export type MasterColumn = {
  /** Nama field pada baris data. */
  key: string
  /** Label kolom pada header tabel. */
  label: string
  sortable?: boolean
  align?: 'left' | 'right'
  /** Sembunyikan kolom di layar sempit. */
  hideBelow?: 'sm' | 'md' | 'lg' | 'xl'
  /** Tampilkan dengan font mono + angka tabular (NIK, username, telepon). */
  mono?: boolean
  /** Ikut tampil di kartu mobile. Urutan pertama jadi judul kartu. */
  mobile?: boolean
  /** Label berbeda saat tampil di kartu mobile. */
  mobileLabel?: string
  width?: string
  /** Tampilkan inisial berwarna di depan nilai (kolom nama entitas). */
  avatar?: boolean
  /** Jadikan kolom ini judul kartu di tampilan mobile. */
  mobileTitle?: boolean
}
