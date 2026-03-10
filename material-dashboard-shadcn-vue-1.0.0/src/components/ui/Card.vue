<script setup lang="ts">
import { cn } from '@/lib/utils'

defineProps<{
  class?: string
}>()
</script>

<template>
  <div
    :class="
      cn(
        'rounded-2xl border border-border/70 bg-card/80 text-card-foreground shadow-[0_20px_45px_-30px_hsl(var(--foreground)/0.35)] backdrop-blur-sm',
        $props.class
      )
    "
  >
    <slot />
  </div>
</template>
