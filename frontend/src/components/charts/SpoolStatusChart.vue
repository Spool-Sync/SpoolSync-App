<template>
  <Doughnut v-if="hasData" :data="chartData" :options="options" style="max-height: 220px" />
  <div v-else class="text-center text-medium-emphasis py-8">No data</div>
</template>

<script setup>
import { computed } from 'vue';
import { Doughnut } from 'vue-chartjs';
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';

ChartJS.register(ArcElement, Tooltip, Legend);

const props = defineProps({
  chartData: { type: Object, required: true },
});

const hasData = computed(() => props.chartData.datasets?.[0]?.data?.some(v => v > 0));

const options = {
  responsive: true,
  plugins: { legend: { position: 'bottom' } },
  cutout: '60%',
};
</script>
