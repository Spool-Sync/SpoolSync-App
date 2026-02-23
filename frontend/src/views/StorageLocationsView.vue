<template>
  <div>
    <div class="d-flex align-center mb-4">
      <h1 class="text-h5 font-weight-bold">Storage</h1>
      <v-spacer />
      <v-btn
        v-if="tab === 'locations'"
        color="primary"
        prepend-icon="mdi-plus"
        @click="showForm = true"
      >
        Add Location
      </v-btn>
    </div>

    <v-tabs v-model="tab" class="mb-4">
      <v-tab value="inventory" prepend-icon="mdi-view-column-outline">Inventory</v-tab>
      <v-tab value="locations" prepend-icon="mdi-map-marker-outline">Locations</v-tab>
    </v-tabs>

    <v-window v-model="tab">
      <v-window-item value="inventory">
        <StorageKanban />
      </v-window-item>

      <v-window-item value="locations">
        <v-text-field
          v-model="locationSearch"
          label="Search locations"
          prepend-inner-icon="mdi-magnify"
          variant="outlined"
          density="compact"
          clearable
          class="mb-4"
          style="max-width: 400px"
        />
        <StorageLocationTable
          :locations="locationStore.locations"
          :loading="locationStore.loading"
          :search="locationSearch"
          @edit="openEdit"
          @delete="handleDelete"
        />
      </v-window-item>
    </v-window>

    <v-dialog v-model="showForm" max-width="500">
      <StorageLocationForm :location="editingLocation" @saved="handleSaved" @cancel="closeForm" />
    </v-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import StorageLocationTable from '@/components/tables/StorageLocationTable.vue';
import StorageLocationForm from '@/components/forms/StorageLocationForm.vue';
import StorageKanban from '@/components/StorageKanban.vue';
import { useStorageLocationStore } from '@/store/storageLocations';

const locationStore = useStorageLocationStore();

const tab = ref('inventory');
const showForm = ref(false);
const editingLocation = ref(null);
const locationSearch = ref('');

onMounted(() => locationStore.fetchLocations());

function openEdit(location) {
  editingLocation.value = location;
  showForm.value = true;
}

function closeForm() {
  showForm.value = false;
  editingLocation.value = null;
}

function handleSaved(location) {
  if (editingLocation.value) {
    locationStore.handleLocationUpdated(location);
  } else {
    locationStore.handleLocationCreated(location);
  }
  closeForm();
}

async function handleDelete(locationId) {
  await locationStore.deleteLocation(locationId);
}
</script>
