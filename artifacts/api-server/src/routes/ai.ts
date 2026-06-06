import { Router } from "express";
import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { Mistral } from "@mistralai/mistralai";
import { CohereClient } from "cohere-ai";
import { db } from "@workspace/db";
import { conversationsTable, messagesTable, actionCardsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router = Router();

// ── Lazy clients ──────────────────────────────────────────────────────────────

function getOpenAI() {
  if (!process.env["OPENAI_API_KEY"]) throw new Error("OPENAI_API_KEY not configured");
  return new OpenAI({ apiKey: process.env["OPENAI_API_KEY"] });
}
function getAnthropic() {
  if (!process.env["ANTHROPIC_API_KEY"]) throw new Error("ANTHROPIC_API_KEY not configured");
  return new Anthropic({ apiKey: process.env["ANTHROPIC_API_KEY"] });
}
function getGemini() {
  if (!process.env["GOOGLE_AI_API_KEY"]) throw new Error("GOOGLE_AI_API_KEY not configured");
  return new GoogleGenerativeAI(process.env["GOOGLE_AI_API_KEY"]);
}
function getDeepSeek() {
  if (!process.env["DEEPSEEK_API_KEY"]) throw new Error("DEEPSEEK_API_KEY not configured");
  return new OpenAI({ apiKey: process.env["DEEPSEEK_API_KEY"], baseURL: "https://api.deepseek.com/v1" });
}
function getGrok() {
  if (!process.env["XAI_API_KEY"]) throw new Error("XAI_API_KEY not configured");
  return new OpenAI({ apiKey: process.env["XAI_API_KEY"], baseURL: "https://api.x.ai/v1" });
}
function getMistral() {
  if (!process.env["MISTRAL_API_KEY"]) throw new Error("MISTRAL_API_KEY not configured");
  return new Mistral({ apiKey: process.env["MISTRAL_API_KEY"] });
}
function getCohere() {
  if (!process.env["COHERE_API_KEY"]) throw new Error("COHERE_API_KEY not configured");
  return new CohereClient({ token: process.env["COHERE_API_KEY"] });
}
function getElevenLabs() {
  if (!process.env["ELEVENLABS_API_KEY"]) throw new Error("ELEVENLABS_API_KEY not configured");
  return process.env["ELEVENLABS_API_KEY"];
}

// ── Model → provider mapping ──────────────────────────────────────────────────

type Provider = "openai" | "anthropic" | "gemini" | "deepseek" | "grok" | "mistral" | "cohere" | "elevenlabs";

const MODEL_MAP: Record<string, { provider: Provider; model: string }> = {
  // OpenAI
  "openai":           { provider: "openai",     model: "gpt-4o" },
  "gpt-4o":          { provider: "openai",     model: "gpt-4o" },
  "gpt-4o-mini":     { provider: "openai",     model: "gpt-4o-mini" },
  "o3-mini":         { provider: "openai",     model: "o3-mini" },
  // Anthropic
  "anthropic":       { provider: "anthropic",  model: "claude-sonnet-4-5" },
  "claude-3-5-sonnet": { provider: "anthropic", model: "claude-sonnet-4-5" },
  "claude-haiku":    { provider: "anthropic",  model: "claude-haiku-4-5" },
  // Google Gemini
  "google-gemini":   { provider: "gemini",     model: "gemini-1.5-flash" },
  "gemini-flash":    { provider: "gemini",     model: "gemini-1.5-flash" },
  "gemini-pro":      { provider: "gemini",     model: "gemini-1.5-pro" },
  // DeepSeek
  "deepseek":        { provider: "deepseek",   model: "deepseek-chat" },
  "deepseek-chat":   { provider: "deepseek",   model: "deepseek-chat" },
  "deepseek-coder":  { provider: "deepseek",   model: "deepseek-coder" },
  // xAI Grok
  "grokai":           { provider: "grok",       model: "grok-2-latest" },
  "grok-2":          { provider: "grok",       model: "grok-2-latest" },
  // Mistral
  "mistral":         { provider: "mistral",    model: "mistral-large-latest" },
  "mistral-large":   { provider: "mistral",    model: "mistral-large-latest" },
  "mistral-small":   { provider: "mistral",    model: "mistral-small-latest" },
  // Cohere
  "cohere":          { provider: "cohere",     model: "command-r-plus" },
  "command-r-plus":  { provider: "cohere",     model: "command-r-plus" },
  "command-r":       { provider: "cohere",     model: "command-r" },
  // ElevenLabs (text only — returns TTS note)
  "elevenlabs":      { provider: "elevenlabs", model: "eleven_multilingual_v2" },
  // Auto — picks best available
  "auto":            { provider: "openai",     model: "gpt-4o-mini" },
};

function resolveModel(modelId: string): { provider: Provider; model: string } {
  if (MODEL_MAP[modelId]) return MODEL_MAP[modelId];
  // Fallback heuristics
  if (modelId.startsWith("gpt") || modelId.startsWith("o1") || modelId.startsWith("o3")) return { provider: "openai", model: modelId };
  if (modelId.startsWith("claude")) return { provider: "anthropic", model: modelId };
  if (modelId.startsWith("gemini")) return { provider: "gemini", model: modelId };
  if (modelId.startsWith("deepseek")) return { provider: "deepseek", model: modelId };
  if (modelId.startsWith("grok")) return { provider: "grok", model: modelId };
  if (modelId.startsWith("mistral") || modelId.startsWith("command")) return { provider: "mistral", model: modelId };
  // Default fallback to OpenAI
  return { provider: "openai", model: "gpt-4o-mini" };
}

// ── System prompt ─────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are DLJOS AI — an AI Operating System that manages 47 platforms across Social Media, Business, E-Commerce, Advertising, Crypto, and Forex.

You are a multi-agent OS, not just a chatbot. You control: social media posting, ad campaigns, trading signals, e-commerce management, content creation, and platform automation.

# CORE RULES
1. NEVER delete any platform, model, or module.
2. ONLY update status (connected / not connected).
3. ALWAYS preserve system structure.
4. If a feature is missing, restore it — do not remove others.
5. ALL actions are state-based, not destructive.
6. NEVER execute anything without user approval.

# PLATFORMS YOU MANAGE
SOCIAL: YouTube, TikTok, Instagram, Facebook, X, LinkedIn, Pinterest, Snapchat, Threads, Telegram, Discord
BUSINESS: Gmail, Outlook, Google Drive, OneDrive, Dropbox, Notion, Slack, Zoom, Google Meet
E-COMMERCE: Shopify, WooCommerce, Amazon, Daraz, Etsy, eBay, Alibaba, AliExpress, Noon, Walmart
ADS: Google Ads, Meta Ads, TikTok Ads, LinkedIn Ads, X Ads, Pinterest Ads
CRYPTO: Binance, Bitget, Bybit, KuCoin, OKX, Coinbase
FOREX/BROKERS: MetaTrader 5, Exness, XM, IC Markets, Pepperstone, HFM

# AI MODELS (always visible)
OpenAI GPT-4o, Anthropic Claude, Google Gemini, DeepSeek, xAI Grok, Mistral, Cohere, ElevenLabs (TTS), Runway (video), Pika (video), Stable Diffusion (image)

# AGENTS
1. Content Agent — scripts, captions, creative copy
2. Marketing Agent — ad strategy, campaign planning
3. Growth Agent — analytics, A/B testing, optimization
4. Trading Agent — forex/crypto signals and analysis
5. Automation Agent — workflows, scheduling, triggers

# RESPONSE FORMAT
Brief, professional response (2-3 sentences max), then if action needed:

ACTION_CARD:
{
  "title": "Short title",
  "platform": "Platform name",
  "intent": "social|ads|trading|ecommerce|content|general",
  "riskLevel": "low|medium|high",
  "estimatedCost": "Free|$X|Variable",
  "details": "Full details of what will happen"
}

RULES: riskLevel=high for trading/financial, medium for ads/store, low for posts/content.
Only include ACTION_CARD when user clearly requests an executable action.
For questions or analysis — respond normally without ACTION_CARD.`;

// ── Streaming functions ───────────────────────────────────────────────────────

function detectIntent(content: string): string {
  const lower = content.toLowerCase();
  if (lower.match(/trade|buy|sell|forex|crypto|bitcoin|btc|eth|binance|bybit|mt5|signal|long|short/)) return "trading";
  if (lower.match(/ads?|campaign|advertis|google ads|meta ads|boost|paid/)) return "ads";
  if (lower.match(/shopify|woocommerce|product|listing|ecommerce|store|inventory/)) return "ecommerce";
  if (lower.match(/instagram|tiktok|youtube|facebook|post|reel|story|upload|tweet|linkedin/)) return "social";
  if (lower.match(/write|script|caption|content|blog|copy|create/)) return "content";
  return "general";
}

function parseActionCard(text: string): { cleanText: string; actionCard: Record<string, string> | null } {
  const marker = "ACTION_CARD:";
  const idx = text.indexOf(marker);
  if (idx === -1) return { cleanText: text.trim(), actionCard: null };
  const cleanText = text.slice(0, idx).trim();
  const jsonStr = text.slice(idx + marker.length).trim();
  try {
    return { cleanText, actionCard: JSON.parse(jsonStr) };
  } catch {
    return { cleanText: text.trim(), actionCard: null };
  }
}

async function streamOpenAICompat(
  client: OpenAI,
  model: string,
  messages: { role: string; content: string }[],
  onChunk: (t: string) => void
): Promise<string> {
  const stream = await client.chat.completions.create({
    model,
    max_tokens: 4096,
    messages: [{ role: "system", content: SYSTEM_PROMPT }, ...messages] as OpenAI.ChatCompletionMessageParam[],
    stream: true,
  });
  let full = "";
  for await (const chunk of stream) {
    const delta = chunk.choices[0]?.delta?.content ?? "";
    if (delta) { full += delta; if (!full.includes("ACTION_CARD:")) onChunk(delta); }
  }
  return full;
}

async function streamAnthropic(
  model: string,
  messages: { role: string; content: string }[],
  onChunk: (t: string) => void
): Promise<string> {
  const client = getAnthropic();
  const stream = client.messages.stream({
    model,
    max_tokens: 4096,
    system: SYSTEM_PROMPT,
    messages: messages as Anthropic.MessageParam[],
  });
  let full = "";
  for await (const event of stream) {
    if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
      const chunk = event.delta.text;
      full += chunk;
      if (!full.includes("ACTION_CARD:")) onChunk(chunk);
    }
  }
  return full;
}

async function streamGemini(
  model: string,
  messages: { role: string; content: string }[],
  onChunk: (t: string) => void
): Promise<string> {
  const client = getGemini();
  const genModel = client.getGenerativeModel({ model, systemInstruction: SYSTEM_PROMPT });
  const history = messages.slice(0, -1).map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));
  const lastMessage = messages[messages.length - 1]?.content ?? "";
  const chat = genModel.startChat({ history });
  const result = await chat.sendMessageStream(lastMessage);
  let full = "";
  for await (const chunk of result.stream) {
    const delta = chunk.text();
    if (delta) { full += delta; if (!full.includes("ACTION_CARD:")) onChunk(delta); }
  }
  return full;
}

async function streamMistral(
  model: string,
  messages: { role: string; content: string }[],
  onChunk: (t: string) => void
): Promise<string> {
  const client = getMistral();
  const stream = await client.chat.stream({
    model,
    maxTokens: 4096,
    messages: [
      { role: "system" as const, content: SYSTEM_PROMPT },
      ...messages.map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
    ],
  });
  let full = "";
  for await (const chunk of stream) {
    const delta = chunk.data?.choices?.[0]?.delta?.content ?? "";
    if (typeof delta === "string" && delta) {
      full += delta;
      if (!full.includes("ACTION_CARD:")) onChunk(delta);
    }
  }
  return full;
}

async function streamCohere(
  model: string,
  messages: { role: string; content: string }[],
  onChunk: (t: string) => void
): Promise<string> {
  const client = getCohere();
  const history = messages.slice(0, -1).map((m) => ({
    role: m.role === "assistant" ? ("CHATBOT" as const) : ("USER" as const),
    message: m.content,
  }));
  const lastMessage = messages[messages.length - 1]?.content ?? "";

  const stream = await client.chatStream({
    model,
    preamble: SYSTEM_PROMPT,
    chatHistory: history,
    message: lastMessage,
  });

  let full = "";
  for await (const event of stream) {
    if (event.eventType === "text-generation") {
      const delta = event.text ?? "";
      if (delta) { full += delta; if (!full.includes("ACTION_CARD:")) onChunk(delta); }
    }
  }
  return full;
}

// ── Route: Status of all AI providers ────────────────────────────────────────

router.get("/ai/status", (_req, res) => {
  res.json({
    openai:     !!process.env["OPENAI_API_KEY"],
    anthropic:  !!process.env["ANTHROPIC_API_KEY"],
    gemini:     !!process.env["GOOGLE_AI_API_KEY"],
    deepseek:   !!process.env["DEEPSEEK_API_KEY"],
    grok:       !!process.env["XAI_API_KEY"],
    mistral:    !!process.env["MISTRAL_API_KEY"],
    cohere:     !!process.env["COHERE_API_KEY"],
    elevenlabs: !!process.env["ELEVENLABS_API_KEY"],
  });
});

// ── Route: Main chat ──────────────────────────────────────────────────────────

router.post("/ai/conversations/:id/messages", async (req, res) => {
  const convId = parseInt(req.params["id"] ?? "");
  if (isNaN(convId)) { res.status(400).json({ error: "Invalid conversation id" }); return; }

  const { content, model = "auto" } = req.body as { content: string; model?: string };
  if (!content?.trim()) { res.status(400).json({ error: "content required" }); return; }

  const intent = detectIntent(content);
  const { provider, model: resolvedModel } = resolveModel(model);

  // DB ops — graceful fallback if DB is down
  let conv: { id: number } | null = null;
  let history: { role: string; content: string }[] = [];
  let userMsg: { id: number; createdAt: Date } | null = null;

  try {
    const [found] = await db.select().from(conversationsTable).where(eq(conversationsTable.id, convId));
    if (!found) { res.status(404).json({ error: "Conversation not found" }); return; }
    conv = found;
    const rows = await db.select().from(messagesTable).where(eq(messagesTable.conversationId, convId)).orderBy(messagesTable.createdAt).limit(20);
    history = rows.map((m) => ({ role: m.role, content: m.content }));
    const [um] = await db.insert(messagesTable).values({ conversationId: convId, role: "user", content, intent }).returning();
    userMsg = um;
  } catch {
    req.log.warn("DB unavailable — running stateless");
    conv = { id: convId };
  }

  const chatMessages = [...history, { role: "user", content }];

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");

  const onChunk = (text: string) => res.write(`data: ${JSON.stringify({ content: text })}\n\n`);

  try {
    let fullResponse = "";

    switch (provider) {
      case "openai":
        fullResponse = await streamOpenAICompat(getOpenAI(), resolvedModel, chatMessages, onChunk);
        break;
      case "anthropic":
        fullResponse = await streamAnthropic(resolvedModel, chatMessages, onChunk);
        break;
      case "gemini":
        fullResponse = await streamGemini(resolvedModel, chatMessages, onChunk);
        break;
      case "deepseek":
        fullResponse = await streamOpenAICompat(getDeepSeek(), resolvedModel, chatMessages, onChunk);
        break;
      case "grok":
        fullResponse = await streamOpenAICompat(getGrok(), resolvedModel, chatMessages, onChunk);
        break;
      case "mistral":
        fullResponse = await streamMistral(resolvedModel, chatMessages, onChunk);
        break;
      case "cohere":
        fullResponse = await streamCohere(resolvedModel, chatMessages, onChunk);
        break;
      case "elevenlabs": {
        const key = getElevenLabs();
        fullResponse = `ElevenLabs TTS is active (key configured ✓). To generate audio, send your script and I'll prepare a TTS action card. ElevenLabs API Key: ${key ? "••••" + key.slice(-4) : "not set"}.`;
        onChunk(fullResponse);
        break;
      }
    }

    const { cleanText, actionCard } = parseActionCard(fullResponse);

    // Save to DB
    let actionCardId: number | null = null;
    let savedActionCard = null;
    let aiMsg: { id: number; createdAt: Date } | null = null;

    try {
      if (actionCard) {
        const [ac] = await db.insert(actionCardsTable).values({
          title: actionCard["title"] ?? "Action",
          platform: actionCard["platform"] ?? "Unknown",
          intent: actionCard["intent"] ?? intent,
          riskLevel: (actionCard["riskLevel"] as "low" | "medium" | "high") ?? "low",
          estimatedCost: actionCard["estimatedCost"] ?? null,
          details: actionCard["details"] ?? "",
          status: "pending",
          conversationId: convId,
        }).returning();
        actionCardId = ac.id;
        savedActionCard = { ...ac, createdAt: ac.createdAt.toISOString(), updatedAt: ac.updatedAt.toISOString() };
      }

      const [am] = await db.insert(messagesTable).values({
        conversationId: convId, role: "assistant", content: cleanText, intent, actionCardId,
      }).returning();
      aiMsg = am;
      await db.update(conversationsTable).set({ updatedAt: new Date() }).where(eq(conversationsTable.id, convId));
    } catch {
      req.log.warn("DB save failed — response still streamed");
    }

    const now = new Date().toISOString();
    res.write(`data: ${JSON.stringify({
      done: true,
      userMessage: userMsg ? { ...userMsg, createdAt: userMsg.createdAt.toISOString() } : { id: Date.now(), role: "user", content, createdAt: now },
      aiMessage: aiMsg ? { ...aiMsg, createdAt: aiMsg.createdAt.toISOString() } : { id: Date.now() + 1, role: "assistant", content: cleanText, createdAt: now },
      actionCard: savedActionCard,
    })}\n\n`);
    res.end();

  } catch (err: unknown) {
    req.log.error(err, "AI stream error");
    const raw = err instanceof Error ? err.message : String(err);
    const friendly = raw.includes("not configured")
      ? `${provider} API key not configured — add it in your Replit Secrets.`
      : raw.includes("429") || raw.includes("quota") || raw.includes("billing")
      ? `${provider} quota exceeded — check your billing/credits.`
      : raw.includes("401") || raw.includes("Unauthorized") || raw.includes("invalid_api_key")
      ? `${provider} API key is invalid — please check it in Replit Secrets.`
      : `${provider} error: ${raw.slice(0, 150)}`;
    res.write(`data: ${JSON.stringify({ error: friendly })}\n\n`);
    res.end();
  }
});

export default router;
