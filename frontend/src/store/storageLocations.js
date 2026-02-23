import { defineStore } from 'pinia';
import { ref } from 'vue';
import apiClient from '@/services/apiClient';

export const useStorageLocationStore = defineStore('storageLocations', () => {
  const locations = ref([]);
  const loading = ref(false);
  const error = ref(null);

  async function fetchLocations() {
    loading.value = true;
    error.value = null;
    try {
      const { data } = await apiClient.get('/storage-locations');
      locations.value = data;
    } catch (err) {
      error.value = err.response?.data?.message || 'Failed to load storage locations';
    } finally {
      loading.value = false;
    }
  }

  async function createLocation(payload) {
    const { data } = await apiClient.post('/storage-locations', payload);
    handleLocationCreated(data);
    return data;
  }

  async function updateLocation(storageLocationId, payload) {
    const { data } = await apiClient.put(`/storage-locations/${storageLocationId}`, payload);
    handleLocationUpdated(data);
    return data;
  }

  async function deleteLocation(storageLocationId) {
    await apiClient.delete(`/storage-locations/${storageLocationId}`);
    handleLocationDeleted({ storageLocationId });
  }

  function handleLocationCreated(location) {
    if (!locations.value.find((l) => l.storageLocationId === location.storageLocationId)) {
      locations.value.push(location);
    }
  }

  function handleLocationUpdated(location) {
    const idx = locations.value.findIndex((l) => l.storageLocationId === location.storageLocationId);
    if (idx !== -1) {
      locations.value[idx] = { ...locations.value[idx], ...location };
    }
  }

  function handleLocationDeleted({ storageLocationId }) {
    locations.value = locations.value.filter((l) => l.storageLocationId !== storageLocationId);
  }

  // ── Zone methods ──────────────────────────────────────────────────────────

  async function createZone(storageLocationId, payload) {
    const { data } = await apiClient.post(`/storage-locations/${storageLocationId}/zones`, payload);
    handleLocationUpdated({ storageLocationId, zones: data });
    await fetchLocations(); // refresh to get full nested data
    return data;
  }

  async function updateZone(storageLocationId, zoneId, payload) {
    const { data } = await apiClient.put(`/storage-locations/zones/${zoneId}`, payload);
    await fetchLocations();
    return data;
  }

  async function deleteZone(storageLocationId, zoneId) {
    await apiClient.delete(`/storage-locations/zones/${zoneId}`);
    await fetchLocations();
  }

  return {
    locations,
    loading,
    error,
    fetchLocations,
    createLocation,
    updateLocation,
    deleteLocation,
    handleLocationCreated,
    handleLocationUpdated,
    handleLocationDeleted,
    createZone,
    updateZone,
    deleteZone,
  };
});
