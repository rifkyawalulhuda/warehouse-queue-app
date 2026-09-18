const LOADING_TYPES = ["PALETIZE", "COMBINE", "LOOSE"];
const SYSTEM_LOADING_TYPE = "SYSTEM";

const LOADING_TYPE_LABELS = {
  PALETIZE: "Paletize",
  COMBINE: "Combine",
  LOOSE: "Loose (Curah)",
  SYSTEM: "Sistem",
};

function isAllowedLoadingType(value) {
  return typeof value === "string" && LOADING_TYPES.includes(value);
}

function formatLoadingTypeLabel(value) {
  if (!value) return "-";
  return LOADING_TYPE_LABELS[value] || value;
}

module.exports = {
  LOADING_TYPES,
  SYSTEM_LOADING_TYPE,
  LOADING_TYPE_LABELS,
  isAllowedLoadingType,
  formatLoadingTypeLabel,
};
