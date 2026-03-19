import { Router, type IRouter } from "express";
import healthRouter from "./health.js";
import webhookRouter from "./webhook.js";
import messagesRouter from "./messages.js";
import donationsRouter from "./donations.js";

const router: IRouter = Router();

router.use(healthRouter);
router.use(webhookRouter);
router.use(messagesRouter);
router.use(donationsRouter);

export default router;
