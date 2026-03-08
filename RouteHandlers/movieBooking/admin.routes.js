// src/routes/movie-bookings/movieBookings.routes.js

import { Router } from "express";
import {
  createBooking,
  deleteBooking,
  updateBooking,
  updateBookingStatus,
} from "../../Controllers/movieBooking/movieBooking.controller.js";

const bookingAdminRouter = Router();

bookingAdminRouter.post(
  "/create",

  createBooking,
);

// PATCH  /api/v1/admin/movie-bookings/status/:id
bookingAdminRouter.patch(
  "/status/:id",

  updateBookingStatus,
);

// PUT    /api/v1/admin/movie-bookings/update/:id
bookingAdminRouter.put(
  "/update/:id",

  updateBooking,
);

// DELETE /api/v1/admin/movie-bookings/delete/:id
bookingAdminRouter.delete(
  "/delete/:id",

  deleteBooking,
);

export default bookingAdminRouter;
