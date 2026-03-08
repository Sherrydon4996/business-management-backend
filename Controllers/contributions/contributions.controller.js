// src/controllers/contributions/contributions.controller.js

import { v4 as uuidv4 } from "uuid";
import { db } from "../../config/db.js";

// ─── Constants ────────────────────────────────────────────────────────────────

const VALID_TYPES = [
  "weekly_group",
  "cooperative_bank",
  "caritas_bank",
  "custom",
];

const VALID_STATUSES = ["paid", "pending", "overdue"];

const VALID_PAYMENT_METHODS = ["Cash", "M-Pesa", "Card", "Bank Transfer"];

// Reusable SELECT — JOINs users so recorded_by returns username, not UUID
const SELECT_CONTRIBUTIONS = `
  SELECT
    c.id,
    c.amount,
    c.type,
    c.description,
    c.payment_method,
    c.status,
    u.username AS recorded_by,
    c.date,
    c.created_at
  FROM contributions c
  JOIN users u ON u.id = c.recorded_by
`;

// ─── GET /api/v1/contributions/get ───────────────────────────────────────────

export const getContributions = async (req, res) => {
  try {
    const result = await db.execute(
      `${SELECT_CONTRIBUTIONS} ORDER BY c.date DESC`,
    );

    res.json({
      success: true,
      records: result.rows || [],
    });
  } catch (error) {
    console.error("Error fetching contributions:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch contributions",
      error: error.message,
    });
  }
};

// ─── POST /api/v1/admin/contributions/create ─────────────────────────────────

export const createContribution = async (req, res) => {
  try {
    const recorded_by = req.user?.id;

    if (!recorded_by) {
      return res.status(401).json({
        success: false,
        code: "UNAUTHORIZED",
        message: "User not authenticated",
      });
    }

    const { amount, type, description, payment_method, date } = req.body;

    if (!amount || !type || !payment_method || !date) {
      return res.status(400).json({
        success: false,
        code: "MISSING_FIELDS",
        message: "amount, type, payment_method, and date are required",
      });
    }

    if (typeof amount !== "number" || amount <= 0) {
      return res.status(400).json({
        success: false,
        code: "INVALID_AMOUNT",
        message: "amount must be a positive number",
      });
    }

    if (!VALID_TYPES.includes(type)) {
      return res.status(400).json({
        success: false,
        code: "INVALID_TYPE",
        message: `type must be one of: ${VALID_TYPES.join(", ")}`,
      });
    }

    if (!VALID_PAYMENT_METHODS.includes(payment_method)) {
      return res.status(400).json({
        success: false,
        code: "INVALID_PAYMENT_METHOD",
        message: `payment_method must be one of: ${VALID_PAYMENT_METHODS.join(", ")}`,
      });
    }

    const id = uuidv4();

    await db.execute(
      `INSERT INTO contributions (id, amount, type, description, payment_method, status, recorded_by, date)
       VALUES (?, ?, ?, ?, ?, 'paid', ?, ?)`,
      [
        id,
        amount,
        type,
        description ?? null,
        payment_method,
        recorded_by,
        date,
      ],
    );

    const inserted = await db.execute(
      `${SELECT_CONTRIBUTIONS} WHERE c.id = ?`,
      [id],
    );

    res.status(201).json({
      success: true,
      data: inserted.rows[0],
    });
  } catch (error) {
    console.error("Error creating contribution:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create contribution",
      error: error.message,
    });
  }
};

// ─── PATCH /api/v1/admin/contributions/mark-paid/:id ─────────────────────────

export const markContributionPaid = async (req, res) => {
  try {
    const { id } = req.params;

    const existing = await db.execute(
      `SELECT id, status FROM contributions WHERE id = ?`,
      [id],
    );

    if (!existing.rows || existing.rows.length === 0) {
      return res.status(404).json({
        success: false,
        code: "NOT_FOUND",
        message: "Contribution not found",
      });
    }

    if (existing.rows[0].status === "paid") {
      return res.status(400).json({
        success: false,
        code: "ALREADY_PAID",
        message: "Contribution is already marked as paid",
      });
    }

    // Update status and refresh the date to now (EAT) when marking paid
    const { date } = req.body; // client sends current EAT timestamp

    await db.execute(
      `UPDATE contributions SET status = 'paid', date = COALESCE(?, date) WHERE id = ?`,
      [date ?? null, id],
    );

    const updated = await db.execute(`${SELECT_CONTRIBUTIONS} WHERE c.id = ?`, [
      id,
    ]);

    res.json({
      success: true,
      data: updated.rows[0],
    });
  } catch (error) {
    console.error("Error marking contribution paid:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update contribution status",
      error: error.message,
    });
  }
};

// ─── PUT /api/v1/admin/contributions/update/:id ───────────────────────────────

export const updateContribution = async (req, res) => {
  try {
    const { id } = req.params;
    const { amount, type, description, payment_method, status, date } =
      req.body;

    const existing = await db.execute(
      `SELECT id FROM contributions WHERE id = ?`,
      [id],
    );

    if (!existing.rows || existing.rows.length === 0) {
      return res.status(404).json({
        success: false,
        code: "NOT_FOUND",
        message: "Contribution not found",
      });
    }

    const fields = [];
    const values = [];

    if (amount !== undefined) {
      if (typeof amount !== "number" || amount <= 0) {
        return res.status(400).json({
          success: false,
          code: "INVALID_AMOUNT",
          message: "amount must be a positive number",
        });
      }
      fields.push("amount = ?");
      values.push(amount);
    }

    if (type !== undefined) {
      if (!VALID_TYPES.includes(type)) {
        return res.status(400).json({
          success: false,
          code: "INVALID_TYPE",
          message: `type must be one of: ${VALID_TYPES.join(", ")}`,
        });
      }
      fields.push("type = ?");
      values.push(type);
    }

    if (description !== undefined) {
      fields.push("description = ?");
      values.push(description);
    }

    if (payment_method !== undefined) {
      if (!VALID_PAYMENT_METHODS.includes(payment_method)) {
        return res.status(400).json({
          success: false,
          code: "INVALID_PAYMENT_METHOD",
          message: `payment_method must be one of: ${VALID_PAYMENT_METHODS.join(", ")}`,
        });
      }
      fields.push("payment_method = ?");
      values.push(payment_method);
    }

    if (status !== undefined) {
      if (!VALID_STATUSES.includes(status)) {
        return res.status(400).json({
          success: false,
          code: "INVALID_STATUS",
          message: `status must be one of: ${VALID_STATUSES.join(", ")}`,
        });
      }
      fields.push("status = ?");
      values.push(status);
    }

    if (date !== undefined) {
      fields.push("date = ?");
      values.push(date);
    }

    if (fields.length === 0) {
      return res.status(400).json({
        success: false,
        code: "NO_FIELDS",
        message: "No valid fields provided for update",
      });
    }

    values.push(id);

    await db.execute(
      `UPDATE contributions SET ${fields.join(", ")} WHERE id = ?`,
      values,
    );

    const updated = await db.execute(`${SELECT_CONTRIBUTIONS} WHERE c.id = ?`, [
      id,
    ]);

    res.json({
      success: true,
      data: updated.rows[0],
    });
  } catch (error) {
    console.error("Error updating contribution:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update contribution",
      error: error.message,
    });
  }
};

// ─── DELETE /api/v1/admin/contributions/delete/:id ───────────────────────────

export const deleteContribution = async (req, res) => {
  try {
    const { id } = req.params;

    const existing = await db.execute(
      `SELECT id FROM contributions WHERE id = ?`,
      [id],
    );

    if (!existing.rows || existing.rows.length === 0) {
      return res.status(404).json({
        success: false,
        code: "NOT_FOUND",
        message: "Contribution not found",
      });
    }

    await db.execute(`DELETE FROM contributions WHERE id = ?`, [id]);

    res.json({
      success: true,
      message: "Contribution deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting contribution:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete contribution",
      error: error.message,
    });
  }
};
