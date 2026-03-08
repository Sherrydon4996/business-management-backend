import { Router } from "express";
import { getSessions } from "./../../Controllers/computerSessions/computerSessions.controller.js";
import { getPsGames } from "./../../Controllers/PSGames/psGames.controller.js";

const psGamesUserRouter = Router();

psGamesUserRouter.get("/get", getPsGames);

// ── Sessions ──────────────────────────────────────────────────────────────────

psGamesUserRouter.get("/sessions/get", getSessions);

export default psGamesUserRouter;
