<template>
  <Bar v-if="hasData" :data="chartData" :options="options" :style="`max-height: ${maxHeight}px`" />
  <div v-else class="text-center text-medium-emphasis py-8">No data</div>
</template>

<script setup>
import { computed } from 'vue';
import { Bar } from 'vue-chartjs';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Tooltip,
} from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip);

const props = defineProps({
  // Array of { label, value, hex }
  items: { type: Array, default: () => [] },
});

const hasData = computed(() => props.items.some(i => i.value > 0));

// Scale height with number of items so bars stay readable
const maxHeight = computed(() => Math.max(160, Math.min(props.items.length * 36, 480)));

const chartData = computed(() => ({
  labels: props.items.map(i => i.label),
  datasets: [{
    label: 'Remaining (g)',
    data: props.items.map(i => Math.round(i.value)),
    backgroundColor: props.items.map(i => i.hex ? `${i.hex}cc` : 'rgba(255,107,53,0.7)'),
    borderColor: props.items.map(i => i.hex || '#FF6B35'),
    borderWidth: 1,
    borderRadius: 4,
  }],
}));

const options = {
  indexAxis: 'y',
  responsive: true,
  plugins: {
    legend: { display: false },
    tooltip: {
      callbacks: { label: (ctx) => ` ${Math.round(ctx.parsed.x)}g remaining` },
    },
  },
  scales: {
    x: { beginAtZero: true, title: { display: true, text: 'Filament (g)' } },
    y: { ticks: { font: { size: 11 } } },
  },
};
</script>
