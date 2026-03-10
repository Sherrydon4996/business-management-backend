import { Router } from "express";
import { getDebts } from "../../Controllers/debts/debts.controller.js";

const debtsUserRouter = Router();

debtsUserRouter.get("/get", getDebts);

export default debtsUserRouter;
