<script setup lang="ts">
import { computed } from 'vue'
import { Doughnut } from 'vue-chartjs'
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
  type ChartData,
  type ChartOptions
} from 'chart.js'

ChartJS.register(ArcElement, Tooltip, Legend)

type StatusItem = { name: string; value: number }

const props = defineProps<{
  items: StatusItem[]
}>()

const colors = ['#f59e0b', '#60a5fa', '#3b82f6', '#22c55e', '#94a3b8']

const chartData = computed<ChartData<'doughnut'>>(() => ({
  labels: props.items.map((item) => item.name),
  datasets: [
    {
      data: props.items.map((item) => item.value),
      backgroundColor: colors
    }
  ]
}))

const chartOptions = computed<ChartOptions<'doughnut'>>(() => ({
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { position: 'bottom' }
  }
}))
</script>

<template>
  <div class="h-[300px]">
    <Doughnut :data="chartData" :options="chartOptions" />
  </div>
</template>
