<template>
  <div>
    <Line v-if="hasData" :data="chartData" :options="options" style="max-height: 120px" />
    <div v-else class="text-center text-medium-emphasis py-4 text-caption">No history yet</div>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { Line } from 'vue-chartjs';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
} from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Filler, Tooltip);

const props = defineProps({
  // Array of { date, total_g }
  trend: { type: Array, default: () => [] },
});

const hasData = computed(() => props.trend.length > 1);

const chartData = computed(() => ({
  labels: props.trend.map(p => {
    const d = new Date(p.date);
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  }),
  datasets: [{
    data: props.trend.map(p => p.total_g),
    borderColor: '#FF6B35',
    backgroundColor: 'rgba(255, 107, 53, 0.12)',
    fill: true,
    tension: 0.4,
    pointRadius: 0,
    pointHoverRadius: 4,
    borderWidth: 2,
  }],
}));

const options = {
  responsive: true,
  plugins: {
    legend: { display: false },
    tooltip: {
      callbacks: { label: (ctx) => ` ${ctx.parsed.y.toLocaleString()}g total filament` },
    },
  },
  scales: {
    x: { grid: { display: false }, ticks: { maxTicksLimit: 6, font: { size: 10 } } },
    y: { grid: { color: 'rgba(128,128,128,0.1)' }, ticks: { font: { size: 10 }, callback: v => `${(v/1000).toFixed(1)}kg` } },
  },
};
</script>
