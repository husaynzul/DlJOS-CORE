import { Router } from "express";
import { db } from "@workspace/db";
import {
  conversationsTable,
  messagesTable,
  actionCardsTable,
} from "@workspace/db";
import { eq, desc, sql } from "drizzle-orm";
import {
  CreateConversationBody,
  SendMessageBody,
  SendMessageParams,
  GetConversationParams,
  DeleteConversationParams,
} from "@workspace/api-zod";

const router = Router();

router.get("/conversations", async (req, res) => {
  const conversations = await db
    .select({
      id: conversationsTable.id,
      title: conversationsTable.title,
      createdAt: conversationsTable.createdAt,
      updatedAt: conversationsTable.updatedAt,
      messageCount: sql<number>`(select count(*) from messages where messages.conversation_id = conversations.id)::int`,
      lastMessage: sql<string | null>`(select content from messages where messages.conversation_id = conversations.id order by created_at desc limit 1)`,
    })
    .from(conversationsTable)
    .orderBy(desc(conversationsTable.updatedAt));

  res.json(conversations);
});

router.post("/conversations", async (req, res) => {
  const body = CreateConversationBody.parse(req.body);
  const [conv] = await db
    .insert(conversationsTable)
    .values({ title: body.title })
    .returning();
  res.status(201).json({ ...conv, messageCount: 0, lastMessage: null });
});

router.get("/conversations/:id", async (req, res) => {
  const params = GetConversationParams.parse({ id: Number(req.params.id) });
  const [conv] = await db
    .select()
    .from(conversationsTable)
    .where(eq(conversationsTable.id, params.id));

  if (!conv) {
    res.status(404).json({ error: "Not found" });
    return;
  }

  const messages = await db
    .select()
    .from(messagesTable)
    .where(eq(messagesTable.conversationId, params.id))
    .orderBy(messagesTable.createdAt);

  res.json({
    ...conv,
    messages: messages.map((m) => ({
      ...m,
      createdAt: m.createdAt.toISOString(),
    })),
    createdAt: conv.createdAt.toISOString(),
    updatedAt: conv.updatedAt.toISOString(),
  });
});

router.delete("/conversations/:id", async (req, res) => {
  const params = DeleteConversationParams.parse({ id: Number(req.params.id) });
  await db
    .delete(conversationsTable)
    .where(eq(conversationsTable.id, params.id));
  res.status(204).send();
});

// Detect intent from user message
function detectIntent(content: string): string {
  const lower = content.toLowerCase();
  if (lower.includes("instagram") || lower.includes("tiktok") || lower.includes("youtube") || lower.includes("post") || lower.includes("upload")) return "social";
  if (lower.includes("trade") || lower.includes("buy") || lower.includes("sell") || lower.includes("forex") || lower.includes("crypto") || lower.includes("bitcoin") || lower.includes("binance")) return "trading";
  if (lower.includes("ads") || lower.includes("campaign") || lower.includes("advertis") || lower.includes("google ads") || lower.includes("meta ads")) return "ads";
  if (lower.includes("shopify") || lower.includes("product") || lower.includes("listing") || lower.includes("ecommerce") || lower.includes("store")) return "ecommerce";
  if (lower.includes("order") || lower.includes("pizza") || lower.includes("food") || lower.includes("deliver")) return "food";
  return "general";
}

function buildAIResponse(content: string, intent: string): { text: string; actionCard: { title: string; platform: string; intent: string; riskLevel: "low" | "medium" | "high"; estimatedCost?: string; details: string } | null } {
  const lower = content.toLowerCase();

  if (intent === "social") {
    const platform = lower.includes("instagram") ? "Instagram" : lower.includes("tiktok") ? "TikTok" : lower.includes("youtube") ? "YouTube" : "Instagram";
    return {
      text: `I've prepared a ${platform} action for you. Please review the action card below and confirm before I proceed.`,
      actionCard: {
        title: `Post to ${platform}`,
        platform,
        intent: "social_post",
        riskLevel: "low",
        estimatedCost: "Free",
        details: `Platform: ${platform}\nAction: Create and publish post\nContent: ${content.slice(0, 120)}\nSchedule: Immediately upon approval`,
      },
    };
  }

  if (intent === "trading") {
    const isBuy = lower.includes("buy") || lower.includes("long");
    const isCrypto = lower.includes("bitcoin") || lower.includes("btc") || lower.includes("crypto") || lower.includes("binance");
    const platform = isCrypto ? "Binance" : "MT5";
    return {
      text: `I've analyzed your trading intent. Here's the action plan — please review carefully before approving. Trading carries financial risk.`,
      actionCard: {
        title: `${isBuy ? "Buy" : "Sell"} Order — ${isCrypto ? "Crypto" : "Forex"}`,
        platform,
        intent: "trade_execution",
        riskLevel: "high",
        estimatedCost: "Variable",
        details: `Platform: ${platform}\nAction: ${isBuy ? "Market Buy" : "Market Sell"}\nRequest: ${content.slice(0, 120)}\nStop Loss: Mandatory (calculated at execution)\nRisk per trade: Max 2%`,
      },
    };
  }

  if (intent === "ads") {
    const platform = lower.includes("google") ? "Google Ads" : "Meta Ads";
    return {
      text: `Your ad campaign is ready for review. I'll need your approval before any budget is spent.`,
      actionCard: {
        title: `Launch ${platform} Campaign`,
        platform,
        intent: "ad_campaign",
        riskLevel: "medium",
        estimatedCost: "Budget TBD",
        details: `Platform: ${platform}\nAction: Create and launch campaign\nRequest: ${content.slice(0, 120)}\nAudience: Auto-selected based on campaign goals\nRequires budget confirmation`,
      },
    };
  }

  if (intent === "food") {
    return {
      text: `I found a restaurant matching your order. Here's your order summary — confirm to place it.`,
      actionCard: {
        title: "Place Food Order",
        platform: "Food Delivery",
        intent: "food_order",
        riskLevel: "low",
        estimatedCost: "PKR 2,999 est.",
        details: `Platform: Food Delivery Network\nOrder: ${content.slice(0, 120)}\nDelivery time: 30-45 minutes\nPayment: Card on file`,
      },
    };
  }

  if (intent === "ecommerce") {
    return {
      text: `Here's the e-commerce action I've prepared. Review and approve to proceed.`,
      actionCard: {
        title: "Shopify Store Update",
        platform: "Shopify",
        intent: "ecommerce_update",
        riskLevel: "medium",
        estimatedCost: "Free",
        details: `Platform: Shopify\nAction: Product/store update\nRequest: ${content.slice(0, 120)}`,
      },
    };
  }

  return {
    text: `I understand your request: "${content}". I can help you take action across social media, trading, ads, e-commerce, and food ordering. Could you tell me more specifically what you'd like to do?`,
    actionCard: null,
  };
}

router.post("/conversations/:id/messages", async (req, res) => {
  const params = SendMessageParams.parse({ id: Number(req.params.id) });
  const body = SendMessageBody.parse(req.body);

  const [conv] = await db
    .select()
    .from(conversationsTable)
    .where(eq(conversationsTable.id, params.id));

  if (!conv) {
    res.status(404).json({ error: "Not found" });
    return;
  }

  const intent = detectIntent(body.content);
  const aiResponse = buildAIResponse(body.content, intent);

  const [userMsg] = await db
    .insert(messagesTable)
    .values({
      conversationId: params.id,
      role: "user",
      content: body.content,
      intent,
    })
    .returning();

  let actionCard = null;
  let actionCardId: number | null = null;

  if (aiResponse.actionCard) {
    const [ac] = await db
      .insert(actionCardsTable)
      .values({
        ...aiResponse.actionCard,
        conversationId: params.id,
        status: "pending",
      })
      .returning();
    actionCard = ac;
    actionCardId = ac.id;
  }

  const [aiMsg] = await db
    .insert(messagesTable)
    .values({
      conversationId: params.id,
      role: "assistant",
      content: aiResponse.text,
      intent,
      actionCardId,
    })
    .returning();

  await db
    .update(conversationsTable)
    .set({ updatedAt: new Date() })
    .where(eq(conversationsTable.id, params.id));

  res.status(201).json({
    userMessage: { ...userMsg, createdAt: userMsg.createdAt.toISOString() },
    aiMessage: { ...aiMsg, createdAt: aiMsg.createdAt.toISOString() },
    actionCard: actionCard
      ? {
          ...actionCard,
          createdAt: actionCard.createdAt.toISOString(),
          updatedAt: actionCard.updatedAt.toISOString(),
        }
      : undefined,
  });
});

export default router;
