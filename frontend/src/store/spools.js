import { defineStore } from 'pinia';
import { ref } from 'vue';
import apiClient from '@/services/apiClient';

export const useSpoolStore = defineStore('spools', () => {
  const spools = ref([]);
  const loading = ref(false);
  const error = ref(null);
  // Incremented by WS-driven create/delete so views can react without polling
  const wsChangeCount = ref(0);

  async function fetchSpools(filters = {}) {
    loading.value = true;
    error.value = null;
    try {
      // Fetch without pagination to populate the full list for dashboard/kanban
      const { data } = await apiClient.get('/spools', { params: { ...filters, pageSize: 200 } });
      spools.value = data.items ?? data;
    } catch (err) {
      error.value = err.response?.data?.message || 'Failed to load spools';
    } finally {
      loading.value = false;
    }
  }

  // Server-side paginated fetch — returns { items, total } without mutating spools ref
  async function fetchSpoolsPage(params = {}) {
    const { data } = await apiClient.get('/spools', { params });
    return data; // { items, total, page, pageSize }
  }

  async function fetchFilters() {
    const { data } = await apiClient.get('/spools/filters');
    return data; // { materials, colors }
  }

  async function fetchSpool(spoolId) {
    const { data } = await apiClient.get(`/spools/${spoolId}`);
    return data;
  }

  async function createSpool(payload) {
    const { data } = await apiClient.post('/spools', payload);
    handleSpoolCreated(data);
    return data;
  }

  async function updateSpool(spoolId, payload) {
    const { data } = await apiClient.put(`/spools/${spoolId}`, payload);
    const idx = spools.value.findIndex((s) => s.spoolId === spoolId);
    if (idx !== -1) spools.value[idx] = data;
    return data;
  }

  async function deleteSpool(spoolId) {
    await apiClient.delete(`/spools/${spoolId}`);
    handleSpoolDeleted({ spoolId });
  }

  async function updateWeight(spoolId, weight_g) {
    const { data } = await apiClient.put(`/spools/${spoolId}/update-weight`, { weight_g });
    handleSpoolUpdate(data);
    return data;
  }

  function handleSpoolUpdate(update) {
    const idx = spools.value.findIndex((s) => s.spoolId === update.spoolId);
    if (idx !== -1) {
      spools.value[idx] = { ...spools.value[idx], ...update };
    }
  }

  function handleSpoolCreated(spool) {
    if (!spools.value.find((s) => s.spoolId === spool.spoolId)) {
      spools.value.unshift(spool);
      wsChangeCount.value++;
    }
  }

  function handleSpoolDeleted({ spoolId }) {
    spools.value = spools.value.filter((s) => s.spoolId !== spoolId);
    wsChangeCount.value++;
  }

  async function markSpent(spoolId, spent = true) {
    const { data } = await apiClient.post(`/spools/${spoolId}/mark-spent`, { spent });
    handleSpoolUpdate(data);
    return data;
  }

  async function refillSpool(spoolId, payload = {}) {
    const { data } = await apiClient.post(`/spools/${spoolId}/refill`, payload);
    handleSpoolUpdate(data);
    return data;
  }

  return { spools, loading, error, wsChangeCount, fetchSpools, fetchSpoolsPage, fetchFilters, fetchSpool, createSpool, updateSpool, deleteSpool, updateWeight, markSpent, refillSpool, handleSpoolUpdate, handleSpoolCreated, handleSpoolDeleted };
});
