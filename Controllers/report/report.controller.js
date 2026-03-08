// src/controllers/reports/reports.controller.js

import { db } from "../../config/db.js";

// ─── GET /api/v1/reports/get ──────────────────────────────────────────────────
//
//  Returns everything the Reports page needs in one round-trip:
//
//  • monthIncome    / monthExpenses   — current Kenyan calendar month
//  • incomeByCat    []               — {name, value} for pie chart
//  • expensesByCat  []               — {name, value} for pie chart
//  • last30Days     []               — {date, income, expenses} for line chart
//
//  All date arithmetic uses SUBSTR(date, 1, 10) against stored EAT ISO strings.

export const getReports = async (req, res) => {
  try {
    // ── Kenyan "today" ────────────────────────────────────────────────────────
    const nowUTC = new Date();
    const eatMs = nowUTC.getTime() + 3 * 3_600_000;
    const eatNow = new Date(eatMs);
    const pad = (n) => String(n).padStart(2, "0");

    const curYear = eatNow.getUTCFullYear();
    const curMonthNum = eatNow.getUTCMonth() + 1; // 1-based
    const todayKey = `${curYear}-${pad(curMonthNum)}-${pad(eatNow.getUTCDate())}`;

    const monthStart = `${curYear}-${pad(curMonthNum)}-01`;
    const lastDay = new Date(curYear, curMonthNum, 0).getDate();
    const monthEnd = `${curYear}-${pad(curMonthNum)}-${pad(lastDay)}`;

    // ── 1. Month totals ───────────────────────────────────────────────────────
    const [incTotalRow, expTotalRow] = await Promise.all([
      db.execute(
        `SELECT ROUND(COALESCE(SUM(amount), 0), 2) AS total
         FROM income
         WHERE SUBSTR(date, 1, 10) >= ? AND SUBSTR(date, 1, 10) <= ?`,
        [monthStart, monthEnd],
      ),
      db.execute(
        `SELECT ROUND(COALESCE(SUM(amount), 0), 2) AS total
         FROM expenses
         WHERE SUBSTR(date, 1, 10) >= ? AND SUBSTR(date, 1, 10) <= ?`,
        [monthStart, monthEnd],
      ),
    ]);

    const monthIncome = incTotalRow.rows?.[0]?.total ?? 0;
    const monthExpenses = expTotalRow.rows?.[0]?.total ?? 0;
    const netProfit = Math.round((monthIncome - monthExpenses) * 100) / 100;
    const savingsRate =
      monthIncome > 0
        ? Math.round((netProfit / monthIncome) * 1000) / 10 // one decimal
        : 0;

    // ── 2. Income by category (all time, for a meaningful pie) ───────────────
    const incByCatRaw = await db.execute(`
      SELECT category AS name, ROUND(SUM(amount), 2) AS value
      FROM income
      GROUP BY category
      ORDER BY value DESC
    `);
    const incomeByCat = incByCatRaw.rows || [];

    // ── 3. Expenses by category (all time) ───────────────────────────────────
    const expByCatRaw = await db.execute(`
      SELECT category AS name, ROUND(SUM(amount), 2) AS value
      FROM expenses
      GROUP BY category
      ORDER BY value DESC
    `);
    const expensesByCat = expByCatRaw.rows || [];

    // ── 4. Last 30 days — daily income + expenses for line chart ─────────────
    const thirtyAgoMs = eatMs - 29 * 86_400_000;
    const thirtyAgoKey = fmtDate(new Date(thirtyAgoMs));

    const last30Raw = await db.execute(
      `
      SELECT
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
      ORDER BY date_key ASC
    `,
      [thirtyAgoKey, todayKey],
    );

    // Shape for recharts: { date: "Mar 04", income: 3200, expenses: 1500 }
    const last30Days = (last30Raw.rows || []).map((r) => ({
      date: shortDate(r.date_key),
      income: r.income,
      expenses: r.expenses,
    }));

    // ── Response ──────────────────────────────────────────────────────────────
    res.json({
      success: true,
      data: {
        monthIncome: Math.round(monthIncome),
        monthExpenses: Math.round(monthExpenses),
        netProfit: Math.round(netProfit),
        savingsRate,
        incomeByCat,
        expensesByCat,
        last30Days,
      },
    });
  } catch (error) {
    console.error("Error fetching reports:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch reports data",
      error: error.message,
    });
  }
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(d) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

/** "2026-03-04" → "Mar 04" */
function shortDate(iso) {
  return new Date(iso + "T00:00:00Z").toLocaleDateString("en-KE", {
    month: "short",
    day: "2-digit",
    timeZone: "UTC",
  });
}
