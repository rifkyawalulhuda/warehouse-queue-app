<script setup lang="ts">
import { computed } from 'vue'
const props = defineProps<{
  status: 'MENUNGGU' | 'IN_WH' | 'PROSES' | 'SELESAI' | 'BATAL'
}>()

const statusMap: Record<string, { label: string; class: string }> = {
  MENUNGGU: { label: 'MENUNGGU', class: 'bg-yellow-100 text-yellow-800 border-yellow-200' },
  IN_WH: { label: 'IN_WH', class: 'bg-purple-100 text-purple-800 border-purple-200' },
  PROSES: { label: 'PROSES', class: 'bg-blue-100 text-blue-800 border-blue-200' },
  SELESAI: { label: 'SELESAI', class: 'bg-green-100 text-green-800 border-green-200' },
  BATAL: { label: 'BATAL', class: 'bg-gray-100 text-gray-700 border-gray-200' }
}

const badge = computed(() => statusMap[props.status])
</script>

<template>
  <span class="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold" :class="badge.class">
    {{ badge.label }}
  </span>
</template>
