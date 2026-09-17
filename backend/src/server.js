require("dotenv").config();

const fs = require("fs");
const path = require("path");
const app = require("./app");
const {
  AUTO_COMPLETE_AFTER_DAYS,
  autoCompleteExpiredQueueEntries,
} = require("./services/queue.service");

const PORT = process.env.PORT || 3000;
const AUTO_COMPLETE_INTERVAL_MS = 60 * 60 * 1000;
const LOG_FILE = path.join(__dirname, "..", "runtime.log");

function logToFile(level, ...args) {
  const timestamp = new Date().toISOString();
  const message = args.map((a) => (typeof a === "object" ? JSON.stringify(a) : String(a))).join(" ");
  const line = `[${timestamp}] [${level}] ${message}\n`;
  fs.appendFileSync(LOG_FILE, line);
  console[level === "error" ? "error" : "log"](...args);
}

process.on("uncaughtException", (err) => {
  logToFile("error", "[FATAL] uncaughtException:", err);
});

process.on("unhandledRejection", (reason, promise) => {
  logToFile("error", "[FATAL] unhandledRejection at:", promise, "reason:", reason);
});

process.on("exit", (code) => {
  logToFile("error", "[FATAL] process.exit called with code:", code);
});

process.on("SIGINT", () => {
  logToFile("error", "[FATAL] SIGINT received");
  process.exit(0);
});

process.on("SIGTERM", () => {
  logToFile("error", "[FATAL] SIGTERM received");
  process.exit(0);
});

async function runQueueAutoCompleteJob() {
  try {
    const { updatedCount } = await autoCompleteExpiredQueueEntries();
    if (updatedCount > 0) {
      console.log(
        `[queue-auto-complete] ${updatedCount} data antrian lebih dari ${AUTO_COMPLETE_AFTER_DAYS} hari ditandai SELESAI oleh sistem`
      );
    }
  } catch (error) {
    console.error("[queue-auto-complete] gagal menjalankan auto complete antrian", error);
  }
}

app.listen(PORT, () => {
  console.log(`API running on port ${PORT}`);
  runQueueAutoCompleteJob();
  setInterval(runQueueAutoCompleteJob, AUTO_COMPLETE_INTERVAL_MS);
});
