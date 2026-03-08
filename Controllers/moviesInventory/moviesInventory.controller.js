// src/controllers/movies-inventory/moviesInventory.controller.js

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

const SELECT_ITEMS = `
  SELECT id, title, genre, year, type, seasons, date_added, created_at
  FROM movies_inventory
`;

// ─── GET /api/v1/movies-inventory/get ────────────────────────────────────────
//  Optional query params: ?type=movie | ?type=series

export const getMoviesInventory = async (req, res) => {
  try {
    const { type } = req.query;

    let query = `${SELECT_ITEMS}`;
    const args = [];

    if (type === "movie" || type === "series") {
      query += ` WHERE type = ?`;
      args.push(type);
    }

    query += ` ORDER BY date_added DESC`;

    const result = await db.execute(query, args);
    res.json({ success: true, records: result.rows || [] });
  } catch (error) {
    console.error("Error fetching movies inventory:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch inventory",
      error: error.message,
    });
  }
};

// ─── POST /api/v1/admin/movies-inventory/create ───────────────────────────────

export const createMovieInventoryItem = async (req, res) => {
  try {
    const { title, genre, year, type, seasons } = req.body;

    if (!title || !genre || !year || !type) {
      return res.status(400).json({
        success: false,
        code: "MISSING_FIELDS",
        message: "title, genre, year, and type are required",
      });
    }
    if (type !== "movie" && type !== "series") {
      return res.status(400).json({
        success: false,
        code: "INVALID_TYPE",
        message: "type must be 'movie' or 'series'",
      });
    }
    if (type === "series" && seasons !== undefined) {
      if (typeof seasons !== "number" || seasons < 1) {
        return res.status(400).json({
          success: false,
          code: "INVALID_SEASONS",
          message: "seasons must be a positive integer",
        });
      }
    }

    const id = uuidv4();
    await db.execute(
      `INSERT INTO movies_inventory (id, title, genre, year, type, seasons, date_added)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        title.trim(),
        genre.trim(),
        String(year).trim(),
        type,
        type === "series" && seasons ? seasons : null,
        getNowEAT(),
      ],
    );

    const inserted = await db.execute(`${SELECT_ITEMS} WHERE id = ?`, [id]);
    res.status(201).json({ success: true, data: inserted.rows[0] });
  } catch (error) {
    console.error("Error creating inventory item:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create inventory item",
      error: error.message,
    });
  }
};

// ─── PUT /api/v1/admin/movies-inventory/update/:id ────────────────────────────

export const updateMovieInventoryItem = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, genre, year, seasons } = req.body;

    const existing = await db.execute(
      `SELECT id FROM movies_inventory WHERE id = ?`,
      [id],
    );
    if (!existing.rows?.length) {
      return res.status(404).json({
        success: false,
        code: "NOT_FOUND",
        message: "Item not found",
      });
    }

    const fields = [];
    const values = [];

    if (title !== undefined) {
      fields.push("title = ?");
      values.push(title.trim());
    }
    if (genre !== undefined) {
      fields.push("genre = ?");
      values.push(genre.trim());
    }
    if (year !== undefined) {
      fields.push("year = ?");
      values.push(String(year).trim());
    }
    if (seasons !== undefined) {
      fields.push("seasons = ?");
      values.push(seasons || null);
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
      `UPDATE movies_inventory SET ${fields.join(", ")} WHERE id = ?`,
      values,
    );

    const updated = await db.execute(`${SELECT_ITEMS} WHERE id = ?`, [id]);
    res.json({ success: true, data: updated.rows[0] });
  } catch (error) {
    console.error("Error updating inventory item:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update inventory item",
      error: error.message,
    });
  }
};

// ─── DELETE /api/v1/admin/movies-inventory/delete/:id ─────────────────────────

export const deleteMovieInventoryItem = async (req, res) => {
  try {
    const { id } = req.params;

    const existing = await db.execute(
      `SELECT id FROM movies_inventory WHERE id = ?`,
      [id],
    );
    if (!existing.rows?.length) {
      return res.status(404).json({
        success: false,
        code: "NOT_FOUND",
        message: "Item not found",
      });
    }

    await db.execute(`DELETE FROM movies_inventory WHERE id = ?`, [id]);
    res.json({ success: true, message: "Item deleted successfully" });
  } catch (error) {
    console.error("Error deleting inventory item:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete inventory item",
      error: error.message,
    });
  }
};
