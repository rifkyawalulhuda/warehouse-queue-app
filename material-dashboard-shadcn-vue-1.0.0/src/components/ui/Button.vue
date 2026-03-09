<script setup lang="ts">
import { computed } from 'vue'
import { cn } from '@/lib/utils'

const props = defineProps<{
  variant?: 'default' | 'secondary' | 'outline' | 'ghost' | 'link'
  size?: 'default' | 'sm' | 'lg' | 'icon'
  class?: string
}>()

const buttonClass = computed(() => {
  const baseClass = 'inline-flex items-center justify-center whitespace-nowrap rounded-xl border border-transparent text-sm font-medium ring-offset-background transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 active:scale-[0.99] disabled:pointer-events-none disabled:opacity-50'
  
  const variantClasses = {
    default: 'bg-primary text-primary-foreground shadow-lg shadow-primary/20 hover:bg-primary/90 hover:shadow-xl hover:shadow-primary/25',
    secondary: 'bg-secondary/85 text-secondary-foreground shadow-sm hover:bg-secondary',
    outline: 'border-border/70 bg-card/75 shadow-sm backdrop-blur-sm hover:bg-accent/70 hover:text-accent-foreground',
    ghost: 'hover:bg-accent/70 hover:text-accent-foreground',
    link: 'text-primary underline-offset-4 hover:underline'
  }
  
  const sizeClasses = {
    default: 'h-10 px-4 py-2',
    sm: 'h-9 rounded-md px-3',
    lg: 'h-11 rounded-md px-8',
    icon: 'h-10 w-10'
  }
  
  return cn(
    baseClass,
    variantClasses[props.variant || 'default'],
    sizeClasses[props.size || 'default'],
    props.class
  )
})
</script>

<template>
  <button :class="buttonClass">
    <slot />
  </button>
</template>
