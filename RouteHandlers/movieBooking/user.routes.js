// src/routes/movie-bookings/movieBookings.routes.js

import { Router } from "express";
import { getBookings } from "../../Controllers/movieBooking/movieBooking.controller.js";

const bookingUserRouter = Router();

bookingUserRouter.get("/get", getBookings);

export default bookingUserRouter;
