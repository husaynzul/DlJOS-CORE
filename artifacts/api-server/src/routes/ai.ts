import { Router } from "express";
import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { db } from "@workspace/db";
import { conversationsTable, messagesTable, actionCardsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router = Router();

// Lazy-initialised clients — only created if env var is present
function getAnthropic() {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY not set");
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
}
function getOpenAI() {
  if (!process.env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY not set — add it in Settings → API Keys");
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}
function getGemini() {
  if (!process.env.GOOGLE_AI_API_KEY) throw new Error("GOOGLE_AI_API_KEY not set — add it in Settings → API Keys");
  return new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY);
}

type Provider = "anthropic" | "openai" | "gemini";

function getProvider(model: string): Provider {
  if (model.startsWith("gpt") || model.startsWith("o1") || model.startsWith("o3")) return "openai";
  if (model.startsWith("gemini")) return "gemini";
  return "anthropic";
}

const SYSTEM_PROMPT = `You are DlJOS — an AI Action Operating System. You help users control their digital life through natural language: social media posts, trading orders, ad campaigns, food orders, and e-commerce actions.

Your personality: calm, precise, professional. Like a senior operator who knows exactly what they're doing.

When a user requests an action, respond in two parts:
1. A brief, clear explanation of what you understood and what action you will prepare (2-3 sentences max).
2. At the end of your message, if an action should be generated, include a JSON block in this exact format (no extra text after it):

ACTION_CARD:
{
  "title": "Short action title",
  "platform": "Platform name",
  "intent": "action_type",
  "riskLevel": "low|medium|high",
  "estimatedCost": "Free|$X|Variable",
  "details": "Full multi-line details of exactly what will happen"
}

Rules:
- riskLevel is "high" for any trading, financial, or spending action
- riskLevel is "medium" for ad campaigns or store changes
- riskLevel is "low" for social posts, food orders, content creation
- Only include ACTION_CARD if the user is clearly requesting an action to be executed
- For general questions, analysis, or conversation — respond normally without ACTION_CARD
- Never fabricate platform credentials or claim to have executed anything
- Always remind the user that no action runs without their approval`;

function detectIntent(content: string): string {
  const lower = content.toLowerCase();
  if (lower.match(/instagram|tiktok|youtube|facebook|post|reel|story|upload|tweet/)) return "social";
  if (lower.match(/trade|buy|sell|forex|crypto|bitcoin|btc|eth|binance|bybit|mt5|signal|long|short/)) return "trading";
  if (lower.match(/ads?|campaign|advertis|google ads|meta ads|boost|paid/)) return "ads";
  if (lower.match(/shopify|woocommerce|product|listing|ecommerce|store|inventory/)) return "ecommerce";
  if (lower.match(/order|pizza|food|deliver|restaurant|meal|burger|biryani/)) return "food";
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

// ── Streaming helpers (each returns the full response text) ──────────────────

async function streamAnthropic(
  model: string,
  messages: Anthropic.MessageParam[],
  onChunk: (text: string) => void
): Promise<string> {
  const client = getAnthropic();
  const stream = client.messages.stream({ model, max_tokens: 8192, system: SYSTEM_PROMPT, messages });
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

async function streamOpenAI(
  model: string,
  messages: { role: string; content: string }[],
  onChunk: (text: string) => void
): Promise<string> {
  const client = getOpenAI();
  const stream = await client.chat.completions.create({
    model,
    max_tokens: 8192,
    messages: [{ role: "system", content: SYSTEM_PROMPT }, ...messages] as OpenAI.ChatCompletionMessageParam[],
    stream: true,
  });
  let full = "";
  for await (const chunk of stream) {
    const delta = chunk.choices[0]?.delta?.content ?? "";
    if (delta) {
      full += delta;
      if (!full.includes("ACTION_CARD:")) onChunk(delta);
    }
  }
  return full;
}

async function streamGemini(
  model: string,
  messages: { role: string; content: string }[],
  onChunk: (text: string) => void
): Promise<string> {
  const client = getGemini();
  const genModel = client.getGenerativeModel({ model, systemInstruction: SYSTEM_PROMPT });

  // Gemini uses "user"/"model" roles
  const history = messages.slice(0, -1).map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));
  const lastMessage = messages[messages.length - 1].content;

  const chat = genModel.startChat({ history });
  const result = await chat.sendMessageStream(lastMessage);

  let full = "";
  for await (const chunk of result.stream) {
    const delta = chunk.text();
    if (delta) {
      full += delta;
      if (!full.includes("ACTION_CARD:")) onChunk(delta);
    }
  }
  return full;
}

// ── Route ────────────────────────────────────────────────────────────────────

router.post("/ai/conversations/:id/messages", async (req, res) => {
  const convId = parseInt(req.params.id);
  if (isNaN(convId)) { res.status(400).json({ error: "Invalid conversation id" }); return; }

  const { content, model = "gpt-4o-mini" } = req.body as { content: string; model?: string };
  if (!content?.trim()) { res.status(400).json({ error: "content required" }); return; }

  const [conv] = await db.select().from(conversationsTable).where(eq(conversationsTable.id, convId));
  if (!conv) { res.status(404).json({ error: "Conversation not found" }); return; }

  const history = await db
    .select().from(messagesTable)
    .where(eq(messagesTable.conversationId, convId))
    .orderBy(messagesTable.createdAt)
    .limit(20);

  const intent = detectIntent(content);

  const [userMsg] = await db.insert(messagesTable).values({
    conversationId: convId, role: "user", content, intent,
  }).returning();

  const chatMessages = [
    ...history.map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
    { role: "user" as const, content },
  ];

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");

  const provider = getProvider(model);

  const onChunk = (text: string) => {
    res.write(`data: ${JSON.stringify({ content: text })}\n\n`);
  };

  try {
    let fullResponse = "";

    if (provider === "anthropic") {
      fullResponse = await streamAnthropic(model, chatMessages as Anthropic.MessageParam[], onChunk);
    } else if (provider === "openai") {
      fullResponse = await streamOpenAI(model, chatMessages, onChunk);
    } else {
      fullResponse = await streamGemini(model, chatMessages, onChunk);
    }

    const { cleanText, actionCard } = parseActionCard(fullResponse);

    let actionCardId: number | null = null;
    let savedActionCard = null;
    if (actionCard) {
      const [ac] = await db.insert(actionCardsTable).values({
        title: actionCard.title ?? "Action",
        platform: actionCard.platform ?? "Unknown",
        intent: actionCard.intent ?? intent,
        riskLevel: (actionCard.riskLevel as "low" | "medium" | "high") ?? "low",
        estimatedCost: actionCard.estimatedCost ?? null,
        details: actionCard.details ?? "",
        status: "pending",
        conversationId: convId,
      }).returning();
      actionCardId = ac.id;
      savedActionCard = { ...ac, createdAt: ac.createdAt.toISOString(), updatedAt: ac.updatedAt.toISOString() };
    }

    const [aiMsg] = await db.insert(messagesTable).values({
      conversationId: convId, role: "assistant", content: cleanText, intent, actionCardId,
    }).returning();

    await db.update(conversationsTable).set({ updatedAt: new Date() }).where(eq(conversationsTable.id, convId));

    res.write(`data: ${JSON.stringify({
      done: true,
      userMessage: { ...userMsg, createdAt: userMsg.createdAt.toISOString() },
      aiMessage: { ...aiMsg, createdAt: aiMsg.createdAt.toISOString() },
      actionCard: savedActionCard,
    })}\n\n`);
    res.end();

  } catch (err: unknown) {
    req.log.error(err, "AI stream error");
    const message = err instanceof Error ? err.message : "AI request failed";
    // If it's a missing-key error send a helpful message instead of generic fail
    const friendly = message.includes("not set")
      ? message
      : message.includes("429") || message.includes("quota") || message.includes("billing")
      ? `OpenAI quota exceeded — add billing credits at platform.openai.com/account/billing`
      : `${provider.charAt(0).toUpperCase() + provider.slice(1)} error: ${message.slice(0, 120)}`;
    res.write(`data: ${JSON.stringify({ error: friendly })}\n\n`);
    res.end();
  }
});

export default router;
