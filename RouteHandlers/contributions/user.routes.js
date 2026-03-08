// src/routes/contributions/contributions.routes.js

import { Router } from "express";
import { getContributions } from "../../Controllers/contributions/contributions.controller.js";

const contributionsUserRouter = Router();

contributionsUserRouter.get("/get", getContributions);

export default contributionsUserRouter;
