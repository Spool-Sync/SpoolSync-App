<template>
  <div>
    <div v-if="loading" class="d-flex justify-center pa-8">
      <v-progress-circular indeterminate />
    </div>

    <div v-else class="kanban-layout">

      <!-- ── Left: scrollable storage columns ─────────────────────────────── -->
      <div class="kanban-storage-area">
        <div class="kanban-board">
          <div
            v-for="col in storageColumns"
            :key="col.id"
            class="kanban-col"
            :class="{ 'kanban-col--over': dragOver === col.id && dragFrom !== col.id }"
            @dragover.prevent="dragOver = col.id"
            @dragleave.self="dragOver = null"
            @drop.prevent="onDropStorage(col.id)"
          >
            <div class="d-flex align-center px-3 py-2 kanban-col-header">
              <v-icon size="18" :color="col.color" class="mr-2">{{ col.icon }}</v-icon>
              <span class="text-subtitle-2 font-weight-bold flex-grow-1 text-truncate">{{ col.name }}</span>
              <v-chip v-if="col.zones?.length" size="x-small" class="ml-1" color="blue-grey" variant="tonal" rounded="lg" prepend-icon="mdi-label-outline">
                {{ col.zones.length }}
              </v-chip>
              <v-chip size="x-small" class="ml-1" rounded="lg">{{ col.spools.length }}</v-chip>
            </div>
            <v-divider />

            <div class="kanban-cards pa-2">

              <!-- Sectioned spools -->
              <template v-for="section in col.sections" :key="section.zoneId">
                <div class="section-header px-1 mb-1">
                  <v-icon size="12" class="mr-1" color="blue-grey">mdi-label-outline</v-icon>
                  <span class="text-caption font-weight-bold text-medium-emphasis text-uppercase">{{ section.name }}</span>
                </div>
                <div
                  v-for="spool in section.spools"
                  :key="spool.spoolId"
                  class="spool-card mb-2"
                  :class="{ 'spool-card--dragging': dragSpoolId === spool.spoolId }"
                  draggable="true"
                  @dragstart="onDragStart($event, spool, col.id)"
                  @dragend="onDragEnd"
                  @dblclick.stop="openEdit(spool)"
                >
                  <div class="spool-accent" :style="{ background: spool.filamentType?.colorHex || '#9e9e9e' }" />
                  <div class="pa-2 flex-grow-1" style="min-width: 0">
                    <div class="text-body-2 font-weight-medium text-truncate">
                      {{ spool.filamentType?.brand }} {{ spool.filamentType?.name || '(unknown)' }}
                    </div>
                    <div class="d-flex align-center mt-1 flex-wrap ga-1">
                      <v-chip v-if="spool.filamentType?.material" size="x-small" variant="tonal">
                        {{ spool.filamentType.material }}
                      </v-chip>
                      <span class="text-caption text-medium-emphasis ml-auto">
                        {{ Math.round(Math.max(0, spool.currentWeight_g - (spool.filamentType?.spoolWeight_g ?? 200))) }}g
                      </span>
                    </div>
                  </div>
                </div>
              </template>

              <!-- Unsectioned spools -->
              <template v-if="col.unsectionedSpools?.length">
                <div v-if="col.sections?.length" class="section-header px-1 mb-1 mt-1">
                  <span class="text-caption text-medium-emphasis text-uppercase">Other</span>
                </div>
                <div
                  v-for="spool in col.unsectionedSpools"
                  :key="spool.spoolId"
                  class="spool-card mb-2"
                  :class="{ 'spool-card--dragging': dragSpoolId === spool.spoolId }"
                  draggable="true"
                  @dragstart="onDragStart($event, spool, col.id)"
                  @dragend="onDragEnd"
                  @dblclick.stop="openEdit(spool)"
                >
                  <div class="spool-accent" :style="{ background: spool.filamentType?.colorHex || '#9e9e9e' }" />
                  <div class="pa-2 flex-grow-1" style="min-width: 0">
                    <div class="text-body-2 font-weight-medium text-truncate">
                      {{ spool.filamentType?.brand }} {{ spool.filamentType?.name || '(unknown)' }}
                    </div>
                    <div class="d-flex align-center mt-1 flex-wrap ga-1">
                      <v-chip v-if="spool.filamentType?.material" size="x-small" variant="tonal">
                        {{ spool.filamentType.material }}
                      </v-chip>
                      <span class="text-caption text-medium-emphasis ml-auto">
                        {{ Math.round(Math.max(0, spool.currentWeight_g - (spool.filamentType?.spoolWeight_g ?? 200))) }}g
                      </span>
                    </div>
                  </div>
                </div>
              </template>

              <div
                v-if="col.spools.length === 0"
                class="text-center text-caption text-medium-emphasis py-6"
              >
                Drop spools here
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- ── Right: pinned printer panel ──────────────────────────────────── -->
      <PrinterSidebar
        :drag-spool-id="dragSpoolId"
        :drag-from="dragFrom"
        @drop-holder="({ holder, printer }) => onDropHolder(holder, printer)"
        @spool-dragstart="({ spool, fromId }) => onDragStart(null, spool, fromId)"
        @spool-dragend="onDragEnd"
      />

    </div>

    <v-dialog v-model="showEditForm" max-width="600">
      <SpoolForm
        :spool="editingSpool"
        @saved="handleSaved"
        @cancel="showEditForm = false"
      />
    </v-dialog>

    <!-- Printing override confirmation -->
    <v-dialog v-model="printingConfirmDialog" max-width="440" persistent>
      <v-card rounded="xl">
        <v-card-title class="pa-4 d-flex align-center ga-2">
          <v-icon color="warning">mdi-alert</v-icon>
          Printer is Printing
        </v-card-title>
        <v-card-text>
          <strong>{{ pendingDropPrinterName }}</strong> is currently printing and may be actively using filament in this slot.
          Replacing filament mid-print can cause a failed print or a jam.
          <br /><br />
          Are you sure you want to proceed?
        </v-card-text>
        <v-card-actions class="pa-4 pt-0">
          <v-spacer />
          <v-btn @click="printingConfirmDialog = false">Cancel</v-btn>
          <v-btn color="warning" :loading="printingConfirmLoading" @click="confirmPrintingDrop">Override</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { useSpoolStore } from '@/store/spools';
import { useStorageLocationStore } from '@/store/storageLocations';
import { usePrinterStore } from '@/store/printers';
import { storageTypeInfo } from '@/utils/storageTypes';
import apiClient from '@/services/apiClient';
import SpoolForm from '@/components/forms/SpoolForm.vue';
import PrinterSidebar from '@/components/PrinterSidebar.vue';

const spoolStore = useSpoolStore();
const locationStore = useStorageLocationStore();
const printerStore = usePrinterStore();
const loading = ref(true);

// Edit dialog
const showEditForm = ref(false);
const editingSpool = ref(null);

function openEdit(spool) {
  editingSpool.value = spool;
  showEditForm.value = true;
}

async function handleSaved() {
  showEditForm.value = false;
  editingSpool.value = null;
  await spoolStore.fetchSpools();
}

// Drag state
const dragSpoolId = ref(null);
const dragFrom = ref(null);    // storageLocationId, '__unassigned__', or spoolHolderId
const dragOver = ref(null);

// Printing override confirmation
const printingConfirmDialog = ref(false);
const printingConfirmLoading = ref(false);
const pendingDropPrinterName = ref('');
let pendingDropAction = null;

// Optimistic location overrides: { [spoolId]: locationId | null }
const locationOverrides = ref({});

const storageColumns = computed(() => {
  const overrides = locationOverrides.value;

  const effectiveLocationId = (spool) => {
    if (spool.spoolId in overrides) return overrides[spool.spoolId];
    return spool.storageLocations?.[0]?.storageLocationId ?? null;
  };

  // Build a map from spoolId → { name, zoneId } using location zone data
  const spoolZoneMap = {};
  for (const loc of locationStore.locations) {
    for (const ls of (loc.spools ?? [])) {
      if (ls.zone) spoolZoneMap[ls.spoolId] = { name: ls.zone.name, zoneId: ls.zoneId };
    }
  }

  // Spools currently on a printer slot are shown there, not in storage
  const printerSpoolIds = new Set(
    printerStore.printers.flatMap(p =>
      (p.spoolHolders ?? []).filter(h => h.associatedSpoolId).map(h => h.associatedSpoolId)
    )
  );

  const storageSpools = spoolStore.spools
    .filter(s => !printerSpoolIds.has(s.spoolId))
    .map(s => ({ ...s, zoneInfo: spoolZoneMap[s.spoolId] ?? null }));

  const unassignedSpools = storageSpools.filter(s => effectiveLocationId(s) === null);
  const unassigned = {
    id: '__unassigned__',
    name: 'Unassigned',
    icon: 'mdi-help-circle-outline',
    color: 'grey',
    sections: [],
    unsectionedSpools: unassignedSpools,
    spools: unassignedSpools,
  };

  const locCols = locationStore.locations.map(loc => {
    const info = storageTypeInfo(loc.type);
    const colSpools = storageSpools.filter(s => effectiveLocationId(s) === loc.storageLocationId);

    // Group spools into sections; only include sections that have spools
    const sections = (loc.zones ?? [])
      .map(zone => ({
        zoneId: zone.zoneId,
        name: zone.name,
        spools: colSpools.filter(s => s.zoneInfo?.zoneId === zone.zoneId),
      }))
      .filter(s => s.spools.length > 0);

    const unsectionedSpools = colSpools.filter(s => !s.zoneInfo);

    return {
      id: loc.storageLocationId,
      name: loc.name,
      icon: info.icon,
      color: info.color,
      zones: loc.zones ?? [],
      sections,
      unsectionedSpools,
      spools: colSpools,
    };
  });

  return [unassigned, ...locCols];
});


onMounted(async () => {
  await Promise.all([
    locationStore.fetchLocations(),
    spoolStore.fetchSpools(),
    printerStore.fetchPrinters(),
    printerStore.fetchIntegrationTypes(),
  ]);
  loading.value = false;
});

function onDragStart(event, spool, fromId) {
  dragSpoolId.value = spool.spoolId;
  dragFrom.value = fromId;
  if (event) event.dataTransfer.effectAllowed = 'move';
}

function onDragEnd() {
  dragOver.value = null;
  dragSpoolId.value = null;
  dragFrom.value = null;
}

function findPrinterForHolder(holderId) {
  for (const printer of printerStore.printers) {
    for (const holder of (printer.spoolHolders ?? [])) {
      if (holder.spoolHolderId === holderId) return printer;
    }
  }
  return null;
}

// Drop onto a storage location column
async function onDropStorage(targetColumnId) {
  const spoolId = dragSpoolId.value;
  const fromId = dragFrom.value;
  dragOver.value = null;
  dragSpoolId.value = null;
  dragFrom.value = null;

  if (!spoolId || fromId === targetColumnId) return;

  const newLocationId = targetColumnId === '__unassigned__' ? null : targetColumnId;
  const isFromHolder = fromId && fromId !== '__unassigned__' && !locationStore.locations.find(l => l.storageLocationId === fromId);

  // If dragging off a printing printer's slot, ask for confirmation first
  if (isFromHolder) {
    const sourcePrinter = findPrinterForHolder(fromId);
    if (sourcePrinter?.status === 'PRINTING') {
      pendingDropPrinterName.value = sourcePrinter.name;
      pendingDropAction = async (force) => {
        await apiClient.delete(`/printers/holders/${fromId}/assign-spool`, { params: { force: force ? '1' : undefined } });
        await printerStore.fetchPrinters();
        await spoolStore.updateSpool(spoolId, { storageLocationId: newLocationId });
        await spoolStore.fetchSpools();
      };
      printingConfirmDialog.value = true;
      return;
    }
  }

  // Normal (non-printing) path
  if (isFromHolder) {
    try {
      await apiClient.delete(`/printers/holders/${fromId}/assign-spool`);
      await printerStore.fetchPrinters();
    } catch { /* ignore */ }
  }

  locationOverrides.value = { ...locationOverrides.value, [spoolId]: newLocationId };
  try {
    await spoolStore.updateSpool(spoolId, { storageLocationId: newLocationId });
  } catch {
    // Revert on error
  } finally {
    const overrides = { ...locationOverrides.value };
    delete overrides[spoolId];
    locationOverrides.value = overrides;
  }
}

// Drop onto a printer spool holder slot
async function onDropHolder(holder, printer) {
  const spoolId = dragSpoolId.value;
  dragOver.value = null;
  dragSpoolId.value = null;
  dragFrom.value = null;

  if (!spoolId) return;
  if (holder.associatedSpoolId === spoolId) return; // already there

  // Printers with filament_reload feature always use staging; others assign directly
  if (printer.features?.includes('filament_reload')) {
    try {
      await printerStore.stageSpool(holder.spoolHolderId, spoolId);
    } catch { /* ignore */ }
    return;
  }

  if (printer.status === 'PRINTING') {
    pendingDropPrinterName.value = printer.name;
    pendingDropAction = async (force) => {
      await apiClient.put(`/printers/holders/${holder.spoolHolderId}/assign-spool`, { spoolId, force });
      await printerStore.fetchPrinters();
      await spoolStore.fetchSpools();
    };
    printingConfirmDialog.value = true;
    return;
  }

  try {
    await apiClient.put(`/printers/holders/${holder.spoolHolderId}/assign-spool`, { spoolId });
    await printerStore.fetchPrinters();
    await spoolStore.fetchSpools();
  } catch { /* ignore */ }
}

async function confirmPrintingDrop() {
  if (!pendingDropAction) return;
  printingConfirmLoading.value = true;
  try {
    await pendingDropAction(true);
  } finally {
    printingConfirmLoading.value = false;
    printingConfirmDialog.value = false;
    pendingDropAction = null;
  }
}
</script>

<style scoped>
/* ── Layout ──────────────────────────────────────────────────────────────── */
.kanban-layout {
  display: flex;
  gap: 16px;
  align-items: flex-start;
  overflow: hidden;
}

.kanban-storage-area {
  flex: 1;
  overflow-x: auto;
  overflow-y: visible;
  padding-bottom: 1rem;
}

.kanban-board {
  display: flex;
  gap: 12px;
  min-width: min-content;
  align-items: flex-start;
}

/* ── Storage columns ─────────────────────────────────────────────────────── */
.kanban-col {
  width: 260px;
  min-width: 260px;
  background: rgba(var(--v-theme-surface-variant), 0.4);
  border-radius: 12px;
  border: 2px solid transparent;
  transition: border-color 0.15s, background-color 0.15s;
}

.kanban-col--over {
  border-color: rgb(var(--v-theme-primary));
  background: rgba(var(--v-theme-primary), 0.06);
}

.kanban-col-header {
  border-radius: 10px 10px 0 0;
}

.kanban-cards {
  position: relative;
  min-height: 80px;
  max-height: calc(100vh - 280px);
  overflow-y: auto;
}

/* ── Section headers ─────────────────────────────────────────────────────── */
.section-header {
  display: flex;
  align-items: center;
  letter-spacing: 0.06em;
  opacity: 0.75;
}

/* ── Spool cards ─────────────────────────────────────────────────────────── */
.spool-card {
  display: flex;
  align-items: stretch;
  background: rgb(var(--v-theme-surface));
  border-radius: 8px;
  cursor: grab;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.08);
  overflow: hidden;
  transition: box-shadow 0.15s, opacity 0.15s;
  user-select: none;
}

.spool-card:hover {
  box-shadow: 0 3px 8px rgba(0, 0, 0, 0.14);
}

.spool-card:active {
  cursor: grabbing;
}

.spool-card--dragging {
  opacity: 0.4;
}

.spool-accent {
  width: 5px;
  flex-shrink: 0;
}

/* ── Kanban card list animations (storage columns) ───────────────────────── */
.kanban-card-move {
  transition: transform 0.35s ease;
}

.kanban-card-enter-active {
  transition: all 0.3s ease;
}

.kanban-card-leave-active {
  transition: all 0.25s ease;
  position: absolute;
  left: 8px;
  right: 8px;
  width: auto;
}

.kanban-card-enter-from,
.kanban-card-leave-to {
  opacity: 0;
  transform: scale(0.95) translateY(-6px);
}

</style>
