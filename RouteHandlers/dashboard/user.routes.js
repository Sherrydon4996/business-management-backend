// src/routes/dashboard/dashboard.routes.js

import { Router } from "express";
import { getDashboardStats } from "../../Controllers/dashboard/dashboard.controller.js";

const dashboardRouter = Router();

// GET /api/v1/dashboard/stats
dashboardRouter.get("/get", getDashboardStats);

export default dashboardRouter;
