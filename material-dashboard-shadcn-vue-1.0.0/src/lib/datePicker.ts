/**
 * Membuka pemilih tanggal native dari mana saja pada field, bukan hanya
 * dari ikon kalender di ujung kanan input.
 *
 * Catatan: fallback sengaja hanya `focus()`. Memanggil `input.click()` di sini
 * akan memicu ulang handler klik pada input dan berujung rekursi tanpa henti.
 */
export function openDatePicker(input: HTMLInputElement | null | undefined) {
  if (!input) return
  const picker = input as HTMLInputElement & { showPicker?: () => void }

  if (typeof picker.showPicker === 'function') {
    try {
      picker.showPicker()
      return
    } catch {
      // Picker sudah terbuka, atau browser menolak tanpa gesture pengguna.
      // Fokus tetap diberikan supaya pengguna bisa mengetik.
    }
  }

  input.focus()
}

/** Handler siap pakai untuk `@click` pada `<input type="date">` / `datetime-local`. */
export function handleDateInputClick(event: MouseEvent) {
  openDatePicker(event.currentTarget as HTMLInputElement | null)
}
