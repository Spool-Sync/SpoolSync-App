<template>
  <v-container class="fill-height" fluid>
    <v-row align="center" justify="center">
      <v-col cols="12" sm="8" md="4">

        <!-- OIDC redirect spinner -->
        <div v-if="oidcChecking" class="text-center">
          <v-progress-circular indeterminate color="primary" size="48" />
          <p class="text-body-1 text-medium-emphasis mt-4">Checking sign-in options…</p>
        </div>

        <v-card v-else class="pa-6" rounded="xl" elevation="8">
          <div class="text-center mb-6">
            <v-icon icon="mdi-reel" size="56" color="primary" />
            <h1 class="text-h5 font-weight-bold mt-2">SpoolSync</h1>
            <p class="text-body-2 text-medium-emphasis">Filament management, simplified</p>
          </div>

          <v-form @submit.prevent="handleLogin">
            <v-text-field
              v-model="email"
              label="Email"
              type="email"
              prepend-inner-icon="mdi-email-outline"
              variant="outlined"
              :disabled="loading"
              required
            />
            <v-text-field
              v-model="password"
              label="Password"
              :type="showPassword ? 'text' : 'password'"
              prepend-inner-icon="mdi-lock-outline"
              :append-inner-icon="showPassword ? 'mdi-eye-off' : 'mdi-eye'"
              variant="outlined"
              :disabled="loading"
              required
              @click:append-inner="showPassword = !showPassword"
            />

            <v-alert v-if="error" type="error" variant="tonal" class="mb-4" density="compact">
              {{ error }}
            </v-alert>

            <v-btn
              type="submit"
              color="primary"
              size="large"
              block
              :loading="loading"
            >
              Sign In
            </v-btn>
          </v-form>

          <v-divider class="my-4" />

          <v-btn
            variant="tonal"
            color="secondary"
            block
            prepend-icon="mdi-shield-account"
            href="/api/v1/auth/oidc"
          >
            Sign in with SSO
          </v-btn>
        </v-card>

      </v-col>
    </v-row>
  </v-container>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { useAuthStore } from '@/store/auth';
import { websocketService } from '@/services/websocketService';
import apiClient from '@/services/apiClient';

const router = useRouter();
const route = useRoute();
const authStore = useAuthStore();

const email = ref('');
const password = ref('');
const loading = ref(false);
const error = ref('');
const showPassword = ref(false);
const oidcChecking = ref(true);

onMounted(async () => {
  // Show error from OIDC callback
  if (route.query.error === 'oidc_failed') {
    error.value = 'SSO sign-in failed. Please try again or use your password.';
  }

  // Check if OIDC is configured — auto-redirect unless bypass requested
  try {
    const { data } = await apiClient.get('/auth/oidc-status');
    if (data.enabled && route.query.bypassOauth !== 'true') {
      window.location.href = '/api/v1/auth/oidc';
      return;
    }
  } catch {
    // OIDC check failed — show normal login form
  }

  oidcChecking.value = false;
});

async function handleLogin() {
  loading.value = true;
  error.value = '';
  try {
    await authStore.login(email.value, password.value);
    websocketService.connect();
    router.push(route.query.redirect || '/dashboard');
  } catch (err) {
    error.value = err.response?.data?.message || 'Login failed. Please try again.';
  } finally {
    loading.value = false;
  }
}
</script>
