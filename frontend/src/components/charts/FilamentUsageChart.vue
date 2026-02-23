<template>
  <div>
    <Line v-if="hasData" :data="chartData" :options="options" style="max-height: 280px" />
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
  Tooltip,
  Legend,
} from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend);

const props = defineProps({
  // Array of { filamentTypeId, label, colorHex, data: [{ date, total_g }] }
  series: { type: Array, default: () => [] },
});

const hasData = computed(() => props.series.some(s => s.data.length > 0));

// Union of all dates across all series, sorted ascending
const allDates = computed(() => {
  const set = new Set();
  props.series.forEach(s => s.data.forEach(d => set.add(d.date)));
  return [...set].sort();
});

const labels = computed(() =>
  allDates.value.map(d =>
    new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
  )
);

const chartData = computed(() => ({
  labels: labels.value,
  datasets: props.series.map(s => {
    const byDate = Object.fromEntries(s.data.map(d => [d.date, d.total_g]));
    const color = s.colorHex || '#9e9e9e';
    return {
      label: s.label,
      data: allDates.value.map(d => byDate[d] ?? null),
      borderColor: color,
      backgroundColor: color + '20',
      fill: false,
      tension: 0.3,
      pointRadius: 0,
      pointHoverRadius: 4,
      borderWidth: 2,
      spanGaps: true,
    };
  }),
}));

const options = {
  responsive: true,
  plugins: {
    legend: {
      display: true,
      position: 'bottom',
      labels: { boxWidth: 12, font: { size: 10 }, padding: 10 },
    },
    tooltip: {
      callbacks: {
        label: ctx =>
          ctx.parsed.y != null
            ? ` ${ctx.dataset.label}: ${ctx.parsed.y.toLocaleString()}g`
            : ` ${ctx.dataset.label}: no data`,
      },
    },
  },
  scales: {
    x: { grid: { display: false }, ticks: { maxTicksLimit: 6, font: { size: 10 } } },
    y: {
      grid: { color: 'rgba(128,128,128,0.1)' },
      ticks: { font: { size: 10 }, callback: v => `${(v / 1000).toFixed(1)}kg` },
    },
  },
};
</script>
