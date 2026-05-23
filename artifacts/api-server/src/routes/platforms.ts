import { Router } from "express";
import { db } from "@workspace/db";
import { platformsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { UpdatePlatformParams, UpdatePlatformBody } from "@workspace/api-zod";

const router = Router();

router.get("/platforms", async (_req, res) => {
  const platforms = await db.select().from(platformsTable);
  res.json(
    platforms.map((p) => ({
      ...p,
      lastSync: p.lastSync ? p.lastSync.toISOString() : null,
    }))
  );
});

router.patch("/platforms/:id", async (req, res) => {
  const params = UpdatePlatformParams.parse({ id: Number(req.params.id) });
  const body = UpdatePlatformBody.parse(req.body);

  const [updated] = await db
    .update(platformsTable)
    .set({
      status: body.status,
      ...(body.accountName ? { accountName: body.accountName } : {}),
      lastSync: new Date(),
    })
    .where(eq(platformsTable.id, params.id))
    .returning();

  if (!updated) {
    res.status(404).json({ error: "Not found" });
    return;
  }

  res.json({ ...updated, lastSync: updated.lastSync ? updated.lastSync.toISOString() : null });
});

export default router;
