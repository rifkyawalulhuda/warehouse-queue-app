require("dotenv").config();

const app = require("./app");
const {
  AUTO_COMPLETE_AFTER_DAYS,
  autoCompleteExpiredQueueEntries,
} = require("./services/queue.service");

const PORT = process.env.PORT || 3000;
const AUTO_COMPLETE_INTERVAL_MS = 60 * 60 * 1000;

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
