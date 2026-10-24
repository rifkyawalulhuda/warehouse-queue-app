<script setup lang="ts">
import { computed } from 'vue'
import DailyJobStamp from '@/components/dailyJob/DailyJobStamp.vue'
import type { DailyJobReport } from '@/services/dailyJobActivity'

const props = defineProps<{
  report: DailyJobReport | null
}>()

const groups = computed(() => props.report?.groups ?? [])
const picking = computed(() => props.report?.picking ?? [])
const stuffing = computed(() => props.report?.stuffing ?? [])

const summary = computed(() => ({
  recCddCde: props.report?.summary?.recCddCde || '',
  recWingbox: props.report?.summary?.recWingbox || '',
  recContainer: props.report?.summary?.recContainer || '',
  delCddCde: props.report?.summary?.delCddCde || '',
  delWingboxOther: props.report?.summary?.delWingboxOther || '',
  delContainer: props.report?.summary?.delContainer || ''
}))

const dateLabel = computed(() => {
  const value = props.report?.activityDate
  if (!value) return '—'
  const [y, m, d] = value.split('-')
  return `${d}/${m}/${y}`
})

const isCancelled = computed(() => props.report?.status === 'BATAL')
const showStamp = computed(() => props.report && props.report.status !== 'KOSONG')

const qty = (value?: number | null) => (value && Number(value) > 0 ? String(value) : '')
</script>

<template>
  <article class="dja-paper">
    <div class="relative">
      <DailyJobStamp
        v-if="showStamp && report"
        :status="report.status"
        :date="report.activityDate"
        size="lg"
        class="absolute -right-1 -top-2 z-10"
      />

      <header class="border-b border-[#111]/15 pb-3 pr-32">
        <p class="dja-eyebrow">Daily Job Activity</p>
        <h2 class="dja-date">DATE : {{ dateLabel }}</h2>
        <p v-if="isCancelled" class="dja-note dja-note-danger">
          Seluruh transaksi pada tanggal ini dibatalkan
        </p>
        <p v-else-if="report && report.transactions > 0" class="dja-note">
          {{ report.transactions }} transaksi tercatat · {{ report.counts.SELESAI }} selesai ·
          {{ report.counts.PROSES }} berjalan
        </p>
        <p v-else class="dja-note">Belum ada transaksi pada tanggal ini</p>
      </header>

      <section class="mt-4 grid gap-x-10 gap-y-3 sm:grid-cols-2">
        <div>
          <p class="dja-block-title">Receiving</p>
          <dl class="dja-summary">
            <div><dt>CDD / CDE</dt><dd>{{ summary.recCddCde || '—' }}</dd></div>
            <div><dt>Wingbox</dt><dd>{{ summary.recWingbox || '—' }}</dd></div>
            <div><dt>Container</dt><dd>{{ summary.recContainer || '—' }}</dd></div>
          </dl>
        </div>
        <div>
          <p class="dja-block-title">Delivery</p>
          <dl class="dja-summary">
            <div><dt>CDD / CDE</dt><dd>{{ summary.delCddCde || '—' }}</dd></div>
            <div><dt>Wingbox / Other</dt><dd>{{ summary.delWingboxOther || '—' }}</dd></div>
            <div><dt>Container</dt><dd>{{ summary.delContainer || '—' }}</dd></div>
          </dl>
        </div>
      </section>

      <table class="dja-table mt-5">
        <colgroup>
          <col style="width: 14%" /><col style="width: 8%" /><col style="width: 10%" />
          <col style="width: 5%" /><col style="width: 5%" /><col style="width: 5%" /><col style="width: 5%" /><col style="width: 5%" />
          <col style="width: 7%" /><col style="width: 7%" /><col style="width: 6%" /><col style="width: 6%" /><col style="width: 17%" />
        </colgroup>
        <thead>
          <tr>
            <th class="dja-head-main" rowspan="2">Man Power</th>
            <th class="dja-head-main" rowspan="2" colspan="2">Job Activity</th>
            <th class="dja-head-main" colspan="5">Truck Type</th>
            <th class="dja-head-main" colspan="2">Time Work</th>
            <th class="dja-head-main" colspan="2">Actual Progress</th>
            <th class="dja-head-main" rowspan="2">Confirmation</th>
          </tr>
          <tr>
            <th class="dja-head-main">CDD</th>
            <th class="dja-head-main">WB</th>
            <th class="dja-head-main">Fuso</th>
            <th class="dja-head-main">20ft</th>
            <th class="dja-head-main">40ft</th>
            <th class="dja-head-main">Start</th>
            <th class="dja-head-main">Finish</th>
            <th class="dja-head-main">Pending</th>
            <th class="dja-head-main">Finish</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="groups.length === 0">
            <td v-for="n in 13" :key="`empty-${n}`" class="dja-empty">&nbsp;</td>
          </tr>
          <template v-for="group in groups" :key="group.groupIndex">
            <tr v-if="group.groupIndex > 0">
              <td v-for="n in 13" :key="`spacer-${group.groupIndex}-${n}`" class="dja-spacer"></td>
            </tr>
            <tr v-if="group.tally">
              <td class="dja-name">{{ group.tally.employeeName }}</td>
              <td class="dja-mid">{{ group.tally.jobRole }}</td>
              <td class="dja-mid">{{ group.tally.activityType }}</td>
              <td class="dja-num">{{ qty(group.tally.qtyCdd) }}</td>
              <td class="dja-num">{{ qty(group.tally.qtyWb) }}</td>
              <td class="dja-num">{{ qty(group.tally.qtyFuso) }}</td>
              <td class="dja-num">{{ qty(group.tally.qty20ft) }}</td>
              <td class="dja-num">{{ qty(group.tally.qty40ft) }}</td>
              <td class="dja-mid">{{ group.tally.timeStart || '' }}</td>
              <td class="dja-mid">{{ group.tally.timeFinish || '' }}</td>
              <td class="dja-check">{{ group.tally.isPending ? '✓' : '' }}</td>
              <td class="dja-check">{{ group.tally.isFinish ? '✓' : '' }}</td>
              <td class="dja-text">{{ group.tally.confirmation || '' }}</td>
            </tr>
            <tr v-else>
              <td v-for="n in 13" :key="`tally-blank-${group.groupIndex}-${n}`" class="dja-empty">&nbsp;</td>
            </tr>
            <tr v-if="group.operator">
              <td class="dja-name">{{ group.operator.employeeName }}</td>
              <td class="dja-mid">{{ group.operator.jobRole }}</td>
              <td class="dja-mid">{{ group.operator.activityType }}</td>
              <td class="dja-num">{{ qty(group.operator.qtyCdd) }}</td>
              <td class="dja-num">{{ qty(group.operator.qtyWb) }}</td>
              <td class="dja-num">{{ qty(group.operator.qtyFuso) }}</td>
              <td class="dja-num">{{ qty(group.operator.qty20ft) }}</td>
              <td class="dja-num">{{ qty(group.operator.qty40ft) }}</td>
              <td class="dja-mid">{{ group.operator.timeStart || '' }}</td>
              <td class="dja-mid">{{ group.operator.timeFinish || '' }}</td>
              <td class="dja-check">{{ group.operator.isPending ? '✓' : '' }}</td>
              <td class="dja-check">{{ group.operator.isFinish ? '✓' : '' }}</td>
              <td class="dja-text">{{ group.operator.confirmation || '' }}</td>
            </tr>
            <tr v-else>
              <td v-for="n in 13" :key="`op-blank-${group.groupIndex}-${n}`" class="dja-empty">&nbsp;</td>
            </tr>
          </template>
        </tbody>
      </table>

      <table class="dja-table mt-6">
        <colgroup>
          <col style="width: 14%" /><col style="width: 8%" /><col style="width: 10%" />
          <col style="width: 5%" /><col style="width: 5%" /><col style="width: 5%" /><col style="width: 5%" /><col style="width: 5%" />
          <col style="width: 7%" /><col style="width: 7%" /><col style="width: 6%" /><col style="width: 6%" /><col style="width: 17%" />
        </colgroup>
        <thead>
          <tr>
            <th class="dja-head-pick" rowspan="2" colspan="3">Total Picking</th>
            <th class="dja-head-pick" rowspan="2" colspan="2">Total Member</th>
            <th class="dja-head-pick" rowspan="2" colspan="3">Time Work</th>
            <th class="dja-head-pick" colspan="4">Actual Progress</th>
            <th class="dja-head-pick" rowspan="2">Confirmation</th>
          </tr>
          <tr>
            <th class="dja-head-pick" colspan="2">Pending</th>
            <th class="dja-head-pick" colspan="2">Finish</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in picking" :key="row.id">
            <td class="dja-mid dja-mono" colspan="3">{{ row.total || '' }}</td>
            <td class="dja-mid dja-mono" colspan="2">{{ row.totalMember ?? '' }}</td>
            <td class="dja-mid dja-mono" colspan="3">{{ row.timeWork || '' }}</td>
            <td class="dja-check" colspan="2">{{ row.isPending ? '✓' : '' }}</td>
            <td class="dja-check" colspan="2">{{ row.isFinish ? '✓' : '' }}</td>
            <td class="dja-text">{{ row.confirmation || '' }}</td>
          </tr>
          <tr><td v-for="n in 13" :key="`pick-blank-${n}`" class="dja-empty">&nbsp;</td></tr>
        </tbody>
      </table>

      <table class="dja-table mt-6">
        <colgroup>
          <col style="width: 14%" /><col style="width: 8%" /><col style="width: 10%" />
          <col style="width: 5%" /><col style="width: 5%" /><col style="width: 5%" /><col style="width: 5%" /><col style="width: 5%" />
          <col style="width: 7%" /><col style="width: 7%" /><col style="width: 6%" /><col style="width: 6%" /><col style="width: 17%" />
        </colgroup>
        <thead>
          <tr>
            <th class="dja-head-stuff" rowspan="2" colspan="3">Total Stuffing</th>
            <th class="dja-head-stuff" rowspan="2" colspan="2">Total Member</th>
            <th class="dja-head-stuff" rowspan="2" colspan="3">Time Work</th>
            <th class="dja-head-stuff" colspan="4">Actual Progress</th>
            <th class="dja-head-stuff" rowspan="2">Confirmation</th>
          </tr>
          <tr>
            <th class="dja-head-stuff" colspan="2">Pending</th>
            <th class="dja-head-stuff" colspan="2">Finish</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in stuffing" :key="row.id">
            <td class="dja-mid dja-mono" colspan="3">{{ row.total || '' }}</td>
            <td class="dja-mid dja-mono" colspan="2">{{ row.totalMember ?? '' }}</td>
            <td class="dja-mid dja-mono" colspan="3">{{ row.timeWork || '' }}</td>
            <td class="dja-check" colspan="2">{{ row.isPending ? '✓' : '' }}</td>
            <td class="dja-check" colspan="2">{{ row.isFinish ? '✓' : '' }}</td>
            <td class="dja-text">{{ row.confirmation || '' }}</td>
          </tr>
          <tr><td v-for="n in 13" :key="`stuff-blank-${n}`" class="dja-empty">&nbsp;</td></tr>
        </tbody>
      </table>

      <p v-if="report?.notes" class="dja-notes">
        <span class="font-semibold">Catatan:</span> {{ report.notes }}
      </p>
    </div>
  </article>
</template>

<style scoped>
.dja-paper {
  background: #ffffff;
  color: #111111;
  border-radius: 2px;
  padding: 1.5rem 1.75rem 2rem;
  box-shadow:
    0 1px 2px rgba(16, 24, 40, 0.08),
    0 18px 40px -24px rgba(16, 24, 40, 0.45);
  font-size: 11px;
  line-height: 1.35;
}

@media (min-width: 768px) {
  .dja-paper {
    padding: 2rem 2.25rem 2.5rem;
    font-size: 12px;
  }
}

.dja-eyebrow {
  font-size: 9px;
  letter-spacing: 0.22em;
  text-transform: uppercase;
  color: #6b7280;
  font-weight: 600;
}

.dja-date {
  margin-top: 2px;
  font-size: 15px;
  font-weight: 800;
  letter-spacing: 0.02em;
  text-decoration: underline;
  text-underline-offset: 3px;
}

.dja-note {
  margin-top: 3px;
  font-size: 9.5px;
  font-style: italic;
  color: #6b7280;
}

.dja-note-danger {
  color: #b91c1c;
  font-style: normal;
  font-weight: 600;
}

.dja-block-title {
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  text-decoration: underline;
  text-underline-offset: 3px;
  margin-bottom: 4px;
}

.dja-summary > div {
  display: flex;
  align-items: baseline;
  gap: 4px;
  border-bottom: 1px dotted rgba(17, 17, 17, 0.15);
  padding: 1.5px 0;
}

.dja-summary dt {
  width: 118px;
  color: #4b5563;
}

.dja-summary dd {
  font-family: ui-monospace, "SF Mono", "Cascadia Mono", Consolas, monospace;
  font-variant-numeric: tabular-nums;
  font-weight: 700;
  font-size: 11px;
}

.dja-table {
  border-collapse: collapse;
  width: 100%;
  table-layout: fixed;
}

.dja-table th,
.dja-table td {
  border: 1px solid #111111;
  padding: 3px 4px;
  vertical-align: middle;
  word-wrap: break-word;
}

.dja-table th {
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-align: center;
  text-transform: uppercase;
}

.dja-head-main { background-color: #b4c6e7; }
.dja-head-pick { background-color: #ffff00; }
.dja-head-stuff { background-color: #33cc33; }

.dja-name {
  font-weight: 700;
  letter-spacing: 0.01em;
}

.dja-mid,
.dja-check {
  text-align: center;
}

.dja-mono {
  font-family: ui-monospace, "SF Mono", "Cascadia Mono", Consolas, monospace;
  font-variant-numeric: tabular-nums;
}

.dja-num {
  text-align: center;
  font-weight: 700;
  font-family: ui-monospace, "SF Mono", "Cascadia Mono", Consolas, monospace;
  font-variant-numeric: tabular-nums;
}

.dja-check {
  font-weight: 700;
  font-size: 12px;
  line-height: 1;
}

.dja-text { font-size: 10px; }

.dja-empty,
.dja-spacer { height: 15px; }

.dja-spacer {
  border-left: 1px solid #111111;
  border-right: 1px solid #111111;
}

.dja-notes {
  margin-top: 14px;
  padding-top: 8px;
  border-top: 1px dashed rgba(17, 17, 17, 0.2);
  font-size: 10px;
  color: #374151;
}
</style>
