// src/controllers/reports/reports.controller.js

import { db } from "../../config/db.js";

export const getReports = async (req, res) => {
  try {
    const nowUTC = new Date();
    const eatMs = nowUTC.getTime() + 3 * 3_600_000;
    const eatNow = new Date(eatMs);
    const pad = (n) => String(n).padStart(2, "0");

    const curYear = eatNow.getUTCFullYear();
    const curMonthNum = eatNow.getUTCMonth() + 1;
    const todayKey = `${curYear}-${pad(curMonthNum)}-${pad(eatNow.getUTCDate())}`;
    const monthStart = `${curYear}-${pad(curMonthNum)}-01`;
    const lastDay = new Date(curYear, curMonthNum, 0).getDate();
    const monthEnd = `${curYear}-${pad(curMonthNum)}-${pad(lastDay)}`;
    const thirtyAgoKey = fmtDate(new Date(eatMs - 29 * 86_400_000));

    // ── 1. Month income / expenses ────────────────────────────────────────────
    const [incTotalRow, expTotalRow] = await Promise.all([
      db.execute(
        `SELECT ROUND(COALESCE(SUM(amount),0),2) AS total FROM income
         WHERE SUBSTR(date,1,10) >= ? AND SUBSTR(date,1,10) <= ?`,
        [monthStart, monthEnd],
      ),
      db.execute(
        `SELECT ROUND(COALESCE(SUM(amount),0),2) AS total FROM expenses
         WHERE SUBSTR(date,1,10) >= ? AND SUBSTR(date,1,10) <= ?`,
        [monthStart, monthEnd],
      ),
    ]);

    const monthIncome = incTotalRow.rows?.[0]?.total ?? 0;
    const monthExpenses = expTotalRow.rows?.[0]?.total ?? 0;
    const netProfit = Math.round((monthIncome - monthExpenses) * 100) / 100;
    const savingsRate =
      monthIncome > 0 ? Math.round((netProfit / monthIncome) * 1000) / 10 : 0;

    // ── 2. Debt summary — ALL-TIME outstanding (not period-scoped) ────────────
    const debtRow = await db.execute(`
      SELECT
        ROUND(COALESCE(SUM(amount),0),2)                                                                       AS total_issued,
        ROUND(COALESCE(SUM(amount_settled),0),2)                                                               AS total_settled,
        ROUND(COALESCE(SUM(CASE WHEN status NOT IN ('settled','defaulted') THEN amount - amount_settled ELSE 0 END),0),2) AS total_outstanding,
        ROUND(COALESCE(SUM(CASE WHEN status = 'defaulted' THEN amount ELSE 0 END),0),2)                        AS total_defaulted,
        COUNT(*)                                                                                                AS total_count,
        SUM(CASE WHEN status = 'pending'   THEN 1 ELSE 0 END)                                                  AS pending_count,
        SUM(CASE WHEN status = 'partial'   THEN 1 ELSE 0 END)                                                  AS partial_count,
        SUM(CASE WHEN status = 'defaulted' THEN 1 ELSE 0 END)                                                  AS defaulted_count
      FROM debts
    `);
    const d = debtRow.rows?.[0] ?? {};

    // ── 3. Category pies ──────────────────────────────────────────────────────
    const [incByCatRaw, expByCatRaw] = await Promise.all([
      db.execute(
        `SELECT category AS name, ROUND(SUM(amount),2) AS value FROM income   GROUP BY category ORDER BY value DESC`,
      ),
      db.execute(
        `SELECT category AS name, ROUND(SUM(amount),2) AS value FROM expenses GROUP BY category ORDER BY value DESC`,
      ),
    ]);

    // ── 4. Last 30 days — income + expenses line chart ────────────────────────
    const last30Raw = await db.execute(
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
      [thirtyAgoKey, todayKey],
    );
    const last30Days = (last30Raw.rows || []).map((r) => ({
      date: shortDate(r.date_key),
      income: r.income,
      expenses: r.expenses,
    }));

    // ── 5. Last 30 days — debt issued vs settled line chart ───────────────────
    const debtLast30Raw = await db.execute(
      `SELECT SUBSTR(date,1,10) AS date_key,
         ROUND(SUM(amount),2)                  AS issued,
         ROUND(SUM(amount_settled),2)           AS settled,
         ROUND(SUM(amount - amount_settled),2)  AS outstanding
       FROM debts
       WHERE SUBSTR(date,1,10) >= ? AND SUBSTR(date,1,10) <= ?
       GROUP BY date_key ORDER BY date_key ASC`,
      [thirtyAgoKey, todayKey],
    );
    const debtLast30Days = (debtLast30Raw.rows || []).map((r) => ({
      date: shortDate(r.date_key),
      issued: r.issued,
      settled: r.settled,
      outstanding: r.outstanding,
    }));

    res.json({
      success: true,
      data: {
        monthIncome: Math.round(monthIncome),
        monthExpenses: Math.round(monthExpenses),
        netProfit: Math.round(netProfit),
        savingsRate,
        // Debt summary
        debtTotalIssued: d.total_issued ?? 0,
        debtTotalSettled: d.total_settled ?? 0,
        debtTotalOutstanding: d.total_outstanding ?? 0,
        debtTotalDefaulted: d.total_defaulted ?? 0,
        debtTotalCount: d.total_count ?? 0,
        debtPendingCount: d.pending_count ?? 0,
        debtPartialCount: d.partial_count ?? 0,
        debtDefaultedCount: d.defaulted_count ?? 0,
        // Charts
        incomeByCat: incByCatRaw.rows || [],
        expensesByCat: expByCatRaw.rows || [],
        last30Days,
        debtLast30Days,
      },
    });
  } catch (error) {
    console.error("getReports error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch reports data",
      error: error.message,
    });
  }
};

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
