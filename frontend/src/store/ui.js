import { defineStore } from 'pinia';
import { ref } from 'vue';

export const useUiStore = defineStore('ui', () => {
  const theme = ref(localStorage.getItem('theme') || 'dark');
  const navDrawerOpen = ref(true);
  const notifications = ref([]);
  const updateAvailable = ref(false);
  // Global spool-edit dialog — opened from NFC scan or default-scale trigger
  const editingSpoolId = ref(null);

  function toggleTheme() {
    theme.value = theme.value === 'dark' ? 'light' : 'dark';
    localStorage.setItem('theme', theme.value);
  }

  function toggleNavDrawer() {
    navDrawerOpen.value = !navDrawerOpen.value;
  }

  function notify({ message, type = 'info', timeout = 4000, action = null }) {
    const id = Date.now();
    notifications.value.push({ id, message, type, timeout, action });
    setTimeout(() => dismissNotification(id), timeout);
  }

  function dismissNotification(id) {
    notifications.value = notifications.value.filter((n) => n.id !== id);
  }

  function markUpdateAvailable() {
    updateAvailable.value = true;
  }

  function openSpoolEdit(spoolId) {
    editingSpoolId.value = spoolId;
  }

  function closeSpoolEdit() {
    editingSpoolId.value = null;
  }

  return { theme, navDrawerOpen, notifications, updateAvailable, editingSpoolId, toggleTheme, toggleNavDrawer, notify, dismissNotification, markUpdateAvailable, openSpoolEdit, closeSpoolEdit };
});
