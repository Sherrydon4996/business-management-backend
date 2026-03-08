// src/routes/weekly-summary/weeklySummary.routes.js

import { Router } from "express";
import { getWeeklySummary } from "../../Controllers/weeklySummary/summary.controller.js";

const summaryRouter = Router();

// GET /api/v1/weekly-summary/get?month=2&year=2026
summaryRouter.get("/get", getWeeklySummary);

export default summaryRouter;
