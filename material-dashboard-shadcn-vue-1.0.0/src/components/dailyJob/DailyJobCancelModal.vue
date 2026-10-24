<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import Button from '@/components/ui/Button.vue'
import { Ban, X } from 'lucide-vue-next'

const props = defineProps<{
  open: boolean
  submitting?: boolean
  error?: string | null
  dateLabel: string
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'confirm', reason: string): void
}>()

const reason = ref('')
const localError = ref<string | null>(null)

watch(
  () => props.open,
  (open) => {
    if (open) {
      reason.value = ''
      localError.value = null
    }
  }
)

const canSubmit = computed(() => reason.value.trim().length > 0)

const submit = () => {
  const text = reason.value.trim()
  if (!text) {
    localError.value = 'Alasan pembatalan wajib diisi'
    return
  }
  emit('confirm', text)
}
</script>

<template>
  <div v-if="open" class="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-labelledby="dja-cancel-title">
    <div class="absolute inset-0 bg-black/55 backdrop-blur-sm" @click="submitting ? null : emit('close')"></div>
    <div class="absolute left-1/2 top-1/2 w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-3xl border border-border/70 bg-card shadow-2xl">
      <div class="flex items-start justify-between gap-2 border-b border-border/60 px-5 pb-3 pt-4">
        <div class="flex items-start gap-2">
          <span class="mt-0.5 flex h-7 w-7 items-center justify-center rounded-full bg-red-100 text-red-600 dark:bg-red-500/15 dark:text-red-300">
            <Ban class="h-4 w-4" aria-hidden="true" />
          </span>
          <div>
            <h3 id="dja-cancel-title" class="text-base font-semibold">Batalkan Laporan</h3>
            <p class="text-xs text-muted-foreground">{{ dateLabel }}</p>
          </div>
        </div>
        <button
          type="button"
          class="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-40"
          aria-label="Tutup"
          :disabled="submitting"
          @click="emit('close')"
        >
          <X class="h-4 w-4" />
        </button>
      </div>

      <div class="space-y-3 px-5 py-4">
        <p class="text-xs leading-relaxed text-muted-foreground">
          Laporan tetap tersimpan dan bisa dicetak dengan stempel <span class="font-semibold text-foreground">BATAL</span>.
          Status batal tidak bisa dibuka kembali.
        </p>
        <label class="block">
          <span class="text-xs text-muted-foreground">Alasan batal <span class="text-red-600">*</span></span>
          <textarea
            v-model="reason"
            rows="3"
            maxlength="500"
            class="mt-1 w-full resize-none rounded-xl border border-input/80 bg-card px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            placeholder="Contoh: truk tidak jadi datang"
            @input="localError = null"
          ></textarea>
          <span class="mt-1 block text-right text-[10px] text-muted-foreground tabular-nums">{{ reason.length }}/500</span>
        </label>
        <p v-if="localError || error" class="text-xs text-red-600" role="alert">{{ localError || error }}</p>
      </div>

      <div class="flex items-center justify-end gap-2 border-t border-border/60 bg-muted/20 px-5 py-3">
        <Button variant="ghost" :disabled="submitting" @click="emit('close')">Batal</Button>
        <Button
          variant="outline"
          class="border-red-200 bg-red-600 text-white hover:bg-red-700 hover:text-white dark:border-red-500/40"
          :disabled="submitting || !canSubmit"
          @click="submit"
        >
          {{ submitting ? 'Membatalkan…' : 'Ya, Batalkan' }}
        </Button>
      </div>
    </div>
  </div>
</template>
