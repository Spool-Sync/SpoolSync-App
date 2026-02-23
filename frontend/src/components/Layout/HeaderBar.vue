<template>
  <v-app-bar elevation="0" border="b">
    <v-app-bar-nav-icon
      class="d-flex d-md-none"
      @click="uiStore.toggleNavDrawer()"
    />

    <v-app-bar-title>
      <v-breadcrumbs :items="breadcrumbs" density="compact" class="pa-0" />
    </v-app-bar-title>

    <template #append>
      <RealtimeIndicator class="mr-2 d-none d-sm-flex" />

<v-btn
        :icon="uiStore.theme === 'dark' ? 'mdi-weather-sunny' : 'mdi-weather-night'"
        variant="text"
        @click="uiStore.toggleTheme()"
      />

      <v-menu>
        <template #activator="{ props: menuProps }">
          <v-avatar
            v-bind="menuProps"
            color="primary"
            size="36"
            class="ml-2 mr-3"
            style="cursor: pointer"
          >
            <span class="text-caption font-weight-bold">{{ userInitials }}</span>
          </v-avatar>
        </template>
        <v-list density="compact" min-width="160">
          <v-list-item
            prepend-icon="mdi-logout"
            title="Logout"
            @click="handleLogout"
          />
        </v-list>
      </v-menu>
    </template>
  </v-app-bar>
</template>

<script setup>
import { computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import RealtimeIndicator from '@/components/RealtimeIndicator.vue';
import { useUiStore } from '@/store/ui';
import { useAuthStore } from '@/store/auth';

const uiStore = useUiStore();
const authStore = useAuthStore();
const route = useRoute();
const router = useRouter();

async function handleLogout() {
  await authStore.logout();
  router.push('/login');
}

const breadcrumbs = computed(() => {
  const parts = route.path.split('/').filter(Boolean);
  return [
    { title: 'SpoolSync', to: '/dashboard' },
    ...parts.map((part, i) => ({
      title: part.charAt(0).toUpperCase() + part.slice(1),
      to: '/' + parts.slice(0, i + 1).join('/'),
    })),
  ];
});

const userInitials = computed(() => {
  const name = authStore.user?.username || 'U';
  return name.slice(0, 2).toUpperCase();
});
</script>
