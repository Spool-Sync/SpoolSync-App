<template>
  <v-layout>
    <SideNavBar />
    <HeaderBar />

    <!-- Global spool-edit dialog — opened by NFC scan or default-scale trigger -->
    <v-dialog
      :model-value="!!uiStore.editingSpoolId"
      max-width="500"
      @update:model-value="
        (v) => {
          if (!v) closeGlobalEdit();
        }
      "
    >
      <v-card
        v-if="uiStore.editingSpoolId && !globalEditSpool"
        rounded="xl"
        class="pa-6 d-flex align-center justify-center"
      >
        <v-progress-circular indeterminate />
      </v-card>
      <SpoolForm
        v-else-if="globalEditSpool"
        :spool="globalEditSpool"
        @saved="closeGlobalEdit()"
        @cancel="closeGlobalEdit()"
      />
    </v-dialog>

    <v-main>
      <!-- New-version banner — sticks below the app bar -->
      <v-banner
        v-if="uiStore.updateAvailable"
        color="primary"
        icon="mdi-update"
        lines="one"
        style="position: sticky; top: 64px; z-index: 10"
      >
        A new version of SpoolSync is available.
        <template #actions>
          <v-btn variant="text" @click="reload()">Refresh now</v-btn>
        </template>
      </v-banner>

      <v-container fluid class="pa-2 pa-sm-4 page-view">
        <RouterView />
      </v-container>
    </v-main>

    <v-snackbar
      v-for="notification in uiStore.notifications"
      :key="notification.id"
      :color="notification.type"
      :timeout="notification.timeout"
      location="bottom right"
      model-value
      @update:model-value="uiStore.dismissNotification(notification.id)"
    >
      {{ notification.message }}
      <template v-if="notification.action" #actions>
        <v-btn
          variant="text"
          :to="notification.action.to"
          @click="uiStore.dismissNotification(notification.id)"
        >
          {{ notification.action.label }}
        </v-btn>
      </template>
    </v-snackbar>
  </v-layout>
</template>

<script setup>
import { ref, onMounted, onUnmounted, watch } from "vue";
import SideNavBar from "./SideNavBar.vue";
import HeaderBar from "./HeaderBar.vue";
import SpoolForm from "@/components/forms/SpoolForm.vue";
import { useUiStore } from "@/store/ui";
import { useAuthStore } from "@/store/auth";
import { useSpoolHolderStore } from "@/store/spoolHolders";
import { useSpoolStore } from "@/store/spools";
import { startVersionPolling } from "@/services/versionService";

const uiStore = useUiStore();
const authStore = useAuthStore();
const holderStore = useSpoolHolderStore();
const spoolStore = useSpoolStore();

// Global edit dialog — loaded spool object
const globalEditSpool = ref(null);

// When editingSpoolId is set, fetch the spool then show the form
watch(
  () => uiStore.editingSpoolId,
  async (spoolId) => {
    if (!spoolId) {
      globalEditSpool.value = null;
      return;
    }
    globalEditSpool.value = null;
    globalEditSpool.value = await spoolStore
      .fetchSpool(spoolId)
      .catch(() => null);
    if (!globalEditSpool.value) uiStore.closeSpoolEdit();
  },
);

function closeGlobalEdit() {
  globalEditSpool.value = null;
  uiStore.closeSpoolEdit();
}

// Auto-open spool edit dialog when a known spool is placed on the user's default scale
watch(
  () => holderStore.spoolIdentifications,
  (identifications) => {
    const defaultScaleId = authStore.preferences.defaultScaleId;
    if (!defaultScaleId || !authStore.preferences.autoOpenOnScale) return;
    const event = identifications[defaultScaleId];
    if (event?.spoolId) {
      uiStore.openSpoolEdit(event.spoolId);
      holderStore.clearSpoolIdentification(defaultScaleId);
    }
  },
  { deep: true },
);

function reload() {
  window.location.reload();
}

// When a new version is available, reload as soon as the page is hidden
// (user switches tab or locks phone). If already hidden, reload immediately.
function onVisibilityChange() {
  if (document.visibilityState === "hidden") reload();
}

const stopAutoReloadWatch = watch(
  () => uiStore.updateAvailable,
  (available) => {
    if (!available) return;
    if (document.visibilityState === "hidden") {
      reload();
    } else {
      document.addEventListener("visibilitychange", onVisibilityChange);
    }
  },
);

onMounted(() => {
  startVersionPolling(() => uiStore.markUpdateAvailable());
});

onUnmounted(() => {
  stopAutoReloadWatch();
  document.removeEventListener("visibilitychange", onVisibilityChange);
});
</script>

<style scoped>
.page-view {
  height: calc(100vh - 64px); /* Full height minus header and banner */
  overflow: auto;
}
</style>
