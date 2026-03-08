// src/controllers/expenses/expenses.controller.js

import { v4 as uuidv4 } from "uuid";
import { db } from "../../config/db.js";

const VALID_CATEGORIES = [
  "Stock Purchase",
  "Electricity",
  "Internet",
  "Rent",
  "Salary",
  "Equipment",
  "Maintenance",
  "Other",
];

const VALID_PAYMENT_METHODS = ["Cash", "M-Pesa", "Card", "Bank Transfer"];

// ───────────────────────────────────────────────────────────
// GET EXPENSES
// ───────────────────────────────────────────────────────────
export const getExpenses = async (req, res) => {
  try {
    const result = await db.execute(`
      SELECT 
        e.id,
        e.amount,
        e.category,
        e.description,
        e.payment_method,
        u.username AS recorded_by,
        e.date,
        e.created_at
      FROM expenses e
      JOIN users u ON u.id = e.recorded_by
      ORDER BY e.date DESC
    `);

    res.json({
      success: true,
      records: result.rows || [],
    });
  } catch (error) {
    console.error("Error fetching expenses:", error);

    res.status(500).json({
      success: false,
      message: "Failed to fetch expense records",
      error: error.message,
    });
  }
};

// ───────────────────────────────────────────────────────────
// CREATE EXPENSE
// ───────────────────────────────────────────────────────────
export const createExpense = async (req, res) => {
  try {
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
      `INSERT INTO expenses
      (id, amount, category, description, payment_method, recorded_by, date)
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

    const inserted = await db.execute(
      `SELECT 
        e.id,
        e.amount,
        e.category,
        e.description,
        e.payment_method,
        u.username AS recorded_by,
        e.date,
        e.created_at
      FROM expenses e
      JOIN users u ON u.id = e.recorded_by
      WHERE e.id = ?`,
      [id],
    );

    res.status(201).json({
      success: true,
      data: inserted.rows[0],
    });
  } catch (error) {
    console.error("Error creating expense:", error);

    res.status(500).json({
      success: false,
      message: "Failed to create expense record",
      error: error.message,
    });
  }
};

// ───────────────────────────────────────────────────────────
// UPDATE EXPENSE
// ───────────────────────────────────────────────────────────
export const updateExpense = async (req, res) => {
  try {
    const { id } = req.params;
    const { amount, category, description, payment_method, date } = req.body;

    const existing = await db.execute(`SELECT id FROM expenses WHERE id = ?`, [
      id,
    ]);

    if (!existing.rows.length) {
      return res.status(404).json({
        success: false,
        code: "NOT_FOUND",
        message: "Expense record not found",
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
      `UPDATE expenses SET ${fields.join(", ")} WHERE id = ?`,
      values,
    );

    const updated = await db.execute(
      `SELECT 
        e.id,
        e.amount,
        e.category,
        e.description,
        e.payment_method,
        u.username AS recorded_by,
        e.date,
        e.created_at
      FROM expenses e
      JOIN users u ON u.id = e.recorded_by
      WHERE e.id = ?`,
      [id],
    );

    res.json({
      success: true,
      data: updated.rows[0],
    });
  } catch (error) {
    console.error("Error updating expense:", error);

    res.status(500).json({
      success: false,
      message: "Failed to update expense record",
      error: error.message,
    });
  }
};

// ───────────────────────────────────────────────────────────
// DELETE EXPENSE
// ───────────────────────────────────────────────────────────
export const deleteExpense = async (req, res) => {
  try {
    const { id } = req.params;

    const existing = await db.execute(`SELECT id FROM expenses WHERE id = ?`, [
      id,
    ]);

    if (!existing.rows.length) {
      return res.status(404).json({
        success: false,
        code: "NOT_FOUND",
        message: "Expense record not found",
      });
    }

    await db.execute(`DELETE FROM expenses WHERE id = ?`, [id]);

    res.json({
      success: true,
      message: "Expense record deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting expense:", error);

    res.status(500).json({
      success: false,
      message: "Failed to delete expense record",
      error: error.message,
    });
  }
};
