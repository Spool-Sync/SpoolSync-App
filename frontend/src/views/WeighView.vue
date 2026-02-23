<template>
  <div style="max-width: 520px; margin: 0 auto">
    <div class="d-flex align-center mb-4">
      <h1 class="text-h5 font-weight-bold">Weigh Spool</h1>
    </div>

    <!-- ── Step 1: Identify spool ─────────────────────────────────────────── -->
    <v-card rounded="xl" class="mb-4">
      <v-card-title class="pa-4 pb-2 d-flex align-center ga-2">
        <v-icon :color="spoolStepColor">mdi-nfc</v-icon>
        Identify Spool
        <v-chip v-if="spool" size="x-small" color="success" variant="tonal" class="ml-auto">Found</v-chip>
        <v-chip v-else-if="unknownTag" size="x-small" color="warning" variant="tonal" class="ml-auto">Unknown tag</v-chip>
      </v-card-title>
      <v-divider />
      <v-card-text>

        <v-alert v-if="!nfcSupported" type="info" variant="tonal" density="compact" class="mb-3" icon="mdi-information-outline">
          Web NFC is only supported in Chrome on Android. Search for a spool below.
        </v-alert>

        <!-- NFC scan button -->
        <div v-if="nfcSupported" class="d-flex align-center ga-2 mb-3">
          <v-btn
            :color="nfcScanning ? 'warning' : 'primary'"
            :prepend-icon="nfcScanning ? 'mdi-stop' : 'mdi-nfc-tap'"
            :loading="nfcStarting"
            variant="tonal"
            @click="nfcScanning ? stopNfc() : startNfc()"
          >
            {{ nfcScanning ? 'Stop Scanning' : 'Scan NFC Tag' }}
          </v-btn>
          <div v-if="nfcScanning" class="d-flex align-center ga-1 text-caption text-medium-emphasis">
            <v-progress-circular indeterminate size="14" width="2" />
            Hold tag to phone…
          </div>
        </div>

        <!-- Spool search fallback -->
        <v-autocomplete
          v-if="!spool"
          v-model="selectedSpoolId"
          :items="spoolItems"
          item-title="label"
          item-value="spoolId"
          label="Or search spool by name"
          prepend-inner-icon="mdi-magnify"
          variant="outlined"
          density="compact"
          clearable
          hide-details
          class="mb-1"
          @update:modelValue="onSpoolSelect"
        />

        <!-- Spool info row -->
        <div v-if="spool" class="d-flex align-center ga-3 mt-1">
          <v-avatar size="36" :style="{ backgroundColor: spool.filamentType?.colorHex || '#aaa' }" />
          <div>
            <div class="text-body-1 font-weight-bold">
              {{ spool.filamentType?.brand }} {{ spool.filamentType?.name }}
            </div>
            <div class="d-flex align-center ga-1 mt-1">
              <v-chip size="x-small" variant="tonal">{{ spool.filamentType?.material }}</v-chip>
              <span class="text-caption text-medium-emphasis">
                {{ spool.filamentType?.color }} ·
                current: {{ Math.round(Math.max(0, spool.currentWeight_g - (spool.filamentType?.spoolWeight_g ?? 200))) }}g
              </span>
            </div>
          </div>
          <v-btn icon="mdi-close" size="small" variant="text" class="ml-auto" @click="clearSpool" />
        </div>

        <!-- Unknown tag — offer to link -->
        <div v-if="unknownTag && !spool">
          <v-alert type="warning" variant="tonal" density="compact" class="mb-3">
            Tag <code>{{ unknownTag }}</code> is not linked to any spool.
          </v-alert>
          <div class="d-flex align-center ga-2">
            <v-autocomplete
              v-model="linkTargetSpoolId"
              :items="spoolItems"
              item-title="label"
              item-value="spoolId"
              label="Link this tag to a spool"
              variant="outlined"
              density="compact"
              clearable
              hide-details
              class="flex-grow-1"
            />
            <v-btn color="primary" :loading="linkingTag" :disabled="!linkTargetSpoolId" @click="linkTag">
              Link
            </v-btn>
          </div>
        </div>

      </v-card-text>
    </v-card>

    <!-- ── Step 2: Scale source ───────────────────────────────────────────── -->
    <v-card rounded="xl" class="mb-4" :disabled="!spool">
      <v-card-title class="pa-4 pb-2 d-flex align-center ga-2">
        <v-icon :color="scaleStepColor">mdi-scale</v-icon>
        Weight
      </v-card-title>
      <v-divider />
      <v-card-text>

        <!-- Source toggle -->
        <v-btn-toggle v-model="scaleSource" rounded="lg" density="compact" class="mb-4" mandatory>
          <v-btn value="esp32" prepend-icon="mdi-chip" size="small">ESP32 Device</v-btn>
          <v-btn value="ble" prepend-icon="mdi-bluetooth" size="small" :disabled="!btSupported">Bluetooth Scale</v-btn>
          <v-btn value="manual" prepend-icon="mdi-pencil" size="small">Manual</v-btn>
        </v-btn-toggle>

        <!-- ── ESP32 source ── -->
        <template v-if="scaleSource === 'esp32'">
          <div v-if="esp32Channels.length === 0" class="text-caption text-medium-emphasis mb-3">
            No ESP32 devices with channels found.
            <router-link to="/esp32-devices" class="text-primary">Configure devices →</router-link>
          </div>
          <v-select
            v-else
            v-model="selectedChannelId"
            :items="esp32Channels"
            item-title="label"
            item-value="spoolHolderId"
            label="Select device channel"
            prepend-inner-icon="mdi-chip"
            variant="outlined"
            density="compact"
            hide-details
            class="mb-4"
          />
          <div v-if="selectedChannelId && esp32LiveWeight !== null" class="text-center py-2 mb-2">
            <div class="text-h3 font-weight-bold" :class="weightColor(esp32LiveWeight)">
              {{ esp32LiveWeight }}g
            </div>
            <div class="text-caption text-medium-emphasis">live · gross weight</div>
          </div>
          <div v-else-if="selectedChannelId" class="text-center text-medium-emphasis py-4 text-caption">
            Waiting for reading…
          </div>
        </template>

        <!-- ── Bluetooth source ── -->
        <template v-else-if="scaleSource === 'ble'">
          <div class="d-flex align-center ga-2 mb-4">
            <v-btn
              v-if="!btConnected"
              prepend-icon="mdi-bluetooth"
              variant="tonal"
              :loading="btConnecting"
              :disabled="!spool"
              @click="connectScale"
            >
              Connect Scale
            </v-btn>
            <template v-else>
              <v-btn prepend-icon="mdi-bluetooth-off" variant="tonal" color="error" @click="disconnectScale">
                Disconnect
              </v-btn>
              <span class="text-caption text-medium-emphasis">{{ btDeviceName }}</span>
            </template>
          </div>
          <div v-if="btConnected" class="text-center py-2 mb-2">
            <div class="text-h3 font-weight-bold" :class="weightColor(btLiveWeight)">
              {{ btLiveWeight !== null ? `${btLiveWeight}g` : '—' }}
            </div>
            <div class="text-caption text-medium-emphasis">live · gross weight</div>
          </div>
        </template>

        <!-- ── Manual ── (also shown as override when live source is active) -->
        <v-text-field
          v-model.number="manualWeight_g"
          :label="scaleSource === 'manual' ? 'Gross weight (g)' : 'Override weight (g)'"
          :hint="scaleSource !== 'manual' ? 'Leave empty to use live reading' : 'Total weight including spool'"
          type="number"
          min="0"
          variant="outlined"
          density="compact"
          suffix="g"
          class="mt-2"
        />

        <!-- Net weight preview -->
        <div v-if="effectiveWeight !== null && spool" class="mt-1 text-caption text-medium-emphasis">
          Net filament:
          <strong>{{ Math.round(Math.max(0, effectiveWeight - (spool.filamentType?.spoolWeight_g ?? 200))) }}g</strong>
          (subtracting {{ spool.filamentType?.spoolWeight_g ?? 200 }}g spool)
        </div>

      </v-card-text>
    </v-card>

    <!-- ── Save ───────────────────────────────────────────────────────────── -->
    <v-btn
      block
      size="large"
      color="primary"
      rounded="xl"
      :disabled="!spool || effectiveWeight === null"
      :loading="saving"
      prepend-icon="mdi-content-save"
      @click="saveWeight"
    >
      Update Weight
    </v-btn>

    <v-alert
      v-if="saveResult"
      :type="saveResult.type"
      variant="tonal"
      density="compact"
      class="mt-4"
      closable
      @click:close="saveResult = null"
    >
      {{ saveResult.message }}
    </v-alert>
  </div>
</template>

<script setup>
import { ref, computed, onUnmounted, watch } from 'vue';
import apiClient from '@/services/apiClient';
import { useSpoolStore } from '@/store/spools';
import { useEsp32DeviceStore } from '@/store/esp32Devices';
import { useSpoolHolderStore } from '@/store/spoolHolders';

const spoolStore = useSpoolStore();
const esp32Store = useEsp32DeviceStore();
const holderStore = useSpoolHolderStore();

// ── Spool identification ──────────────────────────────────────────────────────
const spool = ref(null);
const unknownTag = ref(null);
const selectedSpoolId = ref(null);
const linkTargetSpoolId = ref(null);
const linkingTag = ref(false);

spoolStore.fetchSpools();
esp32Store.fetchDevices();
// Fetch all spool holders so we have currentWeight_g live via WS
holderStore.fetchSpoolHolders();

const spoolItems = computed(() =>
  spoolStore.spools.map(s => ({
    spoolId: s.spoolId,
    label: [
      s.filamentType?.brand,
      s.filamentType?.name,
      s.filamentType?.color ? `· ${s.filamentType.color}` : '',
      `(${Math.round(Math.max(0, s.currentWeight_g - (s.filamentType?.spoolWeight_g ?? 200)))}g)`,
    ].filter(Boolean).join(' '),
  }))
);

async function lookupByTag(tagId) {
  unknownTag.value = null;
  spool.value = null;
  try {
    const { data } = await apiClient.get(`/spools/by-nfc/${encodeURIComponent(tagId)}`);
    spool.value = data;
  } catch (err) {
    if (err.response?.status === 404) unknownTag.value = tagId;
  }
}

function onSpoolSelect(spoolId) {
  spool.value = spoolId ? (spoolStore.spools.find(s => s.spoolId === spoolId) ?? null) : null;
}

async function linkTag() {
  if (!unknownTag.value || !linkTargetSpoolId.value) return;
  linkingTag.value = true;
  try {
    const { data } = await apiClient.post(`/spools/${linkTargetSpoolId.value}/link-nfc`, {
      nfcTagId: unknownTag.value,
    });
    spool.value = data;
    unknownTag.value = null;
    linkTargetSpoolId.value = null;
  } finally {
    linkingTag.value = false;
  }
}

function clearSpool() {
  spool.value = null;
  unknownTag.value = null;
  selectedSpoolId.value = null;
  manualWeight_g.value = null;
}

// ── NFC ───────────────────────────────────────────────────────────────────────
const nfcSupported = ref('NDEFReader' in window);
const nfcScanning = ref(false);
const nfcStarting = ref(false);
let nfcAbort = null;

async function startNfc() {
  nfcStarting.value = true;
  try {
    nfcAbort = new AbortController();
    const reader = new window.NDEFReader();
    reader.addEventListener('reading', ({ message }) => {
      const tagId = extractTagText(message);
      if (tagId) lookupByTag(tagId);
    });
    await reader.scan({ signal: nfcAbort.signal });
    nfcScanning.value = true;
  } catch {
    nfcScanning.value = false;
  } finally {
    nfcStarting.value = false;
  }
}

function stopNfc() {
  nfcAbort?.abort();
  nfcScanning.value = false;
}

function extractTagText(message) {
  for (const record of message.records) {
    if (record.recordType === 'text') {
      return new TextDecoder(record.encoding || 'utf-8').decode(record.data).trim();
    }
    if (record.recordType === 'url') {
      return new TextDecoder().decode(record.data).split('/').pop().trim();
    }
  }
  return null;
}

// ── ESP32 scale source ────────────────────────────────────────────────────────
const selectedChannelId = ref(null);

// Flatten all spool holders from ESP32 devices into a select-friendly list
const esp32Channels = computed(() => {
  const items = [];
  for (const device of esp32Store.devices) {
    for (const holder of (device.spoolHolders ?? [])) {
      items.push({
        spoolHolderId: holder.spoolHolderId,
        label: `${device.name} — ${holder.name}`,
      });
    }
  }
  return items;
});

// Live weight from the selected ESP32 channel — reads from holderStore which
// is kept up to date by the global WebSocket (spool:update / holder:updated)
const esp32LiveWeight = computed(() => {
  if (!selectedChannelId.value) return null;
  const holder = holderStore.holders.find(h => h.spoolHolderId === selectedChannelId.value);
  return holder?.currentWeight_g ?? null;
});

// Auto-select first channel when devices load (if nothing selected yet)
watch(esp32Channels, (channels) => {
  if (!selectedChannelId.value && channels.length > 0) {
    selectedChannelId.value = channels[0].spoolHolderId;
  }
}, { immediate: true });

// ── Bluetooth scale source ────────────────────────────────────────────────────
const WEIGHT_SCALE_SERVICE    = 0x181D;
const WEIGHT_MEASUREMENT_CHAR = 0x2A9D;

const btSupported = ref('bluetooth' in navigator);
const btConnecting = ref(false);
const btConnected = ref(false);
const btDeviceName = ref('');
const btLiveWeight = ref(null);
let btDevice = null;
let btChar = null;

async function connectScale() {
  btConnecting.value = true;
  try {
    btDevice = await navigator.bluetooth.requestDevice({
      filters: [{ services: [WEIGHT_SCALE_SERVICE] }],
      optionalServices: [WEIGHT_SCALE_SERVICE],
    });
    btDevice.addEventListener('gattserverdisconnected', onBtDisconnected);
    const server  = await btDevice.gatt.connect();
    const service = await server.getPrimaryService(WEIGHT_SCALE_SERVICE);
    btChar = await service.getCharacteristic(WEIGHT_MEASUREMENT_CHAR);
    btChar.addEventListener('characteristicvaluechanged', onWeightReading);
    await btChar.startNotifications();
    btConnected.value = true;
    btDeviceName.value = btDevice.name || 'Scale';
  } catch {
    // user cancelled or unsupported device
  } finally {
    btConnecting.value = false;
  }
}

function onWeightReading(event) {
  const data  = event.target.value;
  const flags = data.getUint8(0);
  const unit  = flags & 0x01;            // 0 = kg (SI), 1 = lb
  const raw   = data.getUint16(1, true); // little-endian
  btLiveWeight.value = unit === 0
    ? Math.round(raw * 5)                      // SI: 0.005 kg/unit → ×5 for grams
    : Math.round(raw * 0.01 * 453.592);        // imperial: 0.01 lb/unit → grams
}

function onBtDisconnected() {
  btConnected.value = false;
  btDeviceName.value = '';
  btLiveWeight.value = null;
}

async function disconnectScale() {
  try { await btChar?.stopNotifications(); } catch { /* ignore */ }
  btDevice?.gatt?.disconnect();
  btConnected.value = false;
  btDeviceName.value = '';
  btLiveWeight.value = null;
}

// ── Scale source selection ────────────────────────────────────────────────────
// Default to esp32 if devices exist, otherwise manual
const scaleSource = ref(esp32Channels.value.length > 0 ? 'esp32' : 'manual');
watch(esp32Channels, (ch) => {
  if (scaleSource.value === 'manual' && ch.length > 0) scaleSource.value = 'esp32';
});

// ── Effective weight ──────────────────────────────────────────────────────────
const manualWeight_g = ref(null);

const effectiveWeight = computed(() => {
  // Manual entry always wins when filled in
  if (manualWeight_g.value !== null && manualWeight_g.value !== '') return Number(manualWeight_g.value);
  if (scaleSource.value === 'esp32') return esp32LiveWeight.value;
  if (scaleSource.value === 'ble')   return btLiveWeight.value;
  return null;
});

function weightColor(weight_g) {
  if (!spool.value || weight_g === null) return 'text-medium-emphasis';
  const sw   = spool.value.filamentType?.spoolWeight_g ?? 200;
  const init = Math.max(0, spool.value.initialWeight_g - sw);
  const pct  = init > 0 ? ((weight_g - sw) / init) * 100 : 100;
  return pct > 50 ? 'text-success' : pct > 20 ? 'text-warning' : 'text-error';
}

// ── Save ──────────────────────────────────────────────────────────────────────
const saving = ref(false);
const saveResult = ref(null);

async function saveWeight() {
  if (!spool.value || effectiveWeight.value === null) return;
  saving.value = true;
  saveResult.value = null;
  try {
    await apiClient.put(`/spools/${spool.value.spoolId}/update-weight`, {
      weight_g: effectiveWeight.value,
    });
    saveResult.value = { type: 'success', message: `Weight updated to ${effectiveWeight.value}g.` };
    spool.value = { ...spool.value, currentWeight_g: effectiveWeight.value };
    manualWeight_g.value = null;
  } catch {
    saveResult.value = { type: 'error', message: 'Failed to update weight. Please try again.' };
  } finally {
    saving.value = false;
  }
}

// ── Step indicator colours ────────────────────────────────────────────────────
const spoolStepColor = computed(() => spool.value ? 'success' : unknownTag.value ? 'warning' : 'primary');
const scaleStepColor = computed(() => {
  if (scaleSource.value === 'esp32' && esp32LiveWeight.value !== null) return 'success';
  if (scaleSource.value === 'ble' && btConnected.value) return 'success';
  return 'grey';
});

// ── Cleanup ───────────────────────────────────────────────────────────────────
onUnmounted(() => {
  stopNfc();
  disconnectScale();
});
</script>
