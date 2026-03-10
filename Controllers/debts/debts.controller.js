// src/controllers/debts/debts.controller.js
//
// Endpoints:
//   GET    /api/v1/debts/get                  — list all debts (filters: status, category, year)
//   POST   /api/v1/admin/debts/create         — record a new debt
//   PUT    /api/v1/admin/debts/update/:id     — edit customer/amount/description/payment_method
//   DELETE /api/v1/admin/debts/delete/:id     — delete a debt record
//   PATCH  /api/v1/admin/debts/settle/:id     — partial or full settlement
//                                               → auto-posts income row on settlement
//   PATCH  /api/v1/admin/debts/default/:id    — toggle 'defaulted' / back to prior status

import { v4 as uuidv4 } from "uuid";
import { db } from "../../config/db.js";

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Current EAT ISO timestamp: 2026-03-09T14:30:00+03:00 */
function getNowEAT() {
  const now = new Date();
  const eatMs = now.getTime() + 3 * 3_600_000;
  const d = new Date(eatMs);
  const pad = (n) => String(n).padStart(2, "0");
  return (
    `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}` +
    `T${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}+03:00`
  );
}

/** Derive debt status from settled amount vs total amount */
function deriveStatus(amount, amountSettled) {
  if (amountSettled <= 0) return "pending";
  if (amountSettled >= amount) return "settled";
  return "partial";
}

// ─── GET /api/v1/debts/get ────────────────────────────────────────────────────
// Query params: status, category, year
// Returns summary totals + list of debts with recorded_by username.

export const getDebts = async (req, res) => {
  try {
    const { status, category, year } = req.query;

    const conditions = [];
    const params = [];

    if (status && status !== "all") {
      conditions.push(`d.status = ?`);
      params.push(status);
    }
    if (category && category !== "all") {
      conditions.push(`d.income_category = ?`);
      params.push(category);
    }
    if (year) {
      conditions.push(`SUBSTR(d.date, 1, 4) = ?`);
      params.push(year);
    }

    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

    const debtsRaw = await db.execute(
      `SELECT
         d.id,
         d.customer_name,
         d.customer_phone,
         d.amount,
         d.amount_settled,
         ROUND(d.amount - d.amount_settled, 2) AS balance,
         d.income_category,
         d.description,
         d.payment_method,
         d.status,
         d.date,
         d.settled_at,
         d.created_at,
         u.username AS recorded_by
       FROM debts d
       LEFT JOIN users u ON d.recorded_by = u.id
       ${where}
       ORDER BY
         CASE d.status
           WHEN 'defaulted' THEN 1
           WHEN 'pending'   THEN 2
           WHEN 'partial'   THEN 3
           WHEN 'settled'   THEN 4
           ELSE 5
         END,
         d.date DESC`,
      params,
    );

    // ── Summary totals (respecting same filters) ──────────────────────────────
    const totalRaw = await db.execute(
      `SELECT
         ROUND(SUM(amount), 2)          AS total_owed,
         ROUND(SUM(amount_settled), 2)  AS total_collected,
         ROUND(SUM(amount - amount_settled), 2) AS total_outstanding,
         COUNT(*) AS total_count,
         SUM(CASE WHEN status = 'pending'   THEN 1 ELSE 0 END) AS pending_count,
         SUM(CASE WHEN status = 'partial'   THEN 1 ELSE 0 END) AS partial_count,
         SUM(CASE WHEN status = 'settled'   THEN 1 ELSE 0 END) AS settled_count,
         SUM(CASE WHEN status = 'defaulted' THEN 1 ELSE 0 END) AS defaulted_count
       FROM debts d
       ${where}`,
      params,
    );

    res.json({
      success: true,
      summary: totalRaw.rows?.[0] ?? {},
      data: debtsRaw.rows ?? [],
    });
  } catch (error) {
    console.error("getDebts error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch debts",
      error: error.message,
    });
  }
};

// ─── POST /api/v1/admin/debts/create ─────────────────────────────────────────

export const createDebt = async (req, res) => {
  try {
    const {
      customer_name,
      customer_phone,
      amount,
      income_category,
      description,
      payment_method = "Cash",
      date,
    } = req.body;

    if (!customer_name?.trim())
      return res
        .status(400)
        .json({ success: false, message: "customer_name is required" });
    if (!amount || Number(amount) <= 0)
      return res
        .status(400)
        .json({ success: false, message: "amount must be > 0" });
    if (!income_category)
      return res
        .status(400)
        .json({ success: false, message: "income_category is required" });

    const validCategories = ["PS Gaming", "Cyber Services", "Movie Rentals"];
    if (!validCategories.includes(income_category)) {
      return res.status(400).json({
        success: false,
        message: `income_category must be one of: ${validCategories.join(", ")}`,
      });
    }

    const id = uuidv4();
    const now = getNowEAT();

    await db.execute(
      `INSERT INTO debts
         (id, customer_name, customer_phone, amount, amount_settled, income_category,
          description, payment_method, status, recorded_by, date, created_at)
       VALUES (?, ?, ?, ?, 0, ?, ?, ?, 'pending', ?, ?, ?)`,
      [
        id,
        customer_name.trim(),
        customer_phone?.trim() ?? null,
        Number(amount),
        income_category,
        description?.trim() ?? null,
        payment_method,
        req.user.id,
        date || now,
        now,
      ],
    );

    const row = await db.execute(
      `
      SELECT d.*, u.username AS recorded_by
      FROM debts d LEFT JOIN users u ON d.recorded_by = u.id
      WHERE d.id = ?`,
      [id],
    );

    res.status(201).json({ success: true, data: row.rows?.[0] ?? {} });
  } catch (error) {
    console.error("createDebt error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create debt",
      error: error.message,
    });
  }
};

// ─── PUT /api/v1/admin/debts/update/:id ──────────────────────────────────────
// Edit editable fields: customer_name, customer_phone, description,
// payment_method, income_category, date.
// amount is only editable if status is still 'pending' (no payments yet).

export const updateDebt = async (req, res) => {
  try {
    const { id } = req.params;

    const existing = await db.execute(`SELECT * FROM debts WHERE id = ?`, [id]);
    if (!existing.rows?.length) {
      return res
        .status(404)
        .json({ success: false, message: "Debt not found" });
    }
    const debt = existing.rows[0];

    if (debt.status === "defaulted") {
      return res.status(400).json({
        success: false,
        message: "Cannot edit a defaulted debt. Remove the default flag first.",
      });
    }

    const {
      customer_name = debt.customer_name,
      customer_phone = debt.customer_phone,
      description = debt.description,
      payment_method = debt.payment_method,
      income_category = debt.income_category,
      date = debt.date,
      amount, // only allowed if status = 'pending'
    } = req.body;

    let newAmount = debt.amount;
    if (amount !== undefined) {
      if (debt.status !== "pending") {
        return res.status(400).json({
          success: false,
          message: "Cannot change amount after a payment has been made",
        });
      }
      if (Number(amount) <= 0) {
        return res
          .status(400)
          .json({ success: false, message: "amount must be > 0" });
      }
      newAmount = Number(amount);
    }

    const validCategories = ["PS Gaming", "Cyber Services", "Movie Rentals"];
    if (!validCategories.includes(income_category)) {
      return res.status(400).json({
        success: false,
        message: `income_category must be one of: ${validCategories.join(", ")}`,
      });
    }

    await db.execute(
      `UPDATE debts
       SET customer_name   = ?,
           customer_phone  = ?,
           amount          = ?,
           description     = ?,
           payment_method  = ?,
           income_category = ?,
           date            = ?
       WHERE id = ?`,
      [
        customer_name.trim(),
        customer_phone?.trim() ?? null,
        newAmount,
        description?.trim() ?? null,
        payment_method,
        income_category,
        date,
        id,
      ],
    );

    const row = await db.execute(
      `SELECT d.*, u.username AS recorded_by,
              ROUND(d.amount - d.amount_settled, 2) AS balance
       FROM debts d LEFT JOIN users u ON d.recorded_by = u.id
       WHERE d.id = ?`,
      [id],
    );

    res.json({ success: true, data: row.rows?.[0] ?? {} });
  } catch (error) {
    console.error("updateDebt error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update debt",
      error: error.message,
    });
  }
};

// ─── DELETE /api/v1/admin/debts/delete/:id ───────────────────────────────────

export const deleteDebt = async (req, res) => {
  try {
    const { id } = req.params;
    const existing = await db.execute(`SELECT id FROM debts WHERE id = ?`, [
      id,
    ]);
    if (!existing.rows?.length) {
      return res
        .status(404)
        .json({ success: false, message: "Debt not found" });
    }
    await db.execute(`DELETE FROM debts WHERE id = ?`, [id]);
    res.json({ success: true, message: "Debt deleted" });
  } catch (error) {
    console.error("deleteDebt error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete debt",
      error: error.message,
    });
  }
};

// ─── PATCH /api/v1/admin/debts/settle/:id ────────────────────────────────────
// Body: { settle_amount: number }  — can be partial or full
//       { settle_all: true }       — settles the entire remaining balance
//
// On settlement:
//   1. Adds settle_amount to amount_settled
//   2. Derives new status (partial / settled)
//   3. Auto-inserts an income row for income_category with the settled amount

export const settleDebt = async (req, res) => {
  try {
    const { id } = req.params;
    const { settle_amount, settle_all } = req.body;

    const existing = await db.execute(`SELECT * FROM debts WHERE id = ?`, [id]);
    if (!existing.rows?.length) {
      return res
        .status(404)
        .json({ success: false, message: "Debt not found" });
    }
    const debt = existing.rows[0];

    if (debt.status === "settled") {
      return res
        .status(400)
        .json({ success: false, message: "Debt is already fully settled" });
    }
    if (debt.status === "defaulted") {
      return res.status(400).json({
        success: false,
        message:
          "Cannot settle a defaulted debt. Remove the default flag first.",
      });
    }

    const balance = debt.amount - debt.amount_settled;

    let toSettle;
    if (settle_all) {
      toSettle = balance;
    } else {
      toSettle = Number(settle_amount);
      if (!toSettle || toSettle <= 0) {
        return res
          .status(400)
          .json({ success: false, message: "settle_amount must be > 0" });
      }
      if (toSettle > balance) {
        return res.status(400).json({
          success: false,
          message: `settle_amount (${toSettle}) exceeds outstanding balance (${balance})`,
        });
      }
    }

    const newSettled = Math.round((debt.amount_settled + toSettle) * 100) / 100;
    const newStatus = deriveStatus(debt.amount, newSettled);
    const now = getNowEAT();
    const settledAt = newStatus === "settled" ? now : debt.settled_at;

    // 1. Update the debt row
    await db.execute(
      `UPDATE debts
       SET amount_settled = ?,
           status         = ?,
           settled_at     = ?
       WHERE id = ?`,
      [newSettled, newStatus, settledAt, id],
    );

    // 2. Auto-post income row for the settled amount
    const incomeId = uuidv4();
    const incomeDesc = `Debt settlement — ${debt.customer_name}${debt.description ? `: ${debt.description}` : ""}`;

    await db.execute(
      `INSERT INTO income
         (id, amount, category, description, payment_method, recorded_by, date, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        incomeId,
        toSettle,
        debt.income_category,
        incomeDesc,
        debt.payment_method,
        req.user.id,
        now,
        now,
      ],
    );

    const row = await db.execute(
      `SELECT d.*, u.username AS recorded_by,
              ROUND(d.amount - d.amount_settled, 2) AS balance
       FROM debts d LEFT JOIN users u ON d.recorded_by = u.id
       WHERE d.id = ?`,
      [id],
    );

    res.json({
      success: true,
      data: row.rows?.[0] ?? {},
      settled: toSettle,
      income_posted: true,
      income_category: debt.income_category,
    });
  } catch (error) {
    console.error("settleDebt error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to settle debt",
      error: error.message,
    });
  }
};

// ─── PATCH /api/v1/admin/debts/default/:id ───────────────────────────────────
// Toggles the debt between 'defaulted' and its previous active status.
// A defaulted debt's row turns red in the UI and is excluded from collections.

export const toggleDefault = async (req, res) => {
  try {
    const { id } = req.params;

    const existing = await db.execute(`SELECT * FROM debts WHERE id = ?`, [id]);
    if (!existing.rows?.length) {
      return res
        .status(404)
        .json({ success: false, message: "Debt not found" });
    }
    const debt = existing.rows[0];

    let newStatus;
    if (debt.status === "defaulted") {
      // Revert to the correct status based on amounts
      newStatus = deriveStatus(debt.amount, debt.amount_settled);
    } else {
      if (debt.status === "settled") {
        return res.status(400).json({
          success: false,
          message: "Cannot default a fully settled debt",
        });
      }
      newStatus = "defaulted";
    }

    await db.execute(`UPDATE debts SET status = ? WHERE id = ?`, [
      newStatus,
      id,
    ]);

    const row = await db.execute(
      `SELECT d.*, u.username AS recorded_by,
              ROUND(d.amount - d.amount_settled, 2) AS balance
       FROM debts d LEFT JOIN users u ON d.recorded_by = u.id
       WHERE d.id = ?`,
      [id],
    );

    res.json({ success: true, data: row.rows?.[0] ?? {}, newStatus });
  } catch (error) {
    console.error("toggleDefault error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to toggle default",
      error: error.message,
    });
  }
};
