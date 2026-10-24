<script setup lang="ts">
import Button from '@/components/ui/Button.vue'

defineProps<{
  open: boolean
  title: string
  message: string
  confirmLabel?: string
  submitting?: boolean
  error?: string | null
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'confirm'): void
}>()
</script>

<template>
  <div v-if="open" class="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-labelledby="dja-confirm-title">
    <div class="absolute inset-0 bg-black/55 backdrop-blur-sm" @click="submitting ? null : emit('close')"></div>
    <div class="absolute left-1/2 top-1/2 w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-3xl border border-border/70 bg-card shadow-2xl">
      <div class="border-b border-border/60 px-5 pb-3 pt-4">
        <h3 id="dja-confirm-title" class="text-base font-semibold">{{ title }}</h3>
      </div>
      <div class="px-5 py-4">
        <p class="text-sm leading-relaxed text-muted-foreground">{{ message }}</p>
        <p v-if="error" class="mt-2 text-xs text-red-600" role="alert">{{ error }}</p>
      </div>
      <div class="flex items-center justify-end gap-2 border-t border-border/60 bg-muted/20 px-5 py-3">
        <Button variant="ghost" :disabled="submitting" @click="emit('close')">Batal</Button>
        <Button :disabled="submitting" @click="emit('confirm')">
          {{ submitting ? 'Memproses…' : confirmLabel || 'Ya, Lanjutkan' }}
        </Button>
      </div>
    </div>
  </div>
</template>
