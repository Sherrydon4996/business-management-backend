// src/controllers/ps-games/psGames.controller.js

import { v4 as uuidv4 } from "uuid";
import { db } from "../../config/db.js";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const getNowEAT = () => {
  const now = new Date();
  const eatMs =
    now.getTime() + now.getTimezoneOffset() * 60_000 + 3 * 3_600_000;
  const eat = new Date(eatMs);
  const pad = (n) => String(n).padStart(2, "0");
  return (
    `${eat.getFullYear()}-${pad(eat.getMonth() + 1)}-${pad(eat.getDate())}` +
    `T${pad(eat.getHours())}:${pad(eat.getMinutes())}:${pad(eat.getSeconds())}+03:00`
  );
};

const SELECT_GAMES = `
  SELECT id, name, platform, price_per_hour, minutes_per_game, available, date_added, created_at
  FROM ps_games
`;

// ─── GET /api/v1/ps-games/get ─────────────────────────────────────────────────

export const getPsGames = async (req, res) => {
  try {
    const result = await db.execute(`${SELECT_GAMES} ORDER BY date_added DESC`);
    res.json({ success: true, records: result.rows || [] });
  } catch (error) {
    console.error("Error fetching PS games:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch PS games",
      error: error.message,
    });
  }
};

// ─── POST /api/v1/admin/ps-games/create ──────────────────────────────────────

export const createPsGame = async (req, res) => {
  try {
    const { name, platform, price_per_hour, minutes_per_game } = req.body;

    if (
      !name ||
      price_per_hour === undefined ||
      minutes_per_game === undefined
    ) {
      return res.status(400).json({
        success: false,
        code: "MISSING_FIELDS",
        message: "name, price_per_hour, and minutes_per_game are required",
      });
    }
    if (typeof price_per_hour !== "number" || price_per_hour <= 0) {
      return res.status(400).json({
        success: false,
        code: "INVALID_PRICE",
        message: "price_per_hour must be a positive number",
      });
    }
    if (typeof minutes_per_game !== "number" || minutes_per_game <= 0) {
      return res.status(400).json({
        success: false,
        code: "INVALID_MINS",
        message: "minutes_per_game must be a positive number",
      });
    }

    const id = uuidv4();
    await db.execute(
      `INSERT INTO ps_games (id, name, platform, price_per_hour, minutes_per_game, available, date_added)
       VALUES (?, ?, ?, ?, ?, 1, ?)`,
      [
        id,
        name.trim(),
        (platform ?? "PS5").trim(),
        price_per_hour,
        minutes_per_game,
        getNowEAT(),
      ],
    );

    const inserted = await db.execute(`${SELECT_GAMES} WHERE id = ?`, [id]);
    res.status(201).json({ success: true, data: inserted.rows[0] });
  } catch (error) {
    console.error("Error creating PS game:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create PS game",
      error: error.message,
    });
  }
};

// ─── PUT /api/v1/admin/ps-games/update/:id ───────────────────────────────────

export const updatePsGame = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, platform, price_per_hour, minutes_per_game } = req.body;

    const existing = await db.execute(`SELECT id FROM ps_games WHERE id = ?`, [
      id,
    ]);
    if (!existing.rows?.length) {
      return res
        .status(404)
        .json({ success: false, code: "NOT_FOUND", message: "Game not found" });
    }

    const fields = [];
    const values = [];

    if (name !== undefined) {
      fields.push("name = ?");
      values.push(name.trim());
    }
    if (platform !== undefined) {
      fields.push("platform = ?");
      values.push(platform.trim());
    }
    if (price_per_hour !== undefined) {
      fields.push("price_per_hour = ?");
      values.push(price_per_hour);
    }
    if (minutes_per_game !== undefined) {
      fields.push("minutes_per_game = ?");
      values.push(minutes_per_game);
    }

    if (fields.length === 0) {
      return res.status(400).json({
        success: false,
        code: "NO_FIELDS",
        message: "No valid fields to update",
      });
    }

    values.push(id);
    await db.execute(
      `UPDATE ps_games SET ${fields.join(", ")} WHERE id = ?`,
      values,
    );

    const updated = await db.execute(`${SELECT_GAMES} WHERE id = ?`, [id]);
    res.json({ success: true, data: updated.rows[0] });
  } catch (error) {
    console.error("Error updating PS game:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update PS game",
      error: error.message,
    });
  }
};

// ─── PATCH /api/v1/admin/ps-games/availability/:id ───────────────────────────

export const toggleAvailability = async (req, res) => {
  try {
    const { id } = req.params;

    const existing = await db.execute(
      `SELECT id, available FROM ps_games WHERE id = ?`,
      [id],
    );
    if (!existing.rows?.length) {
      return res
        .status(404)
        .json({ success: false, code: "NOT_FOUND", message: "Game not found" });
    }

    const current = existing.rows[0].available;
    const newValue = current === 1 ? 0 : 1;
    await db.execute(`UPDATE ps_games SET available = ? WHERE id = ?`, [
      newValue,
      id,
    ]);

    const updated = await db.execute(`${SELECT_GAMES} WHERE id = ?`, [id]);
    res.json({ success: true, data: updated.rows[0] });
  } catch (error) {
    console.error("Error toggling availability:", error);
    res.status(500).json({
      success: false,
      message: "Failed to toggle availability",
      error: error.message,
    });
  }
};

// ─── DELETE /api/v1/admin/ps-games/delete/:id ────────────────────────────────

export const deletePsGame = async (req, res) => {
  try {
    const { id } = req.params;

    const existing = await db.execute(`SELECT id FROM ps_games WHERE id = ?`, [
      id,
    ]);
    if (!existing.rows?.length) {
      return res
        .status(404)
        .json({ success: false, code: "NOT_FOUND", message: "Game not found" });
    }

    await db.execute(`DELETE FROM ps_games WHERE id = ?`, [id]);
    res.json({ success: true, message: "Game deleted successfully" });
  } catch (error) {
    console.error("Error deleting PS game:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete PS game",
      error: error.message,
    });
  }
};
