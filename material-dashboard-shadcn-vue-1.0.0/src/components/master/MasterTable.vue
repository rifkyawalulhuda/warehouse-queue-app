<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { ArrowDown, ArrowUp, ArrowUpDown, Inbox, SearchX } from 'lucide-vue-next'
import DataPagination from '@/components/ui/DataPagination.vue'
import TableSkeleton from '@/components/ui/TableSkeleton.vue'
import TableEmptyState from '@/components/ui/TableEmptyState.vue'
import MasterNameCell from './MasterNameCell.vue'
import type { MasterColumn } from './types'

// Slot props are intentionally loose: each page passes its own typed rows, and the
// consumer already knows the concrete type it stored in its ref.
type Row = any

const props = withDefaults(
  defineProps<{
    columns: MasterColumn[]
    rows: Row[]
    rowKey?: string
    tableLabel?: string
    loading?: boolean
    filtered?: boolean
    emptyTitle?: string
    emptyDescription?: string
    sortBy?: string
    sortDir?: 'asc' | 'desc'
    page: number
    pageSize: number
    total: number
    totalPages: number
    unit?: string
    showIndex?: boolean
    indexLabel?: string
    hasActions?: boolean
  }>(),
  {
    rowKey: 'id',
    tableLabel: '',
    loading: false,
    filtered: false,
    emptyTitle: 'Belum ada data',
    emptyDescription: 'Data akan tampil di sini setelah ditambahkan.',
    sortBy: '',
    sortDir: 'asc',
    unit: 'data',
    showIndex: true,
    indexLabel: 'No',
    hasActions: true
  }
)

const emit = defineEmits<{
  (e: 'sort', key: string): void
  (e: 'page', value: number): void
  (e: 'page-size', value: number): void
}>()

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

const columnCount = computed(
  () => props.columns.length + (props.showIndex ? 1 : 0) + (props.hasActions ? 1 : 0)
)

const rowNumber = (index: number) => (props.page - 1) * props.pageSize + index + 1

const hideClass = (value?: MasterColumn['hideBelow']) => {
  if (value === 'sm') return 'hidden sm:table-cell'
  if (value === 'md') return 'hidden md:table-cell'
  if (value === 'lg') return 'hidden lg:table-cell'
  if (value === 'xl') return 'hidden xl:table-cell'
  return ''
}

const alignClass = (column: MasterColumn) =>
  column.align === 'right' ? 'text-right' : 'text-left'

const sortIcon = (key: string) => {
  if (props.sortBy !== key) return ArrowUpDown
  return props.sortDir === 'asc' ? ArrowUp : ArrowDown
}

const ariaSort = (column: MasterColumn) => {
  if (!column.sortable) return undefined
  if (props.sortBy !== column.key) return 'none' as const
  return props.sortDir === 'asc' ? ('ascending' as const) : ('descending' as const)
}

const cellValue = (row: Row, column: MasterColumn) => row?.[column.key]

const mobileColumns = computed(() => props.columns.filter((column) => column.mobile))
const mobileTitleColumn = computed<MasterColumn | undefined>(
  () =>
    props.columns.find((column) => column.mobileTitle) ??
    mobileColumns.value[0] ??
    props.columns[0]
)
const mobileDetailColumns = computed(() =>
  mobileColumns.value.filter((column) => column !== mobileTitleColumn.value)
)

const skeletonRows = computed(() => (props.pageSize > 10 ? 8 : 5))
</script>

<template>
  <div class="overflow-hidden rounded-2xl border border-border/60 bg-card shadow-sm">
    <div
      v-if="$slots.toolbar || $slots.filters"
      class="flex flex-col gap-3 border-b border-border/60 bg-muted/20 p-3 lg:flex-row lg:items-center lg:justify-between"
    >
      <div class="w-full lg:max-w-sm">
        <slot name="toolbar" />
      </div>
      <div class="flex flex-wrap items-center gap-2">
        <slot name="filters" />
      </div>
    </div>

    <div v-if="!isMobile" class="max-h-[calc(100vh-19rem)] overflow-auto">
      <table class="min-w-full text-sm" :aria-label="tableLabel || undefined">
        <thead
          class="sticky top-0 z-10 bg-muted/60 text-[11px] uppercase tracking-wide text-muted-foreground backdrop-blur"
        >
          <tr>
            <th v-if="showIndex" scope="col" class="w-14 px-4 py-2.5 text-left font-semibold">
              {{ indexLabel }}
            </th>
            <th
              v-for="column in columns"
              :key="column.key"
              scope="col"
              class="px-4 py-2.5 font-semibold"
              :class="[alignClass(column), hideClass(column.hideBelow)]"
              :style="column.width ? { width: column.width } : undefined"
              :aria-sort="ariaSort(column)"
            >
              <button
                v-if="column.sortable"
                type="button"
                class="inline-flex items-center gap-1.5 rounded transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                @click="emit('sort', column.key)"
              >
                {{ column.label }}
                <component
                  :is="sortIcon(column.key)"
                  class="h-3.5 w-3.5 opacity-60"
                  aria-hidden="true"
                />
              </button>
              <span v-else>{{ column.label }}</span>
            </th>
            <th v-if="hasActions" scope="col" class="w-14 px-4 py-2.5 text-right font-semibold">
              Aksi
            </th>
          </tr>
        </thead>

        <TableSkeleton v-if="loading" :rows="skeletonRows" :columns="columnCount" />

        <tbody v-else-if="rows.length === 0">
          <TableEmptyState
            :colspan="columnCount"
            :filtered="filtered"
            :title="emptyTitle"
            :description="emptyDescription"
          />
        </tbody>

        <tbody v-else>
          <tr
            v-for="(row, index) in rows"
            :key="row[rowKey]"
            class="group border-t border-border/40 transition-colors hover:bg-accent/40 focus-within:bg-accent/40"
          >
            <td v-if="showIndex" class="px-4 py-3 text-xs tabular-nums text-muted-foreground">
              {{ rowNumber(index) }}
            </td>
            <td
              v-for="column in columns"
              :key="column.key"
              class="px-4 py-3 align-middle"
              :class="[
                alignClass(column),
                hideClass(column.hideBelow),
                column.mono ? 'font-mono text-xs tabular-nums' : ''
              ]"
            >
              <MasterNameCell :avatar="column.avatar" :name="String(cellValue(row, column) ?? '')">
                <slot name="cell" :row="row" :column="column" :value="cellValue(row, column)" :index="index">
                  {{ cellValue(row, column) ?? '—' }}
                </slot>
              </MasterNameCell>
            </td>
            <td v-if="hasActions" class="px-4 py-3 text-right">
              <slot name="actions" :row="row" :index="index" />
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div v-else>
      <div v-if="loading" class="space-y-2 p-3" aria-hidden="true">
        <div v-for="n in 4" :key="n" class="h-20 animate-pulse rounded-xl bg-muted/60" />
      </div>

      <div v-else-if="rows.length === 0" class="px-4 py-12 text-center">
        <span
          class="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-border/70 bg-muted/50 text-muted-foreground"
        >
          <component
            :is="filtered ? SearchX : Inbox"
            class="h-5 w-5"
            aria-hidden="true"
          />
        </span>
        <p class="mt-3 text-sm font-medium">
          {{ filtered ? 'Tidak ada hasil yang cocok' : emptyTitle }}
        </p>
        <p class="mx-auto mt-1 max-w-xs text-xs text-muted-foreground">
          {{ filtered ? 'Coba kata kunci lain atau hapus filter.' : emptyDescription }}
        </p>
      </div>

      <ul v-else class="divide-y divide-border/40">
        <li
          v-for="(row, index) in rows"
          :key="row[rowKey]"
          class="flex items-start gap-3 p-3 transition-colors active:bg-accent/40"
        >
          <div class="min-w-0 flex-1">
            <div class="flex items-baseline gap-2">
              <span v-if="showIndex" class="text-xs tabular-nums text-muted-foreground">
                {{ rowNumber(index) }}.
              </span>
              <div class="min-w-0 text-sm font-semibold leading-snug">
                <MasterNameCell
                  v-if="mobileTitleColumn"
                  :avatar="mobileTitleColumn.avatar"
                  :name="String(cellValue(row, mobileTitleColumn) ?? '')"
                >
                  <slot
                    name="cell"
                    :row="row"
                    :column="mobileTitleColumn"
                    :value="cellValue(row, mobileTitleColumn)"
                    :index="index"
                  />
                </MasterNameCell>
              </div>
            </div>
            <dl
              v-if="mobileDetailColumns.length"
              class="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs"
            >
              <template v-for="column in mobileDetailColumns" :key="column.key">
                <dt class="text-muted-foreground">{{ column.mobileLabel || column.label }}</dt>
                <dd class="min-w-0 break-words">
                  <slot
                    name="cell"
                    :row="row"
                    :column="column"
                    :value="cellValue(row, column)"
                    :index="index"
                  >
                    {{ cellValue(row, column) ?? '—' }}
                  </slot>
                </dd>
              </template>
            </dl>
          </div>
          <div v-if="hasActions" class="shrink-0">
            <slot name="actions" :row="row" :index="index" />
          </div>
        </li>
      </ul>
    </div>

    <DataPagination
      :page="page"
      :page-size="pageSize"
      :total="total"
      :total-pages="totalPages"
      :unit="unit"
      :disabled="loading"
      @update:page="(value) => emit('page', value)"
      @update:page-size="(value) => emit('page-size', value)"
    />
  </div>
</template>
