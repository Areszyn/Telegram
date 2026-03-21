import { Router, type IRouter } from "express";
import healthRouter from "./health.js";
import webhookRouter from "./webhook.js";
import messagesRouter from "./messages.js";
import donationsRouter from "./donations.js";
import moderationRouter from "./moderation.js";
import botAdminRouter from "./bot-admin.js";
import sessionsRouter from "./sessions.js";
import spamRouter from "./spam.js";
import videoRouter from "./video.js";
import privacyRouter from "./privacy.js";

const router: IRouter = Router();

router.use(healthRouter);
router.use(webhookRouter);
router.use(messagesRouter);
router.use(donationsRouter);
router.use(moderationRouter);
router.use(botAdminRouter);
router.use(sessionsRouter);
router.use(spamRouter);
router.use(videoRouter);
router.use(privacyRouter);

export default router;
