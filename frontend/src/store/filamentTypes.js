import { defineStore } from "pinia";
import { ref } from "vue";
import apiClient from "@/services/apiClient";

export const useFilamentTypeStore = defineStore("filamentTypes", () => {
  const filamentTypes = ref([]);
  const loading = ref(false);
  const error = ref(null);

  async function fetchFilamentTypes(filters = {}) {
    loading.value = true;
    error.value = null;
    try {
      const { data } = await apiClient.get("/filament-types", {
        params: filters,
      });
      filamentTypes.value = data;
    } catch (err) {
      error.value =
        err.response?.data?.message || "Failed to load filament types";
    } finally {
      loading.value = false;
    }
  }

  async function searchFilamentTypes(query) {
    const { data } = await apiClient.get("/filament-types/search", {
      params: { q: query },
    });
    return data;
  }

  async function createFilamentType(payload) {
    const { data } = await apiClient.post("/filament-types", payload);
    filamentTypes.value.push(data);
    return data;
  }

  async function updateFilamentType(id, payload) {
    const { data } = await apiClient.put(`/filament-types/${id}`, payload);
    const idx = filamentTypes.value.findIndex((f) => f.filamentTypeId === id);
    if (idx !== -1) filamentTypes.value[idx] = data;
    return data;
  }

  async function deleteFilamentType(id) {
    await apiClient.delete(`/filament-types/${id}`);
    filamentTypes.value = filamentTypes.value.filter(
      (f) => f.filamentTypeId !== id,
    );
  }

  async function syncExternal() {
    const { data } = await apiClient.post("/filament-types/sync-external");
    return data;
  }

  // Cascading dropdown helpers
  async function fetchBrands() {
    const { data } = await apiClient.get("/filament-types/brands");
    return data;
  }

  async function fetchMaterialTypes(brand) {
    const { data } = await apiClient.get("/filament-types/material-types", {
      params: { brand },
    });
    return data;
  }

  async function fetchMaterials(brand, materialType) {
    const { data } = await apiClient.get("/filament-types/materials", {
      params: { brand, materialType },
    });
    return data;
  }

  function handleFilamentTypeCreated(ft) {
    if (!filamentTypes.value.find(f => f.filamentTypeId === ft.filamentTypeId)) {
      filamentTypes.value.push(ft);
    }
  }

  function handleFilamentTypeUpdated(ft) {
    const idx = filamentTypes.value.findIndex(f => f.filamentTypeId === ft.filamentTypeId);
    if (idx !== -1) filamentTypes.value[idx] = ft;
  }

  function handleFilamentTypeDeleted({ filamentTypeId }) {
    filamentTypes.value = filamentTypes.value.filter(f => f.filamentTypeId !== filamentTypeId);
  }

  return {
    filamentTypes,
    loading,
    error,
    fetchFilamentTypes,
    searchFilamentTypes,
    createFilamentType,
    updateFilamentType,
    deleteFilamentType,
    syncExternal,
    handleFilamentTypeCreated,
    handleFilamentTypeUpdated,
    handleFilamentTypeDeleted,
    fetchBrands,
    fetchMaterialTypes,
    fetchMaterials,
  };
});
