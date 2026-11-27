<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import Button from '@/components/ui/Button.vue'
import { getSettings, updateSettings, type AppSetting } from '@/services/scheduleApi'

const loading = ref(false)
const saving = ref(false)
const error = ref<string | null>(null)
const successMessage = ref<string | null>(null)
const settings = ref<AppSetting[]>([])
const values = reactive<Record<string, string>>({})

const load = async () => {
  loading.value = true
  error.value = null
  try {
    const { data } = await getSettings()
    settings.value = data.data || []
    settings.value.forEach((item) => {
      values[item.key] = item.value
    })
  } catch (err: any) {
    error.value = err?.response?.data?.message || 'Gagal memuat pengaturan'
  } finally {
    loading.value = false
  }
}

const save = async () => {
  saving.value = true
  error.value = null
  successMessage.value = null
  try {
    const payload: Record<string, number> = {}
    for (const item of settings.value) {
      if (!item.editable) continue
      const raw = values[item.key]
      if (raw === undefined || raw === '') continue
      payload[item.key] = Number(raw)
    }
    await updateSettings(payload)
    successMessage.value = 'Pengaturan tersimpan. Perubahan langsung berlaku pada report.'
    await load()
  } catch (err: any) {
    const details = err?.response?.data?.details
    error.value = Array.isArray(details)
      ? details.join(', ')
      : err?.response?.data?.message || 'Gagal menyimpan pengaturan'
  } finally {
    saving.value = false
  }
}

onMounted(load)
</script>

<template>
  <div class="space-y-6">
    <div class="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 class="text-xl font-bold tracking-tight">Pengaturan Sistem</h1>
        <p class="text-sm text-muted-foreground">
          Parameter operasional Antrian Truk dan report Schedule vs Aktual.
        </p>
      </div>
      <Button size="sm" :disabled="saving || loading" @click="save">
        {{ saving ? 'Menyimpan...' : 'Simpan' }}
      </Button>
    </div>

    <p v-if="error" class="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
      {{ error }}
    </p>
    <p
      v-if="successMessage"
      class="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700"
    >
      {{ successMessage }}
    </p>

    <div class="rounded-lg border bg-card">
      <div v-if="loading" class="p-6 text-sm text-muted-foreground">Memuat pengaturan...</div>
      <table v-else class="min-w-full text-sm">
        <thead class="bg-muted/60 text-muted-foreground">
          <tr>
            <th class="px-4 py-2 text-left font-medium">Pengaturan</th>
            <th class="px-4 py-2 text-left font-medium">Nilai</th>
            <th class="px-4 py-2 text-left font-medium">Batas</th>
            <th class="px-4 py-2 text-left font-medium">Terakhir diubah</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="item in settings" :key="item.key" class="border-t">
            <td class="px-4 py-3">
              <p class="font-medium">{{ item.label }}</p>
              <p class="text-xs text-muted-foreground">{{ item.key }}</p>
            </td>
            <td class="px-4 py-3">
              <input
                v-if="item.editable"
                v-model="values[item.key]"
                type="number"
                class="w-32 rounded-md border bg-transparent px-2 py-1 text-sm"
              />
              <span v-else class="text-muted-foreground">{{ item.value }}</span>
            </td>
            <td class="px-4 py-3 text-muted-foreground">
              <span v-if="item.min !== null || item.max !== null">
                {{ item.min ?? '-' }} s/d {{ item.max ?? '-' }}
              </span>
              <span v-else>-</span>
            </td>
            <td class="px-4 py-3 text-xs text-muted-foreground">
              <span v-if="item.updatedBy">{{ item.updatedBy.name }}</span>
              <span v-else>-</span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <p class="text-xs text-muted-foreground">
      Toleransi on-time dipakai untuk menghitung keterlambatan pada report. Datang lebih awal tetap
      dihitung on-time; hanya keterlambatan melebihi toleransi yang dianggap telat.
    </p>
  </div>
</template>
