// src/controllers/daily-earnings/dailyEarnings.controller.js
import { db } from "../../config/db.js";

// ─── GET /api/v1/daily-earnings/get ──────────────────────────────────────────
//
//  Aggregates income (grouped by category) and expenses per Kenyan calendar
//  day (Africa/Nairobi, UTC+3).
//
//  SQLite stores dates as ISO 8601 text e.g. "2026-03-04T14:00:00+03:00".
//  We extract the Kenyan date by taking the first 10 chars — this is safe
//  because all rows are written with the +03:00 offset already applied
//  (see getNowEAT() on the frontend / the date field in the controllers).
//
//  Result shape per row:
//    date_key        TEXT    — YYYY-MM-DD
//    ps_gaming       REAL
//    cyber_services  REAL
//    movie_rentals   REAL
//    other_income    REAL
//    total_income    REAL    — sum of all four above
//    total_expenses  REAL
//    net_total       REAL    — total_income - total_expenses
//
//  Rows are sorted newest-first.

export const getDailyEarnings = async (req, res) => {
  try {
    const result = await db.execute(`
      SELECT
        date_key,

        -- Income broken down by category
        ROUND(COALESCE(SUM(CASE WHEN source = 'income' AND category = 'PS Gaming'      THEN amount ELSE 0 END), 0), 2) AS ps_gaming,
        ROUND(COALESCE(SUM(CASE WHEN source = 'income' AND category = 'Cyber Services' THEN amount ELSE 0 END), 0), 2) AS cyber_services,
        ROUND(COALESCE(SUM(CASE WHEN source = 'income' AND category = 'Movie Rentals'  THEN amount ELSE 0 END), 0), 2) AS movie_rentals,
        ROUND(COALESCE(SUM(CASE WHEN source = 'income' AND category = 'other'          THEN amount ELSE 0 END), 0), 2) AS other_income,

        -- Total income for the day
        ROUND(COALESCE(SUM(CASE WHEN source = 'income'   THEN amount ELSE 0 END), 0), 2) AS total_income,

        -- Total expenses for the day
        ROUND(COALESCE(SUM(CASE WHEN source = 'expenses' THEN amount ELSE 0 END), 0), 2) AS total_expenses,

        -- Net = income - expenses
        ROUND(
          COALESCE(SUM(CASE WHEN source = 'income'   THEN amount ELSE 0 END), 0) -
          COALESCE(SUM(CASE WHEN source = 'expenses' THEN amount ELSE 0 END), 0),
        2) AS net_total

      FROM (
        -- Income rows: extract the first 10 chars of the stored EAT ISO string as date_key
        SELECT
          'income'    AS source,
          category,
          amount,
          SUBSTR(date, 1, 10) AS date_key
        FROM income

        UNION ALL

        -- Expense rows: no category breakdown needed
        SELECT
          'expenses'  AS source,
          NULL        AS category,
          amount,
          SUBSTR(date, 1, 10) AS date_key
        FROM expenses
      ) combined

      GROUP BY date_key
      ORDER BY date_key DESC
    `);

    res.json({
      success: true,
      records: result.rows || [],
    });
  } catch (error) {
    console.error("Error fetching daily earnings:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch daily earnings",
      error: error.message,
    });
  }
};
