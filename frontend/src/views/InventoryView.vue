<template>
  <div>
    <div class="d-flex align-center mb-4">
      <h1 class="text-h5 font-weight-bold">Inventory</h1>
    </div>

    <!-- Search + Material filter -->
    <v-row dense class="mb-3">
      <v-col cols="12" sm="4">
        <v-text-field
          v-model="search"
          density="compact"
          variant="outlined"
          hide-details
          label="Search filament…"
          prepend-inner-icon="mdi-magnify"
          clearable
        />
      </v-col>
      <v-col cols="12" sm="8" class="d-flex align-center flex-wrap ga-1">
        <v-chip
          v-for="mat in availableMaterials"
          :key="mat"
          :color="materialFilter === mat ? 'primary' : undefined"
          :variant="materialFilter === mat ? 'tonal' : 'outlined'"
          size="small"
          clickable
          @click="materialFilter = materialFilter === mat ? null : mat"
        >
          {{ mat }}
        </v-chip>
      </v-col>
    </v-row>

    <v-data-table
      :headers="headers"
      :items="filteredGroups"
      :loading="spoolStore.loading"
      item-value="filamentTypeId"
      rounded="xl"
      hover
    >
      <template #item.filament="{ item }">
        <div class="d-flex align-center">
          <v-tooltip :text="item.color || 'No color'" location="top">
            <template #activator="{ props: tip }">
              <v-avatar
                v-bind="tip"
                size="20"
                :style="{ backgroundColor: item.colorHex || '#aaa' }"
                class="mr-2 flex-shrink-0"
              />
            </template>
          </v-tooltip>
          <span class="text-body-2">{{ item.brand }} {{ item.name }}</span>
        </div>
      </template>

      <template #item.material="{ item }">
        <v-chip size="x-small" variant="tonal">{{ item.material }}</v-chip>
      </template>

      <template #item.spoolCount="{ item }">
        <v-chip size="small" variant="tonal">{{ item.spoolCount }}</v-chip>
      </template>

      <template #item.remaining="{ item }">
        <div>
          <span class="font-weight-medium">{{ formatGrams(item.totalRemaining_g) }}</span>
          <v-progress-linear
            :model-value="item.pct"
            :color="item.pct > 50 ? 'success' : item.pct > 20 ? 'warning' : 'error'"
            height="4"
            rounded
            class="mt-1"
            style="max-width: 100px"
          />
        </div>
      </template>
    </v-data-table>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { useSpoolStore } from '@/store/spools';

const spoolStore = useSpoolStore();

const search = ref('');
const materialFilter = ref(null);

const headers = [
  { title: 'Filament', key: 'filament', sortable: false },
  { title: 'Material', key: 'material', sortable: true },
  { title: 'Color', key: 'color', sortable: true },
  { title: 'Spools', key: 'spoolCount', sortable: true },
  { title: 'Remaining', key: 'remaining', sortable: true, sort: (a, b) => a.totalRemaining_g - b.totalRemaining_g },
];

onMounted(() => spoolStore.fetchSpools());

const groups = computed(() => {
  const map = {};
  for (const spool of spoolStore.spools) {
    const ft = spool.filamentType;
    if (!ft) continue;
    const key = ft.filamentTypeId;
    const sw = ft.spoolWeight_g ?? 200;
    const remaining = Math.max(0, spool.currentWeight_g - sw);
    const initial = Math.max(0, spool.initialWeight_g - sw);
    if (!map[key]) {
      map[key] = {
        filamentTypeId: key,
        brand: ft.brand,
        name: ft.name,
        material: ft.material,
        color: ft.color ?? '',
        colorHex: ft.colorHex ?? null,
        spoolWeight_g: sw,
        totalRemaining_g: 0,
        totalInitial_g: 0,
        spoolCount: 0,
      };
    }
    map[key].totalRemaining_g += remaining;
    map[key].totalInitial_g += initial;
    map[key].spoolCount += 1;
  }
  return Object.values(map).map((g) => ({
    ...g,
    pct: g.totalInitial_g > 0 ? (g.totalRemaining_g / g.totalInitial_g) * 100 : 0,
  }));
});

const availableMaterials = computed(() => [...new Set(groups.value.map((g) => g.material))].sort());

const filteredGroups = computed(() => {
  const q = search.value?.toLowerCase() ?? '';
  return groups.value.filter((g) => {
    const matchesMaterial = !materialFilter.value || g.material === materialFilter.value;
    const matchesSearch =
      !q ||
      g.brand.toLowerCase().includes(q) ||
      g.name.toLowerCase().includes(q) ||
      g.material.toLowerCase().includes(q) ||
      g.color.toLowerCase().includes(q);
    return matchesMaterial && matchesSearch;
  });
});

function formatGrams(g) {
  if (g >= 1000) return `${(g / 1000).toFixed(2)}kg`;
  return `${Math.round(g)}g`;
}
</script>
