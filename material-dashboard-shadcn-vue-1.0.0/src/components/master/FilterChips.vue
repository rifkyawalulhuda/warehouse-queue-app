<script setup lang="ts">
type Option = { value: string; label: string }

withDefaults(
  defineProps<{
    modelValue: string
    options: Option[]
    allLabel?: string
    allValue?: string
    ariaLabel?: string
  }>(),
  {
    allLabel: 'Semua',
    allValue: '',
    ariaLabel: 'Filter'
  }
)

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void
}>()
</script>

<template>
  <div
    class="flex flex-wrap items-center gap-1 rounded-xl border border-border/70 bg-muted/40 p-1"
    role="group"
    :aria-label="ariaLabel"
  >
    <button
      type="button"
      class="rounded-lg px-2.5 py-1 text-xs font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      :class="
        modelValue === allValue
          ? 'bg-card text-foreground shadow-sm'
          : 'text-muted-foreground hover:text-foreground'
      "
      :aria-pressed="modelValue === allValue"
      @click="emit('update:modelValue', allValue)"
    >
      {{ allLabel }}
    </button>
    <button
      v-for="option in options"
      :key="option.value"
      type="button"
      class="rounded-lg px-2.5 py-1 text-xs font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      :class="
        modelValue === option.value
          ? 'bg-card text-foreground shadow-sm'
          : 'text-muted-foreground hover:text-foreground'
      "
      :aria-pressed="modelValue === option.value"
      @click="emit('update:modelValue', option.value)"
    >
      {{ option.label }}
    </button>
  </div>
</template>
