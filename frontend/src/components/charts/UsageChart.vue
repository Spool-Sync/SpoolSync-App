<template>
  <Bar v-if="chartData.labels?.length" :data="chartData" :options="options" style="max-height: 250px" />
  <div v-else class="text-center text-medium-emphasis py-8">No usage data yet</div>
</template>

<script setup>
import { Bar } from 'vue-chartjs';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend } from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

defineProps({
  chartData: { type: Object, required: true },
});

const options = {
  responsive: true,
  plugins: { legend: { display: false } },
  scales: { y: { beginAtZero: true } },
};
</script>
