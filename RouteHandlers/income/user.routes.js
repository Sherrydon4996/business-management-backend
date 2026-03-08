// src/routes/incomeRoutes.js
import { Router } from "express";
import { getIncome } from "../../Controllers/income/income.controller.js";

const incomeUserRouter = Router();
// GET    /api/v1/income/get          — fetch all income records
incomeUserRouter.get("/get", getIncome);
// POST   /api/v1/income/create       — record a new income entry

export default incomeUserRouter;
