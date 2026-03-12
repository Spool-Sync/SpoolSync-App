<template>
  <div>
    <div class="d-flex align-center mb-2">
      <h1 class="text-h5 font-weight-bold">Filament</h1>
      <v-spacer />

      <template v-if="activeTab === 'spools'">
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
      </template>
    </div>

    <v-tabs v-model="activeTab" class="mb-4" density="compact">
      <v-tab value="spools" prepend-icon="mdi-movie-roll">Spools</v-tab>
      <v-tab value="summary" prepend-icon="mdi-clipboard-list-outline">Total</v-tab>
    </v-tabs>

    <v-tabs-window v-model="activeTab">
      <!-- ── Spools tab ─────────────────────────────────────────────────── -->
      <v-tabs-window-item value="spools">
        <div class="spools-tab-layout">
          <!-- ── Main content area (drop zone when dragging from a holder) ── -->
          <div
            class="spools-main-content"
            @dragover.prevent
            @drop.prevent="onDropToUnassign"
          >

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

        <!-- Sort + Group controls -->
        <v-row dense class="mb-3 align-center">
          <v-col cols="auto" class="d-flex align-center ga-2">
            <v-select
              v-model="sortBy"
              :items="sortOptions"
              item-title="label"
              item-value="value"
              label="Sort by"
              variant="outlined"
              density="compact"
              hide-details
              style="min-width: 152px"
              @update:modelValue="onSortChange"
            />
            <v-btn-toggle
              v-model="sortOrder"
              mandatory
              density="compact"
              variant="outlined"
              @update:modelValue="onSortChange"
            >
              <v-btn value="asc"  size="small">
                <v-icon size="18">mdi-sort-ascending</v-icon>
              </v-btn>
              <v-btn value="desc" size="small">
                <v-icon size="18">mdi-sort-descending</v-icon>
              </v-btn>
            </v-btn-toggle>
          </v-col>
          <v-col cols="auto">
            <v-select
              v-model="groupBy"
              :items="groupOptions"
              item-title="label"
              item-value="value"
              label="Group by"
              variant="outlined"
              density="compact"
              hide-details
              style="min-width: 140px"
              @update:modelValue="onGroupChange"
            />
          </v-col>
        </v-row>

            <SpoolTable
              :spools="tableSpools"
              :loading="tableLoading"
              :total="total"
              :page="page"
              :items-per-page="pageSize"
              :group-by="groupBy"
              :draggable="true"
              :drag-spool-id="dragSpoolId"
              @edit="openEdit"
              @delete="handleDelete"
              @mark-spent="handleMarkSpent"
              @refill="handleRefill"
              @update:options="onTableOptions"
              @spool-dragstart="onTableDragStart"
              @spool-dragend="onDragEnd"
            />
          </div>

          <!-- ── Right: printer sidebar ─────────────────────────────────── -->
          <PrinterSidebar
            :drag-spool-id="dragSpoolId"
            :drag-from="dragFrom"
            @drop-holder="onDropHolder"
            @spool-dragstart="onSidebarDragStart"
            @spool-dragend="onDragEnd"
          />
        </div>
      </v-tabs-window-item>

      <!-- ── Summary tab ────────────────────────────────────────────────── -->
      <v-tabs-window-item value="summary">
        <v-row dense class="mb-3">
          <v-col cols="12" sm="4">
            <v-text-field
              v-model="summarySearch"
              density="compact"
              variant="outlined"
              hide-details
              label="Search filament…"
              prepend-inner-icon="mdi-magnify"
              clearable
            />
          </v-col>
          <v-col cols="12" sm="8" class="d-flex align-center flex-wrap ga-1">
            <v-chip
              v-for="mat in summaryMaterials"
              :key="mat"
              :color="summaryMaterialFilter === mat ? 'primary' : undefined"
              :variant="summaryMaterialFilter === mat ? 'tonal' : 'outlined'"
              size="small"
              clickable
              @click="summaryMaterialFilter = summaryMaterialFilter === mat ? null : mat"
            >
              {{ mat }}
            </v-chip>
          </v-col>
        </v-row>

        <v-data-table
          :headers="summaryHeaders"
          :items="summaryFilteredGroups"
          :loading="spoolStore.loading"
          :sort-by="summarySortBy"
          :group-by="summaryGroupBy"
          item-value="filamentTypeId"
          rounded="xl"
          hover
        >
          <template #group-header="{ item, columns, toggleGroup, isGroupOpen }">
            <tr class="cursor-pointer" @click="toggleGroup(item)">
              <td :colspan="columns.length" class="bg-surface-variant">
                <div class="d-flex align-center ga-2 py-1">
                  <v-icon size="18" color="medium-emphasis">{{ isGroupOpen(item) ? 'mdi-chevron-down' : 'mdi-chevron-right' }}</v-icon>
                  <v-chip size="small" variant="tonal" label>{{ item.value }}</v-chip>
                  <span class="text-caption text-medium-emphasis">{{ item.items.length }} type{{ item.items.length === 1 ? '' : 's' }}</span>
                </div>
              </td>
            </tr>
          </template>
          <template #item.filament="{ item }">
            <div class="d-flex align-center">
              <v-tooltip :text="item.color || item.colorHex || 'Unknown'" location="top">
                <template #activator="{ props: tip }">
                  <v-avatar
                    v-bind="tip"
                    size="20"
                    :style="{ backgroundColor: item.colorHex || '#aaa' }"
                    class="mr-2 flex-shrink-0"
                  />
                </template>
              </v-tooltip>
              <span class="text-body-2">{{ item.brand }} {{ item.name }}</span>
            </div>
          </template>
          <template #item.material="{ item }">
            <v-chip size="x-small" variant="tonal">{{ item.material }}</v-chip>
          </template>
          <template #item.spoolCount="{ item }">
            <v-chip size="small" variant="tonal">{{ item.spoolCount }}</v-chip>
          </template>
          <template #item.remaining="{ item }">
            <div>
              <span class="font-weight-medium">{{ formatGrams(item.totalRemaining_g) }}</span>
              <v-progress-linear
                :model-value="item.pct"
                :color="item.pct > 50 ? 'success' : item.pct > 20 ? 'warning' : 'error'"
                height="4"
                rounded
                class="mt-1"
                style="max-width: 100px"
              />
            </div>
          </template>
        </v-data-table>
      </v-tabs-window-item>
    </v-tabs-window>

    <v-dialog v-model="showForm" max-width="600">
      <SpoolForm
        :spool="editingSpool"
        @saved="handleSaved"
        @cancel="closeForm"
      />
    </v-dialog>

    <IngestSpoolDialog
      v-model="showIngest"
      @created="handleCreated"
    />

    <RefillSpoolDialog
      v-model="showRefill"
      :spool="refillingSpool"
      @refilled="handleRefilled"
    />

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
import { ref, computed, watch, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import SpoolTable from '@/components/tables/SpoolTable.vue';
import SpoolForm from '@/components/forms/SpoolForm.vue';
import IngestSpoolDialog from '@/components/dialogs/IngestSpoolDialog.vue';
import RefillSpoolDialog from '@/components/dialogs/RefillSpoolDialog.vue';
import PrinterSidebar from '@/components/PrinterSidebar.vue';
import { useSpoolStore } from '@/store/spools';
import { useStorageLocationStore } from '@/store/storageLocations';
import { usePrinterStore } from '@/store/printers';
import { useAuthStore } from '@/store/auth';
import apiClient from '@/services/apiClient';

const route = useRoute();
const router = useRouter();
const spoolStore = useSpoolStore();
const locationStore = useStorageLocationStore();
const printerStore = usePrinterStore();
const authStore = useAuthStore();

// ── Tab state ─────────────────────────────────────────────────────────────────
const activeTab = ref('spools');

// ── Dialogs ───────────────────────────────────────────────────────────────────
const showForm = ref(false);
const showIngest = ref(false);
const showRefill = ref(false);
const editingSpool = ref(null);
const refillingSpool = ref(null);
// ── Drag-and-drop ─────────────────────────────────────────────────────────────
const dragSpoolId = ref(null);
const dragFrom = ref(null); // '__table__' for table rows, or spoolHolderId for sidebar cards

// Printing override confirmation
const printingConfirmDialog = ref(false);
const printingConfirmLoading = ref(false);
const pendingDropPrinterName = ref('');
let pendingDropAction = null;

function onTableDragStart({ spool }) {
  dragSpoolId.value = spool.spoolId;
  dragFrom.value = '__table__';
}

function onSidebarDragStart({ spool, fromId }) {
  dragSpoolId.value = spool.spoolId;
  dragFrom.value = fromId;
}

function onDragEnd() {
  dragSpoolId.value = null;
  dragFrom.value = null;
}

function isHolderId(id) {
  if (!id || id === '__table__') return false;
  return printerStore.printers.some(p => p.spoolHolders?.some(h => h.spoolHolderId === id));
}

// Dropped on the content area — only acts when dragging from a printer holder
async function onDropToUnassign() {
  const spoolId = dragSpoolId.value;
  const fromId = dragFrom.value;
  dragSpoolId.value = null;
  dragFrom.value = null;

  if (!spoolId || !isHolderId(fromId)) return;

  const sourcePrinter = printerStore.printers.find(p =>
    p.spoolHolders?.some(h => h.spoolHolderId === fromId)
  );

  if (sourcePrinter?.status === 'PRINTING') {
    pendingDropPrinterName.value = sourcePrinter.name;
    pendingDropAction = async (force) => {
      await apiClient.delete(`/printers/holders/${fromId}/assign-spool`, { params: { force: force ? '1' : undefined } });
      await printerStore.fetchPrinters();
      await spoolStore.updateSpool(spoolId, { storageLocationId: null });
      await Promise.all([loadPage(), spoolStore.fetchSpools()]);
    };
    printingConfirmDialog.value = true;
    return;
  }

  try {
    await apiClient.delete(`/printers/holders/${fromId}/assign-spool`);
    await printerStore.fetchPrinters();
  } catch { /* ignore */ }
  try {
    await spoolStore.updateSpool(spoolId, { storageLocationId: null });
    await Promise.all([loadPage(), spoolStore.fetchSpools()]);
  } catch { /* ignore */ }
}

// Dropped onto a printer holder slot
async function onDropHolder({ holder, printer }) {
  const spoolId = dragSpoolId.value;
  const fromId = dragFrom.value;
  dragSpoolId.value = null;
  dragFrom.value = null;

  if (!spoolId) return;
  if (holder.associatedSpoolId === spoolId) return;

  // Printers with filament_reload feature always use staging
  if (printer.features?.includes('filament_reload')) {
    try {
      await printerStore.stageSpool(holder.spoolHolderId, spoolId);
      await Promise.all([loadPage(), spoolStore.fetchSpools()]);
    } catch { /* ignore */ }
    return;
  }

  if (printer.status === 'PRINTING') {
    pendingDropPrinterName.value = printer.name;
    pendingDropAction = async (force) => {
      // If dragging from another holder, remove it first
      if (isHolderId(fromId) && fromId !== holder.spoolHolderId) {
        await apiClient.delete(`/printers/holders/${fromId}/assign-spool`, { params: { force: force ? '1' : undefined } });
      }
      await apiClient.put(`/printers/holders/${holder.spoolHolderId}/assign-spool`, { spoolId, force });
      await printerStore.fetchPrinters();
      await Promise.all([loadPage(), spoolStore.fetchSpools()]);
    };
    printingConfirmDialog.value = true;
    return;
  }

  try {
    // If dragging from another holder, remove it first
    if (isHolderId(fromId) && fromId !== holder.spoolHolderId) {
      await apiClient.delete(`/printers/holders/${fromId}/assign-spool`);
    }
    await apiClient.put(`/printers/holders/${holder.spoolHolderId}/assign-spool`, { spoolId });
    await printerStore.fetchPrinters();
    await Promise.all([loadPage(), spoolStore.fetchSpools()]);
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

// ── Spools tab — filters & pagination ────────────────────────────────────────
const search = ref(route.query.search ?? '');
const materialFilter = ref(route.query.material ?? null);
const colorFilter = ref(route.query.color ?? null);
const locationFilter = ref(route.query.location ?? null);
const availableMaterials = ref([]);
const availableColors = ref([]);
const availableLocations = ref([]);

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

const tableSpools = ref([]);
const tableLoading = ref(false);
const total = ref(0);
const page = ref(1);
const pageSize = ref(25);
const sortBy = ref('createdAt');
const sortOrder = ref('desc');
const groupBy = ref('material');

const sortOptions = [
  { label: 'Date Added', value: 'createdAt' },
  { label: 'Weight',     value: 'weight' },
  { label: 'Brand',      value: 'brand' },
  { label: 'Color (Hue)', value: 'hue' },
];
const groupOptions = [
  { label: 'Material', value: 'material' },
  { label: 'Brand',    value: 'brand' },
  { label: 'None',     value: 'none' },
];

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
      ...(groupBy.value && groupBy.value !== 'none' && { groupBy: groupBy.value }),
    });
    tableSpools.value = result.items;
    total.value = result.total;
  } finally {
    tableLoading.value = false;
  }
}

function onTableOptions({ page: p, itemsPerPage: ps }) {
  page.value = p;
  pageSize.value = ps;
  loadPage();
}

function onSortChange() {
  page.value = 1;
  loadPage();
  authStore.updatePreferences({ spoolSortBy: sortBy.value, spoolSortOrder: sortOrder.value });
}

function onGroupChange() {
  page.value = 1;
  loadPage();
  authStore.updatePreferences({ spoolGroupBy: groupBy.value });
}

// ── Summary tab ───────────────────────────────────────────────────────────────
const summarySearch = ref('');
const summaryMaterialFilter = ref(null);

const summaryHeaders = [
  { title: 'Filament', key: 'filament', sortable: false },
  { title: 'Material', key: 'material', sortable: true },
  { title: 'Color', key: 'color', sortable: true },
  { title: 'Spools', key: 'spoolCount', sortable: true },
  { title: 'Remaining', key: 'remaining', sortable: true, sort: (a, b) => a - b },
];

const summarySortBy = computed(() => {
  const pref = authStore.preferences.spoolSortBy ?? 'createdAt';
  const order = authStore.preferences.spoolSortOrder ?? 'desc';
  const keyMap = { brand: 'brand', weight: 'remaining', hue: 'remaining', createdAt: 'brand' };
  return [{ key: keyMap[pref] ?? 'brand', order }];
});

const summaryGroupBy = computed(() => {
  const pref = authStore.preferences.spoolGroupBy ?? 'material';
  if (pref === 'material') return [{ key: 'material', order: 'asc' }];
  if (pref === 'brand')    return [{ key: 'brand',    order: 'asc' }];
  return [];
});

const summaryGroups = computed(() => {
  const map = {};
  for (const spool of spoolStore.spools) {
    const ft = spool.filamentType;
    if (!ft) continue;
    const key = ft.filamentTypeId;
    const sw = ft.spoolWeight_g ?? 200;
    const remaining = Math.max(0, spool.currentWeight_g - sw);
    const initial = Math.max(0, spool.initialWeight_g - sw);
    if (!map[key]) {
      map[key] = {
        filamentTypeId: key,
        brand: ft.brand,
        name: ft.name,
        material: ft.material,
        color: ft.color ?? '',
        colorHex: ft.colorHex ?? null,
        totalRemaining_g: 0,
        totalInitial_g: 0,
        spoolCount: 0,
      };
    }
    map[key].totalRemaining_g += remaining;
    map[key].totalInitial_g += initial;
    map[key].spoolCount += 1;
  }
  return Object.values(map).map((g) => ({
    ...g,
    remaining: g.totalRemaining_g,
    pct: g.totalInitial_g > 0 ? (g.totalRemaining_g / g.totalInitial_g) * 100 : 0,
  }));
});

const summaryMaterials = computed(() => [...new Set(summaryGroups.value.map((g) => g.material))].sort());

const summaryFilteredGroups = computed(() => {
  const q = summarySearch.value?.toLowerCase() ?? '';
  return summaryGroups.value.filter((g) => {
    const matchesMaterial = !summaryMaterialFilter.value || g.material === summaryMaterialFilter.value;
    const matchesSearch =
      !q ||
      g.brand.toLowerCase().includes(q) ||
      g.name.toLowerCase().includes(q) ||
      g.material.toLowerCase().includes(q) ||
      g.color.toLowerCase().includes(q);
    return matchesMaterial && matchesSearch;
  });
});

function formatGrams(g) {
  if (g >= 1000) return `${(g / 1000).toFixed(2)}kg`;
  return `${Math.round(g)}g`;
}

// ── Lifecycle ─────────────────────────────────────────────────────────────────
onMounted(async () => {
  sortBy.value    = authStore.preferences.spoolSortBy    ?? 'createdAt';
  sortOrder.value = authStore.preferences.spoolSortOrder ?? 'desc';
  groupBy.value   = authStore.preferences.spoolGroupBy   ?? 'material';

  const [, filters] = await Promise.all([
    loadPage(),
    spoolStore.fetchFilters(),
    locationStore.fetchLocations(),
    printerStore.fetchPrinters(),
    printerStore.fetchIntegrationTypes(),
  ]);
  availableMaterials.value = filters.materials;
  const seen = new Set();
  availableColors.value = filters.colors.filter(c => {
    if (seen.has(c.color)) return false;
    seen.add(c.color);
    return true;
  });
  availableLocations.value = locationStore.locations;
  spoolStore.fetchSpools();
});

// ── Spool table actions ───────────────────────────────────────────────────────
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
  await loadPage();
  spoolStore.fetchSpools();
}

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

<style scoped>
.spools-tab-layout {
  display: flex;
  gap: 16px;
  align-items: flex-start;
}

.spools-main-content {
  flex: 1;
  min-width: 0;
}
</style>
