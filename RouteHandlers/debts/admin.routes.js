import { Router } from "express";
import {
  createDebt,
  deleteDebt,
  settleDebt,
  toggleDefault,
  updateDebt,
} from "../../Controllers/debts/debts.controller.js";

const debtsAdminRouter = Router();

// ── Write (admin only) ────────────────────────────────────────────────────────
debtsAdminRouter.post("/create", createDebt);
debtsAdminRouter.put("/update/:id", updateDebt);
debtsAdminRouter.delete("/delete/:id", deleteDebt);
debtsAdminRouter.patch("/settle/:id", settleDebt);
debtsAdminRouter.patch("/default/:id", toggleDefault);

export default debtsAdminRouter;
