import { Router } from "express";
import {
  createComputerSession,
  deleteComputerSession,
  markComputerSessionDone,
} from "../../Controllers/computerSessions/computerSessions.pc.controller.js";

const computerSessionsAdminRouter = Router();

computerSessionsAdminRouter.post("/create", createComputerSession);

computerSessionsAdminRouter.patch(
  "/done/:id",

  markComputerSessionDone,
);

computerSessionsAdminRouter.delete(
  "/delete/:id",

  deleteComputerSession,
);

export default computerSessionsAdminRouter;
