<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { Check, ChevronsUpDown, Search } from 'lucide-vue-next'

type Option = {
  value: string
  label: string
}

const props = withDefaults(
  defineProps<{
    modelValue: string
    options: Option[]
    placeholder?: string
    searchPlaceholder?: string
    emptyText?: string
    disabled?: boolean
  }>(),
  {
    placeholder: 'Pilih opsi...',
    searchPlaceholder: 'Cari...',
    emptyText: 'Data tidak ditemukan',
    disabled: false,
  }
)

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void
}>()

const open = ref(false)
const query = ref('')
const rootRef = ref<HTMLElement | null>(null)

const selected = computed(() => props.options.find((option) => option.value === props.modelValue) || null)

const filteredOptions = computed(() => {
  const keyword = query.value.trim().toLowerCase()
  if (!keyword) return props.options
  return props.options.filter((option) => option.label.toLowerCase().includes(keyword))
})

const close = () => {
  open.value = false
  query.value = ''
}

const toggle = () => {
  if (props.disabled) return
  open.value = !open.value
  if (!open.value) query.value = ''
}

const selectOption = (value: string) => {
  emit('update:modelValue', value)
  close()
}

const handleOutsideClick = (event: MouseEvent) => {
  const target = event.target as Node | null
  if (!target || !rootRef.value) return
  if (!rootRef.value.contains(target)) close()
}

onMounted(() => {
  document.addEventListener('click', handleOutsideClick)
})

onUnmounted(() => {
  document.removeEventListener('click', handleOutsideClick)
})

watch(
  () => props.disabled,
  (disabled) => {
    if (disabled) close()
  }
)
</script>

<template>
  <div ref="rootRef" class="relative">
    <button
      type="button"
      class="flex h-10 w-full items-center justify-between rounded-md border bg-transparent px-3 text-sm hover:bg-accent/40 disabled:cursor-not-allowed disabled:opacity-60"
      :disabled="disabled"
      @click="toggle"
    >
      <span :class="selected ? 'text-foreground' : 'text-muted-foreground'">
        {{ selected?.label || placeholder }}
      </span>
      <ChevronsUpDown class="h-4 w-4 shrink-0 text-muted-foreground" />
    </button>

    <div
      v-if="open"
      class="absolute z-50 mt-1 w-full overflow-hidden rounded-md border bg-card shadow-lg"
    >
      <div class="flex items-center border-b px-3 py-2">
        <Search class="mr-2 h-4 w-4 text-muted-foreground" />
        <input
          v-model="query"
          type="text"
          class="w-full bg-transparent text-sm outline-none"
          :placeholder="searchPlaceholder"
        />
      </div>
      <div class="max-h-56 overflow-auto p-1">
        <button
          v-for="option in filteredOptions"
          :key="option.value"
          type="button"
          class="flex w-full items-center rounded-sm px-2 py-2 text-left text-sm hover:bg-accent"
          @click="selectOption(option.value)"
        >
          <Check
            class="mr-2 h-4 w-4"
            :class="props.modelValue === option.value ? 'opacity-100' : 'opacity-0'"
          />
          <span>{{ option.label }}</span>
        </button>
        <div
          v-if="filteredOptions.length === 0"
          class="px-2 py-3 text-center text-sm text-muted-foreground"
        >
          {{ emptyText }}
        </div>
      </div>
    </div>
  </div>
</template>
