<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  status: string
  date?: string | null
  size?: 'sm' | 'md' | 'lg'
  rotate?: boolean
}>()

const label = computed(() => {
  if (props.status === 'BERJALAN') return 'BERJALAN'
  return props.status
})

const tone = computed(() => {
  if (props.status === 'PROSES' || props.status === 'BERJALAN') return 'stamp-proses'
  if (props.status === 'SELESAI') return 'stamp-selesai'
  if (props.status === 'BATAL') return 'stamp-batal'
  return 'stamp-draft'
})

const sizeClass = computed(() => {
  if (props.size === 'lg') return 'px-4 py-1.5 text-base tracking-[0.28em]'
  if (props.size === 'sm') return 'px-2 py-0.5 text-[10px] tracking-[0.16em]'
  return 'px-3 py-1 text-xs tracking-[0.2em]'
})

const dateLabel = computed(() => {
  const value = props.date
  if (!value) return ''
  const parts = value.split('-')
  if (parts.length !== 3) return value
  return `${parts[2]}/${parts[1]}/${parts[0]}`
})
</script>

<template>
  <div
    class="inline-flex select-none flex-col items-center justify-center rounded-[3px] border-2 font-extrabold uppercase leading-none"
    :class="[tone, sizeClass, rotate === false ? '' : 'dja-stamp-tilt']"
    role="img"
    :aria-label="`Status ${status}`"
  >
    <span>{{ label }}</span>
    <span
      v-if="dateLabel"
      class="mt-1 font-semibold tracking-[0.1em] opacity-80"
      :class="size === 'lg' ? 'text-[10px]' : 'text-[8px]'"
    >
      {{ dateLabel }}
    </span>
  </div>
</template>

<style scoped>
.dja-stamp-tilt {
  transform: rotate(-7deg);
}

.stamp-proses {
  color: hsl(214 84% 46%);
  border-color: hsl(214 84% 46% / 0.55);
  background-color: hsl(214 84% 46% / 0.06);
}

.stamp-selesai {
  color: hsl(160 84% 30%);
  border-color: hsl(160 84% 30% / 0.55);
  background-color: hsl(160 84% 30% / 0.06);
}

.stamp-batal {
  color: hsl(0 72% 48%);
  border-color: hsl(0 72% 48% / 0.55);
  background-color: hsl(0 72% 48% / 0.06);
}

.stamp-draft {
  color: hsl(210 12% 46%);
  border-color: hsl(210 12% 46% / 0.45);
  background-color: hsl(210 12% 46% / 0.05);
}
</style>
