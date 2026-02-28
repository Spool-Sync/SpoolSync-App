<template>
  <div>
    <div class="d-flex align-center mb-4">
      <h1 class="text-h5 font-weight-bold">Filament</h1>
      <v-spacer />

      <!-- NFC scan: find existing spool or open ingest for unknown tag -->
      <v-btn
        v-if="nfcSupported"
        :color="nfcScanning ? 'primary' : undefined"
        :variant="nfcScanning ? 'tonal' : 'text'"
        :prepend-icon="nfcScanning ? 'mdi-nfc-tap' : 'mdi-nfc'"
        :loading="nfcStarting"
        class="mr-2"
        @click="nfcScanning ? stopNfc() : startNfc()"
      >
        {{ nfcScanning ? 'Hold tag to phone…' : 'Scan NFC' }}
      </v-btn>

      <v-btn
        color="orange"
        variant="tonal"
        prepend-icon="mdi-tray-arrow-down"
        class="mr-2"
        @click="showIngest = true"
      >
        <span class="d-none d-sm-inline">Ingest Spool</span>
      </v-btn>
      <v-btn color="primary" prepend-icon="mdi-plus" @click="showForm = true">
        <span class="d-none d-sm-inline">Add Spool</span>
      </v-btn>
    </div>

    <!-- Search + Filters -->
    <v-row dense class="mb-3">
      <v-col cols="12" sm="3">
        <v-text-field
          v-model="search"
          label="Search spools"
          prepend-inner-icon="mdi-magnify"
          variant="outlined"
          density="compact"
          clearable
          hide-details
          @update:modelValue="debouncedLoad"
        />
      </v-col>
      <v-col cols="12" sm="3">
        <v-select
          v-model="materialFilter"
          :items="availableMaterials"
          label="Material"
          variant="outlined"
          density="compact"
          clearable
          hide-details
          @update:modelValue="resetAndLoad"
        />
      </v-col>
      <v-col cols="12" sm="3">
        <v-select
          v-model="colorFilter"
          :items="availableColors"
          item-title="color"
          item-value="color"
          label="Color"
          variant="outlined"
          density="compact"
          clearable
          hide-details
          @update:modelValue="resetAndLoad"
        >
          <template #item="{ item, props: itemProps }">
            <v-list-item v-bind="itemProps">
              <template #prepend>
                <div
                  class="rounded-circle mr-2"
                  :style="{ width: '14px', height: '14px', background: item.raw.colorHex || '#9e9e9e', flexShrink: 0 }"
                />
              </template>
            </v-list-item>
          </template>
          <template #selection="{ item }">
            <div class="d-flex align-center ga-2">
              <div class="rounded-circle" :style="{ width: '12px', height: '12px', background: item.raw.colorHex || '#9e9e9e' }" />
              {{ item.raw.color }}
            </div>
          </template>
        </v-select>
      </v-col>
      <v-col cols="12" sm="3">
        <v-select
          v-model="locationFilter"
          :items="availableLocations"
          item-title="name"
          item-value="storageLocationId"
          label="Location"
          prepend-inner-icon="mdi-package-variant"
          variant="outlined"
          density="compact"
          clearable
          hide-details
          @update:modelValue="resetAndLoad"
        />
      </v-col>
    </v-row>

    <SpoolTable
      :spools="tableSpools"
      :loading="tableLoading"
      :total="total"
      :page="page"
      :items-per-page="pageSize"
      @edit="openEdit"
      @delete="handleDelete"
      @mark-spent="handleMarkSpent"
      @refill="handleRefill"
      @update:options="onTableOptions"
    />

    <v-dialog v-model="showForm" max-width="600">
      <SpoolForm
        :spool="editingSpool"
        @saved="handleSaved"
        @cancel="closeForm"
      />
    </v-dialog>

    <IngestSpoolDialog
      v-model="showIngest"
      :initial-nfc-tag-id="ingestPrefillTag"
      :open-print-tag-data="ingestOpenPrintTagData"
      @created="handleCreated"
    />

    <RefillSpoolDialog
      v-model="showRefill"
      :spool="refillingSpool"
      @refilled="handleRefilled"
    />
  </div>
</template>

<script setup>
import { ref, watch, onMounted, onUnmounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import SpoolTable from '@/components/tables/SpoolTable.vue';
import SpoolForm from '@/components/forms/SpoolForm.vue';
import IngestSpoolDialog from '@/components/dialogs/IngestSpoolDialog.vue';
import RefillSpoolDialog from '@/components/dialogs/RefillSpoolDialog.vue';
import { useSpoolStore } from '@/store/spools';
import { useStorageLocationStore } from '@/store/storageLocations';
import { useUiStore } from '@/store/ui';
import apiClient from '@/services/apiClient';
import { isOpenPrintTag, parseOpenPrintTag } from '@/utils/openPrintTag';

const route = useRoute();
const router = useRouter();
const spoolStore = useSpoolStore();
const locationStore = useStorageLocationStore();
const uiStore = useUiStore();
const showForm = ref(false);
const showIngest = ref(false);
const showRefill = ref(false);
const editingSpool = ref(null);
const refillingSpool = ref(null);
const ingestPrefillTag = ref(null);
const ingestOpenPrintTagData = ref(null);

// ── NFC scan ──────────────────────────────────────────────────────────────────
const nfcSupported = ref('NDEFReader' in window);
const nfcScanning = ref(false);
const nfcStarting = ref(false);
let nfcAbort = null;

async function startNfc() {
  nfcStarting.value = true;
  console.log('[NFC] startNfc called, NDEFReader available:', 'NDEFReader' in window);
  try {
    nfcAbort = new AbortController();
    const reader = new window.NDEFReader();
    reader.addEventListener('reading', ({ message, serialNumber }) => {
      console.log('[NFC] reading event fired, serialNumber:', serialNumber, 'records:', message.records.length);

      // Check for OpenPrintTag MIME record first
      const optRecord = message.records.find((r) => isOpenPrintTag(r));
      if (optRecord) {
        console.log('[NFC] OpenPrintTag detected');
        const tagData = parseOpenPrintTag(optRecord);
        console.log('[NFC] parsed OPT data:', tagData);
        handleOpenPrintTag(tagData, serialNumber);
        return;
      }

      // Plain tag — use serial number as identifier
      if (serialNumber) {
        handleNfcTag(serialNumber);
      } else {
        stopNfc();
        uiStore.notify({ message: 'Could not read NFC tag — no serial number', type: 'warning' });
      }
    });
    reader.addEventListener('readingerror', (err) => {
      console.error('[NFC] readingerror:', err);
      uiStore.notify({ message: 'NFC read error — try again', type: 'error' });
    });
    await reader.scan({ signal: nfcAbort.signal });
    console.log('[NFC] scan started successfully');
    nfcScanning.value = true;
  } catch (err) {
    console.error('[NFC] scan failed:', err?.name, err?.message);
    nfcScanning.value = false;
    if (err?.name !== 'AbortError') {
      uiStore.notify({ message: `NFC unavailable: ${err?.message ?? err}`, type: 'error' });
    }
  } finally {
    nfcStarting.value = false;
  }
}

function stopNfc() {
  nfcAbort?.abort();
  nfcScanning.value = false;
}

async function handleNfcTag(tagId) {
  stopNfc();
  console.log('[NFC] handleNfcTag, looking up tagId:', tagId);
  try {
    const { data } = await apiClient.get(`/spools/by-nfc/${encodeURIComponent(tagId)}`);
    console.log('[NFC] spool found:', data?.spoolId);
    openEdit(data);
  } catch (err) {
    console.error('[NFC] lookup error:', err?.response?.status, err?.message);
    if (err.response?.status === 404) {
      ingestPrefillTag.value = tagId;
      showIngest.value = true;
    } else {
      uiStore.notify({ message: 'Failed to look up NFC tag', type: 'error' });
    }
  }
}

async function handleOpenPrintTag(tagData, serialNumber) {
  stopNfc();

  // If we have a serial, check whether this tag is already linked to a spool
  if (serialNumber) {
    try {
      const { data } = await apiClient.get(`/spools/by-nfc/${encodeURIComponent(serialNumber)}`);
      // Known spool — open edit dialog
      openEdit(data);
      return;
    } catch (err) {
      if (err.response?.status !== 404) {
        uiStore.notify({ message: 'Failed to look up NFC tag', type: 'error' });
        return;
      }
    }
  }

  if (!tagData) {
    // Parsed as OPT but extraction failed — fall back to plain serial flow
    if (serialNumber) {
      ingestPrefillTag.value = serialNumber;
      showIngest.value = true;
    } else {
      uiStore.notify({ message: 'Could not parse OpenPrintTag data', type: 'warning' });
    }
    return;
  }

  // New spool with full OPT data — open ingest pre-filled
  ingestPrefillTag.value = serialNumber;
  ingestOpenPrintTagData.value = tagData;
  showIngest.value = true;
}

onUnmounted(() => stopNfc());

// Filters — initialised from URL query params
const search = ref(route.query.search ?? '');
const materialFilter = ref(route.query.material ?? null);
const colorFilter = ref(route.query.color ?? null);
const locationFilter = ref(route.query.location ?? null);
const availableMaterials = ref([]);
const availableColors = ref([]);
const availableLocations = ref([]);

// Keep URL in sync with filter state (debounced for search)
let syncTimer = null;
watch([search, materialFilter, colorFilter, locationFilter], () => {
  clearTimeout(syncTimer);
  syncTimer = setTimeout(() => {
    router.replace({
      query: {
        ...(search.value ? { search: search.value } : {}),
        ...(materialFilter.value ? { material: materialFilter.value } : {}),
        ...(colorFilter.value ? { color: colorFilter.value } : {}),
        ...(locationFilter.value ? { location: locationFilter.value } : {}),
      },
    });
  }, 300);
});

// Pagination + sort state
const tableSpools = ref([]);
const tableLoading = ref(false);
const total = ref(0);
const page = ref(1);
const pageSize = ref(25);
const sortBy = ref(null);
const sortOrder = ref(null);

// Debounce handle for search
let searchTimer = null;
function debouncedLoad() {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => { page.value = 1; loadPage(); }, 350);
}

function resetAndLoad() {
  page.value = 1;
  loadPage();
}

async function loadPage() {
  tableLoading.value = true;
  try {
    const result = await spoolStore.fetchSpoolsPage({
      page: page.value,
      pageSize: pageSize.value,
      ...(search.value && { search: search.value }),
      ...(materialFilter.value && { material: materialFilter.value }),
      ...(colorFilter.value && { color: colorFilter.value }),
      ...(locationFilter.value && { locationId: locationFilter.value }),
      ...(sortBy.value && { sortBy: sortBy.value }),
      ...(sortOrder.value && { sortOrder: sortOrder.value }),
    });
    tableSpools.value = result.items;
    total.value = result.total;
  } finally {
    tableLoading.value = false;
  }
}

function onTableOptions({ page: p, itemsPerPage: ps, sortBy: sb, sortOrder: so }) {
  page.value = p;
  pageSize.value = ps;
  sortBy.value = sb;
  sortOrder.value = so;
  loadPage();
}

onMounted(async () => {
  console.log('[SpoolsView] mounted, nfcSupported:', nfcSupported.value);

  const [, filters] = await Promise.all([
    loadPage(),
    spoolStore.fetchFilters(),
    locationStore.fetchLocations(),
  ]);
  availableMaterials.value = filters.materials;
  // Deduplicate by color name (same name can appear with slightly different hex values)
  const seen = new Set();
  availableColors.value = filters.colors.filter(c => {
    if (seen.has(c.color)) return false;
    seen.add(c.color);
    return true;
  });
  availableLocations.value = locationStore.locations;
  // Keep store spools populated for dashboard/kanban
  spoolStore.fetchSpools();
});

function openEdit(spool) {
  editingSpool.value = spool;
  showForm.value = true;
}

function closeForm() {
  showForm.value = false;
  editingSpool.value = null;
}

async function handleSaved() {
  closeForm();
  await loadPage();
  spoolStore.fetchSpools();
}

async function handleCreated() {
  ingestPrefillTag.value = null;
  await loadPage();
  spoolStore.fetchSpools();
}

watch(showIngest, (open) => {
  if (!open) {
    ingestPrefillTag.value = null;
    ingestOpenPrintTagData.value = null;
  }
});

// Reload the table whenever another device creates or deletes a spool
watch(() => spoolStore.wsChangeCount, () => loadPage());

async function handleDelete(spoolId) {
  await spoolStore.deleteSpool(spoolId);
  await loadPage();
}

async function handleMarkSpent(spoolId) {
  await spoolStore.markSpent(spoolId, true);
  await loadPage();
  spoolStore.fetchSpools();
}

function handleRefill(spoolId) {
  refillingSpool.value = tableSpools.value.find((s) => s.spoolId === spoolId) ?? null;
  showRefill.value = true;
}

async function handleRefilled() {
  showRefill.value = false;
  refillingSpool.value = null;
  await loadPage();
  spoolStore.fetchSpools();
}
</script>
