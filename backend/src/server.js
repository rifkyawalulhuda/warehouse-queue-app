require("dotenv").config();

const fs = require("fs");
const path = require("path");
const app = require("./app");
const {
  AUTO_COMPLETE_AFTER_DAYS,
  autoCompleteExpiredQueueEntries,
} = require("./services/queue.service");
const { markNoShowScheduleItems } = require("./services/schedule.service");
const {
  markStaleExportJobsFailed,
  cleanupExpiredExportFiles,
  kickExportWorker,
} = require("./services/export.service");

const PORT = process.env.PORT || 3000;
const AUTO_COMPLETE_INTERVAL_MS = 60 * 60 * 1000;
const SCHEDULE_NO_SHOW_INTERVAL_MS = 60 * 60 * 1000;
const EXPORT_CLEANUP_INTERVAL_MS = 60 * 60 * 1000;
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

async function runScheduleNoShowJob() {
  try {
    const { updatedCount } = await markNoShowScheduleItems();
    if (updatedCount > 0) {
      console.log(`[schedule-no-show] ${updatedCount} jadwal truk ditandai NO_SHOW oleh sistem`);
    }
  } catch (error) {
    console.error("[schedule-no-show] gagal menjalankan penandaan no-show", error);
  }
}

async function runExportCleanupJob() {
  try {
    const removed = await cleanupExpiredExportFiles();
    if (removed > 0) {
      console.log(`[export-cleanup] ${removed} file export kedaluwarsa dihapus`);
    }
  } catch (error) {
    console.error("[export-cleanup] gagal membersihkan file export", error);
  }
}

async function bootstrapExportJobs() {
  try {
    const failed = await markStaleExportJobsFailed();
    if (failed > 0) {
      console.log(`[export-job] ${failed} job export menggantung ditandai GAGAL`);
    }
    void kickExportWorker();
  } catch (error) {
    console.error("[export-job] gagal menyiapkan worker export", error);
  }
}

app.listen(PORT, () => {
  console.log(`API running on port ${PORT}`);
  runQueueAutoCompleteJob();
  runScheduleNoShowJob();
  void bootstrapExportJobs();
  runExportCleanupJob();
  setInterval(runQueueAutoCompleteJob, AUTO_COMPLETE_INTERVAL_MS);
  setInterval(runScheduleNoShowJob, SCHEDULE_NO_SHOW_INTERVAL_MS);
  setInterval(runExportCleanupJob, EXPORT_CLEANUP_INTERVAL_MS);
});
