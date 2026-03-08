// src/controllers/computer-sessions/computerSessions.controller.js

import { v4 as uuidv4 } from "uuid";
import { db } from "../../config/db.js";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const getKenyanDateKey = () => {
  const now = new Date();
  const eatMs = now.getTime() + 3 * 3_600_000;
  const eat = new Date(eatMs);
  const pad = (n) => String(n).padStart(2, "0");
  return `${eat.getUTCFullYear()}-${pad(eat.getUTCMonth() + 1)}-${pad(eat.getUTCDate())}`;
};

/** HH:MM 24-hour EAT */
const getKenyanTimeHHMM = () => {
  const now = new Date();
  const eatMs = now.getTime() + 3 * 3_600_000;
  const eat = new Date(eatMs);
  const pad = (n) => String(n).padStart(2, "0");
  return `${pad(eat.getUTCHours())}:${pad(eat.getUTCMinutes())}`;
};

/** Add minutes to a HH:MM string → HH:MM */
const addMinutes = (hhmm, mins) => {
  const [h, m] = hhmm.split(":").map(Number);
  const total = h * 60 + m + mins;
  const pad = (n) => String(n).padStart(2, "0");
  return `${pad(Math.floor(total / 60) % 24)}:${pad(total % 60)}`;
};

// SELECT statement — maps DB columns to clear field names
const SELECT_SESSIONS = `
  SELECT
    id,
    customer_name,
    computer_number,
    amount,
    minutes,
    start_time,
    end_time,
    status,
    date_key,
    created_at
  FROM computer_sessions
  WHERE session_type = 'computer'
`;

// ─── GET /api/v1/computer-sessions/get ───────────────────────────────────────
//  Auto-marks expired sessions as done before returning.

export const getComputerSessions = async (req, res) => {
  try {
    const nowHHMM = getKenyanTimeHHMM();
    const todayKey = getKenyanDateKey();

    // Auto-mark sessions whose end_time has passed as done
    await db.execute(
      `UPDATE computer_sessions
       SET status = 'done'
       WHERE session_type = 'computer'
         AND status = 'active'
         AND date_key = ?
         AND end_time <= ?`,
      [todayKey, nowHHMM],
    );

    const result = await db.execute(
      `${SELECT_SESSIONS} ORDER BY created_at DESC`,
    );

    res.json({ success: true, records: result.rows || [] });
  } catch (error) {
    console.error("Error fetching computer sessions:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch computer sessions",
      error: error.message,
    });
  }
};

// ─── POST /api/v1/admin/computer-sessions/create ─────────────────────────────

export const createComputerSession = async (req, res) => {
  try {
    const { customer_name, computer_number, amount } = req.body;

    if (!customer_name || !computer_number || !amount) {
      return res.status(400).json({
        success: false,
        code: "MISSING_FIELDS",
        message: "customer_name, computer_number, and amount are required",
      });
    }
    if (typeof amount !== "number" || amount <= 0) {
      return res.status(400).json({
        success: false,
        code: "INVALID_AMOUNT",
        message: "amount must be a positive number (1 KES = 1 minute)",
      });
    }
    if (typeof computer_number !== "number" || computer_number < 1) {
      return res.status(400).json({
        success: false,
        code: "INVALID_COMPUTER_NUMBER",
        message: "computer_number must be a positive integer",
      });
    }

    const minutes = amount; // 1 KES = 1 minute
    const startTime = getKenyanTimeHHMM();
    const endTime = addMinutes(startTime, minutes);
    const dateKey = getKenyanDateKey();
    const id = uuidv4();

    await db.execute(
      `INSERT INTO computer_sessions
         (id, customer_name, computer_number, amount, minutes, start_time, end_time, status, date_key, session_type)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'active', ?, 'computer')`,
      [
        id,
        customer_name.trim(),
        computer_number,
        amount,
        minutes,
        startTime,
        endTime,
        dateKey,
      ],
    );

    const inserted = await db.execute(
      `SELECT id, customer_name, computer_number, amount, minutes, start_time, end_time, status, date_key, created_at
       FROM computer_sessions WHERE id = ?`,
      [id],
    );

    res.status(201).json({ success: true, data: inserted.rows[0] });
  } catch (error) {
    console.error("Error creating computer session:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create computer session",
      error: error.message,
    });
  }
};

// ─── PATCH /api/v1/admin/computer-sessions/done/:id ──────────────────────────

export const markComputerSessionDone = async (req, res) => {
  try {
    const { id } = req.params;

    const existing = await db.execute(
      `SELECT id FROM computer_sessions WHERE id = ? AND session_type = 'computer'`,
      [id],
    );
    if (!existing.rows?.length) {
      return res.status(404).json({
        success: false,
        code: "NOT_FOUND",
        message: "Session not found",
      });
    }

    await db.execute(
      `UPDATE computer_sessions SET status = 'done' WHERE id = ?`,
      [id],
    );

    const updated = await db.execute(
      `SELECT id, customer_name, computer_number, amount, minutes, start_time, end_time, status, date_key, created_at
       FROM computer_sessions WHERE id = ?`,
      [id],
    );

    res.json({ success: true, data: updated.rows[0] });
  } catch (error) {
    console.error("Error marking session done:", error);
    res.status(500).json({
      success: false,
      message: "Failed to mark session done",
      error: error.message,
    });
  }
};

// ─── DELETE /api/v1/admin/computer-sessions/delete/:id ───────────────────────

export const deleteComputerSession = async (req, res) => {
  try {
    const { id } = req.params;

    const existing = await db.execute(
      `SELECT id FROM computer_sessions WHERE id = ? AND session_type = 'computer'`,
      [id],
    );
    if (!existing.rows?.length) {
      return res.status(404).json({
        success: false,
        code: "NOT_FOUND",
        message: "Session not found",
      });
    }

    await db.execute(`DELETE FROM computer_sessions WHERE id = ?`, [id]);
    res.json({ success: true, message: "Session deleted" });
  } catch (error) {
    console.error("Error deleting session:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete session",
      error: error.message,
    });
  }
};
