<script setup lang="ts">
import { computed } from 'vue'
import { cn } from '@/lib/utils'

const props = defineProps<{
  modelValue?: string | number
  type?: string
  placeholder?: string
  disabled?: boolean
  class?: string
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void
}>()

const inputClass = computed(() =>
  cn(
    'flex h-11 w-full rounded-xl border border-input/80 bg-card/75 px-3 py-2 text-sm shadow-sm backdrop-blur-sm ring-offset-background',
    'file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground',
    'placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
    'disabled:cursor-not-allowed disabled:opacity-50',
    props.class
  )
)

const onInput = (event: Event) => {
  const target = event.target as HTMLInputElement | null
  emit('update:modelValue', target?.value ?? '')
}
</script>

<template>
  <input
    :value="modelValue ?? ''"
    :type="type || 'text'"
    :placeholder="placeholder"
    :disabled="disabled"
    :class="inputClass"
    @input="onInput"
  />
</template>
