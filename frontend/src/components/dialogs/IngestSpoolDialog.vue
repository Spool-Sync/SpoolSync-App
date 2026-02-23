<template>
  <v-dialog v-model="model" max-width="700" scrollable>
    <v-card rounded="xl">
      <!-- ── Header ───────────────────────────────────────────────── -->
      <v-card-title class="pa-4 pb-2 d-flex align-center gap-2">
        <v-icon color="orange">mdi-tray-arrow-down</v-icon>
        Ingest Spool
      </v-card-title>

      <v-card-text class="pa-4">
        <!-- Station picker -->
        <v-select
          v-model="selectedStationId"
          :items="stationOptions"
          label="Ingest Station"
          variant="outlined"
          density="compact"
          prepend-inner-icon="mdi-scale"
          clearable
          no-data-text="No ingest point holders configured"
          class="mb-3"
        />

        <!-- No stations configured -->
        <v-alert
          v-if="stationOptions.length === 0"
          type="info"
          variant="tonal"
          density="compact"
          class="mb-4"
        >
          No ingest point holders found.
          <router-link to="/spool-holders" @click="model = false">Configure one →</router-link>
        </v-alert>

        <!-- Live readout: scale + NFC as separate cards -->
        <div v-if="selectedStationId" class="mb-4">
          <div
            v-if="selectedStation?.hasLoadCell || selectedStation?.hasNfc"
            class="d-flex gap-6"
          >
            <!-- Scale -->
            <v-card
              v-if="selectedStation?.hasLoadCell"
              variant="tonal"
              color="primary"
              rounded="lg"
              class="flex-1-1"
            >
              <v-card-text class="pa-3 d-flex align-center gap-3">
                <v-icon size="28" color="primary">mdi-scale</v-icon>
                <div>
                  <div class="text-caption text-medium-emphasis">Scale</div>
                  <div class="text-h6 font-weight-bold">
                    {{ liveWeight != null ? Math.round(liveWeight) : '—' }}
                    <span class="text-body-2 text-medium-emphasis">g</span>
                  </div>
                </div>
              </v-card-text>
            </v-card>

            <!-- NFC -->
            <v-card
              v-if="selectedStation?.hasNfc"
              variant="tonal"
              :color="liveNfcTagId ? 'primary' : undefined"
              rounded="lg"
              class="flex-1-1"
            >
              <v-card-text class="pa-3 d-flex align-center gap-3">
                <v-icon size="28" :color="liveNfcTagId ? 'primary' : 'medium-emphasis'">mdi-nfc</v-icon>
                <div>
                  <div class="text-caption text-medium-emphasis">NFC Tag</div>
                  <div class="text-body-2 font-weight-medium font-mono">
                    {{ liveNfcTagId ?? '—' }}
                  </div>
                </div>
              </v-card-text>
            </v-card>
          </div>
          <p v-else class="text-body-2 text-medium-emphasis">
            This holder has no sensors — enter weight manually below.
          </p>
        </div>

        <!-- Success chip (new spool created) -->
        <v-alert
          v-if="lastCreated"
          type="success"
          variant="tonal"
          density="compact"
          closable
          class="mb-4"
          @click:close="lastCreated = null"
        >
          Spool created!
          <router-link :to="`/spools/${lastCreated.spoolId}`" class="ml-2" @click="model = false">View →</router-link>
        </v-alert>

        <v-divider class="mb-4" />

        <!-- ── Known spool on the holder ─────────────────────────── -->
        <template v-if="knownSpool">
          <v-card rounded="lg" variant="tonal" color="secondary" class="mb-2">
            <v-card-text class="pa-4">
              <div class="d-flex align-center gap-3 mb-3">
                <div
                  class="color-dot"
                  :style="{ background: knownSpool.filamentType.colorHex || '#9e9e9e' }"
                />
                <div>
                  <div class="text-body-1 font-weight-bold">{{ knownSpool.filamentType.name }}</div>
                  <div class="text-caption text-medium-emphasis">
                    {{ knownSpool.filamentType.brand }} · {{ knownSpool.filamentType.material }}
                    <span v-if="knownSpool.filamentType.color"> · {{ knownSpool.filamentType.color }}</span>
                  </div>
                </div>
                <v-spacer />
                <v-chip size="small" color="secondary" variant="tonal">Known Spool</v-chip>
              </div>
              <v-row dense>
                <v-col cols="6">
                  <div class="text-caption text-medium-emphasis">Current Weight</div>
                  <div class="text-body-1 font-weight-bold">
                    {{ liveWeight != null ? Math.round(liveWeight) : Math.round(knownSpool.currentWeight_g) }}g
                  </div>
                </v-col>
                <v-col cols="6">
                  <div class="text-caption text-medium-emphasis">Initial Weight</div>
                  <div class="text-body-2">{{ Math.round(knownSpool.initialWeight_g) }}g</div>
                </v-col>
              </v-row>
              <div class="text-caption text-medium-emphasis mt-2">
                <v-icon size="14" class="mr-1">mdi-clock-outline</v-icon>
                Weight will auto-update after 5 s of stable reading
              </div>
            </v-card-text>
          </v-card>
        </template>

        <!-- ── Create new spool form ──────────────────────────────── -->
        <template v-else>

          <!-- ── OpenPrintTag detected ───────────────────────────── -->
          <template v-if="openPrintTagData && !useManualFlow">
            <v-card rounded="lg" variant="tonal" color="primary" class="mb-3">
              <v-card-text class="pa-3">
                <div class="d-flex align-center gap-3 mb-2">
                  <v-icon color="primary">mdi-nfc-variant</v-icon>
                  <span class="text-body-2 font-weight-bold">OpenPrintTag detected</span>
                  <v-spacer />
                  <v-btn size="x-small" variant="text" @click="useManualFlow = true">
                    Change manually
                  </v-btn>
                </div>
                <div class="d-flex align-center gap-3">
                  <div
                    v-if="openPrintTagData.colorHex"
                    class="rounded-circle flex-shrink-0"
                    :style="{ width: '36px', height: '36px', background: openPrintTagData.colorHex, border: '2px solid rgba(255,255,255,0.2)' }"
                  />
                  <div>
                    <div class="text-body-1 font-weight-bold">
                      {{ openPrintTagData.brand }} {{ openPrintTagData.name }}
                    </div>
                    <div class="text-caption text-medium-emphasis">
                      {{ openPrintTagData.material }}
                      <span v-if="openPrintTagData.nozzleTempMin"> · {{ openPrintTagData.nozzleTempMin }}–{{ openPrintTagData.nozzleTempMax }}°C nozzle</span>
                      <span v-if="openPrintTagData.bedTempMin"> · {{ openPrintTagData.bedTempMin }}–{{ openPrintTagData.bedTempMax }}°C bed</span>
                    </div>
                  </div>
                </div>

                <!-- Match status -->
                <div class="mt-2">
                  <v-progress-linear v-if="optMatching" indeterminate color="primary" rounded height="2" />
                  <v-chip
                    v-else-if="optMatchedFT"
                    size="small"
                    color="success"
                    variant="tonal"
                    prepend-icon="mdi-check-circle"
                  >
                    Matched: {{ optMatchedFT.brand }} {{ optMatchedFT.name }}
                  </v-chip>
                  <v-chip
                    v-else
                    size="small"
                    color="orange"
                    variant="tonal"
                    prepend-icon="mdi-plus-circle"
                  >
                    New custom type will be created
                  </v-chip>
                </div>
              </v-card-text>
            </v-card>
          </template>

          <!-- ── Cascading filament dropdowns (manual or no OPT data) ── -->
          <template v-else>
          <v-select
            v-model="selectedBrand"
            :items="sortedBrands"
            item-title="title"
            item-value="value"
            label="Manufacturer"
            variant="outlined"
            density="compact"
            :loading="brandsLoading"
            :disabled="!selectedStationId"
            required
            class="mb-2"
            @update:model-value="onBrandChange"
          >
            <template #item="{ item, props: ip }">
              <v-divider v-if="item.raw.isDivider" class="my-1" />
              <v-list-item v-else v-bind="ip">
                <template #append>
                  <v-btn
                    :icon="favoriteBrands.has(item.raw.value) ? 'mdi-star' : 'mdi-star-outline'"
                    :color="favoriteBrands.has(item.raw.value) ? 'warning' : undefined"
                    size="x-small"
                    variant="text"
                    @click.stop="toggleFavorite(item.raw.value)"
                  />
                </template>
              </v-list-item>
            </template>
          </v-select>

          <v-select
            v-model="selectedMaterialType"
            :items="materialTypes"
            label="Material Type"
            variant="outlined"
            density="compact"
            :loading="materialTypesLoading"
            :disabled="!selectedBrand"
            required
            class="mb-2"
            @update:model-value="onMaterialTypeChange"
          />

          <v-select
            v-model="selectedMaterial"
            :items="materials"
            label="Material"
            variant="outlined"
            density="compact"
            :loading="materialsLoading"
            :disabled="!selectedMaterialType"
            required
            class="mb-2"
            @update:model-value="onMaterialChange"
          />

          <!-- Color swatches -->
          <div v-if="selectedMaterial" class="mb-3">
            <div class="text-caption text-medium-emphasis mb-2">Color</div>
            <div v-if="filamentTypeStore.loading" class="d-flex align-center ga-2 mb-2">
              <v-progress-circular indeterminate size="18" width="2" />
              <span class="text-caption text-medium-emphasis">Loading variants…</span>
            </div>
            <div v-else-if="filteredFilamentTypes.length" class="d-flex flex-wrap ga-2 mb-1">
              <v-tooltip
                v-for="variant in filteredFilamentTypes"
                :key="variant.color || 'standard'"
                :text="variant.color || 'Standard'"
                location="top"
              >
                <template #activator="{ props: tip }">
                  <div
                    v-bind="tip"
                    class="color-swatch"
                    :class="{ 'color-swatch--active': isSelected(variant) }"
                    :style="{ background: variant.colorHex || '#9e9e9e' }"
                    @click="selectVariant(variant)"
                  >
                    <v-icon v-if="isSelected(variant)" size="14" color="white">mdi-check</v-icon>
                  </div>
                </template>
              </v-tooltip>
            </div>
            <p v-if="selectedVariant" class="text-body-2 text-medium-emphasis mt-1">
              {{ selectedVariant.color || 'Standard' }}
            </p>
          </div>

          </template><!-- end cascading dropdowns / manual flow -->

          <!-- Weight — only shown when no live load cell reading is available -->
          <v-row v-if="liveWeight === null" dense class="mb-1">
            <v-col cols="6">
              <v-text-field
                v-model.number="formData.initialWeight_g"
                label="Initial Weight (g)"
                type="number"
                variant="outlined"
                density="compact"
              />
            </v-col>
            <v-col cols="6">
              <v-text-field
                v-model.number="formData.currentWeight_g"
                label="Current Weight (g)"
                type="number"
                variant="outlined"
                density="compact"
              />
            </v-col>
          </v-row>

          <!-- NFC tag — hidden when the station has a hardware reader; shown for manual/phone NFC -->
          <div v-if="!selectedStation?.hasNfc" class="mb-2">
            <!-- Phone NFC active chip -->
            <div v-if="phoneNfcScanning" class="d-flex align-center gap-2 mb-1">
              <v-chip color="primary" size="small" prepend-icon="mdi-cellphone-nfc">
                Phone NFC active
              </v-chip>
              <v-btn
                variant="text"
                size="x-small"
                @click="stopPhoneNfc"
              >
                Enter manually
              </v-btn>
            </div>
            <v-text-field
              v-model="formData.nfcTagId"
              :label="phoneNfcScanning ? 'NFC Tag (phone reader)' : 'NFC Tag ID (optional)'"
              :prepend-inner-icon="phoneNfcScanning ? 'mdi-cellphone-nfc' : 'mdi-nfc'"
              variant="outlined"
              density="compact"
              :readonly="phoneNfcScanning"
              :error="nfcTagDuplicate"
              :error-messages="nfcTagDuplicate ? 'Tag already assigned to another spool' : ''"
            />
          </div>

          <!-- Notes -->
          <v-textarea
            v-model="formData.notes"
            label="Notes (optional)"
            variant="outlined"
            density="compact"
            rows="2"
          />
        </template>
      </v-card-text>

      <v-card-actions class="pa-4 pt-0">
        <v-spacer />
        <v-btn @click="model = false">{{ knownSpool ? 'Close' : 'Cancel' }}</v-btn>
        <v-btn
          v-if="knownSpool"
          color="secondary"
          variant="tonal"
          :to="`/spools/${knownSpool.spoolId}`"
          @click="model = false"
        >
          View Spool
        </v-btn>
        <v-btn
          v-else
          color="orange"
          :loading="saving"
          :disabled="!selectedStationId || (!formData.filamentTypeId && !selectedVariant && !(openPrintTagData && !useManualFlow)) || nfcTagDuplicate"
          @click="handleSubmit"
        >
          Create Spool
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup>
import { ref, reactive, computed, watch, onMounted, onUnmounted } from 'vue';
import { useSpoolStore } from '@/store/spools';
import { useSpoolHolderStore } from '@/store/spoolHolders';
import { useFilamentTypeStore } from '@/store/filamentTypes';
import { useAuthStore } from '@/store/auth';
import { useFavoriteBrands } from '@/composables/useFavoriteBrands';
import apiClient from '@/services/apiClient';

const props = defineProps({
  modelValue: { type: Boolean, required: true },
  initialNfcTagId: { type: String, default: null },
  openPrintTagData: { type: Object, default: null },
});
const emit = defineEmits(['update:modelValue', 'created']);

const model = computed({
  get: () => props.modelValue,
  set: (v) => emit('update:modelValue', v),
});

const spoolStore = useSpoolStore();
const spoolHolderStore = useSpoolHolderStore();
const filamentTypeStore = useFilamentTypeStore();
const authStore = useAuthStore();
const { favoriteBrands, toggleFavorite } = useFavoriteBrands();

// ── OpenPrintTag auto-fill ─────────────────────────────────────────────────
const optMatching   = ref(false);
const optMatchedFT  = ref(null);   // matched existing FilamentType or null
const useManualFlow = ref(false);  // user can override and use cascading dropdowns

function colorDistance(hex1, hex2) {
  if (!hex1 || !hex2) return Infinity;
  const parse = (h) => [
    parseInt(h.slice(1, 3), 16),
    parseInt(h.slice(3, 5), 16),
    parseInt(h.slice(5, 7), 16),
  ];
  const [r1, g1, b1] = parse(hex1);
  const [r2, g2, b2] = parse(hex2);
  return Math.sqrt((r1 - r2) ** 2 + (g1 - g2) ** 2 + (b1 - b2) ** 2);
}

async function applyOpenPrintTagData(tagData) {
  if (!tagData) return;
  useManualFlow.value = false;
  optMatchedFT.value = null;

  // Pre-fill weights from tag (current = netto - consumed; initial = total on scale)
  if (tagData.currentWeight_g != null) {
    formData.currentWeight_g = Math.round(tagData.currentWeight_g);
  }
  if (tagData.totalWeight_g != null) {
    formData.initialWeight_g = Math.round(tagData.totalWeight_g);
  } else if (tagData.nettoWeight_g != null) {
    formData.initialWeight_g = Math.round(tagData.nettoWeight_g);
  }

  if (!tagData.brand || !tagData.material) return;

  // Try to find a matching FilamentType in the DB
  optMatching.value = true;
  try {
    await filamentTypeStore.fetchFilamentTypes({
      brand: tagData.brand,
      material: tagData.material,
      name: tagData.name ?? undefined,
    });
    const variants = filamentTypeStore.filamentTypes;
    if (variants.length > 0) {
      // Pick the variant whose color is closest to the tag's primary color
      let best = variants[0];
      if (tagData.colorHex && variants.length > 1) {
        let minDist = Infinity;
        for (const v of variants) {
          const d = colorDistance(tagData.colorHex, v.colorHex);
          if (d < minDist) { minDist = d; best = v; }
        }
      }
      optMatchedFT.value = best;
      formData.filamentTypeId = best.filamentTypeId;
    }
  } finally {
    optMatching.value = false;
  }
}

watch(() => props.openPrintTagData, (tagData) => {
  if (tagData) applyOpenPrintTagData(tagData);
  else { optMatchedFT.value = null; useManualFlow.value = false; }
}, { immediate: true });

// ── Station picker ─────────────────────────────────────────────────────────
const ingestStations = ref([]);
const selectedStationId = ref(authStore.preferences.ingestStationId || null);

const stationOptions = computed(() =>
  ingestStations.value.map((h) => ({ title: h.name, value: h.spoolHolderId }))
);

const selectedStation = computed(() =>
  ingestStations.value.find((h) => h.spoolHolderId === selectedStationId.value) ?? null
);

watch(selectedStationId, (id) => {
  authStore.updatePreferences({ ingestStationId: id ?? null });
});

// ── Phone NFC fallback (Android Chrome when station has no hardware NFC) ────
const phoneNfcScanning = ref(false);
let nfcAbortController = null;

const phoneNfcActive = computed(() =>
  'NDEFReader' in window &&
  !!selectedStation.value &&
  !selectedStation.value.hasNfc
);

async function startPhoneNfc() {
  if (!phoneNfcActive.value || phoneNfcScanning.value) return;
  try {
    nfcAbortController = new AbortController();
    const reader = new window.NDEFReader();
    await reader.scan({ signal: nfcAbortController.signal });
    phoneNfcScanning.value = true;
    reader.onreading = (event) => {
      for (const record of event.message.records) {
        if (record.recordType === 'text') {
          const decoder = new TextDecoder(record.encoding || 'utf-8');
          formData.nfcTagId = decoder.decode(record.data);
          break;
        } else if (record.recordType === 'url') {
          const decoder = new TextDecoder();
          const url = decoder.decode(record.data);
          formData.nfcTagId = url.split('/').pop();
          break;
        }
      }
    };
  } catch {
    // NDEFReader unavailable or permission denied — degrade gracefully
    phoneNfcScanning.value = false;
    nfcAbortController = null;
  }
}

function stopPhoneNfc() {
  if (nfcAbortController) {
    nfcAbortController.abort();
    nfcAbortController = null;
  }
  phoneNfcScanning.value = false;
}

// Start phone NFC when a station without hardware NFC is selected
watch(phoneNfcActive, (active) => {
  if (active) startPhoneNfc();
  else stopPhoneNfc();
}, { immediate: false });

// Stop phone NFC when dialog closes
watch(model, (open) => {
  if (!open) stopPhoneNfc();
  // When reopened with an external tag, re-apply it
  if (open && props.initialNfcTagId) formData.nfcTagId = props.initialNfcTagId;
});

// When the parent changes the initial tag (e.g. different scan result), apply it
watch(() => props.initialNfcTagId, (tag) => {
  if (tag) formData.nfcTagId = tag;
});

onUnmounted(() => stopPhoneNfc());

// ── Live sensor data from ingest:update WebSocket events ───────────────────
const liveIngest = computed(() =>
  selectedStationId.value
    ? (spoolHolderStore.ingestUpdates[selectedStationId.value] ?? null)
    : null
);

const liveWeight = computed(() =>
  liveIngest.value?.currentWeight_g ?? selectedStation.value?.currentWeight_g ?? null
);

const liveNfcTagId = computed(() =>
  liveIngest.value?.nfcTagId ?? selectedStation.value?.nfcTagId ?? null
);

// Known spool: immediately resolved from ingest:update when the NFC tag matches a DB spool
const knownSpool = computed(() => liveIngest.value?.knownSpool ?? null);

// Identification banner state (post-debounce, for the in-dialog alert)
const identifiedSpool = computed(() =>
  selectedStationId.value
    ? (spoolHolderStore.spoolIdentifications[selectedStationId.value] ?? null)
    : null
);

function clearIdentification() {
  if (selectedStationId.value) spoolHolderStore.clearSpoolIdentification(selectedStationId.value);
}

// Duplicate NFC tag check for manual entry
const nfcTagDuplicate = ref(false);
let nfcCheckTimer = null;
watch(() => formData.nfcTagId, (tag) => {
  nfcTagDuplicate.value = false;
  if (nfcCheckTimer) clearTimeout(nfcCheckTimer);
  if (!tag) return;
  nfcCheckTimer = setTimeout(async () => {
    try {
      await apiClient.get(`/spools/by-nfc/${encodeURIComponent(tag)}`);
      nfcTagDuplicate.value = true; // 200 means the tag already exists
    } catch (e) {
      if (e.response?.status === 404) nfcTagDuplicate.value = false;
    }
  }, 400);
});

// Auto-fill weight fields from live scale
watch(liveWeight, (w) => {
  if (w != null) {
    formData.initialWeight_g = Math.round(w);
    formData.currentWeight_g = Math.round(w);
  }
});

// Auto-fill NFC tag field; clear identification when spool is removed from holder
watch(liveNfcTagId, (tag) => {
  formData.nfcTagId = tag ?? '';
  if (!tag) clearIdentification();
});

// When station changes, seed the form with its current readings
watch(selectedStation, (s) => {
  if (!s) return;
  if (s.currentWeight_g != null) {
    formData.initialWeight_g = Math.round(s.currentWeight_g);
    formData.currentWeight_g = Math.round(s.currentWeight_g);
  }
  formData.nfcTagId = s.nfcTagId ?? '';
});

// ── Cascading filament dropdowns (mirrors SpoolForm) ───────────────────────
const brands = ref([]);
const brandsLoading = ref(false);
const selectedBrand = ref('');

const sortedBrands = computed(() => {
  const favs = brands.value.filter((b) => favoriteBrands.value.has(b));
  const rest = brands.value.filter((b) => !favoriteBrands.value.has(b));
  if (!favs.length) return brands.value.map((b) => ({ title: b, value: b }));
  return [
    ...favs.map((b) => ({ title: b, value: b })),
    { title: '', value: '__divider__', isDivider: true, disabled: true },
    ...rest.map((b) => ({ title: b, value: b })),
  ];
});

const materialTypes = ref([]);
const materialTypesLoading = ref(false);
const selectedMaterialType = ref('');

const materials = ref([]);
const materialsLoading = ref(false);
const selectedMaterial = ref('');

const filteredFilamentTypes = ref([]);
const selectedVariant = ref(null);

async function onBrandChange() {
  selectedMaterialType.value = '';
  selectedMaterial.value = '';
  selectedVariant.value = null;
  formData.filamentTypeId = '';
  materialTypesLoading.value = true;
  materialTypes.value = await filamentTypeStore.fetchMaterialTypes(selectedBrand.value);
  materialTypesLoading.value = false;
  materials.value = [];
  filteredFilamentTypes.value = [];
}

async function onMaterialTypeChange() {
  selectedMaterial.value = '';
  selectedVariant.value = null;
  formData.filamentTypeId = '';
  materialsLoading.value = true;
  materials.value = await filamentTypeStore.fetchMaterials(selectedBrand.value, selectedMaterialType.value);
  materialsLoading.value = false;
  filteredFilamentTypes.value = [];
}

async function onMaterialChange(material) {
  selectedVariant.value = null;
  formData.filamentTypeId = '';
  filteredFilamentTypes.value = [];
  await filamentTypeStore.fetchFilamentTypes({
    brand: selectedBrand.value,
    material: selectedMaterialType.value,
    name: material,
  });
  filteredFilamentTypes.value = filamentTypeStore.filamentTypes;
}

function isSelected(variant) {
  if (!selectedVariant.value) return false;
  return selectedVariant.value.color === variant.color &&
         selectedVariant.value.colorHex === variant.colorHex;
}

function selectVariant(variant) {
  selectedVariant.value = variant;
  formData.filamentTypeId = variant.filamentTypeId || null;
}

// ── Form data ──────────────────────────────────────────────────────────────
const formData = reactive({
  filamentTypeId: '',
  initialWeight_g: 1000,
  currentWeight_g: 1000,
  nfcTagId: '',
  notes: '',
  orderStatus: 'IN_STOCK',
});

const saving = ref(false);
const lastCreated = ref(null);

// ── Lifecycle ──────────────────────────────────────────────────────────────
onMounted(async () => {
  brandsLoading.value = true;
  const [brandsResult, stationsRes] = await Promise.all([
    filamentTypeStore.fetchBrands(),
    apiClient.get('/spool-holders', { params: { assignmentType: 'INGEST_POINT' } }),
  ]);
  brands.value = brandsResult;
  ingestStations.value = stationsRes.data;
  brandsLoading.value = false;

  // Seed form with current readings of the saved station
  if (selectedStation.value) {
    if (selectedStation.value.currentWeight_g != null) {
      formData.initialWeight_g = Math.round(selectedStation.value.currentWeight_g);
      formData.currentWeight_g = Math.round(selectedStation.value.currentWeight_g);
    }
    formData.nfcTagId = selectedStation.value.nfcTagId ?? '';
  }

  // Pre-fill NFC tag if opened from an external scan (e.g. navbar or page-level scan)
  if (props.initialNfcTagId) {
    formData.nfcTagId = props.initialNfcTagId;
  }
});

// ── Submit ─────────────────────────────────────────────────────────────────
async function handleSubmit() {
  saving.value = true;
  try {
    const payload = { ...formData };

    if (!payload.filamentTypeId) {
      if (props.openPrintTagData && !useManualFlow.value) {
        // Build a new custom FilamentType from the OPT tag data
        const d = props.openPrintTagData;
        payload.filamentTypeData = {
          brand: d.brand,
          name: d.name,
          material: d.material,
          color: d.colorHex,      // use hex as color name fallback
          colorHex: d.colorHex,
          diameter_mm: d.diameter_mm,
          density_g_cm3: d.density_g_cm3,
          spoolWeight_g: d.spoolWeight_g ?? 200,
          nozzleTempMin: d.nozzleTempMin,
          nozzleTempMax: d.nozzleTempMax,
          bedTempMin: d.bedTempMin,
          bedTempMax: d.bedTempMax,
          custom: true,
        };
      } else if (selectedVariant.value) {
        payload.filamentTypeData = { ...selectedVariant.value };
      }
    }

    payload.nfcTagId = payload.nfcTagId || null;
    lastCreated.value = await spoolStore.createSpool(payload);
    resetForm();
  } finally {
    saving.value = false;
  }
}

function resetForm() {
  selectedBrand.value = '';
  selectedMaterialType.value = '';
  selectedMaterial.value = '';
  selectedVariant.value = null;
  filteredFilamentTypes.value = [];
  materialTypes.value = [];
  materials.value = [];
  Object.assign(formData, {
    filamentTypeId: '',
    initialWeight_g: liveWeight.value != null ? Math.round(liveWeight.value) : 1000,
    currentWeight_g: liveWeight.value != null ? Math.round(liveWeight.value) : 1000,
    nfcTagId: liveNfcTagId.value ?? '',
    notes: '',
    orderStatus: 'IN_STOCK',
  });
}
</script>

<style scoped>
.color-dot {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  flex-shrink: 0;
  border: 2px solid rgba(255, 255, 255, 0.15);
}

.color-swatch {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  cursor: pointer;
  border: 2px solid rgba(0, 0, 0, 0.12);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: transform 0.15s;
}
.color-swatch:hover { transform: scale(1.15); }
.color-swatch--active {
  border-color: rgba(255, 255, 255, 0.9);
  box-shadow: 0 0 0 2px rgba(0, 0, 0, 0.5);
}
</style>
