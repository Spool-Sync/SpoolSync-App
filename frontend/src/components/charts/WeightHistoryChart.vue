<template>
  <Line v-if="hasData" :data="chartData" :options="options" style="max-height: 280px" />
  <div v-else class="text-center text-medium-emphasis py-8">No weight history yet</div>
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
  Title,
  Tooltip,
  Filler,
} from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Filler);

const props = defineProps({
  history: { type: Array, default: () => [] },
  spoolWeight_g: { type: Number, default: 200 },
});

const hasData = computed(() => props.history.length > 0);

const chartData = computed(() => {
  const points = props.history.map((h) => ({
    x: new Date(h.recordedAt).toLocaleDateString(),
    y: Math.max(0, h.weight_g - props.spoolWeight_g),
    source: h.source,
  }));

  return {
    labels: points.map((p) => p.x),
    datasets: [
      {
        label: 'Filament (g)',
        data: points.map((p) => p.y),
        borderColor: '#FF6B35',
        backgroundColor: 'rgba(255, 107, 53, 0.08)',
        fill: true,
        tension: 0.3,
        pointRadius: points.length > 50 ? 2 : 4,
        pointHoverRadius: 6,
      },
    ],
  };
});

const options = {
  responsive: true,
  plugins: {
    legend: { display: false },
    tooltip: {
      callbacks: {
        label: (ctx) => `${Math.round(ctx.parsed.y)}g filament`,
      },
    },
  },
  scales: {
    y: {
      beginAtZero: true,
      title: { display: true, text: 'Filament (g)' },
    },
    x: {
      ticks: { maxTicksLimit: 10, maxRotation: 0 },
    },
  },
};
</script>
