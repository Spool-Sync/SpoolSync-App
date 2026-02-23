<template>
  <div>
    <h1 class="text-h5 font-weight-bold mb-4">Dashboard</h1>

    <!-- Stats Row -->
    <v-row class="mb-4">
      <v-col v-for="stat in stats" :key="stat.label" cols="12" sm="6" lg="3">
        <v-card rounded="xl" variant="tonal" :color="stat.color">
          <v-card-text class="d-flex align-center">
            <v-icon :icon="stat.icon" size="40" class="mr-4" />
            <div>
              <div class="text-h4 font-weight-bold">{{ stat.value }}</div>
              <div class="text-body-2 text-medium-emphasis">{{ stat.label }}</div>
            </div>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>

    <!-- Charts Row 1: Filament Usage (per type) + Status -->
    <v-row class="mb-4" align="stretch">
      <v-col cols="12" md="8" class="d-flex flex-column">
        <v-card rounded="xl" class="flex-grow-1">
          <v-card-title class="pa-4 pb-2">Filament Usage</v-card-title>
          <v-card-text>
            <FilamentUsageChart :series="usageTrendByType" />
          </v-card-text>
        </v-card>
      </v-col>
      <v-col cols="12" md="4" class="d-flex flex-column">
        <v-card rounded="xl" class="flex-grow-1">
          <v-card-title class="pa-4 pb-2">Spool Status</v-card-title>
          <v-card-text>
            <SpoolStatusChart :chart-data="statusChartData" />
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>

    <!-- Charts Row 2: Remaining by Filament Type -->
    <v-row class="mb-4">
      <v-col cols="12">
        <v-card rounded="xl">
          <v-card-title class="pa-4 pb-2">Remaining by Filament Type</v-card-title>
          <v-card-text>
            <FilamentTypeChart :items="typeBreakdown" />
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>

    <!-- Low Stock Alerts -->
    <v-card
      v-if="lowStockSpools.length"
      rounded="xl"
      color="warning"
      variant="tonal"
    >
      <v-card-title class="pa-4 pb-2">
        <v-icon icon="mdi-alert-outline" class="mr-2" />
        Low Stock Alerts ({{ lowStockSpools.length }})
      </v-card-title>
      <v-card-text>
        <v-list density="compact" bg-color="transparent">
          <v-list-item
            v-for="spool in lowStockSpools"
            :key="spool.spoolId"
            :title="`${spool.filamentType?.brand} ${spool.filamentType?.name}`"
            :subtitle="`${Math.round(Math.max(0, spool.currentWeight_g - (spool.filamentType?.spoolWeight_g ?? 200)))}g filament remaining`"
            :to="`/spools/${spool.spoolId}`"
            prepend-icon="mdi-reel"
          />
        </v-list>
      </v-card-text>
    </v-card>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from "vue";
import SpoolStatusChart from "@/components/charts/SpoolStatusChart.vue";
import FilamentTypeChart from "@/components/charts/FilamentTypeChart.vue";
import FilamentUsageChart from "@/components/charts/FilamentUsageChart.vue";
import { useSpoolStore } from "@/store/spools";
import { usePrinterStore } from "@/store/printers";
import apiClient from "@/services/apiClient";

const spoolStore = useSpoolStore();
const printerStore = usePrinterStore();
const usageTrendByType = ref([]);

onMounted(async () => {
  const [, trendRes] = await Promise.all([
    Promise.all([spoolStore.fetchSpools(), printerStore.fetchPrinters()]),
    apiClient.get('/spools/usage-trend-by-type'),
  ]);
  usageTrendByType.value = trendRes.data;
});

const stats = computed(() => [
  { label: "Total Spools", value: spoolStore.spools.length, icon: "mdi-movie-roll", color: "primary" },
  { label: "Active Printers", value: printerStore.printers.filter(p => p.status === "PRINTING").length, icon: "mdi-printer-3d", color: "success" },
  { label: "Low Stock", value: lowStockSpools.value.length, icon: "mdi-alert-outline", color: "warning" },
  { label: "Pending Orders", value: spoolStore.spools.filter(s => s.orderStatus === "ORDERED").length, icon: "mdi-cart-outline", color: "info" },
]);

const lowStockSpools = computed(() =>
  spoolStore.spools.filter(s => s.orderStatus === "REORDER_NEEDED"),
);

const statusChartData = computed(() => {
  const statuses = { IN_STOCK: 0, REORDER_NEEDED: 0, ORDERED: 0, DELIVERED: 0 };
  spoolStore.spools.forEach(s => { statuses[s.orderStatus] = (statuses[s.orderStatus] || 0) + 1; });
  return {
    labels: ["In Stock", "Reorder Needed", "Ordered", "Delivered"],
    datasets: [{ data: Object.values(statuses), backgroundColor: ["#2ECC71","#F39C12","#3498DB","#9B59B6"] }],
  };
});

// Breakdown by filament type — total remaining per brand+name+color combination
const typeBreakdown = computed(() => {
  const map = {};
  spoolStore.spools.forEach(s => {
    const ft = s.filamentType;
    if (!ft) return;
    const key = ft.filamentTypeId;
    const label = `${ft.brand} ${ft.name}${ft.color ? ` · ${ft.color}` : ''}`;
    const sw = ft.spoolWeight_g ?? 200;
    const remaining = Math.max(0, s.currentWeight_g - sw);
    if (!map[key]) map[key] = { label, value: 0, hex: ft.colorHex || null };
    map[key].value += remaining;
  });
  return Object.values(map).sort((a, b) => b.value - a.value);
});
</script>
