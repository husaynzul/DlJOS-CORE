import { Router } from "express";
import { db } from "@workspace/db";
import { actionCardsTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import {
  ListActionsQueryParams,
  CreateActionBody,
  GetActionParams,
  UpdateActionStatusParams,
  UpdateActionStatusBody,
} from "@workspace/api-zod";

const router = Router();

router.get("/actions/pending-count", async (_req, res) => {
  const actions = await db
    .select()
    .from(actionCardsTable)
    .where(eq(actionCardsTable.status, "pending"));
  res.json({ count: actions.length });
});

router.get("/actions", async (req, res) => {
  const query = ListActionsQueryParams.parse(req.query);

  let actions;
  if (query.status) {
    actions = await db
      .select()
      .from(actionCardsTable)
      .where(eq(actionCardsTable.status, query.status))
      .orderBy(desc(actionCardsTable.createdAt));
  } else {
    actions = await db
      .select()
      .from(actionCardsTable)
      .orderBy(desc(actionCardsTable.createdAt));
  }

  res.json(
    actions.map((a) => ({
      ...a,
      createdAt: a.createdAt.toISOString(),
      updatedAt: a.updatedAt.toISOString(),
    }))
  );
});

router.post("/actions", async (req, res) => {
  const body = CreateActionBody.parse(req.body);
  const [action] = await db
    .insert(actionCardsTable)
    .values({ ...body, status: "pending" })
    .returning();
  res.status(201).json({
    ...action,
    createdAt: action.createdAt.toISOString(),
    updatedAt: action.updatedAt.toISOString(),
  });
});

router.get("/actions/:id", async (req, res) => {
  const params = GetActionParams.parse({ id: Number(req.params.id) });
  const [action] = await db
    .select()
    .from(actionCardsTable)
    .where(eq(actionCardsTable.id, params.id));

  if (!action) {
    res.status(404).json({ error: "Not found" });
    return;
  }

  res.json({
    ...action,
    createdAt: action.createdAt.toISOString(),
    updatedAt: action.updatedAt.toISOString(),
  });
});

router.patch("/actions/:id", async (req, res) => {
  const params = UpdateActionStatusParams.parse({ id: Number(req.params.id) });
  const body = UpdateActionStatusBody.parse(req.body);

  const updateData: { status: string; details?: string; updatedAt: Date } = {
    status: body.status,
    updatedAt: new Date(),
  };

  if (body.modifiedDetails) {
    updateData.details = body.modifiedDetails;
  }

  const [updated] = await db
    .update(actionCardsTable)
    .set(updateData)
    .where(eq(actionCardsTable.id, params.id))
    .returning();

  if (!updated) {
    res.status(404).json({ error: "Not found" });
    return;
  }

  res.json({
    ...updated,
    createdAt: updated.createdAt.toISOString(),
    updatedAt: updated.updatedAt.toISOString(),
  });
});

export default router;
