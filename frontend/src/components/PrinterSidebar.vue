<template>
  <div v-if="sortedPrinters.length" class="printer-sidebar">
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
        <!-- Begin Reload button: shown when any slots have a staged spool -->
        <v-btn
          v-if="printer.features?.includes('filament_reload') && printer.spoolHolders?.some(h => h.stagedSpoolId)"
          block
          size="small"
          color="success"
          variant="tonal"
          prepend-icon="mdi-reload"
          class="mb-2"
          :loading="reloadingPrinters.has(printer.printerId)"
          @click="handleBeginReload(printer.printerId)"
        >
          Begin Reload
        </v-btn>

        <template v-if="printer.spoolHolders?.length">
          <div
            v-for="holder in [...(printer.spoolHolders ?? [])].sort((a, b) => a.createdAt < b.createdAt ? -1 : 1)"
            :key="holder.spoolHolderId"
            class="holder-slot mb-2"
            :class="{
              'holder-slot--over': dragOver === holder.spoolHolderId && !!dragSpoolId,
              'holder-slot--occupied': !!holder.associatedSpoolId,
              'holder-slot--printing': printer.status === 'PRINTING' && printer.activeTool === holder.slotIndex,
            }"
            @dragover.prevent="dragOver = holder.spoolHolderId"
            @dragleave.self="dragOver = null"
            @drop.prevent="onDropHolder(holder, printer)"
          >
            <div class="d-flex align-center px-2 py-1">
              <v-icon v-if="printer.status === 'PRINTING' && printer.activeTool === holder.slotIndex" size="14" class="mr-1 text-primary">mdi-printer-3d-nozzle-outline</v-icon>
              <v-icon v-else size="14" class="mr-1 text-medium-emphasis">mdi-tray</v-icon>
              <span class="text-caption font-weight-medium text-medium-emphasis">{{ holder.name }}</span>
            </div>

            <Transition name="holder-spool">
              <div
                v-if="holder.associatedSpool"
                class="spool-card mx-1 mb-1"
                :class="{ 'spool-card--dragging': dragSpoolId === holder.associatedSpool.spoolId }"
                draggable="true"
                @dragstart="onSpoolDragStart($event, holder.associatedSpool, holder.spoolHolderId)"
                @dragend="onSpoolDragEnd"
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

            <!-- Staged spool pending indicator -->
            <div v-if="holder.stagedSpool" class="px-2 pb-1">
              <v-chip size="x-small" color="success" variant="tonal" prepend-icon="mdi-clock-outline" class="text-truncate" style="max-width: 100%">
                Pending: {{ holder.stagedSpool.filamentType?.material }}
              </v-chip>
            </div>

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
</template>

<script setup>
import { ref, computed } from 'vue';
import { usePrinterStore } from '@/store/printers';
import PrinterStatusChip from '@/components/PrinterStatusChip.vue';

const props = defineProps({
  dragSpoolId: { type: String, default: null },
  dragFrom: { type: String, default: null },
});

const emit = defineEmits(['drop-holder', 'spool-dragstart', 'spool-dragend']);

const printerStore = usePrinterStore();

const dragOver = ref(null);
const reloadingPrinters = ref(new Set());

const PRINTER_STATUS_ORDER = { OPERATIONAL: 0, PRINTING: 1, PAUSED: 2, ERROR: 3, OFFLINE: 4, UNKNOWN: 5 };

const sortedPrinters = computed(() =>
  [...printerStore.printers].sort((a, b) =>
    (PRINTER_STATUS_ORDER[a.status] ?? 9) - (PRINTER_STATUS_ORDER[b.status] ?? 9)
  )
);

async function handleBeginReload(printerId) {
  reloadingPrinters.value = new Set([...reloadingPrinters.value, printerId]);
  try {
    await printerStore.beginReload(printerId);
  } catch { /* ignore */ } finally {
    const s = new Set(reloadingPrinters.value);
    s.delete(printerId);
    reloadingPrinters.value = s;
  }
}

function onSpoolDragStart(event, spool, holderId) {
  event.dataTransfer.effectAllowed = 'move';
  emit('spool-dragstart', { spool, fromId: holderId });
}

function onSpoolDragEnd() {
  dragOver.value = null;
  emit('spool-dragend');
}

function onDropHolder(holder, printer) {
  dragOver.value = null;
  emit('drop-holder', { holder, printer });
}
</script>

<style scoped>
.printer-sidebar {
  width: 280px;
  min-width: 280px;
  flex-shrink: 0;
  max-height: calc(100vh - 240px);
  overflow-y: auto;
  overflow-x: hidden;
  padding-right: 2px;
}

.printer-card {
  background: rgba(var(--v-theme-surface-variant), 0.4);
  border-radius: 12px;
  overflow: hidden;
}

.printer-card-header {
  border-radius: 10px 10px 0 0;
}

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

.holder-slot--printing {
  border-color: rgba(var(--v-theme-primary), 0.5);
  border-style: solid;
}

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
