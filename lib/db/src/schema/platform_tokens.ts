import { pgTable, serial, integer, text, timestamp } from "drizzle-orm/pg-core";
import { platformsTable } from "./platforms";

export const platformTokensTable = pgTable("platform_tokens", {
  id: serial("id").primaryKey(),
  platformId: integer("platform_id").notNull().references(() => platformsTable.id, { onDelete: "cascade" }),
  provider: text("provider").notNull(),
  accessToken: text("access_token").notNull(),
  refreshToken: text("refresh_token"),
  expiresAt: timestamp("expires_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type PlatformToken = typeof platformTokensTable.$inferSelect;
