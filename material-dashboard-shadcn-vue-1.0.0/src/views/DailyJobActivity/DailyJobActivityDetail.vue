<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import Button from '@/components/ui/Button.vue'
import DailyJobSheet from '@/components/dailyJob/DailyJobSheet.vue'
import DailyJobStamp from '@/components/dailyJob/DailyJobStamp.vue'
import {
  ArrowLeft,
  Download,
  Printer,
  Loader2,
  Maximize2,
  Minimize2,
  ListChecks,
  Save,
  StickyNote
} from 'lucide-vue-next'
import {
  exportDailyJobActivityExcel,
  getDailyJobActivityById,
  updateDailyJobActivityNotes,
  type DailyJobReport
} from '@/services/dailyJobActivity'

const route = useRoute()
const router = useRouter()

const report = ref<DailyJobReport | null>(null)
const loading = ref(true)
const exporting = ref(false)
const error = ref<string | null>(null)
const success = ref<string | null>(null)
const notes = ref('')
const savingNotes = ref(false)
const notesDirty = ref(false)
const paperExpanded = ref(false)
const isNarrow = ref(false)

const reportId = computed(() => String(route.params.id || ''))

const dateLabel = computed(() => {
  const value = report.value?.activityDate
  if (!value) return '—'
  const [y, m, d] = value.split('-')
  return `${d}/${m}/${y}`
})

const weekdayLabel = computed(() => {
  const value = report.value?.activityDate
  if (!value) return ''
  const [y, m, d] = value.split('-').map(Number)
  if (!y || !m || !d) return ''
  return new Date(y, m - 1, d).toLocaleDateString('id-ID', { weekday: 'long' })
})

const getErrorMessage = (err: any, fallback: string) =>
  err?.response?.data?.message || err?.message || fallback

const load = async () => {
  loading.value = true
  error.value = null
  try {
    const response = await getDailyJobActivityById(reportId.value)
    report.value = response.data?.data ?? null
    notes.value = report.value?.notes || ''
    notesDirty.value = false
  } catch (err: any) {
    error.value = getErrorMessage(err, 'Gagal memuat laporan')
    report.value = null
  } finally {
    loading.value = false
  }
}

const saveNotes = async () => {
  if (!report.value?.id) return
  savingNotes.value = true
  error.value = null
  success.value = null
  try {
    await updateDailyJobActivityNotes(report.value.id, notes.value)
    report.value = { ...report.value, notes: notes.value.trim() || null }
    notesDirty.value = false
    success.value = 'Catatan tersimpan'
  } catch (err: any) {
    error.value = getErrorMessage(err, 'Gagal menyimpan catatan')
  } finally {
    savingNotes.value = false
  }
}

const handleExport = async () => {
  if (!report.value?.id) return
  exporting.value = true
  error.value = null
  try {
    const response = await exportDailyJobActivityExcel(report.value.id)
    const blob = new Blob([response.data], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    const prefix = report.value.status === 'BATAL' ? 'BATAL_' : ''
    link.download = `${prefix}daily-job-activity_${report.value.activityDate}.xlsx`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
    success.value = 'File Excel diunduh'
  } catch (err: any) {
    error.value = getErrorMessage(err, 'Gagal export Excel')
  } finally {
    exporting.value = false
  }
}

const escapeHtml = (value: unknown) =>
  String(value ?? '').replace(/[&<>"']/g, (char) => {
    const map: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }
    return map[char]
  })

const qtyCell = (value?: number | null) =>
  value && Number(value) > 0 ? `<td class="c b">${Number(value)}</td>` : '<td></td>'

const checkCell = (checked: boolean) => `<td class="c b chk">${checked ? '&#10003;' : ''}</td>`

const emptyRow = () => `<tr>${'<td></td>'.repeat(13)}</tr>`

const sessionRow = (session: any) => `
  <tr>
    <td class="b">${escapeHtml(session.employeeName)}</td>
    <td class="c">${escapeHtml(session.jobRole)}</td>
    <td class="c">${escapeHtml(session.activityType)}</td>
    ${qtyCell(session.qtyCdd)}${qtyCell(session.qtyWb)}${qtyCell(session.qtyFuso)}${qtyCell(session.qty20ft)}${qtyCell(session.qty40ft)}
    <td class="c">${escapeHtml(session.timeStart)}</td>
    <td class="c">${escapeHtml(session.timeFinish)}</td>
    ${checkCell(session.isPending)}${checkCell(session.isFinish)}
    <td>${escapeHtml(session.confirmation)}</td>
  </tr>
`

const buildPrintHtml = () => {
  const data = report.value
  if (!data) return ''

  const manpowerBody = data.groups.length
    ? data.groups
        .map((group, index) => {
          const parts: string[] = []
          if (index > 0) parts.push(emptyRow())
          parts.push(group.tally ? sessionRow(group.tally) : emptyRow())
          parts.push(group.operator ? sessionRow(group.operator) : emptyRow())
          return parts.join('')
        })
        .join('')
    : emptyRow()

  const simpleBody = (rows: any[]) =>
    (rows.length
      ? rows
          .map(
            (row) => `<tr>
        <td class="c" colspan="3">${escapeHtml(row.total)}</td>
        <td class="c" colspan="2">${escapeHtml(row.totalMember)}</td>
        <td class="c" colspan="3">${escapeHtml(row.timeWork)}</td>
        <td class="c b chk" colspan="2">${row.isPending ? '&#10003;' : ''}</td>
        <td class="c b chk" colspan="2">${row.isFinish ? '&#10003;' : ''}</td>
        <td>${escapeHtml(row.confirmation)}</td>
      </tr>`
          )
          .join('')
      : '') + emptyRow()

  const cols = `<colgroup>
      <col style="width:14%" /><col style="width:8%" /><col style="width:10%" />
      <col style="width:5%" /><col style="width:5%" /><col style="width:5%" /><col style="width:5%" /><col style="width:5%" />
      <col style="width:7%" /><col style="width:7%" /><col style="width:6%" /><col style="width:6%" /><col style="width:17%" />
    </colgroup>`

  return `<!doctype html>
<html>
  <head>
    <meta charset="UTF-8" />
    <title>Daily Job Activity ${escapeHtml(dateLabel.value)}</title>
    <style>
      @page { size: A4 landscape; margin: 8mm; }
      * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      body { font-family: Arial, Helvetica, sans-serif; color: #000; font-size: 9px; margin: 0; }
      h1 { font-size: 12px; margin: 0 0 2px; font-weight: bold; text-decoration: underline; }
      .note { font-size: 8px; font-style: italic; color: #444; margin: 0 0 4px; }
      .batal { display:inline-block; border:1px solid #fca5a5; background:#fee2e2; color:#b91c1c; font-weight:bold; letter-spacing:2px; padding:1px 8px; margin-left:8px; }
      .summary { display: flex; gap: 40px; margin: 10px 0 12px; }
      .summary-block { min-width: 240px; }
      .summary-title { font-weight: bold; text-decoration: underline; margin-bottom: 3px; }
      .summary-row { display: flex; }
      .summary-label { width: 120px; }
      table { border-collapse: collapse; width: 100%; table-layout: fixed; }
      th, td { border: 1px solid #000; padding: 2px 3px; vertical-align: middle; word-wrap: break-word; }
      th { font-weight: bold; text-align: center; }
      .hdr-main { background: #B4C6E7; }
      .hdr-pick { background: #FFFF00; text-transform: uppercase; }
      .hdr-stuff { background: #33CC33; text-transform: uppercase; }
      .c { text-align: center; }
      .b { font-weight: bold; }
      .chk { font-size: 11px; }
      .gap { height: 16px; }
      .notes { margin-top: 10px; font-size: 8px; border-top: 1px dashed #999; padding-top: 4px; }
    </style>
  </head>
  <body>
    <h1>DATE : ${escapeHtml(dateLabel.value)}${data.status === 'BATAL' ? '<span class="batal">BATAL</span>' : ''}</h1>
    ${data.notes ? `<p class="note">Catatan: ${escapeHtml(data.notes)}</p>` : ''}

    <div class="summary">
      <div class="summary-block">
        <div class="summary-title">RECEIVING</div>
        <div class="summary-row"><span class="summary-label">CDD / CDE</span><span>: ${escapeHtml(data.summary.recCddCde)}</span></div>
        <div class="summary-row"><span class="summary-label">WINGBOX</span><span>: ${escapeHtml(data.summary.recWingbox)}</span></div>
        <div class="summary-row"><span class="summary-label">CONTAINER</span><span>: ${escapeHtml(data.summary.recContainer)}</span></div>
      </div>
      <div class="summary-block">
        <div class="summary-title">DELIVERY</div>
        <div class="summary-row"><span class="summary-label">CDD / CDE</span><span>: ${escapeHtml(data.summary.delCddCde)}</span></div>
        <div class="summary-row"><span class="summary-label">WINGBOX / OTHER</span><span>: ${escapeHtml(data.summary.delWingboxOther)}</span></div>
        <div class="summary-row"><span class="summary-label">CONTAINER</span><span>: ${escapeHtml(data.summary.delContainer)}</span></div>
      </div>
    </div>

    <table>
      ${cols}
      <thead>
        <tr>
          <th class="hdr-main" rowspan="2">Man Power</th>
          <th class="hdr-main" rowspan="2" colspan="2">Job Activity</th>
          <th class="hdr-main" colspan="5">Truck Type</th>
          <th class="hdr-main" colspan="2">Time Work</th>
          <th class="hdr-main" colspan="2">Actual Progress</th>
          <th class="hdr-main" rowspan="2">Confirmation</th>
        </tr>
        <tr>
          <th class="hdr-main">CDD</th><th class="hdr-main">WB</th><th class="hdr-main">Fuso</th>
          <th class="hdr-main">20ft</th><th class="hdr-main">40ft</th>
          <th class="hdr-main">Start</th><th class="hdr-main">Finish</th>
          <th class="hdr-main">Pending</th><th class="hdr-main">Finish</th>
        </tr>
      </thead>
      <tbody>${manpowerBody}</tbody>
    </table>

    <div class="gap"></div><div class="gap"></div>

    <table>
      ${cols}
      <thead>
        <tr>
          <th class="hdr-pick" rowspan="2" colspan="3">Total Picking</th>
          <th class="hdr-pick" rowspan="2" colspan="2">Total Member</th>
          <th class="hdr-pick" rowspan="2" colspan="3">Time Work</th>
          <th class="hdr-pick" colspan="4">Actual Progress</th>
          <th class="hdr-pick" rowspan="2">Confirmation</th>
        </tr>
        <tr>
          <th class="hdr-pick" colspan="2">Pending</th>
          <th class="hdr-pick" colspan="2">Finish</th>
        </tr>
      </thead>
      <tbody>${simpleBody(data.picking)}</tbody>
    </table>

    <div class="gap"></div><div class="gap"></div>

    <table>
      ${cols}
      <thead>
        <tr>
          <th class="hdr-stuff" rowspan="2" colspan="3">Total Stuffing</th>
          <th class="hdr-stuff" rowspan="2" colspan="2">Total Member</th>
          <th class="hdr-stuff" rowspan="2" colspan="3">Time Work</th>
          <th class="hdr-stuff" colspan="4">Actual Progress</th>
          <th class="hdr-stuff" rowspan="2">Confirmation</th>
        </tr>
        <tr>
          <th class="hdr-stuff" colspan="2">Pending</th>
          <th class="hdr-stuff" colspan="2">Finish</th>
        </tr>
      </thead>
      <tbody>${simpleBody(data.stuffing)}</tbody>
    </table>
  </body>
</html>`
}

const handlePrint = () => {
  error.value = null
  const printWindow = window.open('', '_blank')
  if (!printWindow) {
    error.value = 'Popup print diblokir browser. Izinkan popup lalu coba lagi.'
    return
  }
  printWindow.document.open()
  printWindow.document.write(buildPrintHtml())
  printWindow.document.close()
  printWindow.focus()
  window.setTimeout(() => printWindow.print(), 300)
}

const openTransactions = () => {
  router.push({
    name: 'Transaksi Pekerjaan',
    query: { date: report.value?.activityDate }
  })
}

const checkNarrow = () => {
  isNarrow.value = window.innerWidth < 1280
}

onMounted(() => {
  checkNarrow()
  window.addEventListener('resize', checkNarrow)
  load()
})

onUnmounted(() => window.removeEventListener('resize', checkNarrow))
</script>

<template>
  <div class="space-y-4">
    <header class="flex flex-wrap items-start justify-between gap-3">
      <div class="flex min-w-0 items-start gap-2">
        <Button
          size="icon"
          variant="ghost"
          class="mt-0.5 h-8 w-8 shrink-0 rounded-full"
          aria-label="Kembali ke daftar laporan"
          @click="router.push({ name: 'Daily Job Activity' })"
        >
          <ArrowLeft class="h-4 w-4" />
        </Button>
        <div class="min-w-0">
          <p class="text-[10px] font-semibold uppercase tracking-[0.22em] text-primary/80">Laporan Harian</p>
          <div class="mt-0.5 flex flex-wrap items-center gap-2">
            <h1 class="text-xl font-bold tracking-tight tabular-nums">{{ dateLabel }}</h1>
            <DailyJobStamp
              v-if="report && report.status !== 'KOSONG'"
              :status="report.status"
              size="sm"
            />
            <span
              v-else-if="report"
              class="rounded-full border border-dashed border-border px-2 py-0.5 text-[10px] font-medium text-muted-foreground"
            >
              Belum ada transaksi
            </span>
          </div>
          <p class="mt-0.5 text-xs capitalize text-muted-foreground">
            {{ weekdayLabel }}
            <template v-if="report"> · {{ report.transactions }} transaksi · {{ report.counts.SELESAI }} selesai</template>
          </p>
        </div>
      </div>

      <div class="flex flex-wrap items-center gap-1.5">
        <Button size="sm" variant="outline" @click="openTransactions">
          <ListChecks class="mr-1.5 h-4 w-4" aria-hidden="true" />
          Transaksi
        </Button>
        <Button size="sm" variant="outline" @click="handlePrint">
          <Printer class="mr-1.5 h-4 w-4" aria-hidden="true" />
          Print
        </Button>
        <Button size="sm" variant="outline" :disabled="exporting || !report?.id" @click="handleExport">
          <Download class="mr-1.5 h-4 w-4" aria-hidden="true" />
          {{ exporting ? 'Menyiapkan…' : 'Excel' }}
        </Button>
      </div>
    </header>

    <div v-if="error" class="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200" role="alert">
      {{ error }}
    </div>
    <div v-if="success" class="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200" role="status">
      {{ success }}
    </div>

    <div v-if="loading" class="flex items-center justify-center py-24 text-sm text-muted-foreground">
      <Loader2 class="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
      Memuat laporan…
    </div>

    <template v-else-if="report">
      <section class="rounded-3xl border border-border/70 bg-card/70 p-3 shadow-sm backdrop-blur-sm sm:p-4">
        <div class="flex items-start gap-2">
          <StickyNote class="mt-1 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          <div class="min-w-0 flex-1">
            <label for="dja-notes" class="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              Catatan laporan
            </label>
            <textarea
              id="dja-notes"
              v-model="notes"
              rows="2"
              maxlength="1000"
              class="jt-field mt-1 resize-none"
              placeholder="Catatan tambahan untuk laporan tanggal ini"
              @input="notesDirty = true"
            ></textarea>
            <div class="mt-2 flex items-center justify-between gap-2">
              <span class="text-[11px] text-muted-foreground">
                Catatan tidak mengubah angka laporan.
              </span>
              <Button size="sm" :disabled="savingNotes || !notesDirty" @click="saveNotes">
                <Save class="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
                {{ savingNotes ? 'Menyimpan…' : 'Simpan catatan' }}
              </Button>
            </div>
          </div>
        </div>
      </section>

      <div class="flex items-center justify-between px-1">
        <p class="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          Pratinjau dokumen
        </p>
        <button
          v-if="isNarrow"
          type="button"
          class="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          @click="paperExpanded = !paperExpanded"
        >
          <Minimize2 v-if="paperExpanded" class="h-3 w-3" aria-hidden="true" />
          <Maximize2 v-else class="h-3 w-3" aria-hidden="true" />
          {{ paperExpanded ? 'Perkecil' : 'Perbesar' }}
        </button>
      </div>

      <div class="overflow-x-auto rounded-3xl bg-muted/30 p-2 sm:p-4">
        <div
          :style="isNarrow && !paperExpanded ? { zoom: 0.62 } : {}"
          class="mx-auto w-full max-w-[1180px]"
        >
          <DailyJobSheet :report="report" />
        </div>
      </div>
    </template>
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
}

.jt-field:focus-visible {
  outline: none;
  border-color: hsl(var(--ring));
  box-shadow: 0 0 0 2px hsl(var(--ring) / 0.25);
}
</style>
