<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import Button from '@/components/ui/Button.vue'
import Combobox from '@/components/ui/Combobox.vue'
import { X, Clock, Truck, User, ListChecks } from 'lucide-vue-next'
import type { Employee } from '@/services/employeeApi'
import type { JobActivityType, JobTransaction, JobTruckType } from '@/services/jobTransactionApi'
import {
  ACTIVITY_OPTIONS,
  TRUCK_OPTIONS,
  formatWallClock,
  isManpower,
  positionFor,
  roleFor,
  toDateTimeInput
} from '@/components/jobTransaction/meta'

const props = defineProps<{
  open: boolean
  mode: 'create' | 'edit'
  initial?: JobTransaction | null
  employees: Employee[]
  submitting?: boolean
  error?: string | null
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (
    e: 'submit',
    payload: {
      activityType: JobActivityType
      employeeId?: string | null
      truckType?: JobTruckType | null
      truckTypeOther?: string | null
      qty?: number | null
      totalDo?: number | null
      totalMember?: number | null
      startAt?: string | null
      finishAt?: string | null
      confirmation?: string | null
    },
    startNow: boolean
  ): void
}>()

const form = ref({
  activityType: 'RECEIVING' as JobActivityType,
  employeeId: '',
  truckType: 'CDD' as JobTruckType,
  truckTypeOther: '',
  qty: '1',
  totalDo: '',
  totalMember: '',
  startAt: '',
  confirmation: ''
})
const localError = ref<string | null>(null)

const reset = () => {
  const row = props.initial
  form.value = {
    activityType: (row?.activityType as JobActivityType) || 'RECEIVING',
    employeeId: row?.employeeId || '',
    truckType: (row?.truckType as JobTruckType) || 'CDD',
    truckTypeOther: row?.truckTypeOther || '',
    qty: String(row?.qty ?? 1),
    totalDo: row?.totalDo !== null && row?.totalDo !== undefined ? String(row.totalDo) : '',
    totalMember:
      row?.totalMember !== null && row?.totalMember !== undefined ? String(row.totalMember) : '',
    startAt: toDateTimeInput(row?.startAt),
    confirmation: row?.confirmation || ''
  }
  localError.value = null
}

watch(
  () => props.open,
  (open) => {
    if (open) reset()
  },
  { immediate: true }
)

watch(
  () => form.value.activityType,
  (type) => {
    if (!isManpower(type)) {
      form.value.employeeId = ''
      return
    }
    if (!props.employees.length) return
    const position = positionFor(type)
    const current = props.employees.find((employee) => employee.id === form.value.employeeId)
    if (current && current.position === position) return
    form.value.employeeId = ''
  }
)

const manpower = computed(() => isManpower(form.value.activityType))

const eligibleEmployees = computed(() => {
  if (!manpower.value) return []
  const position = positionFor(form.value.activityType)
  return props.employees
    .filter((employee) => employee.position === position)
    .sort((a, b) => a.name.localeCompare(b.name, 'id'))
})

const employeeOptions = computed(() =>
  eligibleEmployees.value.map((employee) => ({ value: employee.id, label: employee.name }))
)

const roleLabel = computed(() => (manpower.value ? roleFor(form.value.activityType) : null))

const employeeSearchPlaceholder = computed(() =>
  roleLabel.value === 'TALLY' ? 'Cari tallyman...' : 'Cari operator...'
)

const groupedActivities = computed(() => {
  const groups = new Map<string, typeof ACTIVITY_OPTIONS>()
  ACTIVITY_OPTIONS.forEach((option) => {
    if (!groups.has(option.group)) groups.set(option.group, [])
    groups.get(option.group)!.push(option)
  })
  return [...groups.entries()]
})

const onEmployeeSelect = (employeeId: string) => {
  form.value.employeeId = employeeId
}

/**
 * `v-model` pada <input type="number"> mengembalikan Number, bukan string.
 * Jangan panggil .trim() langsung pada nilai form — pakai helper ini.
 */
const hasValue = (value: unknown) =>
  value !== null && value !== undefined && String(value).trim() !== ''

/** Kirim apa adanya: kosong -> null, 0 tetap 0 (jangan diam-diam jadi null). */
const toNumberOrNull = (value: unknown) => {
  if (!hasValue(value)) return null
  const num = Number(value)
  return Number.isFinite(num) ? num : null
}

const validate = (requireStart: boolean) => {
  if (manpower.value) {
    if (!form.value.employeeId) return 'Pilih karyawan dari daftar Master Karyawan'
    if (!form.value.truckType) return 'Tipe truk wajib dipilih'
    if (form.value.truckType === 'OTHER' && !hasValue(form.value.truckTypeOther)) {
      return 'Keterangan tipe truk wajib diisi untuk Lainnya'
    }
    const qty = Number(form.value.qty)
    if (!Number.isFinite(qty) || qty < 1) return 'Qty minimal 1'
  } else {
    if (!hasValue(form.value.totalDo) && !hasValue(form.value.totalMember)) {
      return 'Isi Total DO atau Total Member'
    }
    const totalDo = Number(form.value.totalDo || 0)
    const totalMember = Number(form.value.totalMember || 0)
    if (!Number.isFinite(totalDo) || totalDo < 0) return 'Total DO tidak valid'
    if (!Number.isFinite(totalMember) || totalMember < 0) return 'Total Member tidak valid'
  }
  if (requireStart && !form.value.startAt) return 'Waktu mulai wajib diisi untuk Confirm'
  return null
}

const buildPayload = () => ({
  activityType: form.value.activityType,
  employeeId: manpower.value ? form.value.employeeId : null,
  truckType: manpower.value ? form.value.truckType : null,
  truckTypeOther:
    manpower.value && form.value.truckType === 'OTHER'
      ? String(form.value.truckTypeOther).trim()
      : null,
  qty: manpower.value ? Number(form.value.qty) || 1 : null,
  totalDo: manpower.value ? null : toNumberOrNull(form.value.totalDo),
  totalMember: manpower.value ? null : toNumberOrNull(form.value.totalMember),
  startAt: form.value.startAt || null,
  confirmation: hasValue(form.value.confirmation)
    ? String(form.value.confirmation).trim()
    : null
})

const submit = (startNow: boolean) => {
  let message: string | null = null
  try {
    message = validate(startNow)
  } catch (err: any) {
    localError.value = err?.message || 'Form tidak dapat diproses. Periksa kembali isian.'
    return
  }
  if (message) {
    localError.value = message
    return
  }
  localError.value = null
  emit('submit', buildPayload(), startNow)
}
</script>

<template>
  <div v-if="open" class="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-labelledby="jt-form-title">
    <div class="absolute inset-0 bg-black/55 backdrop-blur-sm" @click="submitting ? null : emit('close')"></div>
    <div class="absolute left-1/2 top-1/2 flex max-h-[92vh] w-[calc(100%-1.5rem)] max-w-xl -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-3xl border border-border/70 bg-card shadow-2xl">
      <div class="flex items-start justify-between gap-2 border-b border-border/60 px-5 pb-3 pt-4">
        <div>
          <h3 id="jt-form-title" class="text-base font-semibold">
            {{ mode === 'create' ? 'Transaksi Pekerjaan Baru' : 'Ubah Transaksi' }}
          </h3>
          <p class="text-xs text-muted-foreground">
            {{ manpower ? 'Catat manpower, tipe truk, dan jam kerja.' : 'Catat sesi picking atau stuffing.' }}
          </p>
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

      <div class="flex-1 space-y-4 overflow-y-auto px-5 py-4">
        <div>
          <span class="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            Jenis pekerjaan
          </span>
          <div class="mt-1.5 space-y-2">
            <div v-for="[group, options] in groupedActivities" :key="group">
              <p class="mb-1 text-[10px] text-muted-foreground">{{ group }}</p>
              <div class="flex flex-wrap gap-1.5">
                <button
                  v-for="option in options"
                  :key="option.value"
                  type="button"
                  class="rounded-full border px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-50"
                  :class="form.activityType === option.value
                    ? 'border-primary/40 bg-primary/10 text-primary'
                    : 'border-border/70 bg-background/60 text-muted-foreground hover:border-border hover:text-foreground'"
                  :disabled="submitting || mode === 'edit'"
                  :aria-pressed="form.activityType === option.value"
                  @click="form.activityType = option.value"
                >
                  {{ option.label }}
                </button>
              </div>
            </div>
          </div>
        </div>

        <template v-if="manpower">
          <div>
            <span class="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              <User class="h-3 w-3" aria-hidden="true" />
              Karyawan · {{ roleLabel }}
            </span>
            <div class="mt-1">
              <Combobox
                :model-value="form.employeeId"
                :options="employeeOptions"
                :disabled="submitting"
                placeholder="Pilih karyawan..."
                :search-placeholder="employeeSearchPlaceholder"
                empty-text="Tidak ada karyawan"
                @update:model-value="onEmployeeSelect"
              />
            </div>
          </div>

          <div class="grid gap-3 sm:grid-cols-2">
            <label class="block">
              <span class="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                <Truck class="h-3 w-3" aria-hidden="true" />
                Tipe truk
              </span>
              <select v-model="form.truckType" :disabled="submitting" class="jt-field mt-1">
                <option v-for="option in TRUCK_OPTIONS" :key="option.value" :value="option.value">
                  {{ option.label }}
                </option>
              </select>
            </label>
            <label class="block">
              <span class="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Qty truk</span>
              <input
                v-model="form.qty"
                type="number"
                min="1"
                inputmode="numeric"
                :disabled="submitting"
                class="jt-field mt-1 text-center tabular-nums"
              />
            </label>
          </div>

          <label v-if="form.truckType === 'OTHER'" class="block">
            <span class="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              Keterangan tipe truk
            </span>
            <input
              v-model="form.truckTypeOther"
              :disabled="submitting"
              class="jt-field mt-1"
              placeholder="Contoh: Trailer"
            />
          </label>
        </template>

        <div v-else class="grid gap-3 sm:grid-cols-2">
          <label class="block">
            <span class="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              <ListChecks class="h-3 w-3" aria-hidden="true" />
              Total DO
            </span>
            <input
              v-model="form.totalDo"
              type="number"
              min="0"
              inputmode="numeric"
              :disabled="submitting"
              class="jt-field mt-1 text-center tabular-nums"
              placeholder="64"
            />
          </label>
          <label class="block">
            <span class="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Total member</span>
            <input
              v-model="form.totalMember"
              type="number"
              min="0"
              inputmode="numeric"
              :disabled="submitting"
              class="jt-field mt-1 text-center tabular-nums"
              placeholder="8"
            />
          </label>
        </div>

        <label class="block">
          <span class="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            <Clock class="h-3 w-3" aria-hidden="true" />
            Waktu mulai
          </span>
          <input
            v-model="form.startAt"
            type="datetime-local"
            :disabled="submitting"
            class="jt-field mt-1 tabular-nums"
          />
          <span class="mt-1 block text-[11px] text-muted-foreground">
            Wajib untuk Confirm. Kosongkan bila ingin disimpan sebagai draft.
          </span>
        </label>

        <label class="block">
          <span class="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            Confirmation
          </span>
          <input
            v-model="form.confirmation"
            :disabled="submitting"
            class="jt-field mt-1"
            placeholder="Catatan (opsional)"
          />
        </label>

        <p v-if="localError || error" class="text-xs text-red-600" role="alert">{{ localError || error }}</p>

        <p v-if="initial?.startAt" class="rounded-xl border border-border/60 bg-muted/40 px-3 py-2 text-[11px] text-muted-foreground">
          Mulai tercatat {{ formatWallClock(initial.startAt) }}. Mengubah waktu pada transaksi berjalan akan
          memengaruhi laporan tanggal tersebut.
        </p>
      </div>

      <div class="flex flex-wrap items-center justify-end gap-2 border-t border-border/60 bg-muted/20 px-5 py-3">
        <Button variant="ghost" :disabled="submitting" @click="emit('close')">Batal</Button>
        <Button variant="outline" :disabled="submitting" @click="submit(false)">
          Simpan Draft
        </Button>
        <Button :disabled="submitting" @click="submit(true)">
          {{ submitting ? 'Menyimpan…' : 'Confirm' }}
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

.jt-field::placeholder {
  color: hsl(var(--muted-foreground));
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
