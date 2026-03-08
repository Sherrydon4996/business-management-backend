import { Router } from "express";
import {
  createMovieInventoryItem,
  deleteMovieInventoryItem,
  updateMovieInventoryItem,
} from "./../../Controllers/moviesInventory/moviesInventory.controller.js";

const moviesInventoryAdminRouter = Router();

moviesInventoryAdminRouter.post(
  "/create",

  createMovieInventoryItem,
);

moviesInventoryAdminRouter.put(
  "/update/:id",

  updateMovieInventoryItem,
);

moviesInventoryAdminRouter.delete(
  "/delete/:id",

  deleteMovieInventoryItem,
);

export default moviesInventoryAdminRouter;
