<script setup lang="ts">
import { computed } from 'vue'
import { ChevronLeft, ChevronRight } from 'lucide-vue-next'

const props = withDefaults(
  defineProps<{
    page: number
    pageSize: number
    total: number
    totalPages: number
    pageSizeOptions?: number[]
    unit?: string
    disabled?: boolean
  }>(),
  {
    pageSizeOptions: () => [10, 25, 50, 100],
    unit: 'data',
    disabled: false
  }
)

const emit = defineEmits<{
  (e: 'update:page', value: number): void
  (e: 'update:pageSize', value: number): void
}>()

const safeTotalPages = computed(() => Math.max(1, props.totalPages || 1))

const rangeStart = computed(() =>
  props.total === 0 ? 0 : (props.page - 1) * props.pageSize + 1
)
const rangeEnd = computed(() => Math.min(props.page * props.pageSize, props.total))

/** Jendela nomor halaman: 1 … 4 5 6 … 20 */
const pageItems = computed<Array<number | 'gap'>>(() => {
  const total = safeTotalPages.value
  const current = props.page
  if (total <= 7) {
    return Array.from({ length: total }, (_, index) => index + 1)
  }

  const items: Array<number | 'gap'> = [1]
  const start = Math.max(2, current - 1)
  const end = Math.min(total - 1, current + 1)

  if (start > 2) items.push('gap')
  for (let i = start; i <= end; i += 1) items.push(i)
  if (end < total - 1) items.push('gap')
  items.push(total)
  return items
})

const goTo = (target: number) => {
  if (props.disabled) return
  if (target < 1 || target > safeTotalPages.value || target === props.page) return
  emit('update:page', target)
}

const onPageSizeChange = (event: Event) => {
  const value = Number((event.target as HTMLSelectElement).value)
  if (!Number.isFinite(value) || value <= 0 || value === props.pageSize) return
  emit('update:pageSize', value)
}
</script>

<template>
  <div
    class="flex flex-col gap-3 border-t border-border/60 px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between"
  >
    <div class="flex flex-wrap items-center gap-x-2 gap-y-1 text-muted-foreground">
      <span class="tabular-nums">
        <template v-if="total === 0">Tidak ada {{ unit }}</template>
        <template v-else>
          <span class="font-medium text-foreground">{{ rangeStart }}–{{ rangeEnd }}</span>
          dari <span class="font-medium text-foreground">{{ total }}</span> {{ unit }}
        </template>
      </span>
      <span class="hidden text-border sm:inline">·</span>
      <label class="flex items-center gap-1.5">
        <span class="text-xs">Baris</span>
        <select
          :value="pageSize"
          class="h-8 rounded-lg border border-border/70 bg-card px-2 text-xs font-medium text-foreground shadow-sm transition-colors hover:bg-accent/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 disabled:opacity-50"
          :disabled="disabled"
          aria-label="Jumlah baris per halaman"
          @change="onPageSizeChange"
        >
          <option v-for="size in pageSizeOptions" :key="size" :value="size">
            {{ size }}
          </option>
        </select>
      </label>
    </div>

    <nav class="flex items-center gap-1" aria-label="Navigasi halaman">
      <button
        type="button"
        class="inline-flex h-8 items-center gap-1 rounded-lg px-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 disabled:pointer-events-none disabled:opacity-40"
        :disabled="disabled || page <= 1"
        aria-label="Halaman sebelumnya"
        @click="goTo(page - 1)"
      >
        <ChevronLeft class="h-4 w-4" aria-hidden="true" />
        <span class="hidden sm:inline">Sebelumnya</span>
      </button>

      <div class="hidden items-center gap-1 sm:flex">
        <template v-for="(item, index) in pageItems" :key="`${item}-${index}`">
          <span
            v-if="item === 'gap'"
            class="px-1 text-xs text-muted-foreground"
            aria-hidden="true"
          >
            …
          </span>
          <button
            v-else
            type="button"
            class="h-8 min-w-8 rounded-lg px-2 text-xs font-medium tabular-nums transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
            :class="
              item === page
                ? 'bg-primary text-primary-foreground shadow-sm shadow-primary/25'
                : 'text-muted-foreground hover:bg-accent hover:text-foreground'
            "
            :aria-current="item === page ? 'page' : undefined"
            :aria-label="`Halaman ${item}`"
            :disabled="disabled"
            @click="goTo(item as number)"
          >
            {{ item }}
          </button>
        </template>
      </div>

      <span class="px-2 text-xs text-muted-foreground sm:hidden tabular-nums">
        {{ page }} / {{ safeTotalPages }}
      </span>

      <button
        type="button"
        class="inline-flex h-8 items-center gap-1 rounded-lg px-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 disabled:pointer-events-none disabled:opacity-40"
        :disabled="disabled || page >= safeTotalPages"
        aria-label="Halaman berikutnya"
        @click="goTo(page + 1)"
      >
        <span class="hidden sm:inline">Berikutnya</span>
        <ChevronRight class="h-4 w-4" aria-hidden="true" />
      </button>
    </nav>
  </div>
</template>
