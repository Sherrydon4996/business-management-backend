// src/controllers/cyber-services/cyberServices.controller.js

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

const SELECT_SERVICES = `
  SELECT id, name, description, price, date_added, created_at
  FROM cyber_services
`;

// ─── GET /api/v1/cyber-services/get ──────────────────────────────────────────

export const getCyberServices = async (req, res) => {
  try {
    const result = await db.execute(
      `${SELECT_SERVICES} ORDER BY date_added DESC`,
    );
    res.json({ success: true, records: result.rows || [] });
  } catch (error) {
    console.error("Error fetching cyber services:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch cyber services",
      error: error.message,
    });
  }
};

// ─── POST /api/v1/admin/cyber-services/create ────────────────────────────────

export const createCyberService = async (req, res) => {
  try {
    const { name, description, price } = req.body;

    if (!name || price === undefined) {
      return res.status(400).json({
        success: false,
        code: "MISSING_FIELDS",
        message: "name and price are required",
      });
    }
    if (typeof price !== "number" || price <= 0) {
      return res.status(400).json({
        success: false,
        code: "INVALID_PRICE",
        message: "price must be a positive number",
      });
    }

    const id = uuidv4();
    await db.execute(
      `INSERT INTO cyber_services (id, name, description, price, date_added)
       VALUES (?, ?, ?, ?, ?)`,
      [id, name.trim(), description?.trim() ?? null, price, getNowEAT()],
    );

    const inserted = await db.execute(`${SELECT_SERVICES} WHERE id = ?`, [id]);
    res.status(201).json({ success: true, data: inserted.rows[0] });
  } catch (error) {
    console.error("Error creating cyber service:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create cyber service",
      error: error.message,
    });
  }
};

// ─── PUT /api/v1/admin/cyber-services/update/:id ─────────────────────────────

export const updateCyberService = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, price } = req.body;

    const existing = await db.execute(
      `SELECT id FROM cyber_services WHERE id = ?`,
      [id],
    );
    if (!existing.rows?.length) {
      return res.status(404).json({
        success: false,
        code: "NOT_FOUND",
        message: "Service not found",
      });
    }

    const fields = [];
    const values = [];

    if (name !== undefined) {
      fields.push("name = ?");
      values.push(name.trim());
    }
    if (description !== undefined) {
      fields.push("description = ?");
      values.push(description?.trim() ?? null);
    }
    if (price !== undefined) {
      if (typeof price !== "number" || price <= 0) {
        return res.status(400).json({
          success: false,
          code: "INVALID_PRICE",
          message: "price must be a positive number",
        });
      }
      fields.push("price = ?");
      values.push(price);
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
      `UPDATE cyber_services SET ${fields.join(", ")} WHERE id = ?`,
      values,
    );

    const updated = await db.execute(`${SELECT_SERVICES} WHERE id = ?`, [id]);
    res.json({ success: true, data: updated.rows[0] });
  } catch (error) {
    console.error("Error updating cyber service:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update cyber service",
      error: error.message,
    });
  }
};

// ─── DELETE /api/v1/admin/cyber-services/delete/:id ──────────────────────────

export const deleteCyberService = async (req, res) => {
  try {
    const { id } = req.params;

    const existing = await db.execute(
      `SELECT id FROM cyber_services WHERE id = ?`,
      [id],
    );
    if (!existing.rows?.length) {
      return res.status(404).json({
        success: false,
        code: "NOT_FOUND",
        message: "Service not found",
      });
    }

    await db.execute(`DELETE FROM cyber_services WHERE id = ?`, [id]);
    res.json({ success: true, message: "Service deleted successfully" });
  } catch (error) {
    console.error("Error deleting cyber service:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete cyber service",
      error: error.message,
    });
  }
};
