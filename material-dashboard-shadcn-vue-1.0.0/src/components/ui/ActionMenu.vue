<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { Ban, CheckCircle2, MoreHorizontal, Pencil, Play, RotateCcw, Trash2 } from 'lucide-vue-next'

export type ActionIcon = 'edit' | 'undo' | 'cancel' | 'delete' | 'play' | 'check'

export type ActionItem = {
  key: string
  label: string
  icon?: ActionIcon
  danger?: boolean
}

const props = withDefaults(
  defineProps<{
    items: ActionItem[]
    label?: string
    align?: 'start' | 'end'
    disabled?: boolean
    size?: 'sm' | 'md'
  }>(),
  {
    label: 'Aksi lainnya',
    align: 'end',
    disabled: false,
    size: 'sm'
  }
)

const emit = defineEmits<{
  (e: 'select', key: string): void
}>()

const ICONS = {
  edit: Pencil,
  undo: RotateCcw,
  cancel: Ban,
  delete: Trash2,
  play: Play,
  check: CheckCircle2
}

const PANEL_WIDTH = 184
const ITEM_HEIGHT = 38

const open = ref(false)
const triggerRef = ref<HTMLButtonElement | null>(null)
const panelRef = ref<HTMLElement | null>(null)
const panelStyle = ref<Record<string, string>>({})

const hasItems = computed(() => props.items.length > 0)

const updatePosition = () => {
  if (!open.value || !triggerRef.value) return
  const rect = triggerRef.value.getBoundingClientRect()
  const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 0
  const panelHeight = props.items.length * ITEM_HEIGHT + 8
  const spaceBelow = viewportHeight - rect.bottom - 12
  const openUpward = spaceBelow < panelHeight && rect.top > spaceBelow

  const top = openUpward ? rect.top - panelHeight - 6 : rect.bottom + 6
  const left =
    props.align === 'end'
      ? Math.max(8, Math.min(rect.right - PANEL_WIDTH, window.innerWidth - PANEL_WIDTH - 8))
      : Math.max(8, rect.left)

  panelStyle.value = {
    position: 'fixed',
    top: `${Math.max(8, top)}px`,
    left: `${left}px`,
    width: `${PANEL_WIDTH}px`,
    zIndex: '1000'
  }
}

const close = (restoreFocus = false) => {
  if (!open.value) return
  open.value = false
  if (restoreFocus) triggerRef.value?.focus()
}

const toggle = () => {
  if (props.disabled || !hasItems.value) return
  open.value = !open.value
}

const select = (key: string) => {
  close()
  emit('select', key)
}

const handleOutsideClick = (event: MouseEvent) => {
  const target = event.target as Node | null
  if (!target) return
  if (triggerRef.value?.contains(target)) return
  if (panelRef.value?.contains(target)) return
  close()
}

const handleKeydown = (event: KeyboardEvent) => {
  if (event.key === 'Escape' && open.value) {
    event.stopPropagation()
    close(true)
  }
}

onMounted(() => {
  document.addEventListener('click', handleOutsideClick)
  document.addEventListener('keydown', handleKeydown)
})

onUnmounted(() => {
  document.removeEventListener('click', handleOutsideClick)
  document.removeEventListener('keydown', handleKeydown)
  window.removeEventListener('scroll', updatePosition, true)
  window.removeEventListener('resize', updatePosition)
})

watch(open, async (isOpen) => {
  if (!isOpen) {
    window.removeEventListener('scroll', updatePosition, true)
    window.removeEventListener('resize', updatePosition)
    return
  }
  await nextTick()
  updatePosition()
  window.addEventListener('scroll', updatePosition, true)
  window.addEventListener('resize', updatePosition)
})

watch(
  () => props.disabled,
  (disabled) => {
    if (disabled) close()
  }
)
</script>

<template>
  <div class="relative inline-flex">
    <button
      ref="triggerRef"
      type="button"
      class="inline-flex items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 disabled:pointer-events-none disabled:opacity-40"
      :class="[open ? 'bg-accent text-foreground' : '', size === 'md' ? 'h-11 w-11' : 'h-8 w-8']"
      :disabled="disabled || !hasItems"
      :aria-label="label"
      aria-haspopup="menu"
      :aria-expanded="open"
      @click="toggle"
    >
      <MoreHorizontal class="h-4 w-4" aria-hidden="true" />
    </button>

    <Teleport to="body">
      <div
        v-if="open"
        ref="panelRef"
        :style="panelStyle"
        role="menu"
        class="overflow-hidden rounded-xl border border-border/70 bg-card p-1 shadow-xl"
      >
        <button
          v-for="item in items"
          :key="item.key"
          type="button"
          role="menuitem"
          class="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[13px] transition-colors"
          :class="item.danger
            ? 'text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10'
            : 'text-foreground hover:bg-accent'"
          @click="select(item.key)"
        >
          <component
            :is="ICONS[item.icon || 'edit']"
            class="h-3.5 w-3.5 shrink-0 opacity-70"
            aria-hidden="true"
          />
          {{ item.label }}
        </button>
      </div>
    </Teleport>
  </div>
</template>
