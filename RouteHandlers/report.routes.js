// src/routes/reports/reports.routes.js

import { Router } from "express";
import { getReports } from "../Controllers/report/report.controller.js";

const reportsRouter = Router();

// GET /api/v1/reports/get
reportsRouter.get("/get", getReports);

export default reportsRouter;
