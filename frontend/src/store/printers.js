import { defineStore } from 'pinia';
import { ref } from 'vue';
import apiClient from '@/services/apiClient';

export const usePrinterStore = defineStore('printers', () => {
  const printers = ref([]);
  const loading = ref(false);
  const error = ref(null);
  const integrationTypes = ref([]);

  async function fetchPrinters() {
    loading.value = true;
    error.value = null;
    try {
      const { data } = await apiClient.get('/printers');
      printers.value = data;
    } catch (err) {
      error.value = err.response?.data?.message || 'Failed to load printers';
    } finally {
      loading.value = false;
    }
  }

  async function fetchPrinter(printerId) {
    const { data } = await apiClient.get(`/printers/${printerId}`);
    return data;
  }

  async function createPrinter(payload) {
    const { data } = await apiClient.post('/printers', payload);
    handlePrinterCreated(data);
    return data;
  }

  async function updatePrinter(printerId, payload) {
    const { data } = await apiClient.put(`/printers/${printerId}`, payload);
    const idx = printers.value.findIndex((p) => p.printerId === printerId);
    if (idx !== -1) printers.value[idx] = data;
    return data;
  }

  async function deletePrinter(printerId) {
    await apiClient.delete(`/printers/${printerId}`);
    handlePrinterDeleted({ printerId });
  }

  async function syncStatus(printerId) {
    const { data } = await apiClient.post(`/printers/${printerId}/sync-status`);
    handleStatusUpdate(data);
    return data;
  }

  async function setSpoolHolderCount(printerId, count) {
    const { data } = await apiClient.put(`/printers/${printerId}/spool-holder-count`, { count });
    handlePrinterUpdated(data);
    return data;
  }

  async function configureHolder(spoolHolderId, payload) {
    const { data } = await apiClient.put(`/printers/holders/${spoolHolderId}/configure`, payload);
    return data;
  }

  async function assignSpool(spoolHolderId, spoolId, force = false) {
    const { data } = await apiClient.put(`/printers/holders/${spoolHolderId}/assign-spool`, { spoolId, force });
    handlePrinterUpdated(data);
    return data;
  }

  async function removeSpool(spoolHolderId, force = false) {
    const { data } = await apiClient.delete(`/printers/holders/${spoolHolderId}/assign-spool`, { params: { force: force ? '1' : undefined } });
    handlePrinterUpdated(data);
    return data;
  }

  async function fetchPrintJobs(printerId) {
    const { data } = await apiClient.get(`/printers/${printerId}/print-jobs`);
    return data;
  }

  async function reloadFilaments(printerId, assignments) {
    const { data } = await apiClient.post(`/printers/${printerId}/reload-filaments`, { assignments });
    handlePrinterUpdated(data);
    return data;
  }

  async function fetchIntegrationTypes() {
    const { data } = await apiClient.get('/integrations/types');
    integrationTypes.value = data;
    return data;
  }

  function getIntegrationType(typeId) {
    return integrationTypes.value.find((t) => t.id === typeId) ?? null;
  }

  function handleStatusUpdate(update) {
    // update can be { printerId, status } (WS event) or a full printer object
    const id = update.printerId;
    const idx = printers.value.findIndex((p) => p.printerId === id);
    if (idx !== -1) printers.value[idx] = { ...printers.value[idx], ...update };
  }

  function handleJobUpdate({ printerId, jobDetails }) {
    const idx = printers.value.findIndex((p) => p.printerId === printerId);
    if (idx !== -1) printers.value[idx] = { ...printers.value[idx], currentJobDetails: jobDetails };
  }

  function handlePrinterCreated(printer) {
    if (!printers.value.find((p) => p.printerId === printer.printerId)) {
      printers.value.push(printer);
    }
  }

  function handlePrinterUpdated(printer) {
    const idx = printers.value.findIndex((p) => p.printerId === printer.printerId);
    if (idx !== -1) {
      printers.value[idx] = { ...printers.value[idx], ...printer };
    }
  }

  function handlePrinterDeleted({ printerId }) {
    printers.value = printers.value.filter((p) => p.printerId !== printerId);
  }

  return { printers, loading, error, integrationTypes, fetchPrinters, fetchPrinter, createPrinter, updatePrinter, deletePrinter, syncStatus, setSpoolHolderCount, configureHolder, assignSpool, removeSpool, fetchPrintJobs, reloadFilaments, fetchIntegrationTypes, getIntegrationType, handleStatusUpdate, handleJobUpdate, handlePrinterCreated, handlePrinterUpdated, handlePrinterDeleted };
});
