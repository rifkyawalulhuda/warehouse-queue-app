const prisma = require("../utils/prisma");
const { getScheduleSettings } = require("./schedule.service");

function createHttpError(status, message, details) {
  const err = new Error(message);
  err.status = status;
  if (details) err.details = details;
  return err;
}

/**
 * Definisi setting yang boleh diubah lewat API.
 * Batas min/max dipilih supaya nilai aneh tidak merusak perhitungan report.
 */
const SETTING_DEFINITIONS = {
  "report.onTimeToleranceArrivalMinutes": {
    label: "Toleransi on-time kedatangan (menit)",
    min: 0,
    max: 1440,
  },
  "report.onTimeToleranceFinishMinutes": {
    label: "Toleransi on-time selesai (menit)",
    min: 0,
    max: 1440,
  },
  "schedule.backdateMaxDays": {
    label: "Batas backdate waktu registrasi (hari)",
    min: 0,
    max: 90,
  },
  "schedule.overdueWindowDays": {
    label: "Jendela jadwal overdue di dropdown (hari)",
    min: 0,
    max: 90,
  },
  "schedule.noShowGraceHours": {
    label: "Grace no-show setelah estimasi selesai (jam)",
    min: 0,
    max: 168,
  },
};

async function listSettings() {
  const rows = await prisma.appSetting.findMany({
    orderBy: { key: "asc" },
    include: {
      updatedByUser: { select: { id: true, name: true, username: true } },
    },
  });

  return rows.map((row) => {
    const definition = SETTING_DEFINITIONS[row.key] || {};
    return {
      key: row.key,
      value: row.value,
      label: definition.label || row.key,
      min: definition.min ?? null,
      max: definition.max ?? null,
      editable: Boolean(definition.label),
      updatedAt: row.updatedAt,
      updatedBy: row.updatedByUser || null,
    };
  });
}

async function updateSettings(payload, actorUserId) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw createHttpError(400, "Payload harus object { key: value }");
  }

  const entries = Object.entries(payload);
  if (entries.length === 0) {
    throw createHttpError(400, "Tidak ada setting yang dikirim");
  }

  const errors = [];
  const updates = [];

  for (const [key, rawValue] of entries) {
    const definition = SETTING_DEFINITIONS[key];
    if (!definition) {
      errors.push(`${key} bukan setting yang dikenal`);
      continue;
    }

    const value = Number(rawValue);
    if (!Number.isInteger(value)) {
      errors.push(`${key} harus angka bulat`);
      continue;
    }
    if (value < definition.min || value > definition.max) {
      errors.push(`${key} harus antara ${definition.min} dan ${definition.max}`);
      continue;
    }
    updates.push({ key, value: String(value) });
  }

  if (errors.length > 0) {
    throw createHttpError(400, "Validasi gagal", errors);
  }

  await prisma.$transaction(
    updates.map((item) =>
      prisma.appSetting.upsert({
        where: { key: item.key },
        create: {
          key: item.key,
          value: item.value,
          updatedByUserId: actorUserId || null,
        },
        update: {
          value: item.value,
          updatedByUserId: actorUserId || null,
        },
      })
    )
  );

  return {
    settings: await listSettings(),
    effective: await getScheduleSettings(),
  };
}

module.exports = {
  SETTING_DEFINITIONS,
  listSettings,
  updateSettings,
};
