// src/controllers/income/income.controller.js

import { v4 as uuidv4 } from "uuid";
import { db } from "../../config/db.js";

const VALID_CATEGORIES = [
  "PS Gaming",
  "Cyber Services",
  "Movie Rentals",
  "other",
];

const VALID_PAYMENT_METHODS = ["Cash", "M-Pesa", "Card", "Bank Transfer"];

// Reusable SELECT — always JOINs users so recorded_by returns a username, not a UUID
const SELECT_INCOME = `
  SELECT
    i.id,
    i.amount,
    i.category,
    i.description,
    i.payment_method,
    u.username AS recorded_by,
    i.date,
    i.created_at
  FROM income i
  JOIN users u ON u.id = i.recorded_by
`;

// ─── GET /api/v1/income/get ───────────────────────────────────────────────────

export const getIncome = async (req, res) => {
  try {
    const result = await db.execute(`${SELECT_INCOME} ORDER BY i.date DESC`);

    res.json({
      success: true,
      records: result.rows || [],
    });
  } catch (error) {
    console.error("Error fetching income:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch income records",
      error: error.message,
    });
  }
};

// ─── POST /api/v1/income/create ───────────────────────────────────────────────

export const createIncome = async (req, res) => {
  try {
    // ✅ Use req.user.id — matches FOREIGN KEY (recorded_by) REFERENCES users(id)
    const recorded_by = req.user?.id;

    if (!recorded_by) {
      return res.status(401).json({
        success: false,
        code: "UNAUTHORIZED",
        message: "User not authenticated",
      });
    }

    const { amount, category, description, payment_method, date } = req.body;

    if (!amount || !category || !payment_method || !date) {
      return res.status(400).json({
        success: false,
        code: "MISSING_FIELDS",
        message: "amount, category, payment_method, and date are required",
      });
    }

    if (typeof amount !== "number" || amount <= 0) {
      return res.status(400).json({
        success: false,
        code: "INVALID_AMOUNT",
        message: "amount must be a positive number",
      });
    }

    if (!VALID_CATEGORIES.includes(category)) {
      return res.status(400).json({
        success: false,
        code: "INVALID_CATEGORY",
        message: `category must be one of: ${VALID_CATEGORIES.join(", ")}`,
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
      `INSERT INTO income (id, amount, category, description, payment_method, recorded_by, date)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        amount,
        category,
        description ?? null,
        payment_method,
        recorded_by,
        date,
      ],
    );

    // ✅ JOIN to return username in the response, not the raw UUID
    const inserted = await db.execute(`${SELECT_INCOME} WHERE i.id = ?`, [id]);

    res.status(201).json({
      success: true,
      data: inserted.rows[0],
    });
  } catch (error) {
    console.error("Error creating income:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create income record",
      error: error.message,
    });
  }
};

// ─── PUT /api/v1/income/update/:id ────────────────────────────────────────────

export const updateIncome = async (req, res) => {
  try {
    const { id } = req.params;
    const { amount, category, description, payment_method, date } = req.body;

    const existing = await db.execute(`SELECT id FROM income WHERE id = ?`, [
      id,
    ]);

    if (!existing.rows || existing.rows.length === 0) {
      return res.status(404).json({
        success: false,
        code: "NOT_FOUND",
        message: "Income record not found",
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

    if (category !== undefined) {
      if (!VALID_CATEGORIES.includes(category)) {
        return res.status(400).json({
          success: false,
          code: "INVALID_CATEGORY",
          message: `category must be one of: ${VALID_CATEGORIES.join(", ")}`,
        });
      }
      fields.push("category = ?");
      values.push(category);
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
      `UPDATE income SET ${fields.join(", ")} WHERE id = ?`,
      values,
    );

    // ✅ JOIN to return username in the response
    const updated = await db.execute(`${SELECT_INCOME} WHERE i.id = ?`, [id]);

    res.json({
      success: true,
      data: updated.rows[0],
    });
  } catch (error) {
    console.error("Error updating income:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update income record",
      error: error.message,
    });
  }
};

// ─── DELETE /api/v1/income/delete/:id ────────────────────────────────────────

export const deleteIncome = async (req, res) => {
  try {
    const { id } = req.params;

    const existing = await db.execute(`SELECT id FROM income WHERE id = ?`, [
      id,
    ]);

    if (!existing.rows || existing.rows.length === 0) {
      return res.status(404).json({
        success: false,
        code: "NOT_FOUND",
        message: "Income record not found",
      });
    }

    await db.execute(`DELETE FROM income WHERE id = ?`, [id]);

    res.json({
      success: true,
      message: "Income record deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting income:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete income record",
      error: error.message,
    });
  }
};
