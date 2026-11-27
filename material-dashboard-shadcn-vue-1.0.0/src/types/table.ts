export type TableMeta = {
  page: number
  pageSize: number
  total: number
  totalPages: number
  hasPrev: boolean
  hasNext: boolean
}

export type PaginatedResponse<T> = {
  ok: boolean
  data: T[]
  meta?: TableMeta
}
