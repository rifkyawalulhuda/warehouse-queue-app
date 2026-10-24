<script setup lang="ts">
import { ref, watch } from 'vue'
import Button from '@/components/ui/Button.vue'
import { CheckCircle2, X } from 'lucide-vue-next'
import type { JobTransaction } from '@/services/jobTransactionApi'
import { formatWallClock, toDateTimeInput, wallClockToMs } from '@/components/jobTransaction/meta'
import { handleDateInputClick, openDatePicker } from '@/lib/datePicker'

const props = defineProps<{
  open: boolean
  transaction: JobTransaction | null
  submitting?: boolean
  error?: string | null
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'confirm', payload: { finishAt: string; confirmation: string | null }): void
}>()

const finishAt = ref('')
const confirmation = ref('')
const localError = ref<string | null>(null)

watch(
  () => props.open,
  (open) => {
    if (open) {
      finishAt.value = ''
      confirmation.value = props.transaction?.confirmation || ''
      localError.value = null
    }
  }
)

const submit = () => {
  if (!finishAt.value) {
    localError.value = 'Waktu selesai wajib diisi'
    return
  }
  if (props.transaction?.startAt) {
    const start = wallClockToMs(props.transaction.startAt)
    const end = wallClockToMs(finishAt.value)
    if (Number.isFinite(start) && Number.isFinite(end) && end <= start) {
      localError.value = 'Waktu selesai harus lebih besar dari waktu mulai'
      return
    }
  }
  localError.value = null
  emit('confirm', { finishAt: finishAt.value, confirmation: confirmation.value.trim() || null })
}
</script>

<template>
  <div v-if="open" class="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-labelledby="jt-finish-title">
    <div class="absolute inset-0 bg-black/55 backdrop-blur-sm" @click="submitting ? null : emit('close')"></div>
    <div class="absolute left-1/2 top-1/2 w-[calc(100%-1.5rem)] max-w-md -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-3xl border border-border/70 bg-card shadow-2xl">
      <div class="flex items-start justify-between gap-2 border-b border-border/60 px-5 pb-3 pt-4">
        <div class="flex items-start gap-2">
          <span class="mt-0.5 flex h-7 w-7 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300">
            <CheckCircle2 class="h-4 w-4" aria-hidden="true" />
          </span>
          <div>
            <h3 id="jt-finish-title" class="text-base font-semibold">Selesaikan Pekerjaan</h3>
            <p class="text-xs text-muted-foreground">
              {{ transaction?.employeeName }} · {{ transaction?.activityType }}
            </p>
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
        <p v-if="transaction?.startAt" class="rounded-xl border border-border/60 bg-muted/40 px-3 py-2 text-xs">
          Mulai: <span class="font-semibold tabular-nums">{{ formatWallClock(transaction.startAt) }}</span>
        </p>

        <label class="block">
          <span class="text-xs text-muted-foreground">Tanggal &amp; waktu selesai <span class="text-red-600">*</span></span>
          <input
            v-model="finishAt"
            type="datetime-local"
            :disabled="submitting"
            class="jt-field mt-1 cursor-pointer tabular-nums"
            :min="toDateTimeInput(transaction?.startAt)"
            @click="handleDateInputClick"
            @keydown.enter.prevent="openDatePicker($event.currentTarget as HTMLInputElement)"
            @input="localError = null"
          />
        </label>

        <label class="block">
          <span class="text-xs text-muted-foreground">Confirmation</span>
          <input
            v-model="confirmation"
            :disabled="submitting"
            class="jt-field mt-1"
            placeholder="Catatan (opsional)"
          />
        </label>

        <p v-if="localError || error" class="text-xs text-red-600" role="alert">{{ localError || error }}</p>
      </div>

      <div class="flex items-center justify-end gap-2 border-t border-border/60 bg-muted/20 px-5 py-3">
        <Button variant="ghost" :disabled="submitting" @click="emit('close')">Batal</Button>
        <Button :disabled="submitting" @click="submit">
          {{ submitting ? 'Menyelesaikan…' : 'Finish' }}
        </Button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.jt-field {
  width: 100%;
  border: 1px solid hsl(var(--input));
  border-radius: 0.75rem;
  background-color: hsl(var(--card));
  padding: 0.55rem 0.7rem;
  font-size: 0.875rem;
  color: hsl(var(--foreground));
  transition: border-color 150ms ease, box-shadow 150ms ease;
}

.jt-field:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.jt-field:focus-visible {
  outline: none;
  border-color: hsl(var(--ring));
  box-shadow: 0 0 0 2px hsl(var(--ring) / 0.25);
}
</style>
