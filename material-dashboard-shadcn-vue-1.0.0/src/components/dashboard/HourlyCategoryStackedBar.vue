<script setup lang="ts">
import { computed } from 'vue'
import { Bar } from 'vue-chartjs'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Tooltip,
  Legend,
  type ChartData,
  type ChartOptions
} from 'chart.js'

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend)

type HourlyItem = { hour: string; receiving: number; delivery: number }

const props = defineProps<{
  items: HourlyItem[]
}>()

const chartData = computed<ChartData<'bar'>>(() => ({
  labels: props.items.map((item) => item.hour),
  datasets: [
    {
      label: 'Receiving',
      data: props.items.map((item) => item.receiving),
      backgroundColor: 'rgba(16, 185, 129, 0.7)'
    },
    {
      label: 'Delivery',
      data: props.items.map((item) => item.delivery),
      backgroundColor: 'rgba(139, 92, 246, 0.7)'
    }
  ]
}))

const chartOptions = computed<ChartOptions<'bar'>>(() => ({
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { position: 'top' }
  },
  scales: {
    x: { stacked: true },
    y: { stacked: true, beginAtZero: true }
  }
}))
</script>

<template>
  <div class="h-[320px]">
    <Bar :data="chartData" :options="chartOptions" />
  </div>
</template>
