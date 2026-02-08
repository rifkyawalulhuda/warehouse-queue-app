<script setup lang="ts">
type TopCustomerItem = {
  customerName: string
  avgDurationMinutes: number
  totalTransactions: number
}

const props = defineProps<{
  items: TopCustomerItem[]
}>()

const formatDuration = (minutes: number) => {
  if (!Number.isFinite(minutes) || minutes <= 0) return 'kurang dari 1 menit'
  const hours = Math.floor(minutes / 60)
  const remaining = minutes % 60
  if (hours > 0 && remaining > 0) return `${hours} jam ${remaining} menit`
  if (hours > 0 && remaining === 0) return `${hours} jam`
  return `${remaining} menit`
}
</script>

<template>
  <div class="overflow-x-auto">
    <table class="min-w-full text-sm">
      <thead class="text-muted-foreground">
        <tr>
          <th class="px-3 py-2 text-left font-medium">Customer Name</th>
          <th class="px-3 py-2 text-left font-medium">Avg Duration</th>
          <th class="px-3 py-2 text-left font-medium">Total</th>
        </tr>
      </thead>
      <tbody>
        <tr v-if="props.items.length === 0">
          <td colspan="3" class="px-3 py-4 text-center text-muted-foreground">Data kosong.</td>
        </tr>
        <tr v-for="item in props.items" :key="item.customerName" class="border-t">
          <td class="px-3 py-2">{{ item.customerName }}</td>
          <td class="px-3 py-2">{{ formatDuration(item.avgDurationMinutes) }}</td>
          <td class="px-3 py-2">{{ item.totalTransactions }}</td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
