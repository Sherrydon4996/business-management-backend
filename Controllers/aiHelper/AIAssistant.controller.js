import { GoogleGenerativeAI } from "@google/generative-ai";
import { db } from "../../config/db.js";
import { GEMINI_API_KEY } from "../../config/env.js";

// ─── In-memory conversation store ─────────────────────────────────────────────
// Gemini history format: { role: "user" | "model", parts: [{ text }] }[]
const conversationStore = new Map();
const MAX_PAIRS = 15; // 15 user+model pairs = 30 entries max

// ─── Gemini client ────────────────────────────────────────────────────────────
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

// ─── POST /api/v1/ai-assistant/chat ──────────────────────────────────────────

export const chat = async (req, res) => {
  try {
    const { message } = req.body;
    const userId = req.user?.id ?? "anonymous";

    if (!message?.trim()) {
      return res.status(400).json({
        success: false,
        code: "MISSING_MESSAGE",
        message: "message is required",
      });
    }

    // 1. Build fresh business context from DB
    const context = await buildBusinessContext();

    // 2. Get or init conversation history for this user
    if (!conversationStore.has(userId)) {
      conversationStore.set(userId, []);
    }
    const history = conversationStore.get(userId);

    // 3. Create Gemini model with system instruction + chat session
    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash-lite",
      systemInstruction: buildSystemPrompt(context),
      generationConfig: {
        maxOutputTokens: 350,
        temperature: 0.65,
        topP: 0.9,
      },
    });

    const chatSession = model.startChat({ history });

    // 4. Send the user message
    const result = await chatSession.sendMessage(message.trim());
    const reply = result.response.text().trim();

    // 5. Append to history and trim to MAX_PAIRS
    history.push(
      { role: "user", parts: [{ text: message.trim() }] },
      { role: "model", parts: [{ text: reply }] },
    );
    const maxEntries = MAX_PAIRS * 2;
    if (history.length > maxEntries) {
      history.splice(0, history.length - maxEntries);
    }
    conversationStore.set(userId, history);

    res.json({
      success: true,
      reply,
      historyLength: Math.floor(history.length / 2),
    });
  } catch (error) {
    console.error("AI Assistant error:", error);
    const isKeyError =
      error?.message?.includes("API_KEY") ||
      error?.message?.includes("API key") ||
      error?.status === 400 ||
      error?.status === 403;

    res.status(isKeyError ? 401 : 500).json({
      success: false,
      code: isKeyError ? "INVALID_API_KEY" : "AI_ERROR",
      message: isKeyError
        ? "Invalid or missing Gemini API key. Set GEMINI_API_KEY in your .env file."
        : "AI assistant failed. Please try again.",
      error: error.message,
    });
  }
};

// ─── DELETE /api/v1/ai-assistant/clear ───────────────────────────────────────

export const clearHistory = async (req, res) => {
  try {
    conversationStore.delete(req.user?.id ?? "anonymous");
    res.json({ success: true, message: "Conversation cleared." });
  } catch {
    res
      .status(500)
      .json({ success: false, message: "Failed to clear history." });
  }
};

// ─── GET /api/v1/ai-assistant/history ────────────────────────────────────────

export const getHistory = async (req, res) => {
  try {
    const history = conversationStore.get(req.user?.id ?? "anonymous") ?? [];
    const turns = [];
    for (let i = 0; i < history.length; i += 2) {
      turns.push({
        user: history[i]?.parts?.[0]?.text ?? "",
        assistant: history[i + 1]?.parts?.[0]?.text ?? "",
      });
    }
    res.json({ success: true, history: turns, count: turns.length });
  } catch {
    res
      .status(500)
      .json({ success: false, message: "Failed to fetch history." });
  }
};

// ─── Business context builder ─────────────────────────────────────────────────

async function buildBusinessContext() {
  const now = new Date();
  const eatMs = now.getTime() + 3 * 3_600_000;
  const eatNow = new Date(eatMs);
  const pad = (n) => String(n).padStart(2, "0");

  const today = `${eatNow.getUTCFullYear()}-${pad(eatNow.getUTCMonth() + 1)}-${pad(eatNow.getUTCDate())}`;
  const month = `${eatNow.getUTCFullYear()}-${pad(eatNow.getUTCMonth() + 1)}`;
  const year = String(eatNow.getUTCFullYear());

  const dow = (eatNow.getUTCDay() + 6) % 7;
  const wkStart = fmtDate(new Date(eatMs - dow * 86_400_000));
  const wkEnd = fmtDate(new Date(eatMs + (6 - dow) * 86_400_000));

  const [
    todayInc,
    todayExp,
    weekInc,
    weekExp,
    monthInc,
    monthExp,
    yearInc,
    yearExp,
    incByCat,
    expByCat,
    recentIncome,
    recentExpenses,
    contributions,
    activeBookings,
    bookingSummary,
    moviesCount,
    seriesCount,
    psGames,
    cyberServices,
    last7Days,
  ] = await Promise.all([
    scalar(
      `SELECT COALESCE(SUM(amount),0) AS v FROM income   WHERE SUBSTR(date,1,10)=?`,
      [today],
    ),
    scalar(
      `SELECT COALESCE(SUM(amount),0) AS v FROM expenses WHERE SUBSTR(date,1,10)=?`,
      [today],
    ),
    scalar(
      `SELECT COALESCE(SUM(amount),0) AS v FROM income   WHERE SUBSTR(date,1,10)>=? AND SUBSTR(date,1,10)<=?`,
      [wkStart, wkEnd],
    ),
    scalar(
      `SELECT COALESCE(SUM(amount),0) AS v FROM expenses WHERE SUBSTR(date,1,10)>=? AND SUBSTR(date,1,10)<=?`,
      [wkStart, wkEnd],
    ),
    scalar(
      `SELECT COALESCE(SUM(amount),0) AS v FROM income   WHERE SUBSTR(date,1,7)=?`,
      [month],
    ),
    scalar(
      `SELECT COALESCE(SUM(amount),0) AS v FROM expenses WHERE SUBSTR(date,1,7)=?`,
      [month],
    ),
    scalar(
      `SELECT COALESCE(SUM(amount),0) AS v FROM income   WHERE SUBSTR(date,1,4)=?`,
      [year],
    ),
    scalar(
      `SELECT COALESCE(SUM(amount),0) AS v FROM expenses WHERE SUBSTR(date,1,4)=?`,
      [year],
    ),
    rows(
      `SELECT category, ROUND(SUM(amount),2) AS total FROM income   GROUP BY category ORDER BY total DESC`,
    ),
    rows(
      `SELECT category, ROUND(SUM(amount),2) AS total FROM expenses GROUP BY category ORDER BY total DESC`,
    ),
    rows(
      `SELECT amount, category, description, SUBSTR(date,1,10) AS day FROM income   ORDER BY date DESC LIMIT 5`,
    ),
    rows(
      `SELECT amount, category, description, SUBSTR(date,1,10) AS day FROM expenses ORDER BY date DESC LIMIT 5`,
    ),
    rows(
      `SELECT type, status, ROUND(SUM(amount),2) AS total, COUNT(*) AS count FROM contributions GROUP BY type, status`,
    ),
    rows(
      `SELECT customer_name, title, type, pick_date, amount, status FROM movie_bookings WHERE status IN ('active','pending') ORDER BY pick_date ASC LIMIT 10`,
    ),
    rows(
      `SELECT status, COUNT(*) AS count, ROUND(SUM(amount),2) AS total FROM movie_bookings GROUP BY status`,
    ),
    scalar(`SELECT COUNT(*) AS v FROM movies_inventory WHERE type='movie'`),
    scalar(`SELECT COUNT(*) AS v FROM movies_inventory WHERE type='series'`),
    rows(
      `SELECT name, platform, price_per_hour, minutes_per_game, available FROM ps_games ORDER BY available DESC, name ASC`,
    ),
    rows(`SELECT name, price FROM cyber_services ORDER BY price DESC`),
    rows(
      `
      SELECT date_key,
        ROUND(SUM(CASE WHEN src='income'   THEN amt ELSE 0 END),2) AS income,
        ROUND(SUM(CASE WHEN src='expenses' THEN amt ELSE 0 END),2) AS expenses
      FROM (
        SELECT 'income'   AS src, amount AS amt, SUBSTR(date,1,10) AS date_key FROM income
        UNION ALL
        SELECT 'expenses' AS src, amount AS amt, SUBSTR(date,1,10) AS date_key FROM expenses
      )
      WHERE date_key >= ?
      GROUP BY date_key ORDER BY date_key DESC
    `,
      [fmtDate(new Date(eatMs - 6 * 86_400_000))],
    ),
  ]);

  return {
    today,
    wkStart,
    wkEnd,
    month,
    year,
    todayInc,
    todayExp,
    todayProfit: todayInc - todayExp,
    weekInc,
    weekExp,
    weekProfit: weekInc - weekExp,
    monthInc,
    monthExp,
    monthProfit: monthInc - monthExp,
    yearInc,
    yearExp,
    yearProfit: yearInc - yearExp,
    incByCat,
    expByCat,
    recentIncome,
    recentExpenses,
    contributions,
    activeBookings,
    bookingSummary,
    moviesCount,
    seriesCount,
    psGames,
    cyberServices,
    last7Days,
  };
}

// ─── System prompt ────────────────────────────────────────────────────────────

function buildSystemPrompt(ctx) {
  const fmt = (n) => `KES ${Number(n).toLocaleString()}`;
  const sign = (n) => (n >= 0 ? `+${fmt(n)}` : `-${fmt(Math.abs(n))}`);

  const catList = (arr) =>
    arr.map((r) => `${r.category || r.type}: ${fmt(r.total)}`).join(", ") ||
    "none";

  const gameList =
    ctx.psGames
      .map(
        (g) =>
          `${g.name} (${g.platform}, ${fmt(g.price_per_hour)}/hr, ${g.minutes_per_game}min/game, ${g.available ? "available" : "unavailable"})`,
      )
      .join("; ") || "none";

  const serviceList =
    ctx.cyberServices.map((s) => `${s.name}: ${fmt(s.price)}`).join(", ") ||
    "none";

  const bookingList =
    ctx.activeBookings
      .map(
        (b) =>
          `${b.customer_name} – ${b.title} (${b.type}, pick: ${b.pick_date}, ${fmt(b.amount)}, ${b.status})`,
      )
      .join("\n    ") || "none";

  const trendList =
    ctx.last7Days
      .map(
        (d) =>
          `${d.date_key}: income ${fmt(d.income)}, expenses ${fmt(d.expenses)}`,
      )
      .join("\n    ") || "no data";

  const contribSummary =
    ctx.contributions
      .map((c) => `${c.type}/${c.status}: ${fmt(c.total)} (${c.count})`)
      .join(", ") || "none";

  return `You are a sharp, trusted financial advisor for a Kenyan cyber cafe. You have live access to all the business data below.

STRICT RULES

AUTHENTICATION
Always ask for the chat password before answering any question if the session is not authenticated.  
The password is "harryTech".  
The owner’s name is Edwin or Harry.  
If the password is missing or incorrect, reply only with:  
"Seems like you are a guest visitor to the app and I am not authorized to disclose any information."  
Once the correct password is provided, allow the conversation until the user logs out.  
After logout, require the password again before answering any new questions.

RESPONSE RULES
1. Reply in 1–5 short sentences only.
2. Always end with exactly ONE follow-up question.
3. Only reference numbers from the provided business data. Never invent figures.
4. If data is unavailable, say so in one short sentence.
5. Do not use markdown, tables, or headings.
6. Write KES amounts with commas and use at most 2 emojis.
7. Be direct, conversational, and friendly like a trusted advisor.
8. Remember previous questions to maintain context.
9. Use bullet points only when listing multiple items.



════════════ LIVE BUSINESS DATA — ${ctx.today} ════════════

FINANCIALS:
  Today  → Income ${fmt(ctx.todayInc)} | Expenses ${fmt(ctx.todayExp)} | Profit ${sign(ctx.todayProfit)}
  Week   → Income ${fmt(ctx.weekInc)}  | Expenses ${fmt(ctx.weekExp)}  | Profit ${sign(ctx.weekProfit)}
  Month  → Income ${fmt(ctx.monthInc)} | Expenses ${fmt(ctx.monthExp)} | Profit ${sign(ctx.monthProfit)}
  Year   → Income ${fmt(ctx.yearInc)}  | Expenses ${fmt(ctx.yearExp)}  | Profit ${sign(ctx.yearProfit)}

INCOME BY CATEGORY (all time): ${catList(ctx.incByCat)}
EXPENSES BY CATEGORY (all time): ${catList(ctx.expByCat)}

LAST 7 DAYS:
    ${trendList}

RECENT INCOME:
    ${ctx.recentIncome.map((r) => `${r.day} | ${r.category} | ${fmt(r.amount)} | ${r.description || "—"}`).join("\n    ") || "none"}

RECENT EXPENSES:
    ${ctx.recentExpenses.map((r) => `${r.day} | ${r.category} | ${fmt(r.amount)} | ${r.description || "—"}`).join("\n    ") || "none"}

CONTRIBUTIONS: ${contribSummary}

ACTIVE/PENDING BOOKINGS:
    ${bookingList}
BOOKING TOTALS: ${ctx.bookingSummary.map((b) => `${b.status}: ${b.count} (${fmt(b.total)})`).join(" | ") || "none"}

INVENTORY: ${ctx.moviesCount} movies, ${ctx.seriesCount} series

PS GAMES: ${gameList}

CYBER SERVICES: ${serviceList}
══════════════════════════════════════════════════════════`;
}

// ─── DB helpers ───────────────────────────────────────────────────────────────

async function scalar(sql, args = []) {
  const r = await db.execute(sql, args);
  return r.rows?.[0]?.v ?? 0;
}

async function rows(sql, args = []) {
  const r = await db.execute(sql, args);
  return r.rows ?? [];
}

function fmtDate(d) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}
