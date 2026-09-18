export const MIN_PHONE_DIGITS = 9
export const MAX_PHONE_DIGITS = 15

const PHONE_ALLOWED_CHARS = /^[0-9+\-\s]+$/

export function countPhoneDigits(value?: string | null): number {
  if (!value) return 0
  return (value.match(/\d/g) || []).length
}

/** Nomor HP opsional. Kosong valid; jika diisi harus 9-15 digit & hanya angka/+/-/spasi. */
export function isValidOptionalPhone(value?: string | null): boolean {
  if (!value) return true
  if (!PHONE_ALLOWED_CHARS.test(value)) return false
  const digits = countPhoneDigits(value)
  return digits >= MIN_PHONE_DIGITS && digits <= MAX_PHONE_DIGITS
}

/** Bersihkan input agar hanya berisi digit, +, -, dan spasi. */
export function sanitizePhoneInput(value: string): string {
  return value.replace(/[^0-9+\-\s]/g, '')
}
