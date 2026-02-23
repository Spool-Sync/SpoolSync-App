<template>
  <v-card rounded="xl">
    <v-card-title class="pa-4">{{ holder ? 'Edit Spool Holder' : 'Add Spool Holder' }}</v-card-title>
    <v-card-text>
      <v-form @submit.prevent="handleSubmit">
        <v-text-field
          v-model="formData.name"
          label="Name"
          variant="outlined"
          density="compact"
          class="mb-2"
          required
        />

        <v-select
          v-model="formData.assignmentType"
          :items="assignmentOptions"
          label="Assignment Type"
          variant="outlined"
          density="compact"
          class="mb-2"
        />

        <v-select
          v-if="formData.assignmentType === 'PRINTER'"
          v-model="formData.attachedPrinterId"
          :items="printers"
          item-title="name"
          item-value="printerId"
          label="Printer"
          variant="outlined"
          density="compact"
          clearable
          class="mb-2"
        />

        <v-select
          v-if="formData.assignmentType === 'STORAGE'"
          v-model="formData.storageLocationId"
          :items="storageLocations"
          item-title="name"
          item-value="storageLocationId"
          label="Storage Location"
          variant="outlined"
          density="compact"
          clearable
          class="mb-2"
        />

        <v-select
          v-model="formData.type"
          :items="typeOptions"
          label="Holder Type"
          variant="outlined"
          density="compact"
          class="mb-2"
        />

        <template v-if="formData.type === 'ACTIVE'">
          <!-- ESP32 device picker -->
          <v-select
            v-model="formData.esp32DeviceId"
            :items="esp32Devices"
            item-title="name"
            item-value="deviceId"
            label="ESP32 Device"
            variant="outlined"
            density="compact"
            clearable
            class="mb-3"
            @update:model-value="onDeviceChange"
          />

          <!-- ── Detected channel pickers ─────────────────────────────── -->
          <template v-if="formData.esp32DeviceId && hasDetectedChannels">
            <div class="text-caption text-medium-emphasis mb-2 d-flex align-center gap-1">
              <v-icon size="14">mdi-magnify-scan</v-icon>
              Channels detected via I²C scan
            </div>

            <!-- Load cell channel -->
            <v-select
              v-model="formData.channel"
              :items="detectedLoadCellOptions"
              label="Load Cell Channel"
              variant="outlined"
              density="compact"
              clearable
              class="mb-2"
              :hint="formData.channel !== null ? `Channel ${formData.channel} will report weight` : ''"
              persistent-hint
              @update:model-value="(v) => { formData.hasLoadCell = v !== null }"
            />

            <!-- NFC channel -->
            <v-select
              v-model="formData.nfcReaderChannel"
              :items="detectedNfcOptions"
              label="NFC Channel"
              variant="outlined"
              density="compact"
              clearable
              class="mb-2"
              @update:model-value="(v) => { formData.hasNfc = v !== null }"
            />

            <v-alert
              v-if="!detectedLoadCellOptions.length && !detectedNfcOptions.length"
              type="info"
              variant="tonal"
              density="compact"
              class="mb-2"
            >
              No I²C channels detected yet — the device will report them on the next report cycle.
            </v-alert>
          </template>

          <!-- ── Manual fallback (no detected channels or no device selected) ── -->
          <template v-else>
            <v-text-field
              v-model.number="formData.channel"
              label="Channel Number"
              type="number"
              variant="outlined"
              density="compact"
              class="mb-2"
            />

            <v-switch
              v-model="formData.hasLoadCell"
              label="Has Load Cell"
              color="primary"
              density="compact"
              class="mb-1"
            />

            <v-switch
              v-model="formData.hasNfc"
              label="Has NFC Reader"
              color="primary"
              density="compact"
              class="mb-1"
            />

            <v-text-field
              v-if="formData.hasNfc"
              v-model.number="formData.nfcReaderChannel"
              label="NFC Reader Channel"
              type="number"
              variant="outlined"
              density="compact"
              class="mb-2"
            />
          </template>

          <!-- Calibration fields — always shown when a load cell channel is set -->
          <template v-if="formData.hasLoadCell">
            <v-row dense class="mt-1">
              <v-col cols="6">
                <v-text-field
                  v-model.number="formData.loadCellOffset"
                  label="Load Cell Offset"
                  type="number"
                  variant="outlined"
                  density="compact"
                />
              </v-col>
              <v-col cols="6">
                <v-text-field
                  v-model.number="formData.loadCellScale"
                  label="Load Cell Scale (g/unit)"
                  type="number"
                  variant="outlined"
                  density="compact"
                />
              </v-col>
            </v-row>
          </template>
        </template>

        <v-select
          v-model="formData.associatedSpoolId"
          :items="spools"
          :item-title="spoolLabel"
          item-value="spoolId"
          label="Associated Spool (optional)"
          variant="outlined"
          density="compact"
          clearable
          class="mb-2"
        />
      </v-form>
    </v-card-text>
    <v-card-actions class="pa-4 pt-0">
      <v-spacer />
      <v-btn @click="$emit('cancel')">Cancel</v-btn>
      <v-btn color="primary" :loading="saving" @click="handleSubmit">Save</v-btn>
    </v-card-actions>
  </v-card>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue';
import { useSpoolHolderStore } from '@/store/spoolHolders';
import apiClient from '@/services/apiClient';

const props = defineProps({
  holder: { type: Object, default: null },
  initialDeviceId: { type: String, default: null },
  initialChannel: { type: Number, default: null },
  initialCapability: { type: String, default: null }, // 'LOAD_CELL' | 'NFC'
});
const emit = defineEmits(['saved', 'cancel']);

const spoolHolderStore = useSpoolHolderStore();
const saving = ref(false);

const printers = ref([]);
const storageLocations = ref([]);
const esp32Devices = ref([]);
const spools = ref([]);

const assignmentOptions = [
  { title: 'Printer', value: 'PRINTER' },
  { title: 'Storage Location', value: 'STORAGE' },
  { title: 'Ingest Point', value: 'INGEST_POINT' },
];

const typeOptions = [
  { title: 'Active (has sensors)', value: 'ACTIVE' },
  { title: 'Passive (no sensors)', value: 'PASSIVE' },
];

const formData = reactive({
  name: props.holder?.name || '',
  assignmentType: props.holder?.assignmentType || 'INGEST_POINT',
  type: props.holder?.type || (props.initialDeviceId ? 'ACTIVE' : 'PASSIVE'),
  attachedPrinterId: props.holder?.attachedPrinterId || null,
  storageLocationId: props.holder?.storageLocationId || null,
  esp32DeviceId: props.holder?.esp32DeviceId || props.initialDeviceId || null,
  channel: props.holder?.channel ?? (props.initialCapability === 'LOAD_CELL' ? props.initialChannel : null),
  hasLoadCell: props.holder?.hasLoadCell || props.initialCapability === 'LOAD_CELL',
  loadCellOffset: props.holder?.loadCellOffset ?? null,
  loadCellScale: props.holder?.loadCellScale ?? null,
  hasNfc: props.holder?.hasNfc || props.initialCapability === 'NFC',
  nfcReaderChannel: props.holder?.nfcReaderChannel ?? (props.initialCapability === 'NFC' ? props.initialChannel : null),
  associatedSpoolId: props.holder?.associatedSpoolId || null,
});

// ── Detected channel helpers ───────────────────────────────────────────────────

const selectedDevice = computed(() =>
  esp32Devices.value.find((d) => d.deviceId === formData.esp32DeviceId)
);

const detectedChannels = computed(() => selectedDevice.value?.detectedChannels ?? []);

const hasDetectedChannels = computed(() => detectedChannels.value.length > 0);

function channelLabel(ch) {
  const addr = ch.i2cAddress !== null ? `0x${ch.i2cAddress.toString(16).toUpperCase()}` : 'GPIO';
  return ch.capability === 'LOAD_CELL'
    ? `ch${ch.suggestedChannel} — ${ch.deviceType} ${addr} (sub-ch ${ch.subChannel})`
    : `NFC ch${ch.suggestedChannel} — ${ch.deviceType} ${addr}`;
}

const detectedLoadCellOptions = computed(() =>
  detectedChannels.value
    .filter((ch) => ch.capability === 'LOAD_CELL' && ch.suggestedChannel !== null)
    .map((ch) => ({ title: channelLabel(ch), value: ch.suggestedChannel }))
);

const detectedNfcOptions = computed(() =>
  detectedChannels.value
    .filter((ch) => ch.capability === 'NFC' && ch.suggestedChannel !== null)
    .map((ch) => ({ title: channelLabel(ch), value: ch.suggestedChannel }))
);

function onDeviceChange() {
  // Reset channel selections when device changes
  formData.channel = null;
  formData.hasLoadCell = false;
  formData.nfcReaderChannel = null;
  formData.hasNfc = false;
}

// ── Misc ──────────────────────────────────────────────────────────────────────

function spoolLabel(spool) {
  if (!spool?.filamentType) return spool?.spoolId || '';
  return `${spool.filamentType.brand} ${spool.filamentType.name} (${spool.filamentType.color || 'Standard'})`;
}

onMounted(async () => {
  const [printersRes, storageRes, esp32Res, spoolsRes] = await Promise.all([
    apiClient.get('/printers'),
    apiClient.get('/storage-locations'),
    apiClient.get('/esp32-devices'),
    apiClient.get('/spools'),
  ]);
  printers.value = printersRes.data;
  storageLocations.value = storageRes.data;
  esp32Devices.value = esp32Res.data;
  spools.value = spoolsRes.data;
});

async function handleSubmit() {
  saving.value = true;
  try {
    const payload = { ...formData };
    if (payload.type === 'PASSIVE') {
      payload.esp32DeviceId = null;
      payload.channel = null;
      payload.hasLoadCell = false;
      payload.loadCellOffset = null;
      payload.loadCellScale = null;
      payload.hasNfc = false;
      payload.nfcReaderChannel = null;
    }
    if (!payload.hasLoadCell) {
      payload.loadCellOffset = null;
      payload.loadCellScale = null;
    }
    if (!payload.hasNfc) payload.nfcReaderChannel = null;
    if (payload.assignmentType !== 'PRINTER') payload.attachedPrinterId = null;
    if (payload.assignmentType !== 'STORAGE') payload.storageLocationId = null;

    if (props.holder) {
      await spoolHolderStore.updateHolder(props.holder.spoolHolderId, payload);
    } else {
      await spoolHolderStore.createHolder(payload);
    }
    emit('saved');
  } finally {
    saving.value = false;
  }
}
</script>
