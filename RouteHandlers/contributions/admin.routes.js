// src/routes/contributions/contributions.routes.js

import { Router } from "express";
import {
  createContribution,
  deleteContribution,
  markContributionPaid,
  updateContribution,
} from "../../Controllers/contributions/contributions.controller.js";

const contributionsAdminRouter = Router();

contributionsAdminRouter.post(
  "/create",

  createContribution,
);

// PATCH  /api/v1/admin/contributions/mark-paid/:id
contributionsAdminRouter.patch(
  "/mark-paid/:id",

  markContributionPaid,
);

// PUT    /api/v1/admin/contributions/update/:id
contributionsAdminRouter.put(
  "/update/:id",

  updateContribution,
);

// DELETE /api/v1/admin/contributions/delete/:id
contributionsAdminRouter.delete("/delete/:id", deleteContribution);

export default contributionsAdminRouter;
