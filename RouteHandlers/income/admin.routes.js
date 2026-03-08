// src/routes/incomeRoutes.js
import { Router } from "express";
import {
  createIncome,
  deleteIncome,
  updateIncome,
} from "../../Controllers/income/income.controller.js";

const incomeAdminRouter = Router();

// DELETE /api/v1/income/delete/:id   — remove an entry
incomeAdminRouter.delete("/delete/:id", deleteIncome);

incomeAdminRouter.post("/create", createIncome);
incomeAdminRouter.put("/update/:id", updateIncome);

export default incomeAdminRouter;
