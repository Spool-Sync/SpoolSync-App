<template>
  <div>
    <p class="text-body-2 text-medium-emphasis mb-4">
      Drag spools from the panel below onto printer slots, then press
      <v-icon size="16">mdi-play-circle-outline</v-icon> to send the batch load command.
    </p>

    <!-- Available spools palette -->
    <v-card rounded="xl" class="mb-6" variant="outlined">
      <v-card-title class="pa-4 pb-2 text-subtitle-2 font-weight-bold">Available Spools</v-card-title>
      <v-card-text class="pa-3 pt-0">
        <v-text-field
          v-model="spoolSearch"
          density="compact"
          variant="outlined"
          hide-details
          placeholder="Filter spools…"
          prepend-inner-icon="mdi-magnify"
          class="mb-3"
          style="max-width: 320px"
        />
        <div class="d-flex flex-wrap ga-2">
          <div
            v-for="spool in filteredSpools"
            :key="spool.spoolId"
            draggable="true"
            class="spool-chip"
            :style="{ '--spool-color': spool.filamentType?.colorHex || '#9E9E9E' }"
            @dragstart="onDragStart($event, spool)"
            @dragend="dragging = null"
          >
            <span class="spool-chip__dot" />
            <span class="spool-chip__label">
              {{ spool.filamentType?.brand }} {{ spool.filamentType?.name }}
              <span class="text-caption text-medium-emphasis">
                · {{ spool.filamentType?.material }} · {{ Math.round(spool.currentWeight_g) }}g
              </span>
            </span>
          </div>
          <div v-if="filteredSpools.length === 0" class="text-caption text-medium-emphasis pa-2">
            No spools match
          </div>
        </div>
      </v-card-text>
    </v-card>

    <!-- Printer staging cards -->
    <div v-if="reloadablePrinters.length === 0" class="text-center text-medium-emphasis py-8">
      No printers with filament-reload support found.
      Add <code>supports_reload_command: true</code> to a printer integration to enable this feature.
    </div>

    <v-row>
      <v-col
        v-for="printer in reloadablePrinters"
        :key="printer.printerId"
        cols="12"
        md="6"
        lg="4"
      >
        <v-card rounded="xl" class="printer-stage-card">
          <!-- Printer header -->
          <div class="d-flex align-center pa-4 pb-3">
            <div>
              <div class="text-subtitle-2 font-weight-bold">{{ printer.name }}</div>
              <div class="text-caption text-medium-emphasis">{{ printer.type }}</div>
            </div>
            <v-spacer />
            <v-chip
              size="x-small"
              :color="statusColor(printer.status)"
              variant="tonal"
              class="mr-2"
            >
              {{ printer.status }}
            </v-chip>
            <v-btn
              icon="mdi-play-circle"
              color="success"
              size="small"
              variant="tonal"
              :loading="sending[printer.printerId]"
              :disabled="!hasStagedChanges(printer.printerId)"
              @click="commitReload(printer)"
            />
          </div>
          <v-divider />

          <!-- Slot drop zones -->
          <div class="pa-3">
            <div
              v-for="(holder, idx) in sortedHolders(printer)"
              :key="holder.spoolHolderId"
              class="slot-drop"
              :class="{
                'slot-drop--over': dropTarget === holder.spoolHolderId,
                'slot-drop--staged': !!stagedAssignments[printer.printerId]?.[holder.spoolHolderId],
              }"
              @dragover.prevent="dropTarget = holder.spoolHolderId"
              @dragleave="dropTarget = null"
              @drop.prevent="onDrop(printer.printerId, holder)"
            >
              <!-- Slot number -->
              <div class="slot-drop__index text-caption text-medium-emphasis">T{{ idx }}</div>

              <!-- Staged spool (pending, not yet sent) -->
              <template v-if="stagedAssignments[printer.printerId]?.[holder.spoolHolderId]">
                <div
                  class="slot-dot"
                  :style="{ background: stagedAssignments[printer.printerId][holder.spoolHolderId].colorHex || '#9E9E9E' }"
                />
                <div class="slot-drop__info">
                  <div class="text-body-2 font-weight-medium text-primary">
                    {{ stagedAssignments[printer.printerId][holder.spoolHolderId].label }}
                  </div>
                  <div class="text-caption text-medium-emphasis">staged — not yet sent</div>
                </div>
                <v-btn
                  icon="mdi-close"
                  size="x-small"
                  variant="text"
                  class="ml-auto"
                  @click="clearStaged(printer.printerId, holder.spoolHolderId)"
                />
              </template>

              <!-- Current spool (already loaded) -->
              <template v-else-if="holder.associatedSpool">
                <div
                  class="slot-dot"
                  :style="{ background: holder.associatedSpool.filamentType?.colorHex || '#9E9E9E' }"
                />
                <div class="slot-drop__info">
                  <div class="text-body-2">
                    {{ holder.associatedSpool.filamentType?.brand }}
                    {{ holder.associatedSpool.filamentType?.name }}
                  </div>
                  <div class="text-caption text-medium-emphasis">currently loaded</div>
                </div>
              </template>

              <!-- Empty -->
              <template v-else>
                <div class="slot-dot slot-dot--empty" />
                <div class="slot-drop__info text-caption text-medium-emphasis">Drop spool here</div>
              </template>
            </div>

            <div v-if="sortedHolders(printer).length === 0" class="text-caption text-medium-emphasis text-center py-4">
              No slots configured — set holder count on the printer detail page.
            </div>
          </div>

          <!-- Success / error feedback -->
          <v-alert
            v-if="feedback[printer.printerId]"
            :type="feedback[printer.printerId].type"
            density="compact"
            class="ma-3 mt-0"
            closable
            @click:close="delete feedback[printer.printerId]"
          >
            {{ feedback[printer.printerId].message }}
          </v-alert>
        </v-card>
      </v-col>
    </v-row>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { usePrinterStore } from '@/store/printers';
import { useSpoolStore } from '@/store/spools';

const printerStore = usePrinterStore();
const spoolStore = useSpoolStore();

const integrationTypes = ref([]);
const spoolSearch = ref('');
const dragging = ref(null);          // spool object being dragged
const dropTarget = ref(null);        // spoolHolderId currently hovered
const sending = ref({});             // { printerId: bool }
const feedback = ref({});            // { printerId: { type, message } }

// { printerId: { spoolHolderId: { spoolId, label, colorHex } } }
const stagedAssignments = ref({});

onMounted(async () => {
  await Promise.all([
    printerStore.fetchPrinters(),
    spoolStore.fetchSpools(),
    printerStore.fetchIntegrationTypes().then((types) => { integrationTypes.value = types; }),
  ]);
});

const reloadablePrinters = computed(() => {
  const supportingTypes = new Set(
    integrationTypes.value
      .filter((t) => t.capabilities?.supports_reload_command)
      .map((t) => t.id),
  );
  return printerStore.printers.filter((p) => supportingTypes.has(p.type));
});

const filteredSpools = computed(() => {
  const q = spoolSearch.value.toLowerCase();
  return spoolStore.spools.filter((s) => {
    if (!q) return true;
    const label = `${s.filamentType?.brand ?? ''} ${s.filamentType?.name ?? ''} ${s.filamentType?.material ?? ''}`.toLowerCase();
    return label.includes(q);
  });
});

function sortedHolders(printer) {
  return [...(printer.spoolHolders ?? [])].sort((a, b) =>
    a.createdAt < b.createdAt ? -1 : 1,
  );
}

function hasStagedChanges(printerId) {
  const map = stagedAssignments.value[printerId];
  return map && Object.keys(map).length > 0;
}

function statusColor(status) {
  if (status === 'PRINTING') return 'blue';
  if (status === 'OPERATIONAL') return 'green';
  if (status === 'ERROR') return 'red';
  if (status === 'PAUSED') return 'orange';
  return 'grey';
}

function onDragStart(event, spool) {
  dragging.value = spool;
  event.dataTransfer.setData('spoolId', spool.spoolId);
  event.dataTransfer.effectAllowed = 'copy';
}

function onDrop(printerId, holder) {
  dropTarget.value = null;
  const spool = dragging.value;
  if (!spool) return;

  if (!stagedAssignments.value[printerId]) {
    stagedAssignments.value[printerId] = {};
  }
  stagedAssignments.value[printerId][holder.spoolHolderId] = {
    spoolId: spool.spoolId,
    label: `${spool.filamentType?.brand ?? ''} ${spool.filamentType?.name ?? ''}`.trim(),
    colorHex: spool.filamentType?.colorHex ?? null,
  };
}

function clearStaged(printerId, spoolHolderId) {
  if (stagedAssignments.value[printerId]) {
    delete stagedAssignments.value[printerId][spoolHolderId];
  }
}

async function commitReload(printer) {
  const map = stagedAssignments.value[printer.printerId];
  if (!map) return;

  const assignments = Object.entries(map).map(([spoolHolderId, info]) => ({
    spoolHolderId,
    spoolId: info.spoolId,
  }));

  sending.value[printer.printerId] = true;
  try {
    await printerStore.reloadFilaments(printer.printerId, assignments);
    delete stagedAssignments.value[printer.printerId];
    feedback.value[printer.printerId] = {
      type: 'success',
      message: `${assignments.length} slot(s) updated. Hardware reload command will be sent once firmware support is added.`,
    };
  } catch {
    feedback.value[printer.printerId] = { type: 'error', message: 'Failed to send reload command.' };
  } finally {
    sending.value[printer.printerId] = false;
  }
}
</script>

<style scoped>
/* Draggable spool chip */
.spool-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px 4px 6px;
  border-radius: 20px;
  border: 1.5px solid rgba(var(--v-border-color), 0.3);
  cursor: grab;
  user-select: none;
  background: rgba(var(--v-theme-surface-variant), 0.5);
  transition: box-shadow 0.15s;
}
.spool-chip:hover { box-shadow: 0 2px 8px rgba(0,0,0,.15); }
.spool-chip:active { cursor: grabbing; }
.spool-chip__dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: var(--spool-color);
  flex-shrink: 0;
  border: 1px solid rgba(0,0,0,.15);
}
.spool-chip__label { font-size: 0.8rem; line-height: 1.2; }

/* Slot drop zone */
.slot-drop {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  border-radius: 10px;
  border: 1.5px dashed rgba(var(--v-border-color), 0.35);
  margin-bottom: 6px;
  min-height: 52px;
  transition: background 0.15s, border-color 0.15s;
}
.slot-drop--over {
  background: rgba(var(--v-theme-primary), 0.08);
  border-color: rgb(var(--v-theme-primary));
  border-style: solid;
}
.slot-drop--staged {
  border-color: rgb(var(--v-theme-primary));
  border-style: solid;
  background: rgba(var(--v-theme-primary), 0.04);
}
.slot-drop__index {
  width: 22px;
  flex-shrink: 0;
  text-align: center;
  font-weight: 600;
}
.slot-drop__info { flex: 1; min-width: 0; }

.slot-dot {
  width: 16px;
  height: 16px;
  border-radius: 50%;
  flex-shrink: 0;
  border: 1.5px solid rgba(0,0,0,.15);
}
.slot-dot--empty {
  background: rgba(var(--v-border-color), 0.2);
  border-style: dashed;
}
</style>
