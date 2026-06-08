// 🔥 LOAD ENV FIRST — DO NOT REMOVE
import "./env.js";

import app from "./api/index.js";

const PORT = process.env.PORT || 3000;

// ─────────────────────────────────────────────────────────
// 🛡️  Global crash guards — prevent one bad request from
//     killing the entire Node.js process.
//     Logs errors but keeps the server alive.
// ─────────────────────────────────────────────────────────
process.on("uncaughtException", (err) => {
  console.error("💥 Uncaught Exception — server kept alive:", err.message);
  console.error(err.stack);
  // Do NOT call process.exit() — let it keep running
});

process.on("unhandledRejection", (reason, promise) => {
  console.error("💥 Unhandled Promise Rejection — server kept alive:");
  console.error("Promise:", promise);
  console.error("Reason:", reason);
  // Do NOT call process.exit() — let it keep running
});

// ─────────────────────────────────────────────────────────
// 🚀  Start Server
// ─────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`🔥 Local server running at http://localhost:${PORT}`);
});
