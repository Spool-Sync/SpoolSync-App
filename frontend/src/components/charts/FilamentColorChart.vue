<template>
  <Doughnut v-if="hasData" :data="chartData" :options="options" style="max-height: 240px" />
  <div v-else class="text-center text-medium-emphasis py-8">No data</div>
</template>

<script setup>
import { computed } from 'vue';
import { Doughnut } from 'vue-chartjs';
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';

ChartJS.register(ArcElement, Tooltip, Legend);

const props = defineProps({
  // Array of { label, value, hex }
  items: { type: Array, default: () => [] },
});

const hasData = computed(() => props.items.some(i => i.value > 0));

const chartData = computed(() => ({
  labels: props.items.map(i => i.label),
  datasets: [{
    data: props.items.map(i => Math.round(i.value)),
    backgroundColor: props.items.map(i => i.hex || '#9e9e9e'),
    borderColor: props.items.map(i => i.hex ? `${i.hex}cc` : '#9e9e9e99'),
    borderWidth: 1,
  }],
}));

const options = {
  responsive: true,
  cutout: '58%',
  plugins: {
    legend: { position: 'right', labels: { boxWidth: 14, padding: 10 } },
    tooltip: {
      callbacks: {
        label: (ctx) => ` ${Math.round(ctx.parsed)}g`,
      },
    },
  },
};
</script>
