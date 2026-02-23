<template>
  <div>
    <div v-if="loading" class="d-flex justify-center pa-8">
      <v-progress-circular indeterminate />
    </div>

    <template v-else>
      <v-text-field
        v-model="search"
        label="Search inventory"
        prepend-inner-icon="mdi-magnify"
        variant="outlined"
        density="compact"
        clearable
        class="mb-4"
        style="max-width: 400px"
      />

      <v-row>
        <v-col
          v-for="group in filteredGroups"
          :key="group.filamentTypeId"
          cols="12" sm="6" md="4" lg="3"
        >
          <v-card
            rounded="xl"
            hover
            class="h-100"
            style="cursor: pointer"
            @click="goToSpools(group)"
          >
            <v-card-text class="d-flex align-center pa-4 ga-3">
              <!-- Color swatch -->
              <div
                class="rounded-circle flex-shrink-0"
                :style="{
                  width: '44px', height: '44px',
                  background: group.colorHex || '#9e9e9e',
                  border: '2px solid rgba(0,0,0,0.1)',
                }"
              />

              <div class="flex-grow-1" style="min-width: 0">
                <div class="text-body-1 font-weight-bold text-truncate">{{ group.brand }}</div>
                <div class="text-body-2 text-truncate">{{ group.name }}</div>
                <div class="d-flex align-center ga-1 mt-1">
                  <v-chip size="x-small" variant="tonal">{{ group.material }}</v-chip>
                  <v-chip v-if="group.color" size="x-small" variant="tonal" color="grey">{{ group.color }}</v-chip>
                </div>
              </div>

              <div class="text-right flex-shrink-0">
                <div class="text-h6 font-weight-bold">{{ formatGrams(group.totalRemaining_g) }}</div>
                <div class="text-caption text-medium-emphasis">{{ group.spoolCount }} spool{{ group.spoolCount !== 1 ? 's' : '' }}</div>
                <v-progress-linear
                  :model-value="group.pct"
                  :color="group.pct > 50 ? 'success' : group.pct > 20 ? 'warning' : 'error'"
                  height="4"
                  rounded
                  class="mt-1"
                  style="min-width: 60px"
                />
              </div>
            </v-card-text>
          </v-card>
        </v-col>
      </v-row>

      <div v-if="filteredGroups.length === 0" class="text-center text-medium-emphasis py-12">
        No filament found
      </div>
    </template>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useSpoolStore } from '@/store/spools';

const router = useRouter();
const spoolStore = useSpoolStore();
const loading = ref(true);
const search = ref('');

onMounted(async () => {
  await spoolStore.fetchSpools();
  loading.value = false;
});

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
        color: ft.color,
        colorHex: ft.colorHex,
        totalRemaining_g: 0,
        totalInitial_g: 0,
        spoolCount: 0,
      };
    }
    map[key].totalRemaining_g += remaining;
    map[key].totalInitial_g += initial;
    map[key].spoolCount += 1;
  }
  return Object.values(map)
    .map(g => ({ ...g, pct: g.totalInitial_g > 0 ? (g.totalRemaining_g / g.totalInitial_g) * 100 : 0 }))
    .sort((a, b) => b.totalRemaining_g - a.totalRemaining_g);
});

const filteredGroups = computed(() => {
  const q = search.value?.toLowerCase() ?? '';
  if (!q) return groups.value;
  return groups.value.filter(g =>
    g.brand.toLowerCase().includes(q) ||
    g.name.toLowerCase().includes(q) ||
    g.material.toLowerCase().includes(q) ||
    (g.color ?? '').toLowerCase().includes(q)
  );
});

function formatGrams(g) {
  if (g >= 1000) return `${(g / 1000).toFixed(2)}kg`;
  return `${Math.round(g)}g`;
}

function goToSpools(group) {
  router.push({
    name: 'Spools',
    query: {
      ...(group.material && { material: group.material }),
      ...(group.color && { color: group.color }),
      search: `${group.brand} ${group.name}`.trim(),
    },
  });
}
</script>
