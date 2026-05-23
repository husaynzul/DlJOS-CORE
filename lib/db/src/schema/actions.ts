import { pgTable, serial, text, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const actionCardsTable = pgTable("action_cards", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  platform: text("platform").notNull(),
  intent: text("intent").notNull(),
  status: text("status").notNull().default("pending"),
  riskLevel: text("risk_level").notNull().default("low"),
  estimatedCost: text("estimated_cost"),
  details: text("details").notNull(),
  preview: text("preview"),
  conversationId: integer("conversation_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertActionCardSchema = createInsertSchema(actionCardsTable).omit({ id: true, createdAt: true, updatedAt: true });

export type InsertActionCard = z.infer<typeof insertActionCardSchema>;
export type ActionCard = typeof actionCardsTable.$inferSelect;
