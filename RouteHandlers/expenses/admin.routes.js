// src/routes/expensesRoutes.js
import { Router } from "express";
import {
  createExpense,
  deleteExpense,
  updateExpense,
} from "../../Controllers/expenses/expenses.controller.js";

const expenseAdminRouter = Router();

expenseAdminRouter.post("/create", createExpense);

expenseAdminRouter.put("/update/:id", updateExpense);

expenseAdminRouter.delete("/delete/:id", deleteExpense);

export default expenseAdminRouter;
