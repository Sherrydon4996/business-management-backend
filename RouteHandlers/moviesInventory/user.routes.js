import { Router } from "express";
import { getMoviesInventory } from "../../Controllers/moviesInventory/moviesInventory.controller.js";

const moviesInventoryUserRouter = Router();

moviesInventoryUserRouter.get("/get", getMoviesInventory);

export default moviesInventoryUserRouter;
