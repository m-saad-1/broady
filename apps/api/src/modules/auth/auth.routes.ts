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

const router = Router();

router.post("/register", registerController);
router.post("/login", loginController);
router.post("/google", googleAuthController);
router.post("/brand-invite/complete", completeBrandInviteController);
router.post("/logout", logoutController);
router.get("/me", requireAuth, meController);

export default router;
