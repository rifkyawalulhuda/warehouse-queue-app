<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(defineProps<{ name?: string | null; avatar?: boolean }>(), {
  name: '',
  avatar: false
})

/** Dua huruf awal, dihitung dari kata pertama dan kedua. */
const initials = computed(() => {
  const words = String(props.name ?? '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
  if (words.length === 0) return '?'
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase()
  return (words[0][0] + words[1][0]).toUpperCase()
})

// Warna dipilih deterministik dari nama, jadi satu entitas selalu dapat warna sama.
const TONES = [
  'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
  'bg-sky-500/10 text-sky-700 dark:text-sky-400',
  'bg-violet-500/10 text-violet-700 dark:text-violet-400',
  'bg-amber-500/10 text-amber-700 dark:text-amber-400',
  'bg-rose-500/10 text-rose-700 dark:text-rose-400',
  'bg-teal-500/10 text-teal-700 dark:text-teal-400'
]

const tone = computed(() => {
  const text = String(props.name ?? '')
  let hash = 0
  for (let i = 0; i < text.length; i += 1) {
    hash = (hash * 31 + text.charCodeAt(i)) % 100000
  }
  return TONES[hash % TONES.length]
})
</script>

<template>
  <slot v-if="!avatar" />
  <div v-else class="flex min-w-0 items-center gap-2.5">
    <span
      class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[11px] font-semibold tracking-tight"
      :class="tone"
      aria-hidden="true"
    >
      {{ initials }}
    </span>
    <div class="min-w-0">
      <slot />
    </div>
  </div>
</template>
