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
      <div v-if="sortedPrinters.length" class="kanban-printer-panel">
        <div class="d-flex align-center px-1 pb-2">
          <v-icon size="16" color="blue" class="mr-1">mdi-printer-3d</v-icon>
          <span class="text-caption font-weight-bold text-medium-emphasis">PRINTERS</span>
        </div>

        <div
          v-for="printer in sortedPrinters"
          :key="printer.printerId"
          class="printer-card mb-3"
        >
          <div class="d-flex align-center px-3 py-2 printer-card-header">
            <span class="text-subtitle-2 font-weight-bold flex-grow-1 text-truncate">{{ printer.name }}</span>
            <PrinterStatusChip :status="printer.status" :printer-type="printer.type" size="x-small" class="ml-2" />
          </div>
          <v-divider />

          <div class="pa-2">
            <template v-if="printer.spoolHolders?.length">
              <div
                v-for="holder in [...(printer.spoolHolders ?? [])].sort((a, b) => a.createdAt < b.createdAt ? -1 : 1)"
                :key="holder.spoolHolderId"
                class="holder-slot mb-2"
                :class="{
                  'holder-slot--over': dragOver === holder.spoolHolderId && !!dragSpoolId && printer.status !== 'PRINTING',
                  'holder-slot--occupied': !!holder.associatedSpoolId,
                  'holder-slot--locked': printer.status === 'PRINTING',
                }"
                @dragover.prevent="printer.status !== 'PRINTING' && (dragOver = holder.spoolHolderId)"
                @dragleave.self="dragOver = null"
                @drop.prevent="printer.status !== 'PRINTING' && onDropHolder(holder)"
              >
                <div class="d-flex align-center px-2 py-1">
                  <v-icon v-if="printer.status === 'PRINTING'" size="14" class="mr-1 text-warning">mdi-lock</v-icon>
                  <v-icon v-else size="14" class="mr-1 text-medium-emphasis">mdi-tray</v-icon>
                  <span class="text-caption font-weight-medium text-medium-emphasis">{{ holder.name }}</span>
                </div>

                <Transition name="holder-spool">
                  <div
                    v-if="holder.associatedSpool"
                    class="spool-card mx-1 mb-1"
                    :class="{ 'spool-card--dragging': dragSpoolId === holder.associatedSpool.spoolId }"
                    draggable="true"
                    @dragstart="onDragStart($event, holder.associatedSpool, holder.spoolHolderId)"
                    @dragend="onDragEnd"
                    @dblclick.stop="openEdit(holder.associatedSpool)"
                  >
                    <div class="spool-accent" :style="{ background: holder.associatedSpool.filamentType?.colorHex || '#9e9e9e' }" />
                    <div class="pa-2 flex-grow-1" style="min-width: 0">
                      <div class="text-caption font-weight-medium text-truncate">
                        {{ holder.associatedSpool.filamentType?.brand }} {{ holder.associatedSpool.filamentType?.name || '(unknown)' }}
                      </div>
                      <div class="text-caption text-medium-emphasis">
                        {{ Math.round(Math.max(0, (holder.currentWeight_g ?? holder.associatedSpool.currentWeight_g) - (holder.associatedSpool.filamentType?.spoolWeight_g ?? 200))) }}g filament
                      </div>
                    </div>
                  </div>
                </Transition>

                <div v-if="!holder.associatedSpool" class="text-center text-caption text-medium-emphasis py-3">
                  Drop spool here
                </div>
              </div>
            </template>
            <div v-else class="text-center text-caption text-medium-emphasis py-4">
              No holders configured<br>
              <router-link :to="`/printers/${printer.printerId}`" class="text-primary">Configure →</router-link>
            </div>
          </div>
        </div>
      </div>

    </div>

    <v-dialog v-model="showEditForm" max-width="600">
      <SpoolForm
        :spool="editingSpool"
        @saved="handleSaved"
        @cancel="showEditForm = false"
      />
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
import PrinterStatusChip from '@/components/PrinterStatusChip.vue';

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

// Optimistic location overrides: { [spoolId]: locationId | null }
const locationOverrides = ref({});

// Printer status sort order
const PRINTER_STATUS_ORDER = { OPERATIONAL: 0, PRINTING: 1, PAUSED: 2, ERROR: 3, OFFLINE: 4, UNKNOWN: 5 };

const sortedPrinters = computed(() =>
  [...printerStore.printers].sort((a, b) =>
    (PRINTER_STATUS_ORDER[a.status] ?? 9) - (PRINTER_STATUS_ORDER[b.status] ?? 9)
  )
);

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
  event.dataTransfer.effectAllowed = 'move';
}

function onDragEnd() {
  dragOver.value = null;
  dragSpoolId.value = null;
  dragFrom.value = null;
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

  // If coming from a printer holder, remove from holder first
  if (fromId && fromId !== '__unassigned__' && !locationStore.locations.find(l => l.storageLocationId === fromId)) {
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
async function onDropHolder(holder) {
  const spoolId = dragSpoolId.value;
  dragOver.value = null;
  dragSpoolId.value = null;
  dragFrom.value = null;

  if (!spoolId) return;
  if (holder.associatedSpoolId === spoolId) return; // already there

  try {
    await apiClient.put(`/printers/holders/${holder.spoolHolderId}/assign-spool`, { spoolId });
    await printerStore.fetchPrinters();
    // Refresh spools so spoolHolder.attachedPrinter is updated
    await spoolStore.fetchSpools();
  } catch { /* ignore */ }
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

/* ── Pinned printer panel ────────────────────────────────────────────────── */
.kanban-printer-panel {
  width: 280px;
  min-width: 280px;
  flex-shrink: 0;
  max-height: calc(100vh - 240px);
  overflow-y: auto;
  overflow-x: hidden;
  padding-right: 2px; /* prevent scrollbar overlap */
}

.printer-card {
  background: rgba(var(--v-theme-surface-variant), 0.4);
  border-radius: 12px;
  overflow: hidden;
}

.printer-card-header {
  border-radius: 10px 10px 0 0;
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

/* ── Holder slots ────────────────────────────────────────────────────────── */
.holder-slot {
  background: rgba(var(--v-theme-surface), 0.6);
  border-radius: 8px;
  border: 1.5px dashed rgba(var(--v-border-color), 0.3);
  transition: border-color 0.15s, background-color 0.15s;
  overflow: hidden;
}

.holder-slot--over {
  border-color: rgb(var(--v-theme-primary));
  background: rgba(var(--v-theme-primary), 0.06);
  border-style: solid;
}

.holder-slot--occupied {
  border-style: solid;
  border-color: rgba(var(--v-border-color), 0.2);
}

.holder-slot--locked {
  opacity: 0.65;
  cursor: not-allowed;
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

/* ── Holder spool swap animation (printer slots) ─────────────────────────── */
.holder-spool-enter-active {
  transition: all 0.3s ease;
}

.holder-spool-leave-active {
  transition: all 0.2s ease;
}

.holder-spool-enter-from,
.holder-spool-leave-to {
  opacity: 0;
  transform: scale(0.9);
}
</style>
