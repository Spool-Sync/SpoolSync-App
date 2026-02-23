<template>
  <v-chip
    :color="connected ? 'success' : 'error'"
    size="small"
    variant="tonal"
    :prepend-icon="connected ? 'mdi-wifi' : 'mdi-wifi-off'"
  >
    {{ connected ? 'Live' : 'Offline' }}
  </v-chip>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue';
import { websocketService } from '@/services/websocketService';

const connected = ref(websocketService.isConnected);

let interval;
onMounted(() => {
  interval = setInterval(() => {
    connected.value = websocketService.isConnected;
  }, 2000);
});
onUnmounted(() => clearInterval(interval));
</script>
