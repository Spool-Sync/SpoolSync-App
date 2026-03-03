<style>
html,
body,
#app {
  height: 100vh;
  overflow: hidden;
}
</style>
<template>
  <v-app :theme="uiStore.theme">
    <AppLayout v-if="authStore.isAuthenticated" />
    <RouterView v-else />
    <LedController v-if="authStore.isAuthenticated" v-model="ledControllerOpen" />
  </v-app>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from "vue";
import AppLayout from "@/components/Layout/AppLayout.vue";
import LedController from "@/components/LedController.vue";
import { useAuthStore } from "@/store/auth";
import { useUiStore } from "@/store/ui";
import { websocketService } from "@/services/websocketService";

const authStore = useAuthStore();
const uiStore = useUiStore();
const ledControllerOpen = ref(false);

// Konami code: ↑ ↑ ↓ ↓ ← → ← → B A
const KONAMI = [
  'ArrowUp','ArrowUp','ArrowDown','ArrowDown',
  'ArrowLeft','ArrowRight','ArrowLeft','ArrowRight',
  'KeyB','KeyA',
];
const konamiProgress = ref(0);

function onKeyDown(e) {
  if (e.code === KONAMI[konamiProgress.value]) {
    konamiProgress.value++;
    if (konamiProgress.value === KONAMI.length) {
      konamiProgress.value = 0;
      if (authStore.isAuthenticated) ledControllerOpen.value = true;
    }
  } else {
    konamiProgress.value = e.code === KONAMI[0] ? 1 : 0;
  }
}

onMounted(async () => {
  await authStore.restoreSession();
  if (authStore.isAuthenticated) {
    websocketService.connect();
  }
  window.addEventListener('keydown', onKeyDown);
});

onUnmounted(() => {
  window.removeEventListener('keydown', onKeyDown);
});
</script>
