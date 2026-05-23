import { Router } from "express";
import Anthropic from "@anthropic-ai/sdk";
import { db } from "@workspace/db";
import { conversationsTable, messagesTable, actionCardsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router = Router();

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SYSTEM_PROMPT = `You are DlJiS — an AI Action Operating System. You help users control their digital life through natural language: social media posts, trading orders, ad campaigns, food orders, and e-commerce actions.

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
    const actionCard = JSON.parse(jsonStr);
    return { cleanText, actionCard };
  } catch {
    return { cleanText: text.trim(), actionCard: null };
  }
}

router.post("/ai/conversations/:id/messages", async (req, res) => {
  const convId = parseInt(req.params.id);
  if (isNaN(convId)) { res.status(400).json({ error: "Invalid conversation id" }); return; }

  const { content, model = "claude-sonnet-4-6" } = req.body as { content: string; model?: string };
  if (!content?.trim()) { res.status(400).json({ error: "content required" }); return; }

  const [conv] = await db.select().from(conversationsTable).where(eq(conversationsTable.id, convId));
  if (!conv) { res.status(404).json({ error: "Conversation not found" }); return; }

  // Load recent history (last 20 messages)
  const history = await db
    .select()
    .from(messagesTable)
    .where(eq(messagesTable.conversationId, convId))
    .orderBy(messagesTable.createdAt)
    .limit(20);

  const intent = detectIntent(content);

  // Save user message
  const [userMsg] = await db.insert(messagesTable).values({
    conversationId: convId,
    role: "user",
    content,
    intent,
  }).returning();

  // Build message history for Claude
  const chatMessages: Anthropic.MessageParam[] = [
    ...history.map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    })),
    { role: "user", content },
  ];

  // Set SSE headers
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");

  let fullResponse = "";

  try {
    const stream = anthropic.messages.stream({
      model,
      max_tokens: 8192,
      system: SYSTEM_PROMPT,
      messages: chatMessages,
    });

    for await (const event of stream) {
      if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
        const chunk = event.delta.text;
        fullResponse += chunk;

        // Stream only the text before ACTION_CARD marker
        const markerIdx = fullResponse.indexOf("ACTION_CARD:");
        if (markerIdx === -1) {
          res.write(`data: ${JSON.stringify({ content: chunk })}\n\n`);
        } else {
          // We're past the marker — stop streaming text
        }
      }
    }

    const { cleanText, actionCard } = parseActionCard(fullResponse);

    // Save AI message
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
      conversationId: convId,
      role: "assistant",
      content: cleanText,
      intent,
      actionCardId,
    }).returning();

    await db.update(conversationsTable).set({ updatedAt: new Date() }).where(eq(conversationsTable.id, convId));

    // Send final event with full message + action card
    res.write(`data: ${JSON.stringify({
      done: true,
      userMessage: { ...userMsg, createdAt: userMsg.createdAt.toISOString() },
      aiMessage: { ...aiMsg, createdAt: aiMsg.createdAt.toISOString() },
      actionCard: savedActionCard,
    })}\n\n`);
    res.end();
  } catch (err) {
    req.log.error(err, "AI stream error");
    res.write(`data: ${JSON.stringify({ error: "AI request failed" })}\n\n`);
    res.end();
  }
});

export default router;
