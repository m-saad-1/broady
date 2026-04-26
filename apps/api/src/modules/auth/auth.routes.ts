import { Router } from "express";
import {
  completeBrandInviteController,
  googleAuthController,
  loginController,
  logoutController,
  meController,
  registerController,
} from "./auth.controller.js";
import { requireAuth } from "../../middleware/auth.js";
import { createIpRateLimiter } from "../../middleware/rate-limit.js";

const router = Router();
const authBurstLimiter = createIpRateLimiter("auth-burst", 60_000, 20);
const authCredentialLimiter = createIpRateLimiter("auth-credentials", 5 * 60_000, 12);

router.post("/register", authBurstLimiter, authCredentialLimiter, registerController);
router.post("/login", authBurstLimiter, authCredentialLimiter, loginController);
router.post("/google", authBurstLimiter, googleAuthController);
router.post("/brand-invite/complete", authBurstLimiter, authCredentialLimiter, completeBrandInviteController);
router.post("/logout", logoutController);
router.get("/me", requireAuth, meController);

export default router;
