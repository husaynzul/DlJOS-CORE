import { Router, type IRouter } from "express";
import healthRouter from "./health";
import conversationsRouter from "./conversations";
import actionsRouter from "./actions";
import platformsRouter from "./platforms";
import statsRouter from "./stats";
import aiRouter from "./ai";
import authRouter from "./auth";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(aiRouter);
router.use(conversationsRouter);
router.use(actionsRouter);
router.use(platformsRouter);
router.use(statsRouter);

export default router;
