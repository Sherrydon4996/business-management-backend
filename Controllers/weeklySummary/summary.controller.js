// src/controllers/weekly-summary/weeklySummary.controller.js

import { db } from "../../config/db.js";

// ─── GET /api/v1/weekly-summary/get?month=2&year=2026 ────────────────────────

export const getWeeklySummary = async (req, res) => {
  try {
    const month = parseInt(req.query.month ?? new Date().getMonth(), 10); // 0-based
    const year = parseInt(req.query.year ?? new Date().getFullYear(), 10);

    if (isNaN(month) || month < 0 || month > 11) {
      return res.status(400).json({
        success: false,
        code: "INVALID_MONTH",
        message: "month must be 0–11",
      });
    }
    if (isNaN(year) || year < 2000 || year > 2100) {
      return res.status(400).json({
        success: false,
        code: "INVALID_YEAR",
        message: "year must be 4-digit",
      });
    }

    const lastDayOfMonth = new Date(year, month + 1, 0).getDate();
    const pad = (n) => String(n).padStart(2, "0");
    const monthStr = pad(month + 1);

    const weekBoundaries = [
      { start: 1, end: 7 },
      { start: 8, end: 14 },
      { start: 15, end: 21 },
      { start: 22, end: lastDayOfMonth },
    ];

    // ── 4 week buckets ────────────────────────────────────────────────────────

    const weeks = [];

    for (let w = 0; w < weekBoundaries.length; w++) {
      const { start, end } = weekBoundaries[w];
      const startKey = `${year}-${monthStr}-${pad(start)}`;
      const endKey = `${year}-${monthStr}-${pad(end)}`;

      const fmtDay = (day) =>
        new Date(year, month, day).toLocaleDateString("en-KE", {
          month: "short",
          day: "numeric",
          timeZone: "Africa/Nairobi",
        });
      const weekLabel = `${fmtDay(start)} – ${fmtDay(end)}`;

      // Income, contributions, expenses, and debt outstanding — all parallel
      const [incRow, contRow, expRow, debtRow] = await Promise.all([
        db.execute(
          `SELECT ROUND(COALESCE(SUM(amount),0),2) AS total FROM income
           WHERE SUBSTR(date,1,10) >= ? AND SUBSTR(date,1,10) <= ?`,
          [startKey, endKey],
        ),
        db.execute(
          `SELECT ROUND(COALESCE(SUM(amount),0),2) AS total FROM contributions
           WHERE SUBSTR(date,1,10) >= ? AND SUBSTR(date,1,10) <= ? AND status = 'paid'`,
          [startKey, endKey],
        ),
        db.execute(
          `SELECT ROUND(COALESCE(SUM(amount),0),2) AS total FROM expenses
           WHERE SUBSTR(date,1,10) >= ? AND SUBSTR(date,1,10) <= ?`,
          [startKey, endKey],
        ),
        // Debts CREATED in this week that are still unpaid
        db.execute(
          `SELECT ROUND(COALESCE(SUM(amount - amount_settled),0),2) AS total
           FROM debts
           WHERE status NOT IN ('settled','defaulted')
             AND SUBSTR(date,1,10) >= ? AND SUBSTR(date,1,10) <= ?`,
          [startKey, endKey],
        ),
      ]);

      const earnings = incRow.rows?.[0]?.total ?? 0;
      const contributions = contRow.rows?.[0]?.total ?? 0;
      const expenses = expRow.rows?.[0]?.total ?? 0;
      const debtOutstanding = debtRow.rows?.[0]?.total ?? 0;
      const savings =
        Math.round((earnings - contributions - expenses) * 100) / 100;

      weeks.push({
        weekNumber: w + 1,
        weekLabel,
        startKey,
        endKey,
        earnings: Math.round(earnings),
        contributions: Math.round(contributions),
        expenses: Math.round(expenses),
        savings,
        debtOutstanding: Math.round(debtOutstanding),
      });
    }

    // ── Current Kenyan month totals ───────────────────────────────────────────

    const nowUTC = new Date();
    const eatMs = nowUTC.getTime() + 3 * 3_600_000;
    const eatNow = new Date(eatMs);
    const curMonth = pad(eatNow.getUTCMonth() + 1);
    const curYear = eatNow.getUTCFullYear();
    const curMonthStart = `${curYear}-${curMonth}-01`;
    const curMonthEnd = `${curYear}-${curMonth}-${pad(new Date(curYear, eatNow.getUTCMonth() + 1, 0).getDate())}`;

    const [mInc, mCont, mExp, mDebt] = await Promise.all([
      db.execute(
        `SELECT ROUND(COALESCE(SUM(amount),0),2) AS total FROM income
         WHERE SUBSTR(date,1,10) >= ? AND SUBSTR(date,1,10) <= ?`,
        [curMonthStart, curMonthEnd],
      ),
      db.execute(
        `SELECT ROUND(COALESCE(SUM(amount),0),2) AS total FROM contributions
         WHERE SUBSTR(date,1,10) >= ? AND SUBSTR(date,1,10) <= ? AND status = 'paid'`,
        [curMonthStart, curMonthEnd],
      ),
      db.execute(
        `SELECT ROUND(COALESCE(SUM(amount),0),2) AS total FROM expenses
         WHERE SUBSTR(date,1,10) >= ? AND SUBSTR(date,1,10) <= ?`,
        [curMonthStart, curMonthEnd],
      ),
      db.execute(
        `SELECT ROUND(COALESCE(SUM(amount - amount_settled),0),2) AS total
         FROM debts
         WHERE status NOT IN ('settled','defaulted')
           AND SUBSTR(date,1,10) >= ? AND SUBSTR(date,1,10) <= ?`,
        [curMonthStart, curMonthEnd],
      ),
    ]);

    const mEarnings = mInc.rows?.[0]?.total ?? 0;
    const mContributions = mCont.rows?.[0]?.total ?? 0;
    const mExpenses = mExp.rows?.[0]?.total ?? 0;
    const mDebtOut = mDebt.rows?.[0]?.total ?? 0;

    const monthlyTotals = {
      month: eatNow.getUTCMonth(),
      year: curYear,
      earnings: Math.round(mEarnings),
      contributions: Math.round(mContributions),
      expenses: Math.round(mExpenses),
      savings: Math.round(mEarnings - mContributions - mExpenses),
      debtOutstanding: Math.round(mDebtOut),
    };

    // ── Current year totals ───────────────────────────────────────────────────

    const yearStart = `${curYear}-01-01`;
    const yearEnd = `${curYear}-12-31`;

    const [yInc, yCont, yExp, yDebt] = await Promise.all([
      db.execute(
        `SELECT ROUND(COALESCE(SUM(amount),0),2) AS total FROM income
         WHERE SUBSTR(date,1,10) >= ? AND SUBSTR(date,1,10) <= ?`,
        [yearStart, yearEnd],
      ),
      db.execute(
        `SELECT ROUND(COALESCE(SUM(amount),0),2) AS total FROM contributions
         WHERE SUBSTR(date,1,10) >= ? AND SUBSTR(date,1,10) <= ? AND status = 'paid'`,
        [yearStart, yearEnd],
      ),
      db.execute(
        `SELECT ROUND(COALESCE(SUM(amount),0),2) AS total FROM expenses
         WHERE SUBSTR(date,1,10) >= ? AND SUBSTR(date,1,10) <= ?`,
        [yearStart, yearEnd],
      ),
      db.execute(
        `SELECT ROUND(COALESCE(SUM(amount - amount_settled),0),2) AS total
         FROM debts
         WHERE status NOT IN ('settled','defaulted')
           AND SUBSTR(date,1,10) >= ? AND SUBSTR(date,1,10) <= ?`,
        [yearStart, yearEnd],
      ),
    ]);

    const yEarnings = yInc.rows?.[0]?.total ?? 0;
    const yContributions = yCont.rows?.[0]?.total ?? 0;
    const yExpenses = yExp.rows?.[0]?.total ?? 0;
    const yDebtOut = yDebt.rows?.[0]?.total ?? 0;

    const yearlyTotals = {
      year: curYear,
      earnings: Math.round(yEarnings),
      contributions: Math.round(yContributions),
      expenses: Math.round(yExpenses),
      savings: Math.round(yEarnings - yContributions - yExpenses),
      debtOutstanding: Math.round(yDebtOut),
    };

    res.json({
      success: true,
      data: {
        selectedMonth: month,
        selectedYear: year,
        weeks,
        monthlyTotals,
        yearlyTotals,
      },
    });
  } catch (error) {
    console.error("Error fetching weekly summary:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch weekly summary",
      error: error.message,
    });
  }
};
