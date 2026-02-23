<template>
  <div v-if="device">
    <!-- Header -->
    <div class="d-flex align-center mb-4">
      <v-btn icon="mdi-arrow-left" variant="text" class="mr-2" @click="$router.push('/esp32-devices')" />
      <h1 class="text-h5 font-weight-bold">{{ device.name }}</h1>
      <v-spacer />
      <v-btn color="primary" prepend-icon="mdi-plus" @click="openAddChannel(null)">
        Add Channel Manually
      </v-btn>
    </div>

    <!-- Device info -->
    <v-card rounded="lg" class="mb-4">
      <v-card-text>
        <v-row dense>
          <v-col cols="12" sm="4">
            <div class="text-caption text-medium-emphasis">Unique Device ID</div>
            <div class="text-body-2 font-weight-medium" style="font-family: monospace">{{ device.uniqueDeviceId }}</div>
          </v-col>
          <v-col cols="12" sm="2">
            <div class="text-caption text-medium-emphasis">IP Address</div>
            <div class="text-body-2">{{ device.ipAddress || '—' }}</div>
          </v-col>
          <v-col cols="12" sm="3">
            <div class="text-caption text-medium-emphasis">Last Seen</div>
            <div class="text-body-2">{{ device.lastSeen ? new Date(device.lastSeen).toLocaleString() : '—' }}</div>
          </v-col>
          <v-col cols="12" sm="3" class="d-flex align-end justify-end">
            <v-btn variant="tonal" size="small" prepend-icon="mdi-pencil"
              @click="editingName = device.name; showRename = true">
              Rename
            </v-btn>
          </v-col>
        </v-row>
      </v-card-text>
    </v-card>

    <!-- Detected Hardware -->
    <template v-if="device.detectedChannels?.length">
      <div class="text-subtitle-1 font-weight-bold mb-2 d-flex align-center">
        <v-icon class="mr-1" size="18">mdi-magnify-scan</v-icon>
        Detected Hardware
        <v-chip size="x-small" class="ml-2" color="success" variant="tonal">Auto-detected via I²C</v-chip>
      </div>

      <v-row dense class="mb-4">
        <v-col
          v-for="ch in device.detectedChannels"
          :key="`${ch.i2cAddress}-${ch.subChannel}`"
          cols="12" sm="6" md="4"
        >
          <v-card rounded="lg" variant="outlined" :color="capabilityColor(ch.capability)">
            <v-card-text class="pa-3">
              <div class="d-flex align-center mb-2">
                <v-icon :color="capabilityColor(ch.capability)" size="20" class="mr-1">
                  {{ capabilityIcon(ch.capability) }}
                </v-icon>
                <span class="text-body-2 font-weight-bold">
                  {{ ch.deviceType }}
                  <span class="text-caption text-medium-emphasis ml-1">
                  {{ ch.i2cAddress !== null ? '0x' + ch.i2cAddress.toString(16).toUpperCase() : 'GPIO' }}
                </span>
                </span>
                <v-spacer />
                <v-chip size="x-small" :color="capabilityColor(ch.capability)" variant="tonal">
                  {{ capabilityLabel(ch.capability) }}
                </v-chip>
              </div>

              <div class="text-caption text-medium-emphasis mb-2">
                Sub-channel {{ ch.subChannel }}
                <template v-if="ch.suggestedChannel !== null">
                  · Suggested {{ ch.capability === 'NFC' ? 'NFC' : '' }} ch {{ ch.suggestedChannel }}
                </template>
              </div>

              <!-- Already configured? -->
              <template v-if="linkedHolder(ch)">
                <v-chip
                  size="small"
                  color="success"
                  variant="tonal"
                  prepend-icon="mdi-check"
                  :to="`/spool-holders/${linkedHolder(ch).spoolHolderId}`"
                >
                  {{ linkedHolder(ch).name }}
                </v-chip>
              </template>
              <v-btn
                v-else-if="ch.suggestedChannel !== null"
                size="small"
                color="primary"
                variant="tonal"
                prepend-icon="mdi-cog"
                @click="openAddChannel(ch)"
              >
                Configure
              </v-btn>
              <v-chip v-else size="small" variant="tonal" color="warning">Unknown device</v-chip>
            </v-card-text>
          </v-card>
        </v-col>
      </v-row>
    </template>

    <!-- Scan ran but found nothing -->
    <v-alert
      v-else-if="Array.isArray(device.detectedChannels) && device.detectedChannels.length === 0"
      type="warning" variant="tonal" class="mb-4" density="compact"
    >
      I²C scan completed but no devices were found. Check that SDA/SCL are connected (default GPIO 21/22)
      and that pull-up resistors are in place. The next report cycle will re-scan.
    </v-alert>

    <!-- Never received a scan yet -->
    <v-alert v-else-if="device.detectedChannels === null || device.detectedChannels === undefined"
      type="info" variant="tonal" class="mb-4" density="compact">
      No I²C scan data yet. The device will report its hardware on the next report cycle.
    </v-alert>

    <!-- Configured Channels -->
    <div class="text-subtitle-1 font-weight-bold mb-2">
      <v-icon class="mr-1" size="18">mdi-format-list-bulleted</v-icon>
      Configured Channels
    </div>

    <v-data-table
      :headers="channelHeaders"
      :items="channels"
      :loading="channelsLoading"
      item-value="spoolHolderId"
      rounded="lg"
      no-data-text="No channels configured yet."
    >
      <template #item.channel="{ item }">
        <v-chip size="small" color="primary" variant="tonal">ch {{ item.channel ?? '—' }}</v-chip>
      </template>
      <template #item.sensors="{ item }">
        <v-chip v-if="item.hasLoadCell" size="small" class="mr-1" prepend-icon="mdi-weight">Load Cell</v-chip>
        <v-chip v-if="item.hasNfc" size="small" prepend-icon="mdi-nfc">NFC ch {{ item.nfcReaderChannel ?? '?' }}</v-chip>
        <span v-if="!item.hasLoadCell && !item.hasNfc" class="text-medium-emphasis">—</span>
      </template>
      <template #item.currentWeight_g="{ item }">
        {{ item.currentWeight_g != null ? Math.round(item.currentWeight_g) + ' g' : '—' }}
      </template>
      <template #item.associatedSpool="{ item }">
        <router-link v-if="item.associatedSpool" :to="`/spools/${item.associatedSpool.spoolId}`"
          class="text-decoration-none">
          <v-chip size="small" variant="tonal">
            {{ item.associatedSpool.filamentType?.brand }} {{ item.associatedSpool.filamentType?.name }}
          </v-chip>
        </router-link>
        <span v-else class="text-medium-emphasis">—</span>
      </template>
      <template #item.actions="{ item }">
        <v-btn icon="mdi-open-in-new" size="small" variant="text" :to="`/spool-holders/${item.spoolHolderId}`" />
      </template>
    </v-data-table>

    <!-- Rename dialog -->
    <v-dialog v-model="showRename" max-width="360">
      <v-card rounded="xl">
        <v-card-title class="pa-4">Rename Device</v-card-title>
        <v-card-text>
          <v-text-field v-model="editingName" label="Name" variant="outlined" density="compact" autofocus
            @keyup.enter="saveRename" />
        </v-card-text>
        <v-card-actions class="pa-4 pt-0">
          <v-spacer />
          <v-btn @click="showRename = false">Cancel</v-btn>
          <v-btn color="primary" :loading="saving" @click="saveRename">Save</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Add / Configure channel dialog -->
    <v-dialog v-model="showAddChannel" max-width="600">
      <SpoolHolderForm
        :initial-device-id="device.deviceId"
        :initial-channel="pendingDetectedChannel?.suggestedChannel ?? null"
        :initial-capability="pendingDetectedChannel?.capability ?? null"
        @saved="onChannelSaved"
        @cancel="showAddChannel = false"
      />
    </v-dialog>
  </div>

  <div v-else-if="notFound" class="text-center py-12 text-medium-emphasis">
    Device not found.
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import { useEsp32DeviceStore } from '@/store/esp32Devices';
import { useSpoolHolderStore } from '@/store/spoolHolders';
import SpoolHolderForm from '@/components/forms/SpoolHolderForm.vue';

const route = useRoute();
const deviceStore = useEsp32DeviceStore();
const holderStore = useSpoolHolderStore();

const device = ref(null);
const channels = ref([]);
const channelsLoading = ref(false);
const notFound = ref(false);
const showRename = ref(false);
const showAddChannel = ref(false);
const pendingDetectedChannel = ref(null);
const editingName = ref('');
const saving = ref(false);

const channelHeaders = [
  { title: 'Channel', key: 'channel', sortable: true },
  { title: 'Name', key: 'name', sortable: true },
  { title: 'Sensors', key: 'sensors', sortable: false },
  { title: 'Weight', key: 'currentWeight_g', sortable: false },
  { title: 'Associated Spool', key: 'associatedSpool', sortable: false },
  { title: '', key: 'actions', sortable: false, align: 'end' },
];

// Match a detected channel to an existing SpoolHolder
function linkedHolder(detectedCh) {
  if (detectedCh.capability === 'LOAD_CELL') {
    return channels.value.find((h) => h.channel === detectedCh.suggestedChannel && h.hasLoadCell);
  }
  if (detectedCh.capability === 'NFC') {
    return channels.value.find((h) => h.nfcReaderChannel === detectedCh.suggestedChannel && h.hasNfc);
  }
  return null;
}

function capabilityColor(cap) {
  return cap === 'LOAD_CELL' ? 'primary' : cap === 'NFC' ? 'secondary' : 'warning';
}

function capabilityIcon(cap) {
  return cap === 'LOAD_CELL' ? 'mdi-weight' : cap === 'NFC' ? 'mdi-nfc' : 'mdi-help-circle';
}

function capabilityLabel(cap) {
  return cap === 'LOAD_CELL' ? 'Load Cell' : cap === 'NFC' ? 'NFC' : cap;
}

function openAddChannel(detectedCh) {
  pendingDetectedChannel.value = detectedCh;
  showAddChannel.value = true;
}

async function load() {
  try {
    device.value = await deviceStore.fetchDevice(route.params.deviceId);
    await loadChannels();
  } catch {
    notFound.value = true;
  }
}

async function loadChannels() {
  channelsLoading.value = true;
  try {
    await holderStore.fetchSpoolHolders({ esp32DeviceId: route.params.deviceId });
    channels.value = holderStore.holders;
  } finally {
    channelsLoading.value = false;
  }
}

async function saveRename() {
  saving.value = true;
  try {
    await deviceStore.updateDevice(device.value.deviceId, { name: editingName.value });
    device.value.name = editingName.value;
    showRename.value = false;
  } finally {
    saving.value = false;
  }
}

async function onChannelSaved() {
  showAddChannel.value = false;
  pendingDetectedChannel.value = null;
  await loadChannels();
}

onMounted(load);
</script>
