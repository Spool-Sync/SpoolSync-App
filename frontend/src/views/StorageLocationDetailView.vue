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
          <span class="text-caption text-medium-emphasis mr-4">{{ zone.spools?.length || 0 }} spool(s)</span>
          <v-btn size="x-small" variant="tonal" icon="mdi-pencil" class="mr-1" @click="openZoneDialog(zone)" />
          <v-btn size="x-small" variant="tonal" icon="mdi-delete" color="error" @click="handleDeleteZone(zone.zoneId)" />
        </v-card-title>
        <v-card-text v-if="zone.description" class="pt-0 text-caption text-medium-emphasis">
          {{ zone.description }}
        </v-card-text>
        <v-divider />
        <v-card-text>
          <SpoolTable
            v-if="zoneSpools(zone).length"
            :spools="zoneSpools(zone)"
            :loading="false"
          />
          <div v-else class="text-center text-medium-emphasis text-caption py-4">
            No spools in this section
          </div>
        </v-card-text>
      </v-card>

      <!-- Spools not assigned to any zone -->
      <v-card rounded="xl">
        <v-card-title class="pa-4 pb-2 text-subtitle-1 font-weight-bold">
          <v-icon icon="mdi-package-variant" class="mr-2" />
          {{ location.zones?.length ? 'Unsectioned Spools' : 'Stored Spools' }}
          <span class="text-caption text-medium-emphasis ml-2">({{ unzonedSpools.length }})</span>
        </v-card-title>
        <v-divider />
        <v-card-text>
          <SpoolTable v-if="unzonedSpools.length" :spools="unzonedSpools" :loading="false" />
          <div v-else class="text-center text-medium-emphasis text-caption py-4">
            No spools stored here
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

function zoneSpools(zone) {
  return (zone.spools ?? []).map((ls) => ls.spool).filter(Boolean);
}

const unzonedSpools = computed(() => {
  if (!location.value) return [];
  return (location.value.spools ?? [])
    .filter((ls) => !ls.zoneId)
    .map((ls) => ls.spool)
    .filter(Boolean);
});

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
