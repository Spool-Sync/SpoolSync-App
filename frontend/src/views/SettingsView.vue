<template>
  <div>
    <h1 class="text-h5 font-weight-bold mb-4">Settings</h1>

    <v-row>
      <v-col cols="12" md="6">
        <!-- Profile -->
        <v-card rounded="xl" class="mb-4">
          <v-card-title class="pa-4 pb-2 d-flex align-center gap-2">
            <v-icon color="primary">mdi-account-circle</v-icon>
            Profile
          </v-card-title>
          <v-card-text>
            <v-text-field
              v-model="username"
              label="Username"
              variant="outlined"
              density="compact"
              class="mb-2"
            />
            <v-text-field
              v-model="email"
              label="Email"
              type="email"
              variant="outlined"
              density="compact"
            />
          </v-card-text>
          <v-card-actions class="pa-4 pt-0">
            <v-spacer />
            <v-btn color="primary" @click="saveProfile">Save</v-btn>
          </v-card-actions>
        </v-card>

        <!-- Appearance -->
        <v-card rounded="xl" class="mb-4">
          <v-card-title class="pa-4 pb-2 d-flex align-center gap-2">
            <v-icon color="primary">mdi-palette</v-icon>
            Appearance
          </v-card-title>
          <v-card-text>
            <v-switch
              :model-value="uiStore.theme === 'dark'"
              label="Dark Mode"
              color="primary"
              inset
              @update:model-value="uiStore.toggleTheme()"
            />
          </v-card-text>
        </v-card>

        <!-- Change Password -->
        <v-card rounded="xl" class="mb-4">
          <v-card-title class="pa-4 pb-2 d-flex align-center gap-2">
            <v-icon color="primary">mdi-lock-reset</v-icon>
            Change Password
          </v-card-title>
          <v-card-text>
            <v-text-field
              v-model="newPassword"
              label="New Password"
              :type="showPw ? 'text' : 'password'"
              variant="outlined"
              density="compact"
              :append-inner-icon="showPw ? 'mdi-eye-off' : 'mdi-eye'"
              class="mb-2"
              @click:append-inner="showPw = !showPw"
            />
            <v-text-field
              v-if="newPassword"
              v-model="confirmPassword"
              label="Confirm New Password"
              :type="showPw ? 'text' : 'password'"
              variant="outlined"
              density="compact"
              :error-messages="confirmPassword && confirmPassword !== newPassword ? ['Passwords do not match'] : []"
            />
          </v-card-text>
          <v-card-actions class="pa-4 pt-0">
            <v-spacer />
            <v-btn
              color="primary"
              :disabled="!newPassword || newPassword !== confirmPassword"
              :loading="changingPw"
              @click="changePassword"
            >
              Update Password
            </v-btn>
          </v-card-actions>
        </v-card>
      </v-col>

      <v-col cols="12" md="6">
        <!-- Integrations -->
        <v-card rounded="xl" class="mb-4">
          <v-card-title class="pa-4 pb-2 d-flex align-center gap-2">
            <v-icon color="primary">mdi-printer-3d</v-icon>
            Printer Integrations
          </v-card-title>
          <v-card-text>
            <v-list density="compact">
              <v-list-item
                v-for="integration in integrations"
                :key="integration.id"
                :title="integration.name"
                :subtitle="`v${integration.version} — ${integration.description}`"
                prepend-icon="mdi-printer-3d"
              >
                <template #append>
                  <v-chip size="small" color="success" variant="tonal">Active</v-chip>
                </template>
              </v-list-item>
            </v-list>
            <v-file-input
              v-if="authStore.isAdmin"
              label="Upload Integration Config (JSON)"
              accept=".json"
              prepend-icon="mdi-upload"
              variant="outlined"
              density="compact"
              class="mt-4"
              @change="uploadIntegration"
            />
          </v-card-text>
        </v-card>

        <!-- Scan & Scale -->
        <v-card rounded="xl" class="mb-4">
          <v-card-title class="pa-4 pb-2 d-flex align-center gap-2">
            <v-icon color="primary">mdi-scale</v-icon>
            Scan &amp; Scale
          </v-card-title>
          <v-card-text>
            <p class="text-body-2 text-medium-emphasis mb-3">
              When a known spool is placed on your default scale (identified by NFC),
              the spool edit dialog opens automatically. You can also scan NFC tags with
              the button in the top navigation bar.
            </p>
            <v-select
              v-model="defaultScaleId"
              :items="scaleHolders"
              item-title="label"
              item-value="spoolHolderId"
              label="Default scale (ESP32 channel)"
              prepend-inner-icon="mdi-chip"
              variant="outlined"
              density="compact"
              clearable
              hint="Select the spool holder / channel that acts as your main weigh station"
              persistent-hint
              class="mb-3"
              @update:model-value="saveScalePrefs"
            />
            <v-switch
              v-model="autoOpenOnScale"
              label="Auto-open spool edit on scale detection"
              color="primary"
              inset
              density="compact"
              @update:model-value="saveScalePrefs"
            />
          </v-card-text>
        </v-card>

        <!-- OIDC SSO Config (admin only) -->
        <v-card v-if="authStore.isAdmin" rounded="xl" class="mb-4">
          <v-card-title class="pa-4 pb-2 d-flex align-center gap-2">
            <v-icon color="primary">mdi-shield-account</v-icon>
            Single Sign-On (OIDC)
          </v-card-title>
          <v-card-text>
            <v-switch
              v-model="oidcForm.enabled"
              label="Enable SSO"
              color="primary"
              inset
              density="compact"
              class="mb-2"
            />
            <v-text-field
              v-model="oidcForm.issuer"
              label="Issuer URL"
              placeholder="https://auth.example.com/application/o/spoolsync/"
              variant="outlined"
              density="compact"
              :required="oidcForm.enabled"
              hint="Your identity provider's issuer URL"
              persistent-hint
              class="mb-2"
            />
            <v-text-field
              v-model="oidcForm.clientId"
              label="Client ID"
              variant="outlined"
              density="compact"
              :required="oidcForm.enabled"
              class="mb-2"
            />
            <v-text-field
              v-model="oidcForm.clientSecret"
              label="Client Secret"
              :type="showOidcSecret ? 'text' : 'password'"
              :append-inner-icon="showOidcSecret ? 'mdi-eye-off' : 'mdi-eye'"
              variant="outlined"
              density="compact"
              :placeholder="oidcSecretPlaceholder"
              class="mb-2"
              @click:append-inner="showOidcSecret = !showOidcSecret"
            />
            <v-card variant="tonal" color="surface-variant" rounded="lg" class="mb-3">
              <v-card-text class="pa-3">
                <div class="text-caption text-medium-emphasis mb-1">Redirect URI — register this in your identity provider</div>
                <div class="d-flex align-center gap-2">
                  <code class="text-body-2 flex-grow-1" style="word-break: break-all">{{ oidcCallbackUrl }}</code>
                  <v-btn
                    :icon="callbackCopied ? 'mdi-check' : 'mdi-content-copy'"
                    :color="callbackCopied ? 'success' : undefined"
                    size="x-small"
                    variant="text"
                    @click="copyCallbackUrl"
                  />
                </div>
              </v-card-text>
            </v-card>
            <v-alert v-if="oidcSaveSuccess" type="success" variant="tonal" density="compact" class="mt-2">
              SSO configuration saved.
            </v-alert>
          </v-card-text>
          <v-card-actions class="pa-4 pt-0">
            <v-spacer />
            <v-btn color="primary" :loading="savingOidc" @click="saveOidcConfig">Save</v-btn>
          </v-card-actions>
        </v-card>
      </v-col>
    </v-row>
  </div>
</template>

<script setup>
import { ref, reactive, computed, watch, onMounted } from 'vue';
import apiClient from '@/services/apiClient';
import { useAuthStore } from '@/store/auth';
import { useUiStore } from '@/store/ui';
import { useEsp32DeviceStore } from '@/store/esp32Devices';

const authStore = useAuthStore();
const uiStore = useUiStore();
const esp32Store = useEsp32DeviceStore();

const username = ref(authStore.user?.username || '');
const email = ref(authStore.user?.email || '');

// ── Scan & Scale prefs ────────────────────────────────────────────────────────
const defaultScaleId = ref(authStore.preferences.defaultScaleId ?? null);
const autoOpenOnScale = ref(authStore.preferences.autoOpenOnScale ?? true);

// Preferences may still be loading when this component mounts (async restoreSession).
// Keep local refs in sync so the selects populate once preferences arrive.
watch(() => authStore.preferences.defaultScaleId, (val) => { defaultScaleId.value = val ?? null; });
watch(() => authStore.preferences.autoOpenOnScale, (val) => { autoOpenOnScale.value = val ?? true; });

const scaleHolders = computed(() => {
  const items = [];
  for (const device of esp32Store.devices) {
    for (const holder of (device.spoolHolders ?? [])) {
      items.push({ spoolHolderId: holder.spoolHolderId, label: `${device.name} — ${holder.name}` });
    }
  }
  return items;
});

async function saveScalePrefs() {
  await authStore.updatePreferences({ defaultScaleId: defaultScaleId.value, autoOpenOnScale: autoOpenOnScale.value });
  uiStore.notify({ message: 'Scale preferences saved', type: 'success' });
}
const integrations = ref([]);
const newPassword = ref('');
const confirmPassword = ref('');
const showPw = ref(false);
const changingPw = ref(false);

// OIDC config state
const oidcForm = reactive({ enabled: false, issuer: '', clientId: '', clientSecret: '' });
const showOidcSecret = ref(false);
const oidcSecretPlaceholder = ref('');
const savingOidc = ref(false);
const oidcSaveSuccess = ref(false);
const callbackCopied = ref(false);

const oidcCallbackUrl = computed(() => `${window.location.origin}/api/v1/auth/oidc/callback`);

function copyCallbackUrl() {
  navigator.clipboard.writeText(oidcCallbackUrl.value);
  callbackCopied.value = true;
  setTimeout(() => { callbackCopied.value = false; }, 2000);
}

onMounted(async () => {
  esp32Store.fetchDevices();

  const { data } = await apiClient.get('/integrations/types');
  integrations.value = data;

  if (authStore.isAdmin) {
    try {
      const { data: cfg } = await apiClient.get('/auth/oidc-config');
      if (cfg) {
        oidcForm.enabled = cfg.enabled;
        oidcForm.issuer = cfg.issuer;
        oidcForm.clientId = cfg.clientId;
        // clientSecret always comes back masked — keep placeholder
        oidcSecretPlaceholder.value = cfg.clientSecret ? '••••••' : '';
      }
    } catch {
      // no OIDC config yet — leave form blank
    }
  }
});

async function saveProfile() {
  await apiClient.put('/users/me', { username: username.value, email: email.value });
  await authStore.fetchMe();
  uiStore.notify({ message: 'Profile updated', type: 'success' });
}

async function changePassword() {
  if (newPassword.value !== confirmPassword.value) return;
  changingPw.value = true;
  try {
    await apiClient.put('/users/me', { password: newPassword.value });
    newPassword.value = '';
    confirmPassword.value = '';
    uiStore.notify({ message: 'Password updated', type: 'success' });
  } finally {
    changingPw.value = false;
  }
}

async function uploadIntegration(event) {
  const file = event.target.files[0];
  if (!file) return;
  const formData = new FormData();
  formData.append('config', file);
  await apiClient.post('/integrations/upload-config', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  const { data } = await apiClient.get('/integrations/types');
  integrations.value = data;
  uiStore.notify({ message: 'Integration installed', type: 'success' });
}

async function saveOidcConfig() {
  savingOidc.value = true;
  oidcSaveSuccess.value = false;
  try {
    await apiClient.put('/auth/oidc-config', {
      issuer: oidcForm.issuer,
      clientId: oidcForm.clientId,
      clientSecret: oidcForm.clientSecret,
      enabled: oidcForm.enabled,
    });
    // Mask secret again after save
    oidcSecretPlaceholder.value = '••••••';
    oidcForm.clientSecret = '';
    oidcSaveSuccess.value = true;
    uiStore.notify({ message: 'SSO configuration saved', type: 'success' });
  } catch {
    uiStore.notify({ message: 'Failed to save SSO configuration', type: 'error' });
  } finally {
    savingOidc.value = false;
  }
}
</script>
