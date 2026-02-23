import { defineStore } from 'pinia';
import { ref } from 'vue';
import apiClient from '@/services/apiClient';

export const useSpoolHolderStore = defineStore('spoolHolders', () => {
  const holders = ref([]);
  const loading = ref(false);
  const error = ref(null);
  const ingestUpdates = ref({}); // keyed by spoolHolderId
  const spoolIdentifications = ref({}); // keyed by spoolHolderId — set when a known spool's weight is auto-synced

  async function fetchSpoolHolders(filters = {}) {
    loading.value = true;
    error.value = null;
    try {
      const { data } = await apiClient.get('/spool-holders', { params: filters });
      holders.value = data;
    } catch (err) {
      error.value = err.response?.data?.message || 'Failed to load spool holders';
    } finally {
      loading.value = false;
    }
  }

  async function fetchHolder(spoolHolderId) {
    const { data } = await apiClient.get(`/spool-holders/${spoolHolderId}`);
    return data;
  }

  async function createHolder(payload) {
    const { data } = await apiClient.post('/spool-holders', payload);
    handleHolderCreated(data);
    return data;
  }

  async function updateHolder(spoolHolderId, payload) {
    const { data } = await apiClient.put(`/spool-holders/${spoolHolderId}`, payload);
    const idx = holders.value.findIndex((h) => h.spoolHolderId === spoolHolderId);
    if (idx !== -1) holders.value[idx] = data;
    return data;
  }

  async function deleteHolder(spoolHolderId) {
    await apiClient.delete(`/spool-holders/${spoolHolderId}`);
    handleHolderDeleted({ spoolHolderId });
  }

  async function calibrate(spoolHolderId, { offset, scale }) {
    const { data } = await apiClient.post(`/spool-holders/${spoolHolderId}/calibrate`, { offset, scale });
    const idx = holders.value.findIndex((h) => h.spoolHolderId === spoolHolderId);
    if (idx !== -1) holders.value[idx] = data;
    return data;
  }

  function handleHolderUpdate(update) {
    const idx = holders.value.findIndex((h) => h.spoolHolderId === update.spoolHolderId);
    if (idx !== -1) {
      holders.value[idx] = { ...holders.value[idx], ...update };
    }
  }

  function handleIngestUpdate(data) {
    ingestUpdates.value[data.spoolHolderId] = data;
  }

  function handleSpoolIdentified(data) {
    spoolIdentifications.value[data.spoolHolderId] = data;
  }

  function clearSpoolIdentification(spoolHolderId) {
    delete spoolIdentifications.value[spoolHolderId];
  }

  async function linkNfc(spoolId, nfcTagId) {
    const { data } = await apiClient.post(`/spools/${spoolId}/link-nfc`, { nfcTagId });
    return data;
  }

  function handleHolderCreated(holder) {
    if (!holders.value.find((h) => h.spoolHolderId === holder.spoolHolderId)) {
      holders.value.unshift(holder);
    }
  }

  function handleHolderDeleted({ spoolHolderId }) {
    holders.value = holders.value.filter((h) => h.spoolHolderId !== spoolHolderId);
  }

  return {
    holders,
    loading,
    error,
    ingestUpdates,
    spoolIdentifications,
    fetchSpoolHolders,
    fetchHolder,
    createHolder,
    updateHolder,
    deleteHolder,
    calibrate,
    handleHolderUpdate,
    handleHolderCreated,
    handleHolderDeleted,
    handleIngestUpdate,
    handleSpoolIdentified,
    clearSpoolIdentification,
    linkNfc,
  };
});
