<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronDown, Search, X } from 'lucide-vue-next'
import DataPagination from '@/components/ui/DataPagination.vue'
import TableSkeleton from '@/components/ui/TableSkeleton.vue'
import TableEmptyState from '@/components/ui/TableEmptyState.vue'
import type { ReportColumn } from './types'

// Baris report punya bentuk berbeda per tabel; konsumen sudah tahu tipe konkretnya.
type Row = any

const props = withDefaults(
  defineProps<{
    columns: ReportColumn[]
    rows: Row[]
    rowKey: string
    tableLabel?: string
    loading?: boolean
    emptyTitle?: string
    emptyDescription?: string
    unit?: string
    defaultSortKey?: string
    defaultSortDir?: 'asc' | 'desc'
    searchPlaceholder?: string
    pageSizeOptions?: number[]
  }>(),
  {
    tableLabel: '',
    loading: false,
    emptyTitle: 'Tidak ada data',
    emptyDescription: 'Tidak ada data pada rentang ini.',
    unit: 'baris',
    defaultSortKey: '',
    defaultSortDir: 'asc',
    searchPlaceholder: 'Cari di tabel ini...',
    pageSizeOptions: () => [10, 25, 50, 100]
  }
)

const sortKey = ref(props.defaultSortKey)
const sortDir = ref<'asc' | 'desc'>(props.defaultSortDir)

// Pencarian di-debounce supaya mengetik tetap responsif saat barisnya ribuan.
const queryInput = ref('')
const query = ref('')
let queryTimer: ReturnType<typeof setTimeout> | null = null

watch(queryInput, (value) => {
  if (queryTimer) clearTimeout(queryTimer)
  queryTimer = setTimeout(() => {
    query.value = value.trim().toLowerCase()
    page.value = 1
  }, 200)
})

onBeforeUnmount(() => {
  if (queryTimer) clearTimeout(queryTimer)
})

const page = ref(1)
const pageSize = ref(25)

watch(pageSize, () => {
  page.value = 1
})

/** Nilai pembanding; null/undefined selalu diletakkan di akhir, naik maupun turun. */
const sortValue = (row: Row, column: ReportColumn) => {
  const raw = row?.[column.key]
  if (raw === null || raw === undefined || raw === '') return null
  if (column.sortType === 'number') {
    const value = Number(raw)
    return Number.isNaN(value) ? null : value
  }
  if (column.sortType === 'date') {
    const value = new Date(raw).getTime()
    return Number.isNaN(value) ? null : value
  }
  return String(raw).toLowerCase()
}

const searchableText = (row: Row) =>
  props.columns
    .map((column) => {
      const raw = row?.[column.key]
      if (raw === null || raw === undefined) return ''
      if (Array.isArray(raw)) return raw.join(' ')
      return String(raw)
    })
    .join(' ')
    .toLowerCase()

const filteredRows = computed(() => {
  if (!query.value) return props.rows
  const terms = query.value.split(/\s+/).filter(Boolean)
  return props.rows.filter((row) => {
    const haystack = searchableText(row)
    return terms.every((term) => haystack.includes(term))
  })
})

const sortedRows = computed(() => {
  const rows = [...filteredRows.value]
  const column = props.columns.find((item) => item.key === sortKey.value)
  if (!column || !column.sortable) return rows
  const direction = sortDir.value === 'asc' ? 1 : -1

  return rows.sort((a, b) => {
    const left = sortValue(a, column)
    const right = sortValue(b, column)
    if (left === null && right === null) return 0
    if (left === null) return 1
    if (right === null) return -1
    if (typeof left === 'number' && typeof right === 'number') {
      return (left - right) * direction
    }
    return String(left).localeCompare(String(right), 'id', { numeric: true }) * direction
  })
})

const total = computed(() => sortedRows.value.length)
const totalPages = computed(() => Math.max(1, Math.ceil(total.value / pageSize.value)))

watch(totalPages, (value) => {
  if (page.value > value) page.value = value
})

const pagedRows = computed(() => {
  const start = (page.value - 1) * pageSize.value
  return sortedRows.value.slice(start, start + pageSize.value)
})

const toggleSort = (column: ReportColumn) => {
  if (!column.sortable) return
  if (sortKey.value === column.key) {
    sortDir.value = sortDir.value === 'asc' ? 'desc' : 'asc'
  } else {
    sortKey.value = column.key
    sortDir.value = 'asc'
  }
  page.value = 1
}

const sortIcon = (column: ReportColumn) => {
  if (!column.sortable) return null
  if (sortKey.value !== column.key) return ArrowUpDown
  return sortDir.value === 'asc' ? ArrowUp : ArrowDown
}

const ariaSort = (column: ReportColumn) => {
  if (!column.sortable) return undefined
  if (sortKey.value !== column.key) return 'none' as const
  return sortDir.value === 'asc' ? ('ascending' as const) : ('descending' as const)
}

const alignClass = (column: ReportColumn) =>
  column.align === 'right' ? 'text-right' : 'text-left'

const clearQuery = () => {
  queryInput.value = ''
  query.value = ''
  page.value = 1
}

const isMobile = ref(false)
let mediaQuery: MediaQueryList | null = null
const onMediaChange = (event: MediaQueryListEvent) => {
  isMobile.value = event.matches
}

onMounted(() => {
  if (typeof window === 'undefined') return
  mediaQuery = window.matchMedia('(max-width: 639px)')
  isMobile.value = mediaQuery.matches
  mediaQuery.addEventListener('change', onMediaChange)
})

onBeforeUnmount(() => {
  mediaQuery?.removeEventListener('change', onMediaChange)
})

const expanded = ref<Set<string>>(new Set())
const toggleExpanded = (key: string) => {
  const next = new Set(expanded.value)
  if (next.has(key)) next.delete(key)
  else next.add(key)
  expanded.value = next
}

const mobileTitleColumn = computed(
  () => props.columns.find((column) => column.mobileTitle) ?? props.columns[0]
)
const compactColumns = computed(() =>
  props.columns.filter(
    (column) => column.mobile && column.key !== mobileTitleColumn.value?.key
  )
)
const detailColumns = computed(() =>
  props.columns.filter(
    (column) => !column.mobile && column.key !== mobileTitleColumn.value?.key
  )
)

const skeletonRows = computed(() => (pageSize.value > 10 ? 8 : 5))
</script>

<template>
  <div class="overflow-hidden rounded-2xl border border-border/60 bg-card shadow-sm">
    <div
      class="flex flex-col gap-3 border-b border-border/60 bg-muted/20 p-3 sm:flex-row sm:items-center sm:justify-between"
    >
      <div class="relative w-full sm:max-w-xs">
        <Search
          class="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden="true"
        />
        <input
          v-model="queryInput"
          type="search"
          :placeholder="searchPlaceholder"
          :aria-label="`Cari di ${tableLabel || 'tabel'}`"
          class="w-full rounded-lg border border-border bg-background py-2 pl-8 pr-8 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        <button
          v-if="queryInput"
          type="button"
          class="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label="Hapus pencarian"
          @click="clearQuery"
        >
          <X class="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      </div>
      <p class="text-xs text-muted-foreground" aria-live="polite">
        <template v-if="query">
          {{ total }} hasil untuk "{{ query }}"
        </template>
        <template v-else>{{ total }} {{ unit }}</template>
      </p>
    </div>

    <div v-if="!isMobile" class="max-h-[calc(100vh-19rem)] overflow-auto">
      <table class="min-w-full text-sm" :aria-label="tableLabel || undefined">
        <thead
          class="sticky top-0 z-10 bg-muted/60 text-[11px] uppercase tracking-wide text-muted-foreground backdrop-blur"
        >
          <tr>
            <th
              v-for="column in columns"
              :key="column.key"
              scope="col"
              class="whitespace-nowrap px-4 py-2.5 font-semibold"
              :class="alignClass(column)"
              :style="column.width ? { width: column.width } : undefined"
              :aria-sort="ariaSort(column)"
            >
              <button
                v-if="column.sortable"
                type="button"
                class="inline-flex items-center gap-1.5 rounded transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                :title="`Urutkan berdasarkan ${column.label}`"
                @click="toggleSort(column)"
              >
                {{ column.label }}
                <component
                  :is="sortIcon(column)!"
                  class="h-3.5 w-3.5 opacity-60"
                  :class="sortKey === column.key ? 'opacity-100' : ''"
                  aria-hidden="true"
                />
              </button>
              <span v-else>{{ column.label }}</span>
            </th>
          </tr>
        </thead>

        <TableSkeleton v-if="loading" :rows="skeletonRows" :columns="columns.length" />

        <tbody v-else-if="pagedRows.length === 0">
          <TableEmptyState
            :colspan="columns.length"
            :filtered="Boolean(query)"
            :title="emptyTitle"
            :description="emptyDescription"
          />
        </tbody>

        <tbody v-else>
          <tr
            v-for="row in pagedRows"
            :key="row[rowKey]"
            class="border-t border-border/40 transition-colors hover:bg-accent/40"
          >
            <td
              v-for="column in columns"
              :key="column.key"
              class="px-4 py-2.5 align-middle"
              :class="[
                alignClass(column),
                column.mono ? 'font-mono text-xs tabular-nums' : ''
              ]"
            >
              <slot name="cell" :row="row" :column="column" :value="row[column.key]">
                {{ row[column.key] ?? '—' }}
              </slot>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div v-else>
      <div v-if="loading" class="space-y-2 p-3" aria-hidden="true">
        <div v-for="n in 4" :key="n" class="h-24 animate-pulse rounded-xl bg-muted/60" />
      </div>

      <div v-else-if="pagedRows.length === 0" class="px-4 py-12 text-center">
        <p class="text-sm font-medium">
          {{ query ? 'Tidak ada hasil yang cocok' : emptyTitle }}
        </p>
        <p class="mx-auto mt-1 max-w-xs text-xs text-muted-foreground">
          {{ query ? 'Coba kata kunci lain atau hapus pencarian.' : emptyDescription }}
        </p>
      </div>

      <ul v-else class="divide-y divide-border/40">
        <li
          v-for="row in pagedRows"
          :key="row[rowKey]"
          class="p-3 transition-colors active:bg-accent/40"
        >
          <div class="flex items-start justify-between gap-2">
            <div class="min-w-0 text-sm font-semibold leading-snug">
              <slot
                name="cell"
                :row="row"
                :column="mobileTitleColumn"
                :value="row[mobileTitleColumn.key]"
              >
                {{ row[mobileTitleColumn.key] ?? '—' }}
              </slot>
            </div>
          </div>

          <dl class="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
            <template v-for="column in compactColumns" :key="column.key">
              <dt class="text-muted-foreground">{{ column.mobileLabel || column.label }}</dt>
              <dd class="min-w-0 break-words" :class="column.align === 'right' ? 'text-right' : ''">
                <slot name="cell" :row="row" :column="column" :value="row[column.key]">
                  {{ row[column.key] ?? '—' }}
                </slot>
              </dd>
            </template>
          </dl>

          <template v-if="detailColumns.length">
            <button
              type="button"
              class="mt-2 inline-flex items-center gap-1 rounded text-xs font-medium text-primary transition-colors hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              :aria-expanded="expanded.has(row[rowKey])"
              @click="toggleExpanded(row[rowKey])"
            >
              {{ expanded.has(row[rowKey]) ? 'Sembunyikan detail' : 'Lihat detail' }}
              <ChevronDown
                class="h-3.5 w-3.5 transition-transform duration-200"
                :class="expanded.has(row[rowKey]) ? 'rotate-180' : ''"
                aria-hidden="true"
              />
            </button>

            <dl
              v-if="expanded.has(row[rowKey])"
              class="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 border-t border-border/40 pt-2 text-xs"
            >
              <template v-for="column in detailColumns" :key="column.key">
                <dt class="text-muted-foreground">{{ column.mobileLabel || column.label }}</dt>
                <dd class="min-w-0 break-words" :class="column.align === 'right' ? 'text-right' : ''">
                  <slot name="cell" :row="row" :column="column" :value="row[column.key]">
                    {{ row[column.key] ?? '—' }}
                  </slot>
                </dd>
              </template>
            </dl>
          </template>
        </li>
      </ul>
    </div>

    <DataPagination
      :page="page"
      :page-size="pageSize"
      :total="total"
      :total-pages="totalPages"
      :page-size-options="pageSizeOptions"
      :unit="unit"
      :disabled="loading"
      @update:page="(value) => (page = value)"
      @update:page-size="(value) => (pageSize = value)"
    />
  </div>
</template>
