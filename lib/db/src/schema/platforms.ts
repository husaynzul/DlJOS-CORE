import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const platformsTable = pgTable("platforms", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  category: text("category").notNull(), // social | ads | ecommerce | trading | food | website
  status: text("status").notNull().default("disconnected"), // connected | disconnected | limited
  icon: text("icon").notNull(),
  accountName: text("account_name"),
  lastSync: timestamp("last_sync"),
});

export const insertPlatformSchema = createInsertSchema(platformsTable).omit({ id: true });

export type InsertPlatform = z.infer<typeof insertPlatformSchema>;
export type Platform = typeof platformsTable.$inferSelect;
