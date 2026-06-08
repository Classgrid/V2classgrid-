import "../env.js"; // 🔥 Load config FIRST
import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import passport from "passport";
import cookieParser from "cookie-parser";

import connectDB from "../config/db.js";
import passportConfig from "../src/services/passport.service.js";

import authRoutes from "../src/routes/auth.routes.js";
import userRoutes from "../src/routes/user.routes.js";
import chatRoutes from "../src/routes/chat.routes.js";
import notesRoutes from "../src/routes/notes.routes.js";
import classroomRoutes from "../src/routes/classroom.routes.js";
import activityRoutes from "../src/routes/activity.routes.js";
import messagingRoutes from "../src/routes/messaging.routes.js";
import classroomChatRoutes from "../src/routes/classroom_chat.routes.js";
import notificationRoutes from "../src/routes/notification.routes.js";
import organizationRoutes from "../src/routes/organization.routes.js";
import adminRoutes from "../src/routes/admin.routes.js";
import digestRoutes from "../src/routes/digest.routes.js";
import paymentRoutes from "../src/routes/payment.routes.js";
import attendanceRoutes from "../src/routes/attendance.routes.js";
import cronRoutes from "../src/routes/cron.routes.js";
import demoRoutes from "../src/routes/demo.routes.js";
import quizRoutes from "../src/routes/quiz.routes.js";
import marksRoutes from "../src/routes/marks.routes.js";
import { sendEmail } from "../src/services/brevo.service.js";
import { metricsMiddleware, startMetricsFlush } from "../src/middleware/metrics.middleware.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

console.log("BUILD VERSION: 2026-AUDIT");
console.log("SMTP HOST:", process.env.BREVO_SMTP_HOST);
console.log("SMTP USER:", process.env.BREVO_SMTP_USER);
console.log("SMTP SENDER:", process.env.BREVO_SENDER_EMAIL);

/* ---------- DB ---------- */
connectDB().catch(err => console.error("Initial DB connect error:", err));
startMetricsFlush(); // Start buffered metrics flush loop (60s interval)

/* ---------- CONFIG ---------- */
passportConfig(); // Initialize passport strategies

// 🔐 TRUST PROXY (Required for production behind reverse proxy like Vercel/Nginx)
app.set('trust proxy', 1);

/* ---------- MIDDLEWARE ---------- */
app.use(
  cors({
    origin: [
      "http://localhost:3000",
      "http://127.0.0.1:3000",
      "https://www.classgrid.in",
      "https://classgrid.in",
      "https://classgridplatform.vercel.app"
    ],
    credentials: true
  })
);

// Skip JSON body parsing for Razorpay webhook — it needs the raw body for signature verification
app.use((req, res, next) => {
  if (req.originalUrl === '/api/payments/webhook') return next();
  express.json({ limit: '2mb' })(req, res, next);
});
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser(process.env.COOKIE_SECRET)); // Use cookie parser
app.use(passport.initialize());

// Debug Middleware: Log all requests
app.use((req, res, next) => {
  console.log(`➡️  ${req.method} ${req.originalUrl}`);
  next();
});

// API Metrics Middleware (zero-overhead in-memory buffering)
app.use(metricsMiddleware);

/* ---------- CACHE CONTROL — Prevent bfcache on HTML pages ---------- */
app.use((req, res, next) => {
  // Only set no-store for HTML page requests (not for JS/CSS/image assets)
  if (!req.path.startsWith("/api") && !req.path.match(/\.(js|css|png|jpg|jpeg|gif|svg|ico|woff2?|ttf|webp|mp4|webm)$/i)) {
    res.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
    res.set("Pragma", "no-cache");
    res.set("Expires", "0");
  }
  next();
});

/* ---------- STATIC FILES ---------- */
app.use(express.static(path.join(__dirname, "../public")));

/* ---------- API ROUTES ---------- */
app.use("/api/auth", authRoutes);
app.use("/api/user", userRoutes);
app.use("/api/chat", chatRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/notes", notesRoutes);
app.use("/api/classrooms", classroomRoutes);
app.use("/api/classroom", classroomRoutes); // Fix: Alias for singular access
app.use("/api/activity", activityRoutes);
app.use("/api/messages", messagingRoutes);
app.use("/api/classroom-chat", classroomChatRoutes);
app.use("/api/organization", organizationRoutes);
app.use("/api/org", organizationRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/demo", demoRoutes);
app.use("/api/digest", digestRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/attendance", attendanceRoutes);
app.use("/api/cron", cronRoutes);
app.use("/api/quiz", quizRoutes);
app.use("/api/marks", marksRoutes);

/* ---------- HEALTH ---------- */
app.get("/api/health", (req, res) => {
  res.json({
    status: "OK",
    env: process.env.NODE_ENV || "development"
  });
});

app.get("/api/email-test", async (req, res) => {
  console.log("TEST ROUTE HIT");

  try {
    const info = await sendEmail({
      to: "nikhil.shinde@classgrid.in",
      subject: "Direct SMTP Test",
      text: "Testing direct send",
      html: "<h1>Direct Test</h1>"
    });
    console.log("TEST DIRECT SEND INFO", info);
    res.send("Done: " + JSON.stringify(info));
  } catch (error) {
    console.error("TEST DIRECT SEND ERROR", error);
    res.status(500).send("Error: " + error.message);
  }
});

/* ---------- LEGACY OAUTH CALLBACK REDIRECTS ---------- */
// Google Console / Vercel may have old callback path format: /api/auth/callback/google
// The actual Express routes use: /api/auth/google/callback
// These redirects ensure both formats work
app.get("/api/auth/callback/google", (req, res) => {
  const qs = req.url.includes("?") ? req.url.substring(req.url.indexOf("?")) : "";
  res.redirect(307, `/api/auth/google/callback${qs}`);
});
app.get("/api/auth/callback/github", (req, res) => {
  const qs = req.url.includes("?") ? req.url.substring(req.url.indexOf("?")) : "";
  res.redirect(307, `/api/auth/github/callback${qs}`);
});
app.get("/api/auth/callback/facebook", (req, res) => {
  const qs = req.url.includes("?") ? req.url.substring(req.url.indexOf("?")) : "";
  res.redirect(307, `/api/auth/facebook/callback${qs}`);
});

app.get("/api/config", (req, res) => {
  res.json({ recaptchaSiteKey: process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY });
});

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "../public/index.html"));
});

/* ---------- ISOLATED LOGIN ROUTES ---------- */
app.get("/admin/login", (req, res) => {
  res.sendFile(path.join(__dirname, "../public/admin-login.html"), err => {
    if (err) res.status(404).send("Admin Login not found");
  });
});

app.get("/admin/activate", (req, res) => {
  res.sendFile(path.join(__dirname, "../public/admin/activate.html"), err => {
    if (err) res.status(404).send("Admin Activation page not found");
  });
});

app.get("/faculty/activate", (req, res) => {
  res.sendFile(path.join(__dirname, "../public/faculty/activate.html"), err => {
    if (err) res.status(404).send("Faculty Activation page not found");
  });
});

app.get("/superadmin/login", (req, res) => {
  res.sendFile(path.join(__dirname, "../public/superadmin-login.html"), err => {
    if (err) res.status(404).send("Super Admin Login not found");
  });
});

/* ---------- DEDICATED ADMIN DASHBOARD ROUTES (must be before /:page) ---------- */
app.get("/super-admin", (req, res) => {
  res.sendFile(path.join(__dirname, "../public/super-admin-dashboard.html"), err => {
    if (err) res.status(404).send("Super Admin Dashboard not found");
  });
});

/* ---------- CUSTOM ORGANIZATION DASHBOARD ROUTE ---------- */
app.get("/org/:name/admin", (req, res) => {
  res.sendFile(path.join(__dirname, "../public/org-admin-dashboard.html"), err => {
    if (err) res.status(404).send("Dashboard not found");
  });
});

/* ---------- GENERIC CLEAN URL HANDLER ---------- */
app.get("/:page", (req, res, next) => {
  if (req.path.startsWith("/api")) return next();

  const filePath = path.join(
    __dirname,
    "../public",
    `${req.params.page}.html`
  );

  res.sendFile(filePath, err => {
    if (err) next();
  });
});

/* ---------- FINAL FALLBACK ---------- */
// NOTE: Do NOT redirect to login.html here — that causes ALL unresolved routes to force
// a login redirect, breaking the super-admin and org-admin dashboards.
// Auth guards on the frontend pages are responsible for authentication redirects.
app.get("*", (req, res) => {
  if (req.path.startsWith("/api")) {
    return res.status(404).json({ error: "API not found" });
  }

  // Return 404 for truly unknown pages — let the browser show a 404
  res.status(404).sendFile(path.join(__dirname, "../public/index.html"), err => {
    if (err) res.status(404).send("Page not found");
  });
});

/* ---------- GLOBAL ERROR HANDLER ---------- */
app.use((err, req, res, next) => {
  console.error("🔥 [Global Error]:", err);

  // Format consistently, no stack trace
  res.status(err.status || 500).json({
    success: false,
    message: err.message || "Something went wrong",
    code: err.code || "SERVER_ERROR"
  });
});

export default app;
