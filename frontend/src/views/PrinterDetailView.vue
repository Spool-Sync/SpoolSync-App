<template>
  <div>
    <div class="d-flex align-center mb-4">
      <v-btn icon="mdi-arrow-left" variant="text" @click="$router.back()" />
      <h1 class="text-h5 font-weight-bold ml-2">{{ printer?.name ?? 'Printer Detail' }}</h1>
      <v-spacer />
      <v-btn
        variant="tonal"
        prepend-icon="mdi-sync"
        :loading="syncing"
        @click="handleSync"
      >
        Sync Status
      </v-btn>
    </div>

    <template v-if="printer">
      <v-row>
        <!-- Left: Status card + print job history -->
        <v-col cols="12" md="4">
          <PrinterStatusCard :printer="printer" class="mb-4" />

          <!-- Print Job History -->
          <v-card rounded="xl">
            <v-card-title class="pa-4 pb-2 text-subtitle-1 font-weight-bold">Print History</v-card-title>
            <v-card-text v-if="groupedPrintJobs.length === 0" class="text-center text-medium-emphasis py-4">
              No print jobs recorded yet
            </v-card-text>
            <v-list v-else density="compact">
              <template v-for="group in groupedPrintJobs" :key="group.key">
                <v-list-item :subtitle="formatJobDate(group.completedAt)">
                  <template #title>
                    <span class="text-body-2 font-weight-bold">
                      {{ group.fileName ?? 'Unknown file' }}
                    </span>
                  </template>
                  <template #append>
                    <span class="text-caption text-medium-emphasis">
                      {{ Math.round(group.totalUsed_g) }}g total
                    </span>
                  </template>
                </v-list-item>
                <!-- Per-filament breakdown -->
                <v-list-item
                  v-for="job in group.jobs"
                  :key="job.printJobId"
                  class="pl-8"
                  density="compact"
                >
                  <template #prepend>
                    <div
                      class="rounded-circle mr-2 flex-shrink-0"
                      :style="{
                        width: '10px', height: '10px',
                        background: job.spool?.filamentType?.colorHex || '#aaa',
                      }"
                    />
                  </template>
                  <template #title>
                    <span class="text-caption">
                      {{ job.spool?.filamentType?.brand }} {{ job.spool?.filamentType?.name ?? 'Unknown spool' }}
                    </span>
                  </template>
                  <template #append>
                    <v-chip v-if="job.filamentUsed_g != null" size="x-small" color="orange" variant="tonal">
                      {{ Math.round(job.filamentUsed_g) }}g
                    </v-chip>
                  </template>
                </v-list-item>
                <v-divider class="my-1" />
              </template>
            </v-list>
          </v-card>
        </v-col>

        <!-- Right: Spool holder slots -->
        <v-col cols="12" md="8">
          <v-card rounded="xl" class="mb-4">
            <v-card-title class="pa-4 pb-2 d-flex align-center">
              <span class="text-subtitle-1 font-weight-bold">Spool Holder Slots</span>
              <v-spacer />
              <div class="d-flex align-center ga-2">
                <v-text-field
                  v-model.number="holderCount"
                  type="number"
                  density="compact"
                  variant="outlined"
                  hide-details
                  style="width: 80px"
                  min="0"
                  max="16"
                />
                <v-btn
                  size="small"
                  color="primary"
                  variant="tonal"
                  :loading="settingCount"
                  @click="applyHolderCount"
                >
                  Set
                </v-btn>
              </div>
            </v-card-title>
            <v-divider />
            <v-card-text v-if="printer.spoolHolders.length === 0" class="text-center text-medium-emphasis py-8">
              Set the number of spool holders above to get started
            </v-card-text>
            <div v-else class="pa-3">
              <v-card
                v-for="holder in [...(printer.spoolHolders ?? [])].sort((a, b) => a.createdAt < b.createdAt ? -1 : 1)"
                :key="holder.spoolHolderId"
                variant="outlined"
                rounded="lg"
                class="mb-3"
              >
                <div class="d-flex align-center pa-3 ga-3">
                  <!-- Color swatch for loaded spool -->
                  <div
                    class="rounded-circle flex-shrink-0"
                    :style="{
                      width: '36px', height: '36px',
                      background: holder.associatedSpool?.filamentType?.colorHex || 'rgba(var(--v-border-color), 0.15)',
                      border: '2px solid rgba(var(--v-border-color), 0.2)',
                    }"
                  />

                  <!-- Holder info -->
                  <div class="flex-grow-1" style="min-width: 0">
                    <div class="text-body-2 font-weight-medium">{{ holder.name }}</div>
                    <div v-if="holder.associatedSpool" class="text-caption text-medium-emphasis">
                      {{ holder.associatedSpool.filamentType?.brand }}
                      {{ holder.associatedSpool.filamentType?.name }}
                      <span v-if="holder.currentWeight_g != null">
                        · {{ Math.round(Math.max(0, holder.currentWeight_g - (holder.associatedSpool.filamentType?.spoolWeight_g ?? 200))) }}g filament
                      </span>
                    </div>
                    <div v-else class="text-caption text-medium-emphasis">Empty</div>

                    <!-- ESP32 link -->
                    <div v-if="holder.esp32Device" class="text-caption text-blue-darken-2 mt-1">
                      <v-icon size="12" class="mr-1">mdi-chip</v-icon>
                      {{ holder.esp32Device.name }} · Ch {{ holder.channel ?? '?' }}
                    </div>
                  </div>

                  <!-- Actions -->
                  <div class="d-flex flex-column ga-1">
                    <template v-if="holder.associatedSpool">
                      <!-- Replace: swap to a different spool without unloading first -->
                      <v-tooltip location="left" text="Replace spool">
                        <template #activator="{ props: tip }">
                          <v-btn
                            v-bind="tip"
                            size="x-small"
                            variant="tonal"
                            color="primary"
                            icon="mdi-swap-horizontal"
                            @click="openAssignDialog(holder)"
                          />
                        </template>
                      </v-tooltip>
                      <!-- Unload -->
                      <v-tooltip location="left" text="Unload spool">
                        <template #activator="{ props: tip }">
                          <v-btn
                            v-bind="tip"
                            size="x-small"
                            variant="tonal"
                            color="error"
                            icon="mdi-tray-minus"
                            @click="handleRemoveSpool(holder)"
                          />
                        </template>
                      </v-tooltip>
                    </template>
                    <v-tooltip v-else location="left" text="Load spool">
                      <template #activator="{ props: tip }">
                        <v-btn
                          v-bind="tip"
                          size="x-small"
                          variant="tonal"
                          color="primary"
                          icon="mdi-tray-plus"
                          @click="openAssignDialog(holder)"
                        />
                      </template>
                    </v-tooltip>
                    <v-btn
                      size="x-small"
                      variant="tonal"
                      icon="mdi-cog"
                      @click="openConfigDialog(holder)"
                    />
                  </div>
                </div>
              </v-card>
            </div>
          </v-card>
        </v-col>
      </v-row>
    </template>

    <v-overlay v-else :model-value="loading" class="align-center justify-center">
      <v-progress-circular indeterminate size="64" />
    </v-overlay>

    <!-- Assign spool dialog -->
    <v-dialog v-model="assignDialog" max-width="480">
      <v-card rounded="xl">
        <v-card-title class="pa-4">{{ assignTarget?.associatedSpool ? 'Replace Spool in' : 'Load Spool onto' }} {{ assignTarget?.name }}</v-card-title>
        <v-card-text>
          <v-select
            v-model="assignSpoolId"
            :items="availableSpools"
            item-title="label"
            item-value="spoolId"
            label="Select Spool"
            variant="outlined"
            density="compact"
          />
        </v-card-text>
        <v-card-actions class="pa-4 pt-0">
          <v-spacer />
          <v-btn @click="assignDialog = false">Cancel</v-btn>
          <v-btn color="primary" :disabled="!assignSpoolId" :loading="assigning" @click="confirmAssign">Load</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Printing override confirmation dialog -->
    <v-dialog v-model="printingConfirmDialog" max-width="440" persistent>
      <v-card rounded="xl">
        <v-card-title class="pa-4 d-flex align-center ga-2">
          <v-icon color="warning">mdi-alert</v-icon>
          Printer is Printing
        </v-card-title>
        <v-card-text>
          <strong>{{ printer?.name }}</strong> is currently printing and may be actively using filament in this slot.
          Changing filament mid-print can cause a failed print or a jam.
          <br /><br />
          Are you sure you want to proceed?
        </v-card-text>
        <v-card-actions class="pa-4 pt-0">
          <v-spacer />
          <v-btn @click="printingConfirmDialog = false">Cancel</v-btn>
          <v-btn color="warning" :loading="printingConfirmLoading" @click="confirmPrintingOverride">Override</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Configure holder dialog -->
    <v-dialog v-model="configDialog" max-width="480">
      <v-card rounded="xl" v-if="configTarget">
        <v-card-title class="pa-4">Configure {{ configTarget.name }}</v-card-title>
        <v-card-text>
          <v-select
            v-model="configForm.type"
            :items="['ACTIVE', 'PASSIVE']"
            label="Holder Type"
            variant="outlined"
            density="compact"
            class="mb-2"
          />
          <template v-if="configForm.type === 'ACTIVE'">
            <v-select
              v-model="configForm.esp32DeviceId"
              :items="esp32Devices"
              item-title="name"
              item-value="deviceId"
              label="ESP32 Device"
              variant="outlined"
              density="compact"
              clearable
              class="mb-2"
            />
            <v-row dense>
              <v-col cols="6">
                <v-text-field
                  v-model.number="configForm.channel"
                  label="Load Cell Channel"
                  type="number"
                  variant="outlined"
                  density="compact"
                  class="mb-2"
                />
              </v-col>
              <v-col cols="6">
                <v-text-field
                  v-model.number="configForm.nfcReaderChannel"
                  label="NFC Channel"
                  type="number"
                  variant="outlined"
                  density="compact"
                  class="mb-2"
                />
              </v-col>
            </v-row>
            <v-switch v-model="configForm.hasLoadCell" label="Has Load Cell" density="compact" />
            <v-switch v-model="configForm.hasNfc" label="Has NFC Reader" density="compact" />
          </template>
        </v-card-text>
        <v-card-actions class="pa-4 pt-0">
          <v-spacer />
          <v-btn @click="configDialog = false">Cancel</v-btn>
          <v-btn color="primary" :loading="configuring" @click="confirmConfig">Save</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import { useRoute } from 'vue-router';
import PrinterStatusCard from '@/components/cards/PrinterStatusCard.vue';
import { usePrinterStore } from '@/store/printers';
import { useSpoolStore } from '@/store/spools';
import apiClient from '@/services/apiClient';

const route = useRoute();
const printerStore = usePrinterStore();
const spoolStore = useSpoolStore();

const printer = ref(null);
const loading = ref(true);
const syncing = ref(false);
const printJobs = ref([]);
const holderCount = ref(0);
const settingCount = ref(false);

const assignDialog = ref(false);
const assignTarget = ref(null);
const assignSpoolId = ref(null);
const assigning = ref(false);

// Printing-override confirmation
const printingConfirmDialog = ref(false);
const printingConfirmLoading = ref(false);
let pendingOverrideAction = null;

const configDialog = ref(false);
const configTarget = ref(null);
const configuring = ref(false);
const configForm = ref({});

const esp32Devices = ref([]);

onMounted(async () => {
  const [printerData, jobs, spoolsData, devicesData] = await Promise.all([
    printerStore.fetchPrinter(route.params.printerId),
    printerStore.fetchPrintJobs(route.params.printerId),
    spoolStore.fetchSpools(),
    apiClient.get('/esp32-devices'),
  ]);
  printer.value = printerData;
  printJobs.value = jobs;
  holderCount.value = printerData.spoolHolders.length;
  esp32Devices.value = devicesData.data;
  loading.value = false;
});

const availableSpools = computed(() =>
  spoolStore.spools.map((s) => ({
    spoolId: s.spoolId,
    label: `${s.filamentType?.brand ?? ''} ${s.filamentType?.name ?? ''} · ${s.filamentType?.color ?? 'Standard'}`.trim(),
  }))
);

// Group print jobs by file name + start time so multi-spool prints appear together.
const groupedPrintJobs = computed(() => {
  const groups = new Map();
  for (const job of printJobs.value) {
    // Round start time to the nearest minute to group concurrent spool records.
    const roundedStart = job.startedAt
      ? new Date(Math.round(new Date(job.startedAt).getTime() / 60000) * 60000).toISOString()
      : 'unknown';
    const key = `${job.fileName ?? ''}::${roundedStart}`;
    if (!groups.has(key)) {
      groups.set(key, {
        key,
        fileName: job.fileName,
        completedAt: job.completedAt,
        jobs: [],
        totalUsed_g: 0,
      });
    }
    const g = groups.get(key);
    g.jobs.push(job);
    g.totalUsed_g += job.filamentUsed_g ?? 0;
    // Use the latest completedAt for the group header.
    if (job.completedAt > g.completedAt) g.completedAt = job.completedAt;
  }
  return [...groups.values()];
});

async function handleSync() {
  syncing.value = true;
  printer.value = await printerStore.syncStatus(route.params.printerId);
  syncing.value = false;
}

async function applyHolderCount() {
  settingCount.value = true;
  printer.value = await printerStore.setSpoolHolderCount(route.params.printerId, holderCount.value);
  holderCount.value = printer.value.spoolHolders.length;
  settingCount.value = false;
}

function openAssignDialog(holder) {
  assignTarget.value = holder;
  assignSpoolId.value = null;
  assignDialog.value = true;
}

async function confirmAssign() {
  if (!assignSpoolId.value) return;

  // If the printer is currently printing, ask for confirmation first
  if (printer.value?.status === 'PRINTING') {
    pendingOverrideAction = async () => {
      printer.value = await printerStore.assignSpool(assignTarget.value.spoolHolderId, assignSpoolId.value, true);
      assignDialog.value = false;
    };
    assignDialog.value = false;
    printingConfirmDialog.value = true;
    return;
  }

  assigning.value = true;
  printer.value = await printerStore.assignSpool(assignTarget.value.spoolHolderId, assignSpoolId.value);
  assignDialog.value = false;
  assigning.value = false;
}

async function handleRemoveSpool(holder) {
  if (printer.value?.status === 'PRINTING') {
    pendingOverrideAction = async () => {
      printer.value = await printerStore.removeSpool(holder.spoolHolderId, true);
    };
    printingConfirmDialog.value = true;
    return;
  }
  printer.value = await printerStore.removeSpool(holder.spoolHolderId);
}

async function confirmPrintingOverride() {
  if (!pendingOverrideAction) return;
  printingConfirmLoading.value = true;
  try {
    await pendingOverrideAction();
  } finally {
    printingConfirmLoading.value = false;
    printingConfirmDialog.value = false;
    pendingOverrideAction = null;
  }
}

function openConfigDialog(holder) {
  configTarget.value = holder;
  configForm.value = {
    type: holder.type,
    esp32DeviceId: holder.esp32Device?.deviceId ?? null,
    channel: holder.channel ?? null,
    nfcReaderChannel: holder.nfcReaderChannel ?? null,
    hasLoadCell: holder.hasLoadCell,
    hasNfc: holder.hasNfc,
  };
  configDialog.value = true;
}

async function confirmConfig() {
  configuring.value = true;
  await printerStore.configureHolder(configTarget.value.spoolHolderId, configForm.value);
  printer.value = await printerStore.fetchPrinter(route.params.printerId);
  configDialog.value = false;
  configuring.value = false;
}

function formatJobDate(iso) {
  return new Date(iso).toLocaleString();
}
</script>
