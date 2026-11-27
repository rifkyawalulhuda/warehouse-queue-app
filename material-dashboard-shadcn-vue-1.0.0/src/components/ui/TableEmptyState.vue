<script setup lang="ts">
import { Inbox, SearchX } from 'lucide-vue-next'
import { computed } from 'vue'

const props = withDefaults(
  defineProps<{
    title?: string
    description?: string
    /** true kalau kosong karena filter pencarian, bukan karena belum ada data */
    filtered?: boolean
    colspan?: number
  }>(),
  {
    title: 'Belum ada data',
    description: 'Data akan tampil di sini setelah ditambahkan.',
    filtered: false,
    colspan: 4
  }
)

const icon = computed(() => (props.filtered ? SearchX : Inbox))
</script>

<template>
  <tr>
    <td :colspan="colspan" class="px-4 py-14">
      <div class="flex flex-col items-center justify-center gap-3 text-center">
        <span
          class="flex h-12 w-12 items-center justify-center rounded-2xl border border-border/70 bg-muted/50 text-muted-foreground"
        >
          <component :is="icon" class="h-5 w-5" aria-hidden="true" />
        </span>
        <div class="space-y-1">
          <p class="text-sm font-medium text-foreground">
            {{ filtered ? 'Tidak ada hasil yang cocok' : title }}
          </p>
          <p class="mx-auto max-w-sm text-xs text-muted-foreground">
            {{ filtered ? 'Coba kata kunci lain atau hapus filter pencarian.' : description }}
          </p>
        </div>
        <slot />
      </div>
    </td>
  </tr>
</template>
