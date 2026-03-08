import { Router } from "express";
import {
  createPsGame,
  deletePsGame,
  toggleAvailability,
  updatePsGame,
} from "../../Controllers/PSGames/psGames.controller.js";
import {
  createSession,
  deleteSession,
  markSessionDone,
} from "../../Controllers/computerSessions/computerSessions.controller.js";

const psGamesAdminRouter = Router();

psGamesAdminRouter.post("/create", createPsGame);
psGamesAdminRouter.put("/update/:id", updatePsGame);
psGamesAdminRouter.patch(
  "/availability/:id",

  toggleAvailability,
);
psGamesAdminRouter.delete("/delete/:id", deletePsGame);

// ── Sessions ──────────────────────────────────────────────────────────────────

psGamesAdminRouter.post("/sessions/create", createSession);

psGamesAdminRouter.patch(
  "/sessions/done/:id",

  markSessionDone,
);

psGamesAdminRouter.delete(
  "/sessions/delete/:id",

  deleteSession,
);

export default psGamesAdminRouter;
