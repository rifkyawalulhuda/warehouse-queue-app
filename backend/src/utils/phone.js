const PHONE_ALLOWED_CHARS = /^[0-9+\-\s]+$/;
const MIN_PHONE_DIGITS = 9;
const MAX_PHONE_DIGITS = 15;

function countPhoneDigits(value) {
  if (typeof value !== "string") return 0;
  return (value.match(/\d/g) || []).length;
}

/**
 * Nomor HP bersifat opsional.
 * - Kosong (undefined/null/"") => valid.
 * - Selain itu: hanya boleh berisi digit, "+", "-", dan spasi,
 *   serta jumlah digit antara 9 dan 15.
 */
function isValidOptionalPhone(value) {
  if (value === undefined || value === null || value === "") return true;
  if (typeof value !== "string") return false;
  if (!PHONE_ALLOWED_CHARS.test(value)) return false;
  const digits = countPhoneDigits(value);
  return digits >= MIN_PHONE_DIGITS && digits <= MAX_PHONE_DIGITS;
}

module.exports = {
  MIN_PHONE_DIGITS,
  MAX_PHONE_DIGITS,
  countPhoneDigits,
  isValidOptionalPhone,
};
