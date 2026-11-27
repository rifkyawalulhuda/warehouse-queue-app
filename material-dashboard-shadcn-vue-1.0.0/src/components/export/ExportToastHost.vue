<script setup lang="ts">
import { CheckCircle2, AlertTriangle, Info, Download, X, Loader2 } from 'lucide-vue-next'
import { useExportJobs } from '@/composables/useExportJobs'

const { toasts, downloading, downloadJob, dismissToast } = useExportJobs()

const toneClass = (tone: string) => {
  if (tone === 'success') return 'border-emerald-500/40 bg-emerald-50/95 text-emerald-900 dark:bg-emerald-950/90 dark:text-emerald-100'
  if (tone === 'error') return 'border-red-500/40 bg-red-50/95 text-red-900 dark:bg-red-950/90 dark:text-red-100'
  return 'border-border bg-card/95 text-foreground'
}
</script>

<template>
  <div class="pointer-events-none fixed bottom-4 right-4 z-[100] flex w-full max-w-sm flex-col gap-2 sm:bottom-6 sm:right-6">
    <div
      v-for="toast in toasts"
      :key="toast.id"
      class="pointer-events-auto rounded-xl border p-3 shadow-lg shadow-black/10 backdrop-blur"
      :class="toneClass(toast.tone)"
      role="status"
      aria-live="polite"
    >
      <div class="flex items-start gap-2">
        <CheckCircle2 v-if="toast.tone === 'success'" class="mt-0.5 h-4 w-4 shrink-0" />
        <AlertTriangle v-else-if="toast.tone === 'error'" class="mt-0.5 h-4 w-4 shrink-0" />
        <Info v-else class="mt-0.5 h-4 w-4 shrink-0" />
        <div class="min-w-0 flex-1">
          <p class="text-sm font-semibold leading-tight">{{ toast.title }}</p>
          <p class="mt-0.5 text-xs leading-snug opacity-90">{{ toast.message }}</p>
          <div v-if="toast.job?.downloadable" class="mt-2">
            <button
              type="button"
              class="inline-flex items-center gap-1.5 rounded-lg border border-current/30 px-2.5 py-1 text-xs font-medium transition hover:bg-black/5 dark:hover:bg-white/10"
              :disabled="downloading[toast.job.id]"
              @click="downloadJob(toast.job)"
            >
              <Loader2 v-if="downloading[toast.job.id]" class="h-3.5 w-3.5 animate-spin" />
              <Download v-else class="h-3.5 w-3.5" />
              {{ downloading[toast.job.id] ? 'Mengunduh...' : 'Unduh file' }}
            </button>
          </div>
        </div>
        <button
          type="button"
          class="rounded-md p-1 opacity-70 transition hover:opacity-100"
          aria-label="Tutup notifikasi"
          @click="dismissToast(toast.id)"
        >
          <X class="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  </div>
</template>