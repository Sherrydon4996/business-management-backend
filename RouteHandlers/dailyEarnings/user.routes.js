// src/routes/daily-earnings/dailyEarnings.routes.js

import { Router } from "express";
import { getDailyEarnings } from "../../Controllers/dailyEarnings/dailyEarning.controller.js";

const earningsRouter = Router();

// ─── Routes ───────────────────────────────────────────────────────────────────

// GET /api/v1/daily-earnings/get
// Accessible by any authenticated user (admin or regular)
earningsRouter.get("/get", getDailyEarnings);

export default earningsRouter;
