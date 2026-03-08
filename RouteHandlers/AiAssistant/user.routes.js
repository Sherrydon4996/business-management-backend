import { Router } from "express";
import {
  chat,
  clearHistory,
  getHistory,
} from "../../Controllers/aiHelper/AIAssistant.controller.js";

const aiUserRouter = Router();

aiUserRouter.post("/chat", chat);

aiUserRouter.get("/history", getHistory);

aiUserRouter.delete("/clear", clearHistory);

export default aiUserRouter;
