import { Router } from "express";
import { db } from "@workspace/db";
import { actionCardsTable, platformsTable } from "@workspace/db";
import { eq, gte, desc } from "drizzle-orm";

const router = Router();

router.get("/stats/summary", async (_req, res) => {
  const allActions = await db.select().from(actionCardsTable);
  const allPlatforms = await db.select().from(platformsTable);

  const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const recentActions = await db
    .select()
    .from(actionCardsTable)
    .where(gte(actionCardsTable.createdAt, oneWeekAgo))
    .orderBy(desc(actionCardsTable.createdAt))
    .limit(5);

  const pendingActions = allActions.filter((a) => a.status === "pending").length;
  const completedActions = allActions.filter((a) => a.status === "completed").length;
  const connectedPlatforms = allPlatforms.filter((p) => p.status === "connected").length;

  res.json({
    totalActions: allActions.length,
    pendingActions,
    completedActions,
    connectedPlatforms,
    actionsThisWeek: recentActions.length,
    recentActivity: recentActions.map((a) => ({
      ...a,
      createdAt: a.createdAt.toISOString(),
      updatedAt: a.updatedAt.toISOString(),
    })),
  });
});

export default router;
