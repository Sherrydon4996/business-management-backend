// ============================================================
import { db } from "./../config/db.js";
//  DATABASE SCHEMA — Cyber Cafe Business Management App
//  Tables: users, refresh_tokens, income, expenses,
//          contributions, computer_sessions, movie_bookings,
//          movies_inventory, ps_games, cyber_services
// ============================================================

// ------------------------------------------------------------
//  CREATE TABLES
// ------------------------------------------------------------

export const createTables = async () => {
  // ----------------------------------------------------------
  //  1. USERS
  //     Stores admin and regular user accounts.
  // ----------------------------------------------------------
  await db.execute(`
    CREATE TABLE IF NOT EXISTS users (
      id                 TEXT PRIMARY KEY,
      username           TEXT NOT NULL UNIQUE,
      mobile             TEXT NOT NULL,
      password           TEXT NOT NULL,
      role               TEXT NOT NULL DEFAULT 'user',    -- 'admin' | 'user'
      status             TEXT NOT NULL DEFAULT 'active',  -- 'active' | 'suspended'
      session_started_at TEXT,
      session_expires_at TEXT,
      created_at         TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // ----------------------------------------------------------
  //  2. REFRESH TOKENS
  //     JWT refresh tokens linked to users.
  // ----------------------------------------------------------
  await db.execute(`
    CREATE TABLE IF NOT EXISTS refresh_tokens (
      id         TEXT PRIMARY KEY,
      user_id    TEXT NOT NULL,
      token      TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `);

  // ----------------------------------------------------------
  //  3. INCOME
  //     Records every income entry across all categories.
  //     category: 'PS Gaming' | 'Cyber Services' | 'Movie Rentals'
  // ----------------------------------------------------------
  await db.execute(`
    CREATE TABLE IF NOT EXISTS income (
      id             TEXT PRIMARY KEY,
      amount         REAL NOT NULL CHECK(amount > 0),
      category       TEXT NOT NULL,    -- 'PS Gaming' | 'Cyber Services' | 'Movie Rentals'
      description    TEXT,
      payment_method TEXT NOT NULL,
      recorded_by    TEXT NOT NULL,
      date           TEXT NOT NULL,    -- ISO 8601 with timezone e.g. 2026-03-04T14:00:00+03:00
      created_at     TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (recorded_by) REFERENCES users(id)
    );
  `);

  // ----------------------------------------------------------
  //  4. EXPENSES
  //     Records every business expense entry.
  // ----------------------------------------------------------
  await db.execute(`
    CREATE TABLE IF NOT EXISTS expenses (
      id             TEXT PRIMARY KEY,
      amount         REAL NOT NULL CHECK(amount > 0),
      category       TEXT NOT NULL,    -- e.g. 'Stock Purchase' | 'Utilities' | 'Internet' etc.
      description    TEXT,
      payment_method TEXT NOT NULL,
      recorded_by    TEXT NOT NULL,
      date           TEXT NOT NULL,
      created_at     TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (recorded_by) REFERENCES users(id)
    );
  `);

  // ----------------------------------------------------------
  //  5. CONTRIBUTIONS
  //     Weekly group, cooperative bank, caritas bank & custom
  //     contributions.
  //     type:   'weekly_group' | 'cooperative_bank' | 'caritas_bank' | 'custom'
  //     status: 'paid' | 'pending' | 'overdue'
  // ----------------------------------------------------------
  await db.execute(`
    CREATE TABLE IF NOT EXISTS contributions (
      id             TEXT PRIMARY KEY,
      amount         REAL NOT NULL CHECK(amount > 0),
      type           TEXT NOT NULL,    -- 'weekly_group' | 'cooperative_bank' | 'caritas_bank' | 'custom'
      description    TEXT,
      payment_method TEXT NOT NULL,
      status         TEXT NOT NULL DEFAULT 'paid',  -- 'paid' | 'pending' | 'overdue'
      recorded_by    TEXT NOT NULL,
      date           TEXT NOT NULL,
      created_at     TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (recorded_by) REFERENCES users(id)
    );
  `);

  // ----------------------------------------------------------
  //  6. COMPUTER SESSIONS  (PS / Gaming Sessions)
  //     Tracks timed gaming sessions for each day.
  //     Other one-off earnings are recorded in the income table.
  // ----------------------------------------------------------
  await db.execute(`
    CREATE TABLE IF NOT EXISTS computer_sessions (
      id          TEXT PRIMARY KEY,
      amount      REAL NOT NULL CHECK(amount > 0),
      start_time  TEXT NOT NULL,   -- e.g. '14:00'
      end_time    TEXT NOT NULL,   -- e.g. '15:30'
      status      TEXT NOT NULL DEFAULT 'active',  -- 'active' | 'done'
      date_key    TEXT NOT NULL,   -- YYYY-MM-DD (Kenyan date)
      created_at  TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // ----------------------------------------------------------
  //  7. MOVIE & SERIES BOOKINGS
  //     Tracks customer rentals and pickup status.
  //     pick_date: the date the customer will collect the movie.
  //     status: 'pending' (not yet picked up) | 'active' (picked up) |
  //             'delivered' (returned) | 'cancelled' (auto or manual)
  // ----------------------------------------------------------
  await db.execute(`
    CREATE TABLE IF NOT EXISTS movie_bookings (
      id             TEXT PRIMARY KEY,
      customer_name  TEXT NOT NULL,
      customer_phone TEXT,
      title          TEXT NOT NULL,
      type           TEXT NOT NULL DEFAULT 'movie',   -- 'movie' | 'series'
      pick_date      TEXT NOT NULL,                   -- YYYY-MM-DD
      amount         REAL NOT NULL CHECK(amount > 0),
      status         TEXT NOT NULL DEFAULT 'pending', -- 'pending' | 'active' | 'delivered' | 'cancelled'
      booked_at      TEXT NOT NULL,                   -- ISO 8601 +03:00
      created_at     TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // ----------------------------------------------------------
  //  8. MOVIES & SERIES INVENTORY
  //     Full catalog of movies and series available for rent.
  // ----------------------------------------------------------
  await db.execute(`
    CREATE TABLE IF NOT EXISTS movies_inventory (
      id          TEXT PRIMARY KEY,
      title       TEXT NOT NULL,
      genre       TEXT NOT NULL,
      year        TEXT NOT NULL,
      type        TEXT NOT NULL DEFAULT 'movie',  -- 'movie' | 'series'
      seasons     INTEGER,                        -- only for series
      date_added  TEXT NOT NULL,
      created_at  TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // ----------------------------------------------------------
  //  9. PS GAMES
  //     PlayStation game library with pricing and availability.
  // ----------------------------------------------------------
  await db.execute(`
    CREATE TABLE IF NOT EXISTS ps_games (
      id              TEXT PRIMARY KEY,
      name            TEXT NOT NULL,
      platform        TEXT NOT NULL DEFAULT 'PS5',  -- 'PS4' | 'PS5' etc.
      price_per_hour  REAL NOT NULL CHECK(price_per_hour > 0),
      available       INTEGER NOT NULL DEFAULT 1,   -- 1 = available, 0 = unavailable
      date_added      TEXT NOT NULL,
      created_at      TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // ----------------------------------------------------------
  //  10. CYBER SERVICES
  //      Service offerings with pricing for the cyber cafe.
  // ----------------------------------------------------------
  await db.execute(`
    CREATE TABLE IF NOT EXISTS cyber_services (
      id          TEXT PRIMARY KEY,
      name        TEXT NOT NULL,
      description TEXT,
      price       REAL NOT NULL CHECK(price > 0),
      date_added  TEXT NOT NULL,
      created_at  TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // ----------------------------------------------------------
  //  INDEXES — for fast querying by date, category, status
  // ----------------------------------------------------------

  // users
  await db.execute(
    `CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);`,
  );
  await db.execute(
    `CREATE INDEX IF NOT EXISTS idx_users_role   ON users(role);`,
  );

  // refresh_tokens
  await db.execute(
    `CREATE INDEX IF NOT EXISTS idx_tokens_user ON refresh_tokens(user_id);`,
  );

  // income
  await db.execute(
    `CREATE INDEX IF NOT EXISTS idx_income_category ON income(category);`,
  );
  await db.execute(
    `CREATE INDEX IF NOT EXISTS idx_income_date      ON income(date);`,
  );
  await db.execute(
    `CREATE INDEX IF NOT EXISTS idx_income_recorded  ON income(recorded_by);`,
  );

  // expenses
  await db.execute(
    `CREATE INDEX IF NOT EXISTS idx_expenses_category ON expenses(category);`,
  );
  await db.execute(
    `CREATE INDEX IF NOT EXISTS idx_expenses_date      ON expenses(date);`,
  );

  // contributions
  await db.execute(
    `CREATE INDEX IF NOT EXISTS idx_contributions_type   ON contributions(type);`,
  );
  await db.execute(
    `CREATE INDEX IF NOT EXISTS idx_contributions_status ON contributions(status);`,
  );
  await db.execute(
    `CREATE INDEX IF NOT EXISTS idx_contributions_date   ON contributions(date);`,
  );

  // computer sessions
  await db.execute(
    `CREATE INDEX IF NOT EXISTS idx_sessions_date   ON computer_sessions(date_key);`,
  );
  await db.execute(
    `CREATE INDEX IF NOT EXISTS idx_sessions_status ON computer_sessions(status);`,
  );

  // movie bookings
  await db.execute(
    `CREATE INDEX IF NOT EXISTS idx_bookings_status    ON movie_bookings(status);`,
  );
  await db.execute(
    `CREATE INDEX IF NOT EXISTS idx_bookings_pick_date ON movie_bookings(pick_date);`,
  );
  await db.execute(
    `CREATE INDEX IF NOT EXISTS idx_bookings_booked_at ON movie_bookings(booked_at);`,
  );

  // movies inventory
  await db.execute(
    `CREATE INDEX IF NOT EXISTS idx_movies_type       ON movies_inventory(type);`,
  );
  await db.execute(
    `CREATE INDEX IF NOT EXISTS idx_movies_date_added ON movies_inventory(date_added);`,
  );

  // ps games
  await db.execute(
    `CREATE INDEX IF NOT EXISTS idx_ps_games_platform  ON ps_games(platform);`,
  );
  await db.execute(
    `CREATE INDEX IF NOT EXISTS idx_ps_games_available ON ps_games(available);`,
  );

  console.log("✅ All tables and indexes created successfully.");
};

// ------------------------------------------------------------
//  MIGRATIONS
//  Safe, additive changes to existing tables.
//  Run once on app startup after createTables().
// ------------------------------------------------------------

export const runMigrations = async () => {
  try {
    // ── users ──────────────────────────────────────────────────────────────────
    const userInfo = await db.execute(`PRAGMA table_info(users);`);
    const userCols = userInfo.rows.map((c) => c.name);

    if (!userCols.includes("session_started_at")) {
      await db.execute(`ALTER TABLE users ADD COLUMN session_started_at TEXT;`);
      console.log("Migration: added users.session_started_at");
    }
    if (!userCols.includes("session_expires_at")) {
      await db.execute(`ALTER TABLE users ADD COLUMN session_expires_at TEXT;`);
      console.log("Migration: added users.session_expires_at");
    }

    // ── income ─────────────────────────────────────────────────────────────────
    const incomeInfo = await db.execute(`PRAGMA table_info(income);`);
    const incomeCols = incomeInfo.rows.map((c) => c.name);

    if (!incomeCols.includes("payment_method")) {
      await db.execute(
        `ALTER TABLE income ADD COLUMN payment_method TEXT NOT NULL DEFAULT 'Cash';`,
      );
      console.log("Migration: added income.payment_method");
    }

    // ── movie_bookings ─────────────────────────────────────────────────────────
    const bookingInfo = await db.execute(`PRAGMA table_info(movie_bookings);`);
    const bookingCols = bookingInfo.rows.map((c) => c.name);

    if (!bookingCols.includes("customer_phone")) {
      await db.execute(
        `ALTER TABLE movie_bookings ADD COLUMN customer_phone TEXT;`,
      );
      console.log("Migration: added movie_bookings.customer_phone");
    }

    if (!bookingCols.includes("pick_date")) {
      await db.execute(
        `ALTER TABLE movie_bookings ADD COLUMN pick_date TEXT NOT NULL DEFAULT '2026-01-01';`,
      );
      // Back-fill from booked_at for existing rows
      await db.execute(
        `UPDATE movie_bookings SET pick_date = SUBSTR(booked_at, 1, 10) WHERE pick_date = '2026-01-01';`,
      );
      console.log("Migration: added movie_bookings.pick_date");
    }

    // Remove return_date from any existing rows that have it
    // SQLite cannot DROP columns directly before v3.35 — we handle this by
    // simply ignoring it in all queries. If your SQLite version is >= 3.35:
    // await db.execute(`ALTER TABLE movie_bookings DROP COLUMN return_date;`);

    // ── Triggers ───────────────────────────────────────────────────────────────

    // Drop the old overdue trigger (was keyed on return_date, now obsolete)
    await db.execute(`DROP TRIGGER IF EXISTS trigger_mark_overdue_bookings;`);

    // Auto-cancel bookings whose pick_date has passed and are still pending/active
    await db.execute(`
      CREATE TRIGGER IF NOT EXISTS trigger_auto_cancel_bookings
      AFTER UPDATE ON movie_bookings
      FOR EACH ROW
      WHEN NEW.status IN ('active', 'pending') AND NEW.pick_date < DATE('now', '+3 hours')
      BEGIN
        UPDATE movie_bookings SET status = 'cancelled' WHERE id = NEW.id;
      END;
    `);

    // Auto-mark computer sessions as done when end_time is reached
    await db.execute(`
      CREATE TRIGGER IF NOT EXISTS trigger_mark_session_done
      AFTER UPDATE ON computer_sessions
      FOR EACH ROW
      WHEN NEW.status = 'active' AND TIME('now', 'localtime') >= NEW.end_time
      BEGIN
        UPDATE computer_sessions SET status = 'done' WHERE id = NEW.id;
      END;
    `);

    const sessionsInfo = await db.execute(
      `PRAGMA table_info(computer_sessions);`,
    );
    const sessionsCols = sessionsInfo.rows.map((c) => c.name);

    if (!sessionsCols.includes("customer_name")) {
      await db.execute(
        `ALTER TABLE computer_sessions ADD COLUMN customer_name TEXT NOT NULL DEFAULT '';`,
      );
      console.log("Migration: added computer_sessions.customer_name");
    }
    if (!sessionsCols.includes("game_name")) {
      await db.execute(
        `ALTER TABLE computer_sessions ADD COLUMN game_name TEXT NOT NULL DEFAULT '';`,
      );
      console.log("Migration: added computer_sessions.game_name");
    }
    if (!sessionsCols.includes("num_games")) {
      await db.execute(
        `ALTER TABLE computer_sessions ADD COLUMN num_games INTEGER NOT NULL DEFAULT 1;`,
      );
      console.log("Migration: added computer_sessions.num_games");
    }

    // ps_games: add minutes_per_game
    const psGamesInfo = await db.execute(`PRAGMA table_info(ps_games);`);
    const psGamesCols = psGamesInfo.rows.map((c) => c.name);
    if (!psGamesCols.includes("minutes_per_game")) {
      await db.execute(
        `ALTER TABLE ps_games ADD COLUMN minutes_per_game INTEGER NOT NULL DEFAULT 15;`,
      );
      console.log("Migration: added ps_games.minutes_per_game");
    }
    const csInfo = await db.execute(`PRAGMA table_info(computer_sessions);`);
    const csCols = csInfo.rows.map((c) => c.name);

    // Distinguishes PC internet sessions from PS gaming sessions
    if (!csCols.includes("session_type")) {
      await db.execute(
        `ALTER TABLE computer_sessions ADD COLUMN session_type TEXT NOT NULL DEFAULT 'ps';`,
      );
      console.log("Migration: added computer_sessions.session_type");
    }

    // Computer/PC number at the desk (only used by 'computer' session_type)
    if (!csCols.includes("computer_number")) {
      await db.execute(
        `ALTER TABLE computer_sessions ADD COLUMN computer_number INTEGER;`,
      );
      console.log("Migration: added computer_sessions.computer_number");
    }

    // Minutes of the session (= amount for computer sessions, derived for PS)
    if (!csCols.includes("minutes")) {
      await db.execute(
        `ALTER TABLE computer_sessions ADD COLUMN minutes INTEGER NOT NULL DEFAULT 0;`,
      );
      console.log("Migration: added computer_sessions.minutes");
    }

    console.log("✅ Migrations completed successfully.");
  } catch (error) {
    console.error("❌ Migration error:", error.message || error);
  }
};
