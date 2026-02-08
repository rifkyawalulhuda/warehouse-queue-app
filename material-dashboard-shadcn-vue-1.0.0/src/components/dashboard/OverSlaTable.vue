<script setup lang="ts">
type OverSlaItem = {
  id: string
  customerName: string
  truckNumber: string
  status: string
  overMinutes: number
}

const props = defineProps<{
  items: OverSlaItem[]
}>()

const emit = defineEmits<{
  (e: 'select', id: string): void
}>()

const formatOver = (minutes: number) => {
  if (!Number.isFinite(minutes) || minutes <= 0) return '+0 menit'
  return `+${minutes} menit`
}
</script>

<template>
  <div class="overflow-x-auto">
    <table class="min-w-full text-sm">
      <thead class="text-muted-foreground">
        <tr>
          <th class="px-3 py-2 text-left font-medium">Customer</th>
          <th class="px-3 py-2 text-left font-medium">Truck</th>
          <th class="px-3 py-2 text-left font-medium">Status</th>
          <th class="px-3 py-2 text-left font-medium">Over SLA</th>
        </tr>
      </thead>
      <tbody>
        <tr v-if="props.items.length === 0">
          <td colspan="4" class="px-3 py-4 text-center text-muted-foreground">Data kosong.</td>
        </tr>
        <tr
          v-for="item in props.items"
          :key="item.id"
          class="border-t cursor-pointer hover:bg-accent/40"
          @click="emit('select', item.id)"
        >
          <td class="px-3 py-2">{{ item.customerName }}</td>
          <td class="px-3 py-2">{{ item.truckNumber }}</td>
          <td class="px-3 py-2">{{ item.status }}</td>
          <td class="px-3 py-2 font-semibold text-red-600">{{ formatOver(item.overMinutes) }}</td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
