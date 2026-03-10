// src/controllers/dashboard/dashboard.controller.js

import { db } from "../../config/db.js";

export const getDashboardStats = async (req, res) => {
  try {
    const nowUTC = new Date();
    const eatMs = nowUTC.getTime() + 3 * 3_600_000;
    const eatNow = new Date(eatMs);
    const pad = (n) => String(n).padStart(2, "0");

    const todayKey = `${eatNow.getUTCFullYear()}-${pad(eatNow.getUTCMonth() + 1)}-${pad(eatNow.getUTCDate())}`;
    const dayOfWeek = (eatNow.getUTCDay() + 6) % 7;
    const weekStartMs = eatMs - dayOfWeek * 86_400_000;
    const weekEndMs = weekStartMs + 6 * 86_400_000;
    const weekStart = fmtDate(new Date(weekStartMs));
    const weekEnd = fmtDate(new Date(weekEndMs));
    const monthStart = `${eatNow.getUTCFullYear()}-${pad(eatNow.getUTCMonth() + 1)}-01`;
    const monthEnd = todayKey;
    const yearStart = `${eatNow.getUTCFullYear()}-01-01`;
    const yearEnd = todayKey;
    const thirtyDaysAgo = fmtDate(new Date(eatMs - 29 * 86_400_000));

    // ── Income / Expenses + outstanding debt per period (all parallel) ────────
    const [
      todayInc,
      todayExp,
      weekInc,
      weekExp,
      monthInc,
      monthExp,
      yearInc,
      yearExp,
      todayDebtOutstanding,
      weekDebtOutstanding,
      monthDebtOutstanding,
      yearDebtOutstanding,
    ] = await Promise.all([
      sumAmount("income", todayKey, todayKey),
      sumAmount("expenses", todayKey, todayKey),
      sumAmount("income", weekStart, weekEnd),
      sumAmount("expenses", weekStart, weekEnd),
      sumAmount("income", monthStart, monthEnd),
      sumAmount("expenses", monthStart, monthEnd),
      sumAmount("income", yearStart, yearEnd),
      sumAmount("expenses", yearStart, yearEnd),
      // Outstanding = balance of debts CREATED in that period that are still unpaid
      outstandingDebt(todayKey, todayKey),
      outstandingDebt(weekStart, weekEnd),
      outstandingDebt(monthStart, monthEnd),
      outstandingDebt(yearStart, yearEnd),
    ]);

    // ── Last 30 days — income, expenses AND debt outstanding per day ──────────
    const [last30Raw, debtLast30Raw] = await Promise.all([
      db.execute(
        `SELECT date_key,
           ROUND(SUM(CASE WHEN source='income'   THEN amount ELSE 0 END),2) AS income,
           ROUND(SUM(CASE WHEN source='expenses' THEN amount ELSE 0 END),2) AS expenses
         FROM (
           SELECT 'income'   AS source, amount, SUBSTR(date,1,10) AS date_key FROM income
           UNION ALL
           SELECT 'expenses' AS source, amount, SUBSTR(date,1,10) AS date_key FROM expenses
         )
         WHERE date_key >= ? AND date_key <= ?
         GROUP BY date_key ORDER BY date_key ASC`,
        [thirtyDaysAgo, todayKey],
      ),
      db.execute(
        `SELECT SUBSTR(date,1,10) AS date_key,
           ROUND(SUM(amount - amount_settled),2) AS debt_outstanding
         FROM debts
         WHERE status NOT IN ('settled','defaulted')
           AND SUBSTR(date,1,10) >= ? AND SUBSTR(date,1,10) <= ?
         GROUP BY date_key ORDER BY date_key ASC`,
        [thirtyDaysAgo, todayKey],
      ),
    ]);

    // Merge debt outstanding into the income/expenses chart points by date
    const debtByDate = new Map(
      (debtLast30Raw.rows || []).map((r) => [r.date_key, r.debt_outstanding]),
    );

    // Build a full set of date keys from both datasets
    const allDateKeys = new Set([
      ...(last30Raw.rows || []).map((r) => r.date_key),
      ...(debtLast30Raw.rows || []).map((r) => r.date_key),
    ]);
    // Also build income/expense lookup
    const incExpByDate = new Map(
      (last30Raw.rows || []).map((r) => [
        r.date_key,
        { income: r.income, expenses: r.expenses },
      ]),
    );

    const last30Days = [...allDateKeys].sort().map((dk) => ({
      date: shortDate(dk),
      income: incExpByDate.get(dk)?.income ?? 0,
      expenses: incExpByDate.get(dk)?.expenses ?? 0,
      debtOutstanding: debtByDate.get(dk) ?? 0,
    }));

    // ── Category pies ─────────────────────────────────────────────────────────
    const [incByCatRaw, expByCatRaw] = await Promise.all([
      db.execute(
        `SELECT category AS name, ROUND(SUM(amount),2) AS value FROM income   GROUP BY category ORDER BY value DESC`,
      ),
      db.execute(
        `SELECT category AS name, ROUND(SUM(amount),2) AS value FROM expenses GROUP BY category ORDER BY value DESC`,
      ),
    ]);

    // ── Weekly comparison bar — last 6 weeks ─────────────────────────────────
    const weeklyComparison = [];
    for (let w = 5; w >= 0; w--) {
      const wStartMs = weekStartMs - w * 7 * 86_400_000;
      const wEndMs = wStartMs + 6 * 86_400_000;
      const [wInc, wExp] = await Promise.all([
        sumAmount(
          "income",
          fmtDate(new Date(wStartMs)),
          fmtDate(new Date(wEndMs)),
        ),
        sumAmount(
          "expenses",
          fmtDate(new Date(wStartMs)),
          fmtDate(new Date(wEndMs)),
        ),
      ]);
      weeklyComparison.push({
        week: `W${6 - w}`,
        income: wInc,
        expenses: wExp,
      });
    }

    // ── Recent 10 transactions ────────────────────────────────────────────────
    const recentRaw = await db.execute(`
      SELECT id, 'income'  AS type, category, description, amount, date FROM income
      UNION ALL
      SELECT id, 'expense' AS type, category, description, amount, date FROM expenses
      ORDER BY date DESC LIMIT 10
    `);

    const recentTransactions = (recentRaw.rows || []).map((r) => ({
      id: r.id,
      type: r.type,
      category: r.category,
      description: r.description ?? "—",
      amount: r.amount,
      date: r.date,
    }));

    res.json({
      success: true,
      data: {
        todayIncome: todayInc,
        todayExpenses: todayExp,
        todayProfit: round(todayInc - todayExp),
        todayDebtOutstanding,
        weekIncome: weekInc,
        weekExpenses: weekExp,
        weekProfit: round(weekInc - weekExp),
        weekDebtOutstanding,
        monthIncome: monthInc,
        monthExpenses: monthExp,
        monthProfit: round(monthInc - monthExp),
        monthDebtOutstanding,
        yearIncome: yearInc,
        yearExpenses: yearExp,
        yearProfit: round(yearInc - yearExp),
        yearDebtOutstanding,
        last30Days, // now includes debtOutstanding per day
        incomeByCat: incByCatRaw.rows || [],
        expensesByCat: expByCatRaw.rows || [],
        weeklyComparison,
        recentTransactions,
      },
    });
  } catch (error) {
    console.error("getDashboardStats error:", error);
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
    `SELECT ROUND(COALESCE(SUM(amount),0),2) AS total FROM ${table}
     WHERE SUBSTR(date,1,10) >= ? AND SUBSTR(date,1,10) <= ?`,
    [from, to],
  );
  return r.rows?.[0]?.total ?? 0;
}

/** Sum of (amount - amount_settled) for active debts created in the date range */
async function outstandingDebt(from, to) {
  const r = await db.execute(
    `SELECT ROUND(COALESCE(SUM(amount - amount_settled),0),2) AS total
     FROM debts
     WHERE status NOT IN ('settled','defaulted')
       AND SUBSTR(date,1,10) >= ? AND SUBSTR(date,1,10) <= ?`,
    [from, to],
  );
  return r.rows?.[0]?.total ?? 0;
}

function fmtDate(d) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

function shortDate(iso) {
  return new Date(iso + "T00:00:00Z").toLocaleDateString("en-KE", {
    month: "short",
    day: "2-digit",
    timeZone: "UTC",
  });
}

function round(n) {
  return Math.round(n * 100) / 100;
}
