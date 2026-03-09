<script setup lang="ts">
import { computed } from 'vue'
const props = defineProps<{
  status: 'MENUNGGU' | 'IN_WH' | 'PROSES' | 'SELESAI' | 'BATAL'
}>()

const statusMap: Record<string, { label: string; class: string }> = {
  MENUNGGU: { label: 'MENUNGGU', class: 'bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-500/15 dark:text-yellow-100 dark:border-yellow-400/30' },
  IN_WH: { label: 'IN_WH', class: 'bg-cyan-100 text-cyan-800 border-cyan-200 dark:bg-cyan-500/15 dark:text-cyan-200 dark:border-cyan-400/30' },
  PROSES: { label: 'PROSES', class: 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-500/15 dark:text-blue-100 dark:border-blue-400/30' },
  SELESAI: { label: 'SELESAI', class: 'bg-green-100 text-green-800 border-green-200 dark:bg-emerald-500/15 dark:text-emerald-100 dark:border-emerald-400/30' },
  BATAL: { label: 'BATAL', class: 'bg-muted text-muted-foreground border-border' }
}

const badge = computed(() => statusMap[props.status])
</script>

<template>
  <span class="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold" :class="badge.class">
    {{ badge.label }}
  </span>
</template>
