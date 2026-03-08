// src/controllers/dashboard/dashboard.controller.js

import { db } from "../../config/db.js";

// ─── GET /api/v1/dashboard/stats/get ─────────────────────────────────────────
//
//  Returns everything the Dashboard UI needs in a single round-trip:
//
//  TODAY:    todayIncome / todayExpenses / todayProfit
//  WEEK:     weekIncome  / weekExpenses  / weekProfit
//  MONTH:    monthIncome / monthExpenses / monthProfit
//  YEAR:     yearIncome  / yearExpenses  / yearProfit
//  CHARTS:   last30Days / incomeByCat / expensesByCat / weeklyComparison
//  TABLE:    recentTransactions (latest 10)

export const getDashboardStats = async (req, res) => {
  try {
    // ── EAT "today" ───────────────────────────────────────────────────────────
    const nowUTC = new Date();
    const eatMs = nowUTC.getTime() + 3 * 3_600_000;
    const eatNow = new Date(eatMs);
    const pad = (n) => String(n).padStart(2, "0");

    const todayKey = `${eatNow.getUTCFullYear()}-${pad(eatNow.getUTCMonth() + 1)}-${pad(eatNow.getUTCDate())}`;

    // ── Week bounds (Mon–Sun) ─────────────────────────────────────────────────
    const dayOfWeek = (eatNow.getUTCDay() + 6) % 7; // Mon=0 … Sun=6
    const weekStartMs = eatMs - dayOfWeek * 86_400_000;
    const weekEndMs = weekStartMs + 6 * 86_400_000;
    const weekStart = fmtDate(new Date(weekStartMs));
    const weekEnd = fmtDate(new Date(weekEndMs));

    // ── Month bounds ──────────────────────────────────────────────────────────
    const monthStart = `${eatNow.getUTCFullYear()}-${pad(eatNow.getUTCMonth() + 1)}-01`;
    const monthEnd = todayKey;

    // ── Year bounds ───────────────────────────────────────────────────────────
    const yearStart = `${eatNow.getUTCFullYear()}-01-01`;
    const yearEnd = todayKey;

    // ── All parallel simple sums ──────────────────────────────────────────────
    const [
      todayInc,
      todayExp,
      weekInc,
      weekExp,
      monthInc,
      monthExp,
      yearInc,
      yearExp,
    ] = await Promise.all([
      sumAmount("income", todayKey, todayKey),
      sumAmount("expenses", todayKey, todayKey),
      sumAmount("income", weekStart, weekEnd),
      sumAmount("expenses", weekStart, weekEnd),
      sumAmount("income", monthStart, monthEnd),
      sumAmount("expenses", monthStart, monthEnd),
      sumAmount("income", yearStart, yearEnd),
      sumAmount("expenses", yearStart, yearEnd),
    ]);

    // ── Last 30 days line chart ────────────────────────────────────────────────
    const thirtyDaysAgo = fmtDate(new Date(eatMs - 29 * 86_400_000));

    const last30Raw = await db.execute(
      `SELECT
         date_key,
         ROUND(SUM(CASE WHEN source = 'income'   THEN amount ELSE 0 END), 2) AS income,
         ROUND(SUM(CASE WHEN source = 'expenses' THEN amount ELSE 0 END), 2) AS expenses
       FROM (
         SELECT 'income'   AS source, amount, SUBSTR(date, 1, 10) AS date_key FROM income
         UNION ALL
         SELECT 'expenses' AS source, amount, SUBSTR(date, 1, 10) AS date_key FROM expenses
       )
       WHERE date_key >= ? AND date_key <= ?
       GROUP BY date_key
       ORDER BY date_key ASC`,
      [thirtyDaysAgo, todayKey],
    );

    const last30Days = (last30Raw.rows || []).map((r) => ({
      date: shortDate(r.date_key),
      income: r.income,
      expenses: r.expenses,
    }));

    // ── Income by category (pie) ──────────────────────────────────────────────
    const incByCatRaw = await db.execute(
      `SELECT category AS name, ROUND(SUM(amount), 2) AS value
       FROM income GROUP BY category ORDER BY value DESC`,
    );

    // ── Expenses by category (pie) ────────────────────────────────────────────
    const expByCatRaw = await db.execute(
      `SELECT category AS name, ROUND(SUM(amount), 2) AS value
       FROM expenses GROUP BY category ORDER BY value DESC`,
    );

    // ── Weekly comparison — last 6 weeks (bar chart) ──────────────────────────
    const weeklyComparison = [];
    for (let w = 5; w >= 0; w--) {
      const wStartMs = weekStartMs - w * 7 * 86_400_000;
      const wEndMs = wStartMs + 6 * 86_400_000;
      const wStart = fmtDate(new Date(wStartMs));
      const wEnd = fmtDate(new Date(wEndMs));
      const label = `W${6 - w}`; // W1 … W6  (W6 = current week)

      const [wInc, wExp] = await Promise.all([
        sumAmount("income", wStart, wEnd),
        sumAmount("expenses", wStart, wEnd),
      ]);
      weeklyComparison.push({ week: label, income: wInc, expenses: wExp });
    }

    // ── Recent 10 transactions ────────────────────────────────────────────────
    const recentRaw = await db.execute(`
      SELECT id, 'income'  AS type, category, description, amount, date FROM income
      UNION ALL
      SELECT id, 'expense' AS type, category, description, amount, date FROM expenses
      ORDER BY date DESC
      LIMIT 10
    `);

    const recentTransactions = (recentRaw.rows || []).map((r) => ({
      id: r.id,
      type: r.type, // 'income' | 'expense'
      category: r.category,
      description: r.description ?? "—",
      amount: r.amount,
      date: r.date,
    }));

    // ── Response ──────────────────────────────────────────────────────────────
    res.json({
      success: true,
      data: {
        // Today
        todayIncome: todayInc,
        todayExpenses: todayExp,
        todayProfit: round(todayInc - todayExp),
        // Week
        weekIncome: weekInc,
        weekExpenses: weekExp,
        weekProfit: round(weekInc - weekExp),
        // Month
        monthIncome: monthInc,
        monthExpenses: monthExp,
        monthProfit: round(monthInc - monthExp),
        // Year
        yearIncome: yearInc,
        yearExpenses: yearExp,
        yearProfit: round(yearInc - yearExp),
        // Charts
        last30Days,
        incomeByCat: incByCatRaw.rows || [],
        expensesByCat: expByCatRaw.rows || [],
        weeklyComparison,
        // Table
        recentTransactions,
      },
    });
  } catch (error) {
    console.error("Error fetching dashboard stats:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch dashboard stats",
      error: error.message,
    });
  }
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function sumAmount(table, from, to) {
  const r = await db.execute(
    `SELECT ROUND(COALESCE(SUM(amount), 0), 2) AS total
     FROM ${table}
     WHERE SUBSTR(date, 1, 10) >= ? AND SUBSTR(date, 1, 10) <= ?`,
    [from, to],
  );
  return r.rows?.[0]?.total ?? 0;
}

function fmtDate(d) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

function shortDate(iso) {
  const d = new Date(iso + "T00:00:00Z");
  return d.toLocaleDateString("en-KE", {
    month: "short",
    day: "2-digit",
    timeZone: "UTC",
  });
}

function round(n) {
  return Math.round(n * 100) / 100;
}
