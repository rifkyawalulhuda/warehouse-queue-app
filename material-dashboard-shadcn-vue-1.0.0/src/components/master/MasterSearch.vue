<script setup lang="ts">
import { Search, X } from 'lucide-vue-next'
import Input from '@/components/ui/Input.vue'

withDefaults(
  defineProps<{
    modelValue: string
    placeholder?: string
    label?: string
  }>(),
  {
    placeholder: 'Cari...',
    label: ''
  }
)

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void
}>()
</script>

<template>
  <div class="relative w-full">
    <Search
      class="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
      aria-hidden="true"
    />
    <Input
      :model-value="modelValue"
      type="search"
      :placeholder="placeholder"
      :aria-label="label || placeholder"
      class="pl-9 pr-9"
      @update:model-value="(value) => emit('update:modelValue', String(value))"
    />
    <button
      v-if="modelValue"
      type="button"
      class="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      aria-label="Hapus pencarian"
      @click="emit('update:modelValue', '')"
    >
      <X class="h-3.5 w-3.5" aria-hidden="true" />
    </button>
  </div>
</template>
