import { io } from 'socket.io-client';
import { useSpoolStore } from '@/store/spools';
import { usePrinterStore } from '@/store/printers';
import { useSpoolHolderStore } from '@/store/spoolHolders';
import { useEsp32DeviceStore } from '@/store/esp32Devices';
import { useStorageLocationStore } from '@/store/storageLocations';
import { useOrderStore } from '@/store/orders';
import { useFilamentTypeStore } from '@/store/filamentTypes';
import { useUiStore } from '@/store/ui';

let socket = null;
const _logBuffer = [];   // holds { level, args } entries emitted before WS connects

export const websocketService = {
  connect() {
    if (socket?.connected) return;

    socket = io('/', { autoConnect: true });

    socket.on('connect', () => {
      console.log('[WS] Connected:', socket.id);
      // Flush any logs that were emitted before the socket connected
      while (_logBuffer.length > 0) {
        socket.emit('client:log', _logBuffer.shift());
      }
    });

    socket.on('disconnect', () => {
      console.log('[WS] Disconnected');
    });

    // ── Spools ────────────────────────────────────────────────────────────────
    socket.on('spool:update', (data) => {
      if (data.spoolId) {
        const spoolStore = useSpoolStore();
        spoolStore.handleSpoolUpdate(data);
      }
      if (data.spoolHolderId) {
        const spoolHolderStore = useSpoolHolderStore();
        spoolHolderStore.handleHolderUpdate(data);
      }
    });

    socket.on('spool:created', (data) => {
      useSpoolStore().handleSpoolCreated(data);
    });

    socket.on('spool:updated', (data) => {
      useSpoolStore().handleSpoolUpdate(data);
    });

    socket.on('spool:deleted', (data) => {
      useSpoolStore().handleSpoolDeleted(data);
    });

    socket.on('spool:spent', (data) => {
      useSpoolStore().handleSpoolUpdate({ spoolId: data.spoolId, status: 'SPENT' });
    });

    // ── Ingest ────────────────────────────────────────────────────────────────
    socket.on('ingest:update', (data) => {
      useSpoolHolderStore().handleIngestUpdate(data);
    });

    socket.on('ingest:spool_identified', (data) => {
      useSpoolHolderStore().handleSpoolIdentified(data);

      const uiStore = useUiStore();
      const ft = data.filamentType;
      const label = ft ? `${ft.brand} ${ft.name}` : 'Spool';
      uiStore.notify({
        message: `${label} — weight updated to ${Math.round(data.currentWeight_g)}g`,
        type: 'success',
        timeout: 6000,
        action: { label: 'View', to: `/spools/${data.spoolId}` },
      });
    });

    // ── Printers ──────────────────────────────────────────────────────────────
    socket.on('printer:status_update', (data) => {
      usePrinterStore().handleStatusUpdate(data);
    });

    socket.on('printer:job_update', (data) => {
      usePrinterStore().handleJobUpdate(data);
    });

    socket.on('printer:created', (data) => {
      usePrinterStore().handlePrinterCreated(data);
    });

    socket.on('printer:updated', (data) => {
      usePrinterStore().handlePrinterUpdated(data);
    });

    socket.on('printer:deleted', (data) => {
      usePrinterStore().handlePrinterDeleted(data);
    });

    // Spool loaded/unloaded on a printer holder — refresh printer state so the
    // Kanban and printer detail views reflect the new holder assignment.
    socket.on('printer:spool_loaded', () => {
      usePrinterStore().fetchPrinters();
    });

    socket.on('printer:spool_unloaded', () => {
      usePrinterStore().fetchPrinters();
    });

    // ── Spool Holders ─────────────────────────────────────────────────────────
    socket.on('holder:created', (data) => {
      useSpoolHolderStore().handleHolderCreated(data);
    });

    socket.on('holder:updated', (data) => {
      useSpoolHolderStore().handleHolderUpdate(data);
    });

    socket.on('holder:deleted', (data) => {
      useSpoolHolderStore().handleHolderDeleted(data);
    });

    // ── Storage Locations ─────────────────────────────────────────────────────
    socket.on('storageLocation:created', (data) => {
      useStorageLocationStore().handleLocationCreated(data);
    });

    socket.on('storageLocation:updated', (data) => {
      useStorageLocationStore().handleLocationUpdated(data);
    });

    socket.on('storageLocation:deleted', (data) => {
      useStorageLocationStore().handleLocationDeleted(data);
    });

    // ── Orders ────────────────────────────────────────────────────────────────
    socket.on('order:created', (data) => {
      useOrderStore().handleOrderCreated(data);
    });

    socket.on('order:updated', (data) => {
      useOrderStore().handleOrderUpdated(data);
    });

    socket.on('order:deleted', (data) => {
      useOrderStore().handleOrderDeleted(data);
    });

    // ── ESP32 Devices ─────────────────────────────────────────────────────────
    socket.on('esp32Device:created', (data) => {
      useEsp32DeviceStore().handleDeviceCreated(data);
    });

    socket.on('esp32Device:updated', (data) => {
      useEsp32DeviceStore().handleDeviceUpdated(data);
    });

    socket.on('esp32Device:deleted', (data) => {
      useEsp32DeviceStore().handleDeviceDeleted(data);
    });

    // ── Filament Types ────────────────────────────────────────────────────────
    socket.on('filamentType:created', (data) => {
      useFilamentTypeStore().handleFilamentTypeCreated(data);
    });

    socket.on('filamentType:updated', (data) => {
      useFilamentTypeStore().handleFilamentTypeUpdated(data);
    });

    socket.on('filamentType:deleted', (data) => {
      useFilamentTypeStore().handleFilamentTypeDeleted(data);
    });

    // ── Inventory ─────────────────────────────────────────────────────────────
    socket.on('inventory:low_stock_alert', (data) => {
      const uiStore = useUiStore();
      uiStore.notify({
        message: `Low stock alert — spool ${data.spoolId} is at ${Math.round(data.currentWeight_g)}g`,
        type: 'warning',
        timeout: 8000,
      });
    });
  },

  disconnect() {
    socket?.disconnect();
    socket = null;
  },

  emit(event, data) {
    socket?.emit(event, data);
  },

  bufferLog(entry) {
    if (socket?.connected) {
      socket.emit('client:log', entry);
    } else {
      _logBuffer.push(entry);
    }
  },

  get isConnected() {
    return socket?.connected ?? false;
  },
};
