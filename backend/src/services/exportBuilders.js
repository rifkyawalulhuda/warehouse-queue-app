const ExcelJS = require("exceljs");
const queueService = require("./queue.service");

/* ------------------------------------------------------------------ */
/* Formatter bersama                                                   */
/* ------------------------------------------------------------------ */

function pad(value) {
  return String(value).padStart(2, "0");
}

function formatDateTimeDmy(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()} ${pad(
    date.getHours()
  )}:${pad(date.getMinutes())}`;
}

function formatDateOnlyDmy(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()}`;
}

function formatDateOnlyUtcDmy(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return `${pad(date.getUTCDate())}/${pad(date.getUTCMonth() + 1)}/${date.getUTCFullYear()}`;
}

function formatTimeOnly(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function formatDateTimeIso(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(
    date.getHours()
  )}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

function formatDateOnlyIso(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function formatDurationHuman(startValue, endValue) {
  if (!startValue || !endValue) return "-";
  const start = new Date(startValue);
  const end = new Date(endValue);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return "-";
  const durationMs = end.getTime() - start.getTime();
  if (durationMs < 0) return "-";
  const totalMinutes = Math.floor(durationMs / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours > 0 && minutes > 0) return `${hours} jam ${minutes} menit`;
  if (hours > 0) return `${hours} jam`;
  if (minutes > 0) return `${minutes} menit`;
  return "kurang dari 1 menit";
}

function formatMinutesHuman(value) {
  const totalMinutes = Number(value);
  if (!Number.isFinite(totalMinutes) || totalMinutes <= 0) return "-";
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours > 0 && minutes > 0) return `${hours} jam ${minutes} menit`;
  if (hours > 0) return `${hours} jam`;
  return `${minutes} menit`;
}

function formatPercentage(value) {
  const num = Number(value ?? 0);
  if (!Number.isFinite(num)) return "0%";
  return `${num.toFixed(2).replace(/\.?0+$/, "")}%`;
}

function formatSlaRemaining(seconds, status) {
  if (status !== "ON_PROCESS" || seconds === null || seconds === undefined) return "-";
  const abs = Math.abs(seconds);
  const mins = Math.floor(abs / 60);
  const secs = abs % 60;
  const text = `${mins}m ${String(secs).padStart(2, "0")}s`;
  if (seconds < 0) return `Over SLA ${text}`;
  return text;
}

const TRUCK_TYPE_LABELS = {
  CDD: "CDD",
  CDE: "CDE",
  FUSO: "FUSO",
  WB: "W/B",
  FT20: "20 ft",
  FT40: "40 ft",
  OTHER: "Other",
};

const STORE_TYPE_LABELS = {
  STORE_IN: "Store In",
  STORE_OUT: "Store Out",
};

const SCHEDULE_STATUS_LABELS = {
  PLANNED: "Planned",
  LINKED: "Sudah Ada Antrian",
  NO_SHOW: "No Show",
  NO_SHOW_CLOSED: "No Show (Ditutup)",
};

function truckTypeLabel(item) {
  if (item.truckType === "OTHER") {
    return item.truckTypeOther ? `Other - ${item.truckTypeOther}` : "Other";
  }
  return TRUCK_TYPE_LABELS[item.truckType] || item.truckType;
}

function mapQueueCategory(category) {
  if (category === "RECEIVING") return "Receiving";
  if (category === "DELIVERY") return "Delivery";
  return "-";
}

function applyHeaderStyle(worksheet) {
  worksheet.getRow(1).font = { bold: true };
  worksheet.getRow(1).alignment = { vertical: "middle" };
  worksheet.views = [{ state: "frozen", ySplit: 1 }];
}

/* ------------------------------------------------------------------ */
/* Builder per jenis export                                            */
/* ------------------------------------------------------------------ */

function buildQueueWorkbook(entries) {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("Antrian Truk");

  // Nilai plan diambil dari snapshot pada antrian (samakan dengan report),
  // dan jatuh ke nilai item schedule bila snapshot kosong. Item schedule bisa
  // saja sudah dihapus, jadi snapshot adalah sumber utama.
  const resolvePlan = (entry) => {
    const item = entry.scheduleItem || null;
    const plannedStart = entry.plannedStart || item?.plannedStart || null;
    const plannedFinish = entry.plannedFinish || item?.plannedFinish || null;
    return {
      plannedTruckType:
        entry.plannedTruckType || item?.truckType || item?.truckTypeOther || null,
      plannedTransporterName:
        entry.plannedTransporterName || item?.transporter?.name || null,
      plannedDriverName: entry.plannedDriverName || item?.driverName || null,
      plannedContainerNumbers:
        entry.plannedContainerNumbers?.length
          ? entry.plannedContainerNumbers
          : item?.containerNumbers || [],
      plannedStart,
      plannedFinish,
      scheduleItemStatus: item?.status || null,
      varianceArrival:
        entry.registerTime && plannedStart
          ? Math.round(
              (new Date(entry.registerTime).getTime() - new Date(plannedStart).getTime()) / 60000
            )
          : null,
      varianceFinish:
        entry.finishTime && plannedFinish
          ? Math.round(
              (new Date(entry.finishTime).getTime() - new Date(plannedFinish).getTime()) / 60000
            )
          : null,
    };
  };

  worksheet.columns = [
    { header: "No", key: "no", width: 6 },
    { header: "Tanggal", key: "date", width: 14 },
    { header: "Customer Name", key: "customerName", width: 28 },
    { header: "Driver Name", key: "driverName", width: 20 },
    { header: "Driver Plan", key: "plannedDriverName", width: 20 },
    { header: "Driver Phone", key: "driverPhone", width: 18 },
    // Plat plan tidak dijadikan kolom terpisah: nilainya dijamin sama dengan
    // No Truck selama tautan ke schedule aktif (plat terkunci di kedua sisi).
    { header: "No Truck", key: "truckNumber", width: 16 },
    { header: "Tipe Truk Plan", key: "plannedTruckType", width: 16 },
    { header: "No Container", key: "containerNumber", width: 18 },
    { header: "Container Plan", key: "plannedContainerNumbers", width: 22 },
    { header: "Transporter", key: "transporter", width: 18 },
    { header: "Transporter Plan", key: "plannedTransporterName", width: 22 },
    { header: "Notes", key: "notes", width: 24 },
    { header: "Notes from WH", key: "notesFromWh", width: 30 },
    { header: "Gate No", key: "gateNo", width: 12 },
    { header: "Gate Area", key: "gateArea", width: 20 },
    { header: "Gate Warehouse", key: "gateWarehouse", width: 18 },
    { header: "Nama Tallyman", key: "pickerEmployeeName", width: 28 },
    { header: "Register Time", key: "registerTime", width: 20 },
    { header: "Estimasi Start Plan", key: "plannedStart", width: 20 },
    { header: "Variance Kedatangan (mnt)", key: "varianceArrival", width: 24 },
    { header: "In WH - Time", key: "inWhTime", width: 20 },
    { header: "Start", key: "startTime", width: 20 },
    { header: "Finish", key: "finishTime", width: 20 },
    { header: "Estimasi Finish Plan", key: "plannedFinish", width: 20 },
    { header: "Variance Selesai (mnt)", key: "varianceFinish", width: 22 },
    { header: "Total Waktu (Register → Finish)", key: "totalDuration", width: 28 },
    { header: "SLA Menunggu", key: "slaWaitingMinutes", width: 18 },
    { header: "SLA IN_WH + Proses", key: "slaInWhProcessMinutes", width: 22 },
    { header: "Time Remaining", key: "timeRemaining", width: 18 },
    { header: "Status", key: "status", width: 14 },
    { header: "Status Plan", key: "scheduleItemStatus", width: 16 },
    { header: "Loading Type", key: "loadingType", width: 18 },
    { header: "Keterangan Batal", key: "cancelReason", width: 30 },
    { header: "Category", key: "category", width: 14 },
  ];
  applyHeaderStyle(worksheet);

  entries.forEach((entry, index) => {
    const remainingMinutes = queueService.getEntryRemainingMinutes(entry);
    const plan = resolvePlan(entry);
    let timeRemaining = "-";
    if (remainingMinutes !== null) {
      timeRemaining =
        remainingMinutes < 0
          ? `Over SLA ${Math.abs(remainingMinutes)} menit`
          : `${remainingMinutes} menit`;
    }

    worksheet.addRow({
      no: index + 1,
      date: formatDateOnlyDmy(entry.registerTime),
      customerName: entry.customer?.name || "-",
      driverName: entry.driverName || "-",
      plannedDriverName: plan.plannedDriverName || "-",
      driverPhone: entry.driverPhone || "-",
      truckNumber: entry.truckNumber || "-",
      plannedTruckType: plan.plannedTruckType || "-",
      containerNumber: (entry.containerNumbers || []).join(", ") || "-",
      plannedContainerNumbers: (plan.plannedContainerNumbers || []).join(", ") || "-",
      transporter: entry.transporter || "-",
      plannedTransporterName: plan.plannedTransporterName || "-",
      notes: entry.notes || "-",
      notesFromWh: entry.notesFromWh || "-",
      gateNo: entry.gate?.gateNo || "-",
      gateArea: entry.gate?.area || "-",
      gateWarehouse: entry.gate?.warehouse || "-",
      pickerEmployeeName: entry.pickerEmployee?.name || "-",
      registerTime: formatDateTimeDmy(entry.registerTime),
      plannedStart: formatDateTimeDmy(plan.plannedStart),
      varianceArrival: plan.varianceArrival ?? "-",
      inWhTime: formatDateTimeDmy(entry.inWhTime),
      startTime: formatDateTimeDmy(entry.startTime),
      finishTime: formatDateTimeDmy(entry.finishTime),
      plannedFinish: formatDateTimeDmy(plan.plannedFinish),
      varianceFinish: plan.varianceFinish ?? "-",
      slaWaitingMinutes: formatMinutesHuman(entry.slaWaitingMinutes),
      slaInWhProcessMinutes: formatMinutesHuman(entry.slaInWhProcessMinutes),
      totalDuration: formatDurationHuman(entry.registerTime, entry.finishTime),
      timeRemaining,
      status: entry.status || "-",
      scheduleItemStatus: plan.scheduleItemStatus || "-",
      loadingType: entry.loadingType || "-",
      cancelReason: entry.logs?.[0]?.note || "-",
      category: mapQueueCategory(entry.category),
    });
  });

  return workbook;
}

function buildPickingProgressWorkbook(entries) {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("Picking Progress");
  worksheet.columns = [
    { header: "No", key: "no", width: 6 },
    { header: "Tanggal", key: "date", width: 14 },
    { header: "Nama Customer", key: "customerName", width: 24 },
    { header: "DO Number", key: "doNumber", width: 18 },
    { header: "Destination", key: "destination", width: 18 },
    { header: "Volume (CBM)", key: "volumeCbm", width: 14 },
    { header: "PL Time Release", key: "plTimeRelease", width: 20 },
    { header: "Picking Qty (Barcode)", key: "pickingQty", width: 20 },
    { header: "Picked Qty", key: "pickedQty", width: 12 },
    { header: "Remain", key: "remainQty", width: 10 },
    { header: "Picking Progress", key: "pickingProgress", width: 16 },
    { header: "Nama Karyawan", key: "pickerName", width: 18 },
    { header: "Time Remaining", key: "timeRemaining", width: 18 },
    { header: "Status", key: "status", width: 14 },
    { header: "Keterangan Batal", key: "cancelReason", width: 30 },
    { header: "Notes from WH", key: "notesFromWh", width: 30 },
    { header: "Start Time", key: "startTime", width: 20 },
    { header: "Finish Time", key: "finishTime", width: 20 },
  ];
  applyHeaderStyle(worksheet);

  entries.forEach((entry, index) => {
    worksheet.addRow({
      no: index + 1,
      date: formatDateOnlyIso(entry.date),
      customerName: entry.customer?.name || "-",
      doNumber: entry.doNumber || "-",
      destination: entry.destination || "-",
      volumeCbm: entry.volumeCbm ?? "-",
      plTimeRelease: formatDateTimeIso(entry.plTimeRelease || entry.startTime),
      pickingQty: entry.pickingQty ?? 0,
      pickedQty: entry.pickedQty ?? 0,
      remainQty: entry.remainQty ?? 0,
      pickingProgress: formatPercentage(entry.pickingProgressPercent),
      pickerName: entry.pickerEmployee?.name || "-",
      timeRemaining: formatSlaRemaining(entry.timeRemainingSeconds, entry.status),
      status: entry.status || "-",
      cancelReason: entry.logs?.[0]?.note || "-",
      notesFromWh: entry.notesFromWh || "-",
      startTime: formatDateTimeIso(entry.startTime),
      finishTime: formatDateTimeIso(entry.finishTime),
    });
  });

  return workbook;
}

function buildScheduleWorkbook(schedules) {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("Schedule Pengiriman");

  worksheet.columns = [
    { header: "Tanggal", key: "scheduleDate", width: 14 },
    { header: "Store Type", key: "storeType", width: 14 },
    { header: "Customer Name", key: "customerName", width: 28 },
    { header: "Jenis Truck", key: "truckType", width: 20 },
    { header: "Plat Nomor", key: "plateNumber", width: 16 },
    { header: "Transporter", key: "transporter", width: 22 },
    { header: "Driver Name", key: "driverName", width: 20 },
    { header: "No Container", key: "containerNumbers", width: 28 },
    { header: "Estimasi Start", key: "plannedStart", width: 16 },
    { header: "Estimasi Finish", key: "plannedFinish", width: 16 },
    { header: "Status", key: "status", width: 16 },
    { header: "Created At", key: "createdAt", width: 20 },
  ];
  applyHeaderStyle(worksheet);

  schedules.forEach((schedule) => {
    if (!schedule.items || schedule.items.length === 0) {
      worksheet.addRow({
        scheduleDate: formatDateOnlyUtcDmy(schedule.scheduleDate),
        storeType: STORE_TYPE_LABELS[schedule.storeType] || schedule.storeType,
        customerName: schedule.customer?.name || "-",
        truckType: "-",
        plateNumber: "-",
        transporter: "-",
        driverName: "-",
        containerNumbers: "-",
        plannedStart: "-",
        plannedFinish: "-",
        status: "-",
        createdAt: formatDateTimeIso(schedule.createdAt),
      });
      return;
    }

    schedule.items.forEach((item) => {
      worksheet.addRow({
        scheduleDate: formatDateOnlyUtcDmy(schedule.scheduleDate),
        storeType: STORE_TYPE_LABELS[schedule.storeType] || schedule.storeType,
        customerName: schedule.customer?.name || "-",
        truckType: truckTypeLabel(item),
        plateNumber: item.plateNumber || "-",
        transporter: item.transporter?.name || "-",
        driverName: item.driverName || "-",
        containerNumbers: (item.containerNumbers || []).join(", ") || "-",
        plannedStart: formatTimeOnly(item.plannedStart),
        plannedFinish: formatTimeOnly(item.plannedFinish),
        status: SCHEDULE_STATUS_LABELS[item.status] || item.status || "-",
        createdAt: formatDateTimeIso(schedule.createdAt),
      });
    });
  });

  return workbook;
}

/* ------------------------------------------------------------------ */
/* Report Schedule vs Aktual                                           */
/* ------------------------------------------------------------------ */

function varianceLabel(value) {
  if (value === null || value === undefined) return "-";
  if (value === 0) return "0";
  return value > 0 ? `+${value}` : String(value);
}

function onTimeLabel(value) {
  if (value === null || value === undefined) return "-";
  return value ? "On Time" : "Terlambat";
}

function buildReportWorkbook(report) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Warehouse Queue App";

  const summarySheet = workbook.addWorksheet("Summary");
  summarySheet.columns = [
    { header: "Group", key: "label", width: 24 },
    { header: "Total Plan", key: "totalPlan", width: 12 },
    { header: "Total Aktual", key: "totalActual", width: 14 },
    { header: "No Show", key: "totalNoShow", width: 10 },
    { header: "Arrival Diukur", key: "arrivalMeasured", width: 15 },
    { header: "Arrival On Time", key: "arrivalOnTime", width: 15 },
    { header: "Arrival Terlambat", key: "arrivalLate", width: 17 },
    { header: "Arrival On Time %", key: "arrivalRate", width: 18 },
    { header: "Avg Variance Arrival (mnt)", key: "arrivalAvg", width: 24 },
    { header: "Finish Diukur", key: "finishMeasured", width: 14 },
    { header: "Finish On Time", key: "finishOnTime", width: 15 },
    { header: "Finish Terlambat", key: "finishLate", width: 16 },
    { header: "Finish On Time %", key: "finishRate", width: 17 },
    { header: "Avg Variance Finish (mnt)", key: "finishAvg", width: 24 },
  ];
  summarySheet.getRow(1).font = { bold: true };

  const pushSummaryRow = (label, summary) => {
    summarySheet.addRow({
      label,
      totalPlan: summary.totalPlan,
      totalActual: summary.totalActual,
      totalNoShow: summary.totalNoShow,
      arrivalMeasured: summary.arrival.measured,
      arrivalOnTime: summary.arrival.onTime,
      arrivalLate: summary.arrival.late,
      arrivalRate: summary.arrival.onTimeRate,
      arrivalAvg: summary.arrival.avgVarianceMinutes,
      finishMeasured: summary.finish.measured,
      finishOnTime: summary.finish.onTime,
      finishLate: summary.finish.late,
      finishRate: summary.finish.onTimeRate,
      finishAvg: summary.finish.avgVarianceMinutes,
    });
  };

  pushSummaryRow("TOTAL", report.summary);
  (report.groups || []).forEach((group) => pushSummaryRow(group.label, group.summary));

  const planSheet = workbook.addWorksheet("Plan");
  planSheet.columns = [
    { header: "Tanggal", key: "scheduleDate", width: 13 },
    { header: "Kategori", key: "category", width: 12 },
    { header: "Customer Plan", key: "customerName", width: 24 },
    { header: "Plat Plan", key: "plateNumber", width: 14 },
    { header: "Tipe Truk", key: "truckType", width: 12 },
    { header: "Transporter Plan", key: "transporterName", width: 22 },
    { header: "Driver Plan", key: "driverName", width: 18 },
    { header: "Container Plan", key: "containerNumbers", width: 24 },
    { header: "Estimasi Start", key: "plannedStart", width: 17 },
    { header: "Estimasi Finish", key: "plannedFinish", width: 17 },
    { header: "Status Jadwal", key: "scheduleStatus", width: 16 },
    { header: "Register Aktual", key: "registerTime", width: 17 },
    { header: "Finish Aktual", key: "finishTime", width: 17 },
    { header: "Variance Arrival (mnt)", key: "varianceArrival", width: 20 },
    { header: "On Time Arrival", key: "onTimeArrival", width: 16 },
    { header: "Variance Finish (mnt)", key: "varianceFinish", width: 20 },
    { header: "On Time Finish", key: "onTimeFinish", width: 15 },
  ];
  planSheet.getRow(1).font = { bold: true };

  (report.planRows || []).forEach((row) => {
    planSheet.addRow({
      scheduleDate: formatDateOnlyUtcDmy(row.scheduleDate),
      category: row.category,
      customerName: row.customerName,
      plateNumber: row.plateNumber || "-",
      truckType: row.truckType,
      transporterName: row.transporterName || "-",
      driverName: row.driverName || "-",
      containerNumbers: (row.containerNumbers || []).join(", ") || "-",
      plannedStart: formatDateTimeDmy(row.plannedStart),
      plannedFinish: formatDateTimeDmy(row.plannedFinish),
      scheduleStatus: row.scheduleStatus,
      registerTime: formatDateTimeDmy(row.registerTime),
      finishTime: formatDateTimeDmy(row.finishTime),
      varianceArrival: varianceLabel(row.varianceArrivalMinutes),
      onTimeArrival: onTimeLabel(row.isOnTimeArrival),
      varianceFinish: varianceLabel(row.varianceFinishMinutes),
      onTimeFinish: onTimeLabel(row.isOnTimeFinish),
    });
  });

  const actualSheet = workbook.addWorksheet("Aktual");
  actualSheet.columns = [
    { header: "Register", key: "registerTime", width: 17 },
    { header: "In WH", key: "inWhTime", width: 17 },
    { header: "Start", key: "startTime", width: 17 },
    { header: "Finish", key: "finishTime", width: 17 },
    { header: "Status", key: "status", width: 12 },
    { header: "Kategori", key: "category", width: 12 },
    { header: "Plat", key: "truckNumber", width: 14 },
    { header: "Tipe Truk", key: "truckType", width: 12 },
    { header: "Customer Aktual", key: "customerName", width: 24 },
    { header: "Customer Plan", key: "plannedCustomerName", width: 24 },
    { header: "Transporter", key: "transporterName", width: 22 },
    { header: "Driver", key: "driverName", width: 18 },
    { header: "Container", key: "containerNumbers", width: 24 },
    { header: "Sumber", key: "source", width: 12 },
    { header: "Estimasi Start", key: "plannedStart", width: 17 },
    { header: "Variance Arrival (mnt)", key: "varianceArrival", width: 20 },
    { header: "On Time Arrival", key: "onTimeArrival", width: 16 },
    { header: "Variance Finish (mnt)", key: "varianceFinish", width: 20 },
    { header: "On Time Finish", key: "onTimeFinish", width: 15 },
  ];
  actualSheet.getRow(1).font = { bold: true };

  (report.actualRows || []).forEach((row) => {
    actualSheet.addRow({
      registerTime: formatDateTimeDmy(row.registerTime),
      inWhTime: formatDateTimeDmy(row.inWhTime),
      startTime: formatDateTimeDmy(row.startTime),
      finishTime: formatDateTimeDmy(row.finishTime),
      status: row.status,
      category: row.category,
      truckNumber: row.truckNumber,
      truckType: row.truckType || "-",
      customerName: row.customerName,
      plannedCustomerName: row.plannedCustomerName || "-",
      transporterName: row.transporterName || "-",
      driverName: row.driverName,
      containerNumbers: (row.containerNumbers || []).join(", ") || "-",
      source: row.isWalkIn ? "Walk-in" : "Schedule",
      plannedStart: formatDateTimeDmy(row.plannedStart),
      varianceArrival: varianceLabel(row.varianceArrivalMinutes),
      onTimeArrival: onTimeLabel(row.isOnTimeArrival),
      varianceFinish: varianceLabel(row.varianceFinishMinutes),
      onTimeFinish: onTimeLabel(row.isOnTimeFinish),
    });
  });

  return workbook;
}

module.exports = {
  buildQueueWorkbook,
  buildPickingProgressWorkbook,
  buildScheduleWorkbook,
  buildReportWorkbook,
};
