<script setup lang="ts">
import { computed } from 'vue'
import { Line } from 'vue-chartjs'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
  Filler,
  type ChartData,
  type ChartOptions
} from 'chart.js'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend, Filler)

type HourlyItem = { hour: string; total: number }

const props = defineProps<{
  items: HourlyItem[]
}>()

const chartData = computed<ChartData<'line'>>(() => ({
  labels: props.items.map((item) => item.hour),
  datasets: [
    {
      label: 'Total',
      data: props.items.map((item) => item.total),
      borderColor: 'rgb(37, 99, 235)',
      backgroundColor: 'rgba(37, 99, 235, 0.15)',
      tension: 0.3,
      fill: true
    }
  ]
}))

const chartOptions = computed<ChartOptions<'line'>>(() => ({
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { display: false }
  },
  scales: {
    y: { beginAtZero: true }
  }
}))
</script>

<template>
  <div class="h-[320px]">
    <Line :data="chartData" :options="chartOptions" />
  </div>
</template>
