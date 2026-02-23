<template>
  <v-app :theme="uiStore.theme">
    <AppLayout v-if="authStore.isAuthenticated" />
    <RouterView v-else />
  </v-app>
</template>


<script setup>
import { onMounted } from 'vue';
import AppLayout from '@/components/Layout/AppLayout.vue';
import { useAuthStore } from '@/store/auth';
import { useUiStore } from '@/store/ui';
import { websocketService } from '@/services/websocketService';

const authStore = useAuthStore();
const uiStore = useUiStore();

onMounted(async () => {
  await authStore.restoreSession();
  if (authStore.isAuthenticated) {
    websocketService.connect();
  }
});
</script>
