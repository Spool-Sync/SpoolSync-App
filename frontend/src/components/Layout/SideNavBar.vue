<template>
  <v-navigation-drawer
    v-model="uiStore.navDrawerOpen"
    :rail="display.mdAndUp.value && rail"
    :permanent="display.mdAndUp.value"
  >
    <v-list-item nav height="64px" class="d-flex align-center">
      <img
        v-if="!rail || display.smAndDown.value"
        :src="themeLogo"
        alt="SpoolSync Logo"
        height="40"
        style="margin-right: 12px"
      />
      <template v-if="display.mdAndUp.value" #append>
        <v-btn
          :icon="rail ? 'mdi-chevron-right' : 'mdi-chevron-left'"
          variant="text"
          @click="rail = !rail"
        />
      </template>
    </v-list-item>

    <v-divider />

    <v-list density="compact" nav>
      <template v-for="item in navItems" :key="item.divider ? `divider-${item.key}` : item.to">
        <v-divider v-if="item.divider" class="my-1" />
        <v-list-item
          v-else
          :prepend-icon="item.icon"
          :title="item.title"
          :to="item.to"
          :active="$route.path.startsWith(item.to)"
          rounded="lg"
          @click="onNavItemClick"
        />
      </template>
    </v-list>

    <template #append>
      <v-divider />
      <v-list density="compact" nav>
        <v-list-item
          prepend-icon="mdi-cog-outline"
          title="Settings"
          to="/settings"
          rounded="lg"
          @click="onNavItemClick"
        />
        <v-list-item
          prepend-icon="mdi-logout"
          title="Logout"
          rounded="lg"
          @click="onLogout"
        />
      </v-list>
    </template>
  </v-navigation-drawer>
</template>

<script setup>
import { ref, computed, onMounted } from "vue";
import { useDisplay } from "vuetify";
import { useUiStore } from "@/store/ui";
import { useAuthStore } from "@/store/auth";

const uiStore = useUiStore();
const authStore = useAuthStore();
const display = useDisplay();
const rail = ref(false);

// Close drawer by default on mobile (drawer starts open from localStorage/default)
onMounted(() => {
  if (display.smAndDown.value) {
    uiStore.navDrawerOpen = false;
  }
});

const navItems = computed(() => [
  { title: "Dashboard",  icon: "mdi-view-dashboard-outline",  to: "/dashboard" },

  { divider: true, key: "filament" },
  { title: "Filament",   icon: "mdi-movie-roll",               to: "/spools" },
  { title: "Inventory",  icon: "mdi-clipboard-list-outline",   to: "/inventory" },
  { title: "Storage",    icon: "mdi-archive-outline",          to: "/storage" },

  { divider: true, key: "printers" },
  { title: "Printers",   icon: "mdi-printer-3d",               to: "/printers" },
  { title: "Orders",     icon: "mdi-cart-outline",             to: "/orders" },

  { divider: true, key: "hardware" },
  { title: "Scales",     icon: "mdi-scale",                    to: "/spool-holders" },
  { title: "Devices",    icon: "mdi-chip",                     to: "/esp32-devices" },
  { title: "Weigh",      icon: "mdi-scale-balance",            to: "/weigh" },

  ...(authStore.isAdmin ? [
    { divider: true, key: "admin" },
    { title: "Users",    icon: "mdi-account-group-outline",    to: "/admin/users" },
  ] : []),
]);

const themeLogo = computed(() => {
  return uiStore.theme === "light"
    ? new URL("@/assets/title-light.svg", import.meta.url).href
    : new URL("@/assets/title.svg", import.meta.url).href;
});

function onNavItemClick() {
  if (display.smAndDown.value) {
    uiStore.navDrawerOpen = false;
  }
}

function onLogout() {
  onNavItemClick();
  authStore.logout();
}
</script>
