import express from "express";
import {
    createDemoAccount,
    getDemoAccounts,
    resetDemoPassword,
    loginAsDemo,
    deleteDemoAccount,
    exitImpersonation,
} from "../controllers/demo.controller.js";
import { isAuthenticated, requireRole } from "../middleware/auth.middleware.js";

const router = express.Router();

// All demo routes require super_admin or org_admin
router.post("/create", isAuthenticated, requireRole("super_admin", "org_admin"), createDemoAccount);
router.get("/list", isAuthenticated, requireRole("super_admin", "org_admin"), getDemoAccounts);
router.post("/:id/reset-password", isAuthenticated, requireRole("super_admin", "org_admin"), resetDemoPassword);
router.post("/:id/login-as", isAuthenticated, requireRole("super_admin", "org_admin"), loginAsDemo);
router.delete("/:id", isAuthenticated, requireRole("super_admin", "org_admin"), deleteDemoAccount);

// Exit impersonation (any authenticated user who is impersonating)
router.post("/exit-impersonation", isAuthenticated, exitImpersonation);

export default router;
