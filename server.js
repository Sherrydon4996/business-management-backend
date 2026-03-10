import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { PORT } from "./config/env.js";
import { globalErrorHandler } from "./middlewares/globalErroHandler.js";
import {
  createTables,
  runMigrations,
} from "./Controllers/createTables.controller.js";

// Middleware
import { authenticate } from "./middlewares/Authentication.js";
import { authorizeAdmin } from "./middlewares/adminAuthentication.js";

// Routers

import userRouter from "./RouteHandlers/userRoutes/user.routes.js";
import authRouter from "./RouteHandlers/auth.routes.js";

import { checkSession } from "./middlewares/checkSessionHandler.js";
import adminRouter from "./RouteHandlers/userRoutes/admin.route.js";
import incomeUserRouter from "./RouteHandlers/income/user.routes.js";
import expenseUserRouter from "./RouteHandlers/expenses/user.routes.js";
import expenseAdminRouter from "./RouteHandlers/expenses/admin.routes.js";
import incomeAdminRouter from "./RouteHandlers/income/admin.routes.js";
import earningsRouter from "./RouteHandlers/dailyEarnings/user.routes.js";
import dashboardRouter from "./RouteHandlers/dashboard/user.routes.js";
import contributionsUserRouter from "./RouteHandlers/contributions/user.routes.js";
import contributionsAdminRouter from "./RouteHandlers/contributions/admin.routes.js";
import summaryRouter from "./RouteHandlers/weeklySummary/user.routes.js";
import reportsRouter from "./RouteHandlers/report.routes.js";
import bookingUserRouter from "./RouteHandlers/movieBooking/user.routes.js";
import bookingAdminRouter from "./RouteHandlers/movieBooking/admin.routes.js";
import cyberServicesUserRouter from "./RouteHandlers/cyberServices/user.routes.js";
import cyberServicesAdminRouter from "./RouteHandlers/cyberServices/admin.route.js";
import psGamesUserRouter from "./RouteHandlers/PSGames/user.routes.js";
import psGamesAdminRouter from "./RouteHandlers/PSGames/admin.routes.js";
import computerSessionsAdminRouter from "./RouteHandlers/computerSessions/admin.routes.js";
import computerSessionsUserRouter from "./RouteHandlers/computerSessions/user.routes.js";
import moviesInventoryUserRouter from "./RouteHandlers/moviesInventory/user.routes.js";
import moviesInventoryAdminRouter from "./RouteHandlers/moviesInventory/admin.routes.js";
import aiUserRouter from "./RouteHandlers/AiAssistant/user.routes.js";
import debtsUserRouter from "./RouteHandlers/debts/user.routes.js";
import debtsAdminRouter from "./RouteHandlers/debts/admin.routes.js";

const app = express();

// Global middleware
app.use(express.json());
app.use(cookieParser());
// app.use(
//   cors({
//     origin: [
//       "http://localhost:5173",
//       "http://localhost:5174",
//       "https://business-management-frontend-rd7y.vercel.app",
//     ],
//     credentials: true,
//     methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
//     allowedHeaders: ["Content-Type", "Authorization"],
//   }),
// );
app.use(
  cors({
    origin: "https://business-management-frontend-rd7y.vercel.app",
    credentials: true,
  }),
);

app.options(
  "*",
  cors({
    origin: "https://business-management-frontend-rd7y.vercel.app",
    credentials: true,
  }),
);

// Public routes (no authentication required)
app.use("/api/v1/auth", authRouter);

// Protected user routes (authentication + session check)

app.use("/api/v1/users", authenticate, checkSession, userRouter);
app.use("/api/v1/income", authenticate, checkSession, incomeUserRouter);
app.use("/api/v1/expenses", authenticate, checkSession, expenseUserRouter);
app.use("/api/v1/daily-earnings", authenticate, checkSession, earningsRouter);
app.use("/api/v1/dashboard/stats", authenticate, checkSession, dashboardRouter);
app.use(
  "/api/v1/contributions",
  authenticate,
  checkSession,
  contributionsUserRouter,
);
app.use("/api/v1/weekly-summary", authenticate, checkSession, summaryRouter);
app.use("/api/v1/reports", authenticate, checkSession, reportsRouter);
app.use(
  "/api/v1/movie-bookings",
  authenticate,
  checkSession,
  bookingUserRouter,
);
app.use(
  "/api/v1/cyber-services",
  authenticate,
  checkSession,
  cyberServicesUserRouter,
);
app.use("/api/v1/ps-games", authenticate, checkSession, psGamesUserRouter);
app.use(
  "/api/v1/computer-sessions",
  authenticate,
  checkSession,
  computerSessionsUserRouter,
);

app.use(
  "/api/v1/movies-inventory",
  authenticate,
  checkSession,
  moviesInventoryUserRouter,
);

app.use("/api/v1/ai-assistant", authenticate, checkSession, aiUserRouter);
app.use("/api/v1/debts", authenticate, checkSession, debtsUserRouter);

// Protected admin routes (authentication + session check + admin authorization)

app.use(
  "/api/v1/admin/users",
  authenticate,
  checkSession,
  authorizeAdmin,
  adminRouter,
);

app.use(
  "/api/v1/admin/income",
  authenticate,
  checkSession,
  authorizeAdmin,
  incomeAdminRouter,
);
app.use(
  "/api/v1/admin/expenses",
  authenticate,
  checkSession,
  authorizeAdmin,
  expenseAdminRouter,
);

app.use(
  "/api/v1/admin/contributions",
  authenticate,
  checkSession,
  authorizeAdmin,
  contributionsAdminRouter,
);

app.use(
  "/api/v1/admin/movie-bookings",
  authenticate,
  checkSession,
  authorizeAdmin,
  bookingAdminRouter,
);
app.use(
  "/api/v1/admin/cyber-services",
  authenticate,
  checkSession,
  authorizeAdmin,
  cyberServicesAdminRouter,
);
app.use(
  "/api/v1/admin/ps-games",
  authenticate,
  checkSession,
  authorizeAdmin,
  psGamesAdminRouter,
);
app.use(
  "/api/v1/admin/computer-sessions",
  authenticate,
  checkSession,
  authorizeAdmin,
  computerSessionsAdminRouter,
);

app.use(
  "/api/v1/admin/movies-inventory",
  authenticate,
  checkSession,
  authorizeAdmin,
  moviesInventoryAdminRouter,
);
app.use(
  "/api/v1/admin/debts",
  authenticate,
  checkSession,
  authorizeAdmin,
  debtsAdminRouter,
);

// Error handler (must be last)
app.use(globalErrorHandler);

// Initialize database and start server
const startServer = async () => {
  try {
    // Create database tables and run migrations
    await createTables();
    await runMigrations();

    // Start the Express server
    app.listen(PORT, () => {
      console.log(`🚀 Server is running at http://localhost:${PORT}`);
      console.log(
        `📊 Automatic penalty calculation is active (runs daily at 12:01 AM)`,
      );
    });
  } catch (error) {
    console.error("❌ Failed to start server:", error);
    process.exit(1);
  }
};

// Start the server
startServer();
