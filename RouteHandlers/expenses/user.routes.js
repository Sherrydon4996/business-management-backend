// src/routes/expensesRoutes.js
import { Router } from "express";
import { getExpenses } from "../../Controllers/expenses/expenses.controller.js";

const expenseUserRouter = Router();

// GET    /api/v1/expenses/get
expenseUserRouter.get("/get", getExpenses);

export default expenseUserRouter;
