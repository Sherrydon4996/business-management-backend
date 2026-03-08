// src/controllers/weekly-summary/weeklySummary.controller.js

import { db } from "../../config/db.js";

// ─── GET /api/v1/weekly-summary/get?month=2&year=2026 ────────────────────────
//
//  Accepts query params:
//    month  — 0-based month index (0 = January … 11 = December)
//    year   — 4-digit year
//
//  Returns:
//    weeks[]          — 4 weekly buckets for the requested month
//    monthlyTotals    — income/contributions/expenses/savings for current month
//    yearlyTotals     — same but for the full current year

export const getWeeklySummary = async (req, res) => {
  try {
    // ── Parse & validate query params ────────────────────────────────────────

    const month = parseInt(req.query.month ?? new Date().getMonth(), 10); // 0-based
    const year = parseInt(req.query.year ?? new Date().getFullYear(), 10);

    if (isNaN(month) || month < 0 || month > 11) {
      return res.status(400).json({
        success: false,
        code: "INVALID_MONTH",
        message: "month must be an integer between 0 and 11",
      });
    }
    if (isNaN(year) || year < 2000 || year > 2100) {
      return res.status(400).json({
        success: false,
        code: "INVALID_YEAR",
        message: "year must be a 4-digit integer",
      });
    }

    // ── Build 4-week buckets for the requested month ──────────────────────────
    //
    //  Week 1: day  1 → day  7
    //  Week 2: day  8 → day 14
    //  Week 3: day 15 → day 21
    //  Week 4: day 22 → last day of month  (absorbs any remaining days)

    const lastDayOfMonth = new Date(year, month + 1, 0).getDate(); // e.g. 28/29/30/31

    const weekBoundaries = [
      { start: 1, end: 7 },
      { start: 8, end: 14 },
      { start: 15, end: 21 },
      { start: 22, end: lastDayOfMonth },
    ];

    const pad = (n) => String(n).padStart(2, "0");
    const monthStr = pad(month + 1); // 1-based for ISO strings

    const weeks = [];

    for (let w = 0; w < weekBoundaries.length; w++) {
      const { start, end } = weekBoundaries[w];

      // YYYY-MM-DD bounds — we compare against SUBSTR(date, 1, 10)
      const startKey = `${year}-${monthStr}-${pad(start)}`;
      const endKey = `${year}-${monthStr}-${pad(end)}`;

      // Human-readable label e.g. "Mar 01 – Mar 07"
      const fmtDay = (day) =>
        new Date(year, month, day).toLocaleDateString("en-KE", {
          month: "short",
          day: "numeric",
          timeZone: "Africa/Nairobi",
        });
      const weekLabel = `${fmtDay(start)} – ${fmtDay(end)}`;

      // Run income, contributions, expenses in parallel for this week
      const [incRow, contRow, expRow] = await Promise.all([
        db.execute(
          `SELECT ROUND(COALESCE(SUM(amount), 0), 2) AS total
           FROM income
           WHERE SUBSTR(date, 1, 10) >= ? AND SUBSTR(date, 1, 10) <= ?`,
          [startKey, endKey],
        ),
        db.execute(
          `SELECT ROUND(COALESCE(SUM(amount), 0), 2) AS total
           FROM contributions
           WHERE SUBSTR(date, 1, 10) >= ? AND SUBSTR(date, 1, 10) <= ?
             AND status = 'paid'`,
          [startKey, endKey],
        ),
        db.execute(
          `SELECT ROUND(COALESCE(SUM(amount), 0), 2) AS total
           FROM expenses
           WHERE SUBSTR(date, 1, 10) >= ? AND SUBSTR(date, 1, 10) <= ?`,
          [startKey, endKey],
        ),
      ]);

      const earnings = incRow.rows?.[0]?.total ?? 0;
      const contributions = contRow.rows?.[0]?.total ?? 0;
      const expenses = expRow.rows?.[0]?.total ?? 0;
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
      });
    }

    // ── Current Kenyan month totals (always "now", not filtered) ─────────────

    const nowUTC = new Date();
    const eatMs = nowUTC.getTime() + 3 * 3_600_000;
    const eatNow = new Date(eatMs);
    const curMonth = pad(eatNow.getUTCMonth() + 1);
    const curYear = eatNow.getUTCFullYear();
    const curMonthStart = `${curYear}-${curMonth}-01`;
    const curMonthEnd = `${curYear}-${curMonth}-${pad(new Date(curYear, eatNow.getUTCMonth() + 1, 0).getDate())}`;

    const [mInc, mCont, mExp] = await Promise.all([
      db.execute(
        `SELECT ROUND(COALESCE(SUM(amount), 0), 2) AS total FROM income
         WHERE SUBSTR(date, 1, 10) >= ? AND SUBSTR(date, 1, 10) <= ?`,
        [curMonthStart, curMonthEnd],
      ),
      db.execute(
        `SELECT ROUND(COALESCE(SUM(amount), 0), 2) AS total FROM contributions
         WHERE SUBSTR(date, 1, 10) >= ? AND SUBSTR(date, 1, 10) <= ?
           AND status = 'paid'`,
        [curMonthStart, curMonthEnd],
      ),
      db.execute(
        `SELECT ROUND(COALESCE(SUM(amount), 0), 2) AS total FROM expenses
         WHERE SUBSTR(date, 1, 10) >= ? AND SUBSTR(date, 1, 10) <= ?`,
        [curMonthStart, curMonthEnd],
      ),
    ]);

    const mEarnings = mInc.rows?.[0]?.total ?? 0;
    const mContributions = mCont.rows?.[0]?.total ?? 0;
    const mExpenses = mExp.rows?.[0]?.total ?? 0;

    const monthlyTotals = {
      month: eatNow.getUTCMonth(), // 0-based, for label on frontend
      year: curYear,
      earnings: Math.round(mEarnings),
      contributions: Math.round(mContributions),
      expenses: Math.round(mExpenses),
      savings: Math.round(mEarnings - mContributions - mExpenses),
    };

    // ── Current year totals ───────────────────────────────────────────────────

    const yearStart = `${curYear}-01-01`;
    const yearEnd = `${curYear}-12-31`;

    const [yInc, yCont, yExp] = await Promise.all([
      db.execute(
        `SELECT ROUND(COALESCE(SUM(amount), 0), 2) AS total FROM income
         WHERE SUBSTR(date, 1, 10) >= ? AND SUBSTR(date, 1, 10) <= ?`,
        [yearStart, yearEnd],
      ),
      db.execute(
        `SELECT ROUND(COALESCE(SUM(amount), 0), 2) AS total FROM contributions
         WHERE SUBSTR(date, 1, 10) >= ? AND SUBSTR(date, 1, 10) <= ?
           AND status = 'paid'`,
        [yearStart, yearEnd],
      ),
      db.execute(
        `SELECT ROUND(COALESCE(SUM(amount), 0), 2) AS total FROM expenses
         WHERE SUBSTR(date, 1, 10) >= ? AND SUBSTR(date, 1, 10) <= ?`,
        [yearStart, yearEnd],
      ),
    ]);

    const yEarnings = yInc.rows?.[0]?.total ?? 0;
    const yContributions = yCont.rows?.[0]?.total ?? 0;
    const yExpenses = yExp.rows?.[0]?.total ?? 0;

    const yearlyTotals = {
      year: curYear,
      earnings: Math.round(yEarnings),
      contributions: Math.round(yContributions),
      expenses: Math.round(yExpenses),
      savings: Math.round(yEarnings - yContributions - yExpenses),
    };

    // ── Response ──────────────────────────────────────────────────────────────

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
