// src/controllers/movie-bookings/movieBookings.controller.js

import { v4 as uuidv4 } from "uuid";
import { db } from "../../config/db.js";

// ─── Constants ─────────────────────────────────────────────

const VALID_TYPES = ["movie", "series"];

const VALID_STATUSES = ["pending", "active", "delivered", "cancelled"];

// ─── Helpers ──────────────────────────────────────────────

// Current Kenyan date (YYYY-MM-DD)
const getKenyanDateKey = () => {
  const now = new Date();
  const eatMs = now.getTime() + 3 * 3600000;
  const eat = new Date(eatMs);

  const pad = (n) => String(n).padStart(2, "0");

  return `${eat.getUTCFullYear()}-${pad(eat.getUTCMonth() + 1)}-${pad(
    eat.getUTCDate(),
  )}`;
};

// Current Kenyan timestamp
const getNowEAT = () => {
  const now = new Date();
  const eatMs = now.getTime() + now.getTimezoneOffset() * 60000 + 3 * 3600000;

  const eat = new Date(eatMs);

  const pad = (n) => String(n).padStart(2, "0");

  return `${eat.getFullYear()}-${pad(eat.getMonth() + 1)}-${pad(
    eat.getDate(),
  )}T${pad(eat.getHours())}:${pad(eat.getMinutes())}:${pad(
    eat.getSeconds(),
  )}+03:00`;
};

// Cancel bookings whose pick_date already passed
const autoCancelOverdue = async () => {
  const today = getKenyanDateKey();

  await db.execute(
    `UPDATE movie_bookings
     SET status = 'cancelled'
     WHERE status = 'pending'
     AND pick_date < ?`,
    [today],
  );
};

// Base SELECT
const SELECT_BOOKINGS = `
SELECT
  id,
  customer_name,
  customer_phone,
  title,
  type,
  pick_date,
  amount,
  status,
  booked_at,
  created_at
FROM movie_bookings
`;

// ─── GET BOOKINGS ─────────────────────────────────────────

export const getBookings = async (req, res) => {
  try {
    await autoCancelOverdue();

    const result = await db.execute(
      `${SELECT_BOOKINGS} ORDER BY booked_at DESC`,
    );

    res.json({
      success: true,
      records: result.rows || [],
    });
  } catch (error) {
    console.error("Error fetching bookings:", error);

    res.status(500).json({
      success: false,
      message: "Failed to fetch bookings",
      error: error.message,
    });
  }
};

// ─── CREATE BOOKING ───────────────────────────────────────

export const createBooking = async (req, res) => {
  try {
    const { customer_name, customer_phone, title, type, pick_date, amount } =
      req.body;

    if (!customer_name || !title || !type || !pick_date || !amount) {
      return res.status(400).json({
        success: false,
        code: "MISSING_FIELDS",
        message:
          "customer_name, title, type, pick_date and amount are required",
      });
    }

    if (!VALID_TYPES.includes(type)) {
      return res.status(400).json({
        success: false,
        code: "INVALID_TYPE",
        message: `type must be one of: ${VALID_TYPES.join(", ")}`,
      });
    }

    if (typeof amount !== "number" || amount <= 0) {
      return res.status(400).json({
        success: false,
        code: "INVALID_AMOUNT",
        message: "amount must be a positive number",
      });
    }

    const today = getKenyanDateKey();

    let initialStatus;

    if (pick_date < today) {
      initialStatus = "cancelled";
    } else if (pick_date === today) {
      initialStatus = "active";
    } else {
      initialStatus = "pending";
    }

    const id = uuidv4();

    await db.execute(
      `INSERT INTO movie_bookings
      (id, customer_name, customer_phone, title, type, pick_date, amount, status, booked_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        customer_name,
        customer_phone ?? null,
        title,
        type,
        pick_date,
        amount,
        initialStatus,
        getNowEAT(),
      ],
    );

    const inserted = await db.execute(`${SELECT_BOOKINGS} WHERE id = ?`, [id]);

    res.status(201).json({
      success: true,
      data: inserted.rows[0],
    });
  } catch (error) {
    console.error("Error creating booking:", error);

    res.status(500).json({
      success: false,
      message: "Failed to create booking",
      error: error.message,
    });
  }
};

// ─── UPDATE STATUS ────────────────────────────────────────

export const updateBookingStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!VALID_STATUSES.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `status must be one of: ${VALID_STATUSES.join(", ")}`,
      });
    }

    const existing = await db.execute(
      `SELECT id FROM movie_bookings WHERE id = ?`,
      [id],
    );

    if (!existing.rows?.length) {
      return res.status(404).json({
        success: false,
        message: "Booking not found",
      });
    }

    await db.execute(`UPDATE movie_bookings SET status = ? WHERE id = ?`, [
      status,
      id,
    ]);

    const updated = await db.execute(`${SELECT_BOOKINGS} WHERE id = ?`, [id]);

    res.json({
      success: true,
      data: updated.rows[0],
    });
  } catch (error) {
    console.error("Error updating booking status:", error);

    res.status(500).json({
      success: false,
      message: "Failed to update booking status",
      error: error.message,
    });
  }
};

// ─── UPDATE BOOKING ───────────────────────────────────────

export const updateBooking = async (req, res) => {
  try {
    const { id } = req.params;

    const {
      customer_name,
      customer_phone,
      title,
      type,
      pick_date,
      amount,
      status,
    } = req.body;

    const existing = await db.execute(
      `SELECT id FROM movie_bookings WHERE id = ?`,
      [id],
    );

    if (!existing.rows?.length) {
      return res.status(404).json({
        success: false,
        message: "Booking not found",
      });
    }

    const fields = [];
    const values = [];

    if (customer_name !== undefined) {
      fields.push("customer_name = ?");
      values.push(customer_name);
    }

    if (customer_phone !== undefined) {
      fields.push("customer_phone = ?");
      values.push(customer_phone);
    }

    if (title !== undefined) {
      fields.push("title = ?");
      values.push(title);
    }

    if (type !== undefined) {
      if (!VALID_TYPES.includes(type)) {
        return res.status(400).json({
          success: false,
          message: `type must be one of: ${VALID_TYPES.join(", ")}`,
        });
      }

      fields.push("type = ?");
      values.push(type);
    }

    if (pick_date !== undefined) {
      fields.push("pick_date = ?");
      values.push(pick_date);
    }

    if (amount !== undefined) {
      if (typeof amount !== "number" || amount <= 0) {
        return res.status(400).json({
          success: false,
          message: "amount must be positive",
        });
      }

      fields.push("amount = ?");
      values.push(amount);
    }

    if (status !== undefined) {
      if (!VALID_STATUSES.includes(status)) {
        return res.status(400).json({
          success: false,
          message: `status must be one of: ${VALID_STATUSES.join(", ")}`,
        });
      }

      fields.push("status = ?");
      values.push(status);
    }

    if (!fields.length) {
      return res.status(400).json({
        success: false,
        message: "No fields to update",
      });
    }

    values.push(id);

    await db.execute(
      `UPDATE movie_bookings
       SET ${fields.join(", ")}
       WHERE id = ?`,
      values,
    );

    const updated = await db.execute(`${SELECT_BOOKINGS} WHERE id = ?`, [id]);

    res.json({
      success: true,
      data: updated.rows[0],
    });
  } catch (error) {
    console.error("Error updating booking:", error);

    res.status(500).json({
      success: false,
      message: "Failed to update booking",
      error: error.message,
    });
  }
};

// ─── DELETE BOOKING ───────────────────────────────────────

export const deleteBooking = async (req, res) => {
  try {
    const { id } = req.params;

    const existing = await db.execute(
      `SELECT id FROM movie_bookings WHERE id = ?`,
      [id],
    );

    if (!existing.rows?.length) {
      return res.status(404).json({
        success: false,
        message: "Booking not found",
      });
    }

    await db.execute(`DELETE FROM movie_bookings WHERE id = ?`, [id]);

    res.json({
      success: true,
      message: "Booking deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting booking:", error);

    res.status(500).json({
      success: false,
      message: "Failed to delete booking",
      error: error.message,
    });
  }
};
