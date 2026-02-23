<template>
  <div>
    <div class="d-flex align-center mb-4">
      <v-btn icon="mdi-arrow-left" variant="text" @click="$router.back()" />
      <h1 class="text-h5 font-weight-bold ml-2">{{ holder?.name || 'Spool Holder' }}</h1>
      <v-spacer />
      <v-btn color="primary" variant="tonal" prepend-icon="mdi-pencil" @click="showEdit = true">Edit</v-btn>
    </div>

    <v-overlay v-if="loading" :model-value="true" class="align-center justify-center">
      <v-progress-circular indeterminate size="64" />
    </v-overlay>

    <v-row v-if="holder">
      <!-- Holder Info Card -->
      <v-col cols="12" md="4">
        <v-card rounded="xl" class="mb-4">
          <v-card-title class="pa-4 pb-2">Holder Info</v-card-title>
          <v-card-text>
            <div class="d-flex flex-column gap-2">
              <div>
                <span class="text-caption text-medium-emphasis">Type</span>
                <div>
                  <v-chip size="small" :color="holder.type === 'ACTIVE' ? 'success' : 'default'" variant="tonal">
                    {{ holder.type }}
                  </v-chip>
                </div>
              </div>
              <div>
                <span class="text-caption text-medium-emphasis">Assignment</span>
                <div>
                  <v-chip
                    size="small"
                    :color="assignmentColor(holder.assignmentType)"
                    :prepend-icon="assignmentIcon(holder.assignmentType)"
                    variant="tonal"
                  >
                    {{ assignmentLabel(holder.assignmentType) }}
                  </v-chip>
                </div>
              </div>
              <div v-if="holder.attachedPrinter">
                <span class="text-caption text-medium-emphasis">Printer</span>
                <div class="text-body-2">{{ holder.attachedPrinter.name }}</div>
              </div>
              <div v-if="holder.storageLocation">
                <span class="text-caption text-medium-emphasis">Storage Location</span>
                <div class="text-body-2">{{ holder.storageLocation.name }}</div>
              </div>
            </div>
          </v-card-text>
        </v-card>
      </v-col>

      <!-- Live Weight Card -->
      <v-col cols="12" md="4">
        <v-card rounded="xl" class="mb-4">
          <v-card-title class="pa-4 pb-2">
            <v-icon class="mr-2">mdi-scale</v-icon>
            Current Weight
          </v-card-title>
          <v-card-text class="text-center">
            <div v-if="holder.hasLoadCell">
              <div class="text-h3 font-weight-bold">
                {{ liveWeight !== null ? Math.round(Math.max(0, liveWeight - (holder.associatedSpool?.filamentType?.spoolWeight_g ?? 200))) : '—' }}
                <span class="text-h6 text-medium-emphasis">g filament</span>
              </div>
              <div v-if="liveWeight !== null" class="text-caption text-medium-emphasis mt-1">
                {{ Math.round(liveWeight) }}g gross · {{ holder.associatedSpool?.filamentType?.spoolWeight_g ?? 200 }}g spool core
              </div>
              <div v-if="holder.associatedSpool" class="text-caption text-medium-emphasis mt-1">
                Initial: {{ Math.round(Math.max(0, holder.associatedSpool.initialWeight_g - (holder.associatedSpool.filamentType?.spoolWeight_g ?? 200))) }}g filament
              </div>
            </div>
            <div v-else class="text-medium-emphasis py-4">No load cell on this holder</div>
          </v-card-text>
        </v-card>
      </v-col>

      <!-- Associated Spool Card (not shown for ingest points) -->
      <v-col v-if="holder.assignmentType !== 'INGEST_POINT'" cols="12" md="4">
        <v-card rounded="xl" class="mb-4">
          <v-card-title class="pa-4 pb-2">Associated Spool</v-card-title>
          <v-card-text>
            <div v-if="holder.associatedSpool">
              <div class="d-flex align-center mb-2">
                <v-avatar
                  size="24"
                  :style="{ backgroundColor: holder.associatedSpool.filamentType?.colorHex || '#aaa' }"
                  class="mr-2"
                />
                <span class="font-weight-medium">
                  {{ holder.associatedSpool.filamentType?.brand }}
                  {{ holder.associatedSpool.filamentType?.name }}
                </span>
              </div>
              <v-chip size="small" variant="tonal" class="mb-2">
                {{ holder.associatedSpool.filamentType?.material }}
              </v-chip>
              <div>
                <v-btn
                  variant="tonal"
                  size="small"
                  :to="`/spools/${holder.associatedSpool.spoolId}`"
                  prepend-icon="mdi-open-in-app"
                >
                  View Spool
                </v-btn>
              </div>
            </div>
            <div v-else class="text-medium-emphasis">No spool associated</div>
          </v-card-text>
        </v-card>
      </v-col>

      <!-- Calibration Card -->
      <v-col v-if="holder.hasLoadCell" cols="12" md="6">
        <v-card rounded="xl" class="mb-4">
          <v-card-title class="pa-4 pb-2">
            <v-icon class="mr-2">mdi-tune</v-icon>
            Load Cell Calibration
          </v-card-title>
          <v-card-text class="pa-4 pt-0">

            <!-- Live raw ADC -->
            <v-sheet rounded="lg" color="surface-variant" class="pa-3 mb-4">
              <div class="text-caption text-medium-emphasis mb-1">Live Raw ADC</div>
              <div class="text-h6 font-weight-bold" style="font-family: monospace">
                {{ liveRawAdc !== null ? liveRawAdc.toLocaleString() : '—' }}
              </div>
              <div class="text-caption text-medium-emphasis">Updates with each sensor report</div>
            </v-sheet>

            <!-- Step 1: Zero -->
            <div class="text-subtitle-2 mb-1">Step 1 — Zero</div>
            <div class="text-body-2 text-medium-emphasis mb-2">
              Remove the spool. With only the empty holder on the scale, click Zero.
            </div>
            <v-btn
              color="secondary"
              variant="tonal"
              prepend-icon="mdi-target"
              :loading="zeroing"
              :disabled="liveRawAdc === null"
              class="mb-4"
              @click="doZero"
            >
              Zero&nbsp;
              <span v-if="liveRawAdc !== null" class="text-caption opacity-70">
                (set offset = {{ liveRawAdc.toLocaleString() }})
              </span>
            </v-btn>

            <v-divider class="mb-4" />

            <!-- Step 2: Scale -->
            <div class="text-subtitle-2 mb-1">Step 2 — Set Scale</div>
            <div class="text-body-2 text-medium-emphasis mb-2">
              Place a spool of known weight, enter that weight below, then click Calculate.
            </div>
            <div class="d-flex align-center gap-2">
              <v-text-field
                v-model.number="knownWeight"
                label="Known weight"
                type="number"
                suffix="g"
                variant="outlined"
                density="compact"
                style="max-width: 160px"
                hide-details
              />
              <v-btn
                color="primary"
                variant="tonal"
                prepend-icon="mdi-calculator"
                :loading="scaling"
                :disabled="!knownWeight || liveRawAdc === null || holder.loadCellOffset === null"
                @click="doSetScale"
              >
                Calculate &amp; Apply
              </v-btn>
            </div>
            <div v-if="holder.loadCellOffset === null" class="text-caption text-warning mt-1">
              Complete Step 1 first.
            </div>

            <v-divider class="my-4" />

            <!-- Current calibration summary -->
            <div class="text-caption text-medium-emphasis">
              Offset: <strong>{{ holder.loadCellOffset?.toLocaleString() ?? 'not set' }}</strong>
              &nbsp;·&nbsp;
              Scale: <strong>{{ holder.loadCellScale ?? 'not set' }}</strong> raw/g
            </div>
          </v-card-text>
        </v-card>
      </v-col>

      <!-- ESP32 Info Card -->
      <v-col v-if="holder.esp32Device" cols="12" md="6">
        <v-card rounded="xl" class="mb-4">
          <v-card-title class="pa-4 pb-2">
            <v-icon class="mr-2">mdi-chip</v-icon>
            ESP32 Device
          </v-card-title>
          <v-card-text>
            <div class="d-flex flex-column gap-1">
              <div>
                <span class="text-caption text-medium-emphasis">Name</span>
                <div class="text-body-2">{{ holder.esp32Device.name }}</div>
              </div>
              <div>
                <span class="text-caption text-medium-emphasis">Device ID</span>
                <div class="text-body-2 text-mono">{{ holder.esp32Device.uniqueDeviceId }}</div>
              </div>
              <div v-if="holder.esp32Device.ipAddress">
                <span class="text-caption text-medium-emphasis">IP Address</span>
                <div class="text-body-2">{{ holder.esp32Device.ipAddress }}</div>
              </div>
              <div v-if="holder.esp32Device.lastSeen">
                <span class="text-caption text-medium-emphasis">Last Seen</span>
                <div class="text-body-2">{{ new Date(holder.esp32Device.lastSeen).toLocaleString() }}</div>
              </div>
              <div>
                <span class="text-caption text-medium-emphasis">Channel</span>
                <div class="text-body-2">{{ holder.channel ?? '—' }}</div>
              </div>
            </div>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>

    <v-dialog v-model="showEdit" max-width="600">
      <SpoolHolderForm :holder="holder" @saved="handleSaved" @cancel="showEdit = false" />
    </v-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue';
import { useRoute } from 'vue-router';
import SpoolHolderForm from '@/components/forms/SpoolHolderForm.vue';
import { useSpoolHolderStore } from '@/store/spoolHolders';

const route = useRoute();
const spoolHolderStore = useSpoolHolderStore();
const holder = ref(null);
const loading = ref(true);
const showEdit = ref(false);
const liveWeight = ref(null);
const liveRawAdc = ref(null);
const zeroing = ref(false);
const scaling = ref(false);
const knownWeight = ref(null);

onMounted(async () => {
  holder.value = await spoolHolderStore.fetchHolder(route.params.spoolHolderId);
  liveWeight.value = holder.value.currentWeight_g ?? null;
  liveRawAdc.value = holder.value.lastRawAdc ?? null;
  loading.value = false;
});

// Listen for real-time sensor updates via the store
const unwatch = spoolHolderStore.$subscribe((_mutation, state) => {
  const updated = state.holders.find((h) => h.spoolHolderId === route.params.spoolHolderId);
  if (!updated) return;
  if (updated.currentWeight_g !== undefined) liveWeight.value = updated.currentWeight_g;
  if (updated.lastRawAdc !== undefined) liveRawAdc.value = updated.lastRawAdc;
});

onUnmounted(() => unwatch());

async function handleSaved() {
  showEdit.value = false;
  holder.value = await spoolHolderStore.fetchHolder(route.params.spoolHolderId);
  liveRawAdc.value = holder.value.lastRawAdc ?? liveRawAdc.value;
}

async function doZero() {
  zeroing.value = true;
  try {
    const updated = await spoolHolderStore.calibrate(route.params.spoolHolderId, {
      offset: liveRawAdc.value,
    });
    holder.value = { ...holder.value, ...updated };
  } finally {
    zeroing.value = false;
  }
}

async function doSetScale() {
  if (!knownWeight.value || liveRawAdc.value === null || holder.value.loadCellOffset === null) return;
  const scale = (liveRawAdc.value - holder.value.loadCellOffset) / knownWeight.value;
  scaling.value = true;
  try {
    const updated = await spoolHolderStore.calibrate(route.params.spoolHolderId, { scale });
    holder.value = { ...holder.value, ...updated };
  } finally {
    scaling.value = false;
  }
}

function assignmentColor(type) {
  const map = { PRINTER: 'blue', STORAGE: 'green', INGEST_POINT: 'orange' };
  return map[type] || 'default';
}

function assignmentIcon(type) {
  const map = { PRINTER: 'mdi-printer-3d', STORAGE: 'mdi-archive', INGEST_POINT: 'mdi-tray-arrow-down' };
  return map[type] || 'mdi-help';
}

function assignmentLabel(type) {
  const map = { PRINTER: 'Printer', STORAGE: 'Storage', INGEST_POINT: 'Ingest Point' };
  return map[type] || type;
}
</script>
