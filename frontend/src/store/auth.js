import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import apiClient from '@/services/apiClient';

export const useAuthStore = defineStore('auth', () => {
  const user = ref(null);
  const token = ref(null);
  const preferences = ref({ favoriteBrands: [], ingestStationId: null, useIngestMode: false, defaultScaleId: null, autoOpenOnScale: true });

  const isAuthenticated = computed(() => !!token.value);

  const isSuperAdmin = computed(() => user.value?.isSuperAdmin ?? false);

  const permissions = computed(() => {
    if (isSuperAdmin.value) return [];
    return [...new Set((user.value?.customRoles ?? []).flatMap((r) => r.permissions))];
  });

  function hasPermission(perm) {
    if (isSuperAdmin.value) return true;
    return permissions.value.includes(perm);
  }

  // Backward-compat: treat super-admin or anyone who can manage users as "admin"
  const isAdmin = computed(() => isSuperAdmin.value || hasPermission('users:view'));

  async function login(email, password) {
    const { data } = await apiClient.post('/users/login', { email, password });
    token.value = data.token;
    user.value = data.user;
    localStorage.setItem('token', data.token);
    await fetchPreferences();
  }

  async function loginWithToken(newToken) {
    token.value = newToken;
    localStorage.setItem('token', newToken);
    await fetchMe();
    await fetchPreferences();
  }

  async function logout() {
    try {
      await apiClient.post('/users/me/logout');
    } finally {
      token.value = null;
      user.value = null;
      preferences.value = { favoriteBrands: [], ingestStationId: null, useIngestMode: false, defaultScaleId: null, autoOpenOnScale: true };
      localStorage.removeItem('token');
    }
  }

  async function fetchMe() {
    const { data } = await apiClient.get('/users/me');
    user.value = data;
  }

  async function fetchPreferences() {
    try {
      const { data } = await apiClient.get('/users/me/preferences');
      preferences.value = {
        favoriteBrands: data.favoriteBrands ?? [],
        ingestStationId: data.ingestStationId ?? null,
        useIngestMode: data.useIngestMode ?? false,
        defaultScaleId: data.defaultScaleId ?? null,
        autoOpenOnScale: data.autoOpenOnScale ?? true,
      };
    } catch {
      // silently fall back to defaults
    }
  }

  async function updatePreferences(patch) {
    // Optimistic update
    preferences.value = { ...preferences.value, ...patch };
    try {
      const { data } = await apiClient.put('/users/me/preferences', preferences.value);
      preferences.value = {
        favoriteBrands: data.favoriteBrands ?? [],
        ingestStationId: data.ingestStationId ?? null,
        useIngestMode: data.useIngestMode ?? false,
        defaultScaleId: data.defaultScaleId ?? null,
        autoOpenOnScale: data.autoOpenOnScale ?? true,
      };
    } catch {
      // keep optimistic update on failure
    }
  }

  async function restoreSession() {
    const savedToken = localStorage.getItem('token');
    if (savedToken) {
      token.value = savedToken;
      await fetchMe().catch(() => logout());
      if (user.value) await fetchPreferences();
    }
  }

  return {
    user, token, preferences,
    isAuthenticated, isAdmin, isSuperAdmin, permissions,
    hasPermission,
    login, loginWithToken, logout,
    fetchMe, fetchPreferences, updatePreferences,
    restoreSession,
  };
});
