import { Router } from "express";
import { getComputerSessions } from "../../Controllers/computerSessions/computerSessions.pc.controller.js";

const computerSessionsUserRouter = Router();

computerSessionsUserRouter.get("/get", getComputerSessions);

export default computerSessionsUserRouter;
