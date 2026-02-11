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

type TruckCategoryItem = {
  key: string
  label: string
  storeInQty: number
  storeOutQty: number
  totalQty: number
}

const props = defineProps<{
  items: TruckCategoryItem[]
}>()

const chartData = computed<ChartData<'bar'>>(() => ({
  labels: props.items.map((item) => item.label),
  datasets: [
    {
      label: 'Store In',
      data: props.items.map((item) => item.storeInQty),
      backgroundColor: 'rgba(16, 185, 129, 0.78)'
    },
    {
      label: 'Store Out',
      data: props.items.map((item) => item.storeOutQty),
      backgroundColor: 'rgba(37, 99, 235, 0.78)'
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
    y: {
      stacked: true,
      beginAtZero: true,
      ticks: {
        precision: 0
      }
    }
  }
}))
</script>

<template>
  <div class="h-[300px]">
    <Bar :data="chartData" :options="chartOptions" />
  </div>
</template>
