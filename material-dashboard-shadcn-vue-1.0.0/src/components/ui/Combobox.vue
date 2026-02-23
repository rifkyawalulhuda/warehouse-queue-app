<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
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
const triggerRef = ref<HTMLButtonElement | null>(null)
const contentRef = ref<HTMLElement | null>(null)
const contentStyle = ref<Record<string, string>>({})
const listStyle = ref<Record<string, string>>({})

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

const updateContentPosition = () => {
  if (!open.value || !triggerRef.value) return
  const rect = triggerRef.value.getBoundingClientRect()
  const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 0
  const desiredListHeight = 224
  const minListHeight = 100
  const searchBoxHeight = 44
  const desiredPanelHeight = desiredListHeight + searchBoxHeight
  const spaceBelow = viewportHeight - rect.bottom - 12
  const spaceAbove = rect.top - 12
  const openUpward = spaceBelow < desiredPanelHeight && spaceAbove > spaceBelow
  const availableHeight = openUpward ? spaceAbove : spaceBelow
  const usableListHeight = Math.max(minListHeight, Math.min(desiredListHeight, availableHeight - searchBoxHeight))
  const panelHeight = searchBoxHeight + usableListHeight

  const top = openUpward
    ? Math.max(8, rect.top - panelHeight - 6)
    : Math.min(viewportHeight - 8, rect.bottom + 6)

  contentStyle.value = {
    position: 'fixed',
    top: `${top}px`,
    left: `${Math.max(8, rect.left)}px`,
    width: `${rect.width}px`,
    zIndex: '1000',
    height: `${panelHeight}px`,
  }

  listStyle.value = {
    maxHeight: `${usableListHeight}px`,
  }
}

const handleViewportChange = () => {
  updateContentPosition()
}

const handleOutsideClick = (event: MouseEvent) => {
  const target = event.target as Node | null
  if (!target || !rootRef.value) return
  if (rootRef.value.contains(target)) return
  if (contentRef.value?.contains(target)) return
  close()
}

onMounted(() => {
  document.addEventListener('click', handleOutsideClick)
})

onUnmounted(() => {
  document.removeEventListener('click', handleOutsideClick)
  window.removeEventListener('scroll', handleViewportChange, true)
  window.removeEventListener('resize', handleViewportChange)
})

watch(
  () => props.disabled,
  (disabled) => {
    if (disabled) close()
  }
)

watch(open, async (isOpen) => {
  if (!isOpen) {
    window.removeEventListener('scroll', handleViewportChange, true)
    window.removeEventListener('resize', handleViewportChange)
    return
  }

  await nextTick()
  updateContentPosition()
  window.addEventListener('scroll', handleViewportChange, true)
  window.addEventListener('resize', handleViewportChange)
})
</script>

<template>
  <div ref="rootRef" class="relative">
    <button
      ref="triggerRef"
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
    <Teleport to="body">
      <div
        v-if="open"
        ref="contentRef"
        :style="contentStyle"
        class="overflow-hidden rounded-md border bg-card shadow-lg"
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
        <div class="overflow-y-auto p-1" :style="listStyle">
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
    </Teleport>
  </div>
</template>
