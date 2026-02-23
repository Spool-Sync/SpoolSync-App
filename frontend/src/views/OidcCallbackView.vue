<template>
  <v-container class="fill-height" fluid>
    <v-row align="center" justify="center">
      <v-col cols="auto" class="text-center">
        <v-progress-circular indeterminate color="primary" size="48" />
        <p class="text-body-1 text-medium-emphasis mt-4">Signing you in…</p>
      </v-col>
    </v-row>
  </v-container>
</template>

<script setup>
import { onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useAuthStore } from '@/store/auth';
import { websocketService } from '@/services/websocketService';

const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();

onMounted(async () => {
  const { token, error, redirect } = route.query;

  if (error || !token) {
    router.replace('/login?error=oidc_failed');
    return;
  }

  try {
    await authStore.loginWithToken(token);
    websocketService.connect();
    router.replace(redirect || '/dashboard');
  } catch {
    router.replace('/login?error=oidc_failed');
  }
});
</script>
