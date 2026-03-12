<template>
  <div>
    <div class="d-flex align-center mb-4">
      <v-btn icon="mdi-arrow-left" variant="text" @click="$router.back()" />
      <div class="ml-2 flex-grow-1">
        <h1 class="text-h5 font-weight-bold">{{ location?.name || 'Storage Location' }}</h1>
        <div v-if="location" class="d-flex align-center ga-2 mt-1">
          <v-chip :color="typeInfo.color" :prepend-icon="typeInfo.icon" size="small" variant="tonal">
            {{ typeInfo.label }}
          </v-chip>
          <span v-if="location.description" class="text-caption text-medium-emphasis">
            {{ location.description }}
          </span>
        </div>
      </div>
      <v-btn
        color="primary"
        variant="tonal"
        prepend-icon="mdi-plus"
        @click="openZoneDialog()"
      >
        Add Section
      </v-btn>
    </div>

    <div v-if="loading" class="d-flex justify-center pa-8">
      <v-progress-circular indeterminate />
    </div>

    <template v-else-if="location">
      <!-- Search & filter bar -->
      <v-card rounded="xl" class="mb-4 pa-3">
        <div class="d-flex flex-wrap align-center ga-2">
          <v-text-field
            v-model="search"
            prepend-inner-icon="mdi-magnify"
            placeholder="Search by NFC tag, brand, color, material…"
            variant="outlined"
            density="compact"
            hide-details
            clearable
            style="min-width: 260px; flex: 1"
          />
          <v-select
            v-model="filterMaterial"
            :items="materialOptions"
            label="Material"
            variant="outlined"
            density="compact"
            hide-details
            clearable
            style="min-width: 140px; max-width: 180px"
          />
          <v-select
            v-model="filterBrand"
            :items="brandOptions"
            label="Brand"
            variant="outlined"
            density="compact"
            hide-details
            clearable
            style="min-width: 140px; max-width: 200px"
          />
          <v-chip
            v-if="activeFilterCount > 0"
            closable
            color="primary"
            variant="tonal"
            size="small"
            @click:close="clearFilters"
          >
            {{ activeFilterCount }} filter{{ activeFilterCount > 1 ? 's' : '' }} active
          </v-chip>
        </div>
      </v-card>

      <!-- Zones -->
      <v-card
        v-for="zone in location.zones"
        :key="zone.zoneId"
        rounded="xl"
        class="mb-4"
      >
        <v-card-title class="pa-4 pb-2 d-flex align-center">
          <v-icon icon="mdi-label-outline" class="mr-2" />
          <span class="text-subtitle-1 font-weight-bold flex-grow-1">{{ zone.name }}</span>
          <span class="text-caption text-medium-emphasis mr-4">
            {{ filteredZoneSpools(zone).length }}<template v-if="isFiltered"> / {{ zoneSpools(zone).length }}</template> spool(s)
          </span>
          <v-btn size="x-small" variant="tonal" icon="mdi-pencil" class="mr-1" @click="openZoneDialog(zone)" />
          <v-btn size="x-small" variant="tonal" icon="mdi-delete" color="error" @click="handleDeleteZone(zone.zoneId)" />
        </v-card-title>
        <v-card-text v-if="zone.description" class="pt-0 text-caption text-medium-emphasis">
          {{ zone.description }}
        </v-card-text>
        <v-divider />
        <v-card-text>
          <SpoolTable
            v-if="filteredZoneSpools(zone).length"
            :spools="filteredZoneSpools(zone)"
            :loading="false"
          />
          <div v-else class="text-center text-medium-emphasis text-caption py-4">
            {{ isFiltered ? 'No spools match the current filters' : 'No spools in this section' }}
          </div>
        </v-card-text>
      </v-card>

      <!-- Spools not assigned to any zone -->
      <v-card rounded="xl">
        <v-card-title class="pa-4 pb-2 text-subtitle-1 font-weight-bold">
          <v-icon icon="mdi-package-variant" class="mr-2" />
          {{ location.zones?.length ? 'Unsectioned Spools' : 'Stored Spools' }}
          <span class="text-caption text-medium-emphasis ml-2">
            ({{ filteredUnzonedSpools.length }}<template v-if="isFiltered"> / {{ unzonedSpools.length }}</template>)
          </span>
        </v-card-title>
        <v-divider />
        <v-card-text>
          <SpoolTable v-if="filteredUnzonedSpools.length" :spools="filteredUnzonedSpools" :loading="false" />
          <div v-else class="text-center text-medium-emphasis text-caption py-4">
            {{ isFiltered ? 'No spools match the current filters' : 'No spools stored here' }}
          </div>
        </v-card-text>
      </v-card>
    </template>

    <!-- Add / Edit Zone dialog -->
    <v-dialog v-model="zoneDialog" max-width="420">
      <v-card rounded="xl">
        <v-card-title class="pa-4">{{ editingZone ? 'Edit Section' : 'Add Section' }}</v-card-title>
        <v-card-text>
          <v-text-field
            v-model="zoneForm.name"
            label="Section Name"
            variant="outlined"
            density="compact"
            class="mb-2"
          />
          <v-textarea
            v-model="zoneForm.description"
            label="Description (optional)"
            variant="outlined"
            density="compact"
            rows="2"
          />
        </v-card-text>
        <v-card-actions class="pa-4 pt-0">
          <v-spacer />
          <v-btn @click="zoneDialog = false">Cancel</v-btn>
          <v-btn color="primary" :loading="savingZone" :disabled="!zoneForm.name" @click="saveZone">Save</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import SpoolTable from '@/components/tables/SpoolTable.vue';
import { useStorageLocationStore } from '@/store/storageLocations';
import { storageTypeInfo } from '@/utils/storageTypes';
import apiClient from '@/services/apiClient';

const route = useRoute();
const locationStore = useStorageLocationStore();

const location = ref(null);
const loading = ref(true);

// Search / filter state
const search = ref('');
const filterMaterial = ref(null);
const filterBrand = ref(null);

const zoneDialog = ref(false);
const editingZone = ref(null);
const zoneForm = ref({ name: '', description: '' });
const savingZone = ref(false);

onMounted(async () => {
  const { data } = await apiClient.get(`/storage-locations/${route.params.locationId}`);
  location.value = data;
  loading.value = false;
});

const typeInfo = computed(() => storageTypeInfo(location.value?.type));

// All spools across the entire location (flat list for deriving filter options)
const allSpools = computed(() => {
  if (!location.value) return [];
  const fromZones = (location.value.zones ?? []).flatMap(z => (z.spools ?? []).map(ls => ls.spool).filter(Boolean));
  const unzoned = (location.value.spools ?? []).filter(ls => !ls.zoneId).map(ls => ls.spool).filter(Boolean);
  return [...fromZones, ...unzoned];
});

const materialOptions = computed(() =>
  [...new Set(allSpools.value.map(s => s.filamentType?.material).filter(Boolean))].sort()
);

const brandOptions = computed(() =>
  [...new Set(allSpools.value.map(s => s.filamentType?.brand).filter(Boolean))].sort()
);

const activeFilterCount = computed(() =>
  [search.value, filterMaterial.value, filterBrand.value].filter(Boolean).length
);

const isFiltered = computed(() => activeFilterCount.value > 0);

function matchesSpool(spool) {
  if (!spool) return false;
  const ft = spool.filamentType ?? {};
  if (filterMaterial.value && ft.material !== filterMaterial.value) return false;
  if (filterBrand.value && ft.brand !== filterBrand.value) return false;
  if (search.value) {
    const q = search.value.toLowerCase();
    const fields = [
      spool.nfcTagId,
      ft.brand,
      ft.name,
      ft.color,
      ft.colorHex,
      ft.material,
    ];
    if (!fields.some(f => f && String(f).toLowerCase().includes(q))) return false;
  }
  return true;
}

function clearFilters() {
  search.value = '';
  filterMaterial.value = null;
  filterBrand.value = null;
}

function zoneSpools(zone) {
  return (zone.spools ?? []).map((ls) => ls.spool).filter(Boolean);
}

function filteredZoneSpools(zone) {
  return zoneSpools(zone).filter(matchesSpool);
}

const unzonedSpools = computed(() => {
  if (!location.value) return [];
  return (location.value.spools ?? [])
    .filter((ls) => !ls.zoneId)
    .map((ls) => ls.spool)
    .filter(Boolean);
});

const filteredUnzonedSpools = computed(() => unzonedSpools.value.filter(matchesSpool));

function openZoneDialog(zone = null) {
  editingZone.value = zone;
  zoneForm.value = { name: zone?.name ?? '', description: zone?.description ?? '' };
  zoneDialog.value = true;
}

async function saveZone() {
  savingZone.value = true;
  try {
    if (editingZone.value) {
      await locationStore.updateZone(location.value.storageLocationId, editingZone.value.zoneId, zoneForm.value);
    } else {
      await locationStore.createZone(location.value.storageLocationId, zoneForm.value);
    }
    // Refresh local data
    const { data } = await apiClient.get(`/storage-locations/${route.params.locationId}`);
    location.value = data;
    zoneDialog.value = false;
  } finally {
    savingZone.value = false;
  }
}

async function handleDeleteZone(zoneId) {
  await locationStore.deleteZone(location.value.storageLocationId, zoneId);
  const { data } = await apiClient.get(`/storage-locations/${route.params.locationId}`);
  location.value = data;
}
</script>
