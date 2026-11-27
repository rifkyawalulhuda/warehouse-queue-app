/** Definisi kolom untuk tabel report yang bisa di-sort dan dicari di sisi klien. */
export type ReportColumn = {
  key: string
  label: string
  /** Perataan isi sel; angka sebaiknya 'right'. */
  align?: 'left' | 'right'
  sortable?: boolean
  /**
   * Menentukan cara nilai dibandingkan saat mengurutkan.
   * 'number' dan 'date' wajib diisi untuk kolom angka/tanggal, kalau tidak
   * pengurutan memakai perbandingan teks dan hasilnya salah (mis. 10 < 9).
   */
  sortType?: 'text' | 'number' | 'date'
  width?: string
  /** Angka rata digit supaya kolom tidak bergeser saat nilainya berubah. */
  mono?: boolean
  /** Tampil di kartu mobile ringkas. Kolom tanpa ini hanya tampil saat detail dibuka. */
  mobile?: boolean
  /** Kolom yang menjadi judul kartu mobile. */
  mobileTitle?: boolean
  /** Label lebih pendek untuk kartu mobile. */
  mobileLabel?: string
}
