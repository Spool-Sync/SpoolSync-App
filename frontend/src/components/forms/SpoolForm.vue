<template>
  <v-card rounded="xl">
    <v-card-title class="pa-4">{{
      spool ? "Edit Spool" : "Add Spool"
    }}</v-card-title>
    <v-card-text>
      <v-form ref="form" @submit.prevent="handleSubmit">

        <!-- ── EDIT MODE: only weight, location, and NFC tag ── -->
        <template v-if="spool">
          <!-- Read-only filament type display -->
          <v-list-item
            v-if="spool.filamentType"
            rounded="lg"
            class="mb-4 pa-3"
            :style="{ background: 'rgba(var(--v-theme-surface-variant), 0.4)', border: '1px solid rgba(var(--v-border-color), 0.12)' }"
          >
            <template #prepend>
              <div
                class="rounded-circle mr-2"
                :style="{ width: '20px', height: '20px', background: spool.filamentType.colorHex || '#9e9e9e', flexShrink: 0 }"
              />
            </template>
            <v-list-item-title class="text-body-2 font-weight-medium">
              {{ spool.filamentType.brand }} · {{ spool.filamentType.material }}
            </v-list-item-title>
            <v-list-item-subtitle class="text-caption">
              {{ spool.filamentType.name }}{{ spool.filamentType.color ? ` · ${spool.filamentType.color}` : '' }}
            </v-list-item-subtitle>
          </v-list-item>

          <!-- Weight section: ingest mode or manual mode -->
          <div class="mb-2">

            <!-- ── Ingest mode ── -->
            <div v-if="showIngest" class="pa-3 rounded-lg" style="border: 1px solid rgba(var(--v-border-color), 0.2); background: rgba(var(--v-theme-surface-variant), 0.3)">
              <!-- Header: ingest point selector + pencil to go manual -->
              <div class="d-flex align-center mb-3">
                <v-select
                  v-model="selectedIngestId"
                  :items="ingestHolders"
                  item-title="name"
                  item-value="spoolHolderId"
                  label="Ingest point"
                  variant="outlined"
                  density="compact"
                  clearable
                  hide-details
                  class="flex-grow-1"
                />
                <v-tooltip text="Switch to manual entry" location="top">
                  <template #activator="{ props: tip }">
                    <v-btn
                      v-bind="tip"
                      size="x-small"
                      variant="text"
                      icon="mdi-pencil"
                      class="ml-2"
                      @click="switchToManual"
                    />
                  </template>
                </v-tooltip>
              </div>

              <div v-if="selectedIngestId">
                <!-- Two-column: saved weight vs live sensor weight -->
                <div class="d-flex ga-4 mb-3">
                  <div class="flex-1">
                    <div class="text-caption text-medium-emphasis mb-1">Saved weight</div>
                    <div class="text-h6 font-weight-bold">{{ Math.round(formData.currentWeight_g) }}g</div>
                    <div class="text-caption text-medium-emphasis">
                      {{ Math.round(Math.max(0, formData.currentWeight_g - (spool?.filamentType?.spoolWeight_g ?? 200))) }}g filament
                    </div>
                  </div>
                  <v-divider vertical />
                  <div class="flex-1">
                    <div class="text-caption text-medium-emphasis mb-1">On scale now</div>
                    <div class="text-h6 font-weight-bold" :class="liveWeight != null ? '' : 'text-medium-emphasis'">
                      {{ liveWeight != null ? `${Math.round(liveWeight)}g` : '—' }}
                    </div>
                    <div v-if="liveWeight != null" class="text-caption text-medium-emphasis">
                      {{ Math.round(Math.max(0, liveWeight - (spool?.filamentType?.spoolWeight_g ?? 200))) }}g filament
                    </div>
                  </div>
                </div>
                <v-btn
                  color="primary"
                  variant="tonal"
                  size="small"
                  block
                  :disabled="liveWeight == null"
                  @click="applyLiveWeight"
                >
                  <v-icon start>mdi-check</v-icon>
                  Use scale reading ({{ liveWeight != null ? `${Math.round(liveWeight)}g` : '—' }})
                </v-btn>
              </div>
              <div v-else class="text-caption text-medium-emphasis text-center py-2">
                Select an ingest point to read live weight
              </div>
            </div>

            <!-- ── Manual mode ── -->
            <v-text-field
              v-else
              v-model.number="formData.currentWeight_g"
              label="Current Weight (g)"
              type="number"
              variant="outlined"
              density="compact"
              hide-details
              required
            >
              <template #append-inner>
                <v-tooltip text="Use ingest scale" location="top">
                  <template #activator="{ props: tip }">
                    <v-btn
                      v-bind="tip"
                      size="x-small"
                      variant="text"
                      icon="mdi-scale"
                      :disabled="ingestHolders.length === 0"
                      @click="showIngest = true; persistIngestPreference(true)"
                    />
                  </template>
                </v-tooltip>
              </template>
            </v-text-field>

          </div>

          <v-select
            v-model="storageLocationId"
            :items="storageLocations"
            item-title="name"
            item-value="storageLocationId"
            label="Storage Location (optional)"
            variant="outlined"
            density="compact"
            clearable
            class="mb-2"
          >
            <template #item="{ item, props: itemProps }">
              <v-list-item
                v-bind="itemProps"
                :subtitle="storageTypeInfo(item.raw.type).label"
              >
                <template #prepend>
                  <v-icon
                    :icon="storageTypeInfo(item.raw.type).icon"
                    :color="storageTypeInfo(item.raw.type).color"
                    size="small"
                    class="mr-1"
                  />
                </template>
              </v-list-item>
            </template>
          </v-select>

          <v-text-field
            v-model="formData.nfcTagId"
            label="NFC Tag ID (optional)"
            prepend-inner-icon="mdi-nfc"
            variant="outlined"
            density="compact"
          />
        </template>

        <!-- ── CREATE MODE: full filament selection flow ── -->
        <template v-else>
          <!-- Cascading dropdowns: Brand → Material Type → Material Name -->
          <v-select
            v-model="selectedBrand"
            :items="sortedBrands"
            item-title="title"
            item-value="value"
            label="Manufacturer"
            variant="outlined"
            density="compact"
            :loading="brandsLoading"
            required
            class="mb-2"
            @update:modelValue="onBrandChange"
          >
            <template #item="{ item, props: itemProps }">
              <v-divider v-if="item.raw.isDivider" class="my-1" />
              <v-list-item v-else v-bind="itemProps">
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
            @update:modelValue="onMaterialTypeChange"
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
            @update:modelValue="onMaterialChange"
          />

          <!-- Color swatch picker -->
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

          <!-- Weight fields -->
          <v-row dense>
            <v-col cols="6">
              <v-text-field
                v-model.number="formData.initialWeight_g"
                label="Initial Weight (g)"
                type="number"
                variant="outlined"
                density="compact"
                :disabled="initialWeightLocked"
                :hint="initialWeightLocked ? 'Standard 1 kg spool' : ''"
                persistent-hint
                required
              />
            </v-col>
            <v-col cols="6">
              <v-text-field
                v-model.number="formData.currentWeight_g"
                label="Current Weight (g)"
                type="number"
                variant="outlined"
                density="compact"
                required
              />
            </v-col>
          </v-row>

          <v-text-field
            v-if="selectedVariant"
            v-model.number="spoolCoreWeight"
            label="Empty Spool Core Weight (g)"
            type="number"
            variant="outlined"
            density="compact"
            hint="Weight of the plastic spool itself — used to calculate filament remaining"
            persistent-hint
            class="mb-2"
          />

          <v-text-field
            v-model="formData.nfcTagId"
            label="NFC Tag ID (optional)"
            prepend-inner-icon="mdi-nfc"
            variant="outlined"
            density="compact"
            class="mb-2"
          />

          <!-- Reorder threshold (per filament type) -->
          <v-row dense>
            <v-col cols="7">
              <v-text-field
                v-model.number="reorderThresholdInput"
                :label="`Filament Type Reorder Threshold (${reorderUnit})`"
                type="number"
                variant="outlined"
                density="compact"
                hint="Applies to all spools of this filament type"
                persistent-hint
                class="mb-2"
              />
            </v-col>
            <v-col cols="5">
              <v-select
                v-model="reorderUnit"
                :items="['g', 'kg', 'spools']"
                label="Unit"
                variant="outlined"
                density="compact"
                class="mb-2"
              />
            </v-col>
          </v-row>

          <v-select
            v-model="storageLocationId"
            :items="storageLocations"
            item-title="name"
            item-value="storageLocationId"
            label="Storage Location (optional)"
            variant="outlined"
            density="compact"
            clearable
            class="mb-2"
          >
            <template #item="{ item, props: itemProps }">
              <v-list-item
                v-bind="itemProps"
                :subtitle="storageTypeInfo(item.raw.type).label"
              >
                <template #prepend>
                  <v-icon
                    :icon="storageTypeInfo(item.raw.type).icon"
                    :color="storageTypeInfo(item.raw.type).color"
                    size="small"
                    class="mr-1"
                  />
                </template>
              </v-list-item>
            </template>
          </v-select>

          <v-select
            v-model="formData.orderStatus"
            :items="orderStatusOptions"
            label="Order Status"
            variant="outlined"
            density="compact"
            class="mb-2"
          />

          <v-textarea
            v-model="formData.notes"
            label="Notes (optional)"
            variant="outlined"
            density="compact"
            rows="2"
          />
        </template>

      </v-form>
    </v-card-text>
    <v-card-actions class="pa-4 pt-0">
      <v-spacer />
      <v-btn @click="$emit('cancel')">Cancel</v-btn>
      <v-btn color="primary" :loading="saving" @click="handleSubmit">Save</v-btn>
    </v-card-actions>
  </v-card>
</template>

<script setup>
import { ref, reactive, computed, watch, onMounted, onUnmounted } from "vue";
import { useSpoolStore } from "@/store/spools";
import { useFilamentTypeStore } from "@/store/filamentTypes";
import { useSpoolHolderStore } from "@/store/spoolHolders";
import { useAuthStore } from "@/store/auth";
import { useFavoriteBrands } from "@/composables/useFavoriteBrands";
import apiClient from "@/services/apiClient";
import { storageTypeInfo } from "@/utils/storageTypes";

const props = defineProps({
  spool: { type: Object, default: null },
  defaults: { type: Object, default: () => ({}) },
});
const emit = defineEmits(["saved", "cancel"]);

const spoolStore = useSpoolStore();
const filamentTypeStore = useFilamentTypeStore();
const spoolHolderStore = useSpoolHolderStore();
const authStore = useAuthStore();
const { favoriteBrands, toggleFavorite } = useFavoriteBrands();

const saving = ref(false);
const initialWeightLocked = ref(false);
const reorderUnit = ref("g");
const reorderThresholdInput = ref(null);
const spoolCoreWeight = ref(200);

const orderStatusOptions = ["IN_STOCK", "REORDER_NEEDED", "ORDERED", "DELIVERED"];

// ── Ingest-point live weighing (edit mode only) ────────────────────────────
const showIngest = ref(false);
const selectedIngestId = ref(null);
const ingestHolders = ref([]);

// Persist holder selection to user preferences
watch(selectedIngestId, (id) => {
  authStore.updatePreferences({ ingestStationId: id ?? null });
});

function persistIngestPreference(useIngest) {
  authStore.updatePreferences({ useIngestMode: useIngest });
}

function switchToManual() {
  showIngest.value = false;
  persistIngestPreference(false);
}

const liveWeight = computed(() => {
  if (!selectedIngestId.value) return null;
  return spoolHolderStore.ingestUpdates[selectedIngestId.value]?.currentWeight_g ?? null;
});

function applyLiveWeight() {
  if (liveWeight.value != null) {
    formData.currentWeight_g = Math.round(liveWeight.value * 10) / 10;
  }
}

// Cascading dropdown state (create mode only)
const brands = ref([]);
const brandsLoading = ref(false);
const selectedBrand = ref("");

const sortedBrands = computed(() => {
  const favs = brands.value.filter((b) => favoriteBrands.value.has(b));
  const rest = brands.value.filter((b) => !favoriteBrands.value.has(b));
  if (!favs.length) return brands.value.map((b) => ({ title: b, value: b }));
  return [
    ...favs.map((b) => ({ title: b, value: b })),
    { title: "", value: "__divider__", isDivider: true, disabled: true },
    ...rest.map((b) => ({ title: b, value: b })),
  ];
});

const materialTypes = ref([]);
const materialTypesLoading = ref(false);
const selectedMaterialType = ref("");

const materials = ref([]);
const materialsLoading = ref(false);
const selectedMaterial = ref("");

const filteredFilamentTypes = ref([]);
const selectedVariant = ref(null);

// Storage location
const storageLocations = ref([]);
const storageLocationId = ref(props.spool?.storageLocations?.[0]?.storageLocationId ?? null);

const formData = reactive({
  filamentTypeId: props.spool?.filamentTypeId || "",
  initialWeight_g: props.spool?.initialWeight_g ?? props.defaults.initialWeight_g ?? 1000,
  currentWeight_g: props.spool?.currentWeight_g ?? props.defaults.currentWeight_g ?? 1000,
  nfcTagId: props.spool?.nfcTagId ?? props.defaults.nfcTagId ?? "",
  orderStatus: props.spool?.orderStatus || "IN_STOCK",
  notes: props.spool?.notes || "",
});

// Compute filament type reorder threshold in grams
const filamentTypeReorderThreshold_g = computed(() => {
  const val = reorderThresholdInput.value;
  if (val === null || val === undefined || val === "") return null;
  if (reorderUnit.value === "g") return val;
  if (reorderUnit.value === "kg") return val * 1000;
  if (reorderUnit.value === "spools") return val * (formData.initialWeight_g || 1000);
  return null;
});

onMounted(async () => {
  const requests = [
    filamentTypeStore.fetchBrands(),
    apiClient.get("/storage-locations"),
  ];
  if (props.spool) requests.push(apiClient.get("/spool-holders", { params: { assignmentType: 'INGEST_POINT' } }));

  const [brandsResult, locationsResult, holdersResult] = await Promise.all(requests);
  brands.value = brandsResult;
  storageLocations.value = locationsResult.data;
  if (holdersResult) {
    ingestHolders.value = holdersResult.data.filter(h => h.hasLoadCell);
    const savedId = authStore.preferences.ingestStationId;
    const savedMode = authStore.preferences.useIngestMode;
    if (savedMode && ingestHolders.value.length > 0) {
      showIngest.value = true;
      // Restore last-used holder if it still exists
      if (savedId && ingestHolders.value.find(h => h.spoolHolderId === savedId)) {
        selectedIngestId.value = savedId;
      }
    }
  }

  // Edit mode: no cascading dropdowns needed
  if (props.spool) return;

  // Create mode: no pre-population needed
});

async function loadVariants(materialName) {
  await filamentTypeStore.fetchFilamentTypes({
    brand: selectedBrand.value,
    material: selectedMaterialType.value,
    name: materialName,
  });
  filteredFilamentTypes.value = filamentTypeStore.filamentTypes;
}

function isSelected(variant) {
  if (!selectedVariant.value) return false;
  return (
    selectedVariant.value.color === variant.color &&
    selectedVariant.value.colorHex === variant.colorHex
  );
}

function selectVariant(variant) {
  selectedVariant.value = variant;
  formData.filamentTypeId = variant.filamentTypeId || null;
  formData.initialWeight_g = 1000;
  formData.currentWeight_g = 1000;
  initialWeightLocked.value = true;
  spoolCoreWeight.value = variant.spoolWeight_g ?? 200;
}

async function onBrandChange() {
  selectedMaterialType.value = "";
  selectedMaterial.value = "";
  selectedVariant.value = null;
  formData.filamentTypeId = "";
  initialWeightLocked.value = false;
  materialTypesLoading.value = true;
  materialTypes.value = await filamentTypeStore.fetchMaterialTypes(selectedBrand.value);
  materialTypesLoading.value = false;
  materials.value = [];
  filteredFilamentTypes.value = [];
}

async function onMaterialTypeChange() {
  selectedMaterial.value = "";
  selectedVariant.value = null;
  formData.filamentTypeId = "";
  initialWeightLocked.value = false;
  materialsLoading.value = true;
  materials.value = await filamentTypeStore.fetchMaterials(
    selectedBrand.value,
    selectedMaterialType.value,
  );
  materialsLoading.value = false;
  filteredFilamentTypes.value = [];
}

async function onMaterialChange(material) {
  selectedVariant.value = null;
  formData.filamentTypeId = "";
  initialWeightLocked.value = false;
  filteredFilamentTypes.value = [];
  await loadVariants(material);
}

async function handleSubmit() {
  saving.value = true;
  try {
    if (props.spool) {
      // Edit: only send weight, location, nfcTagId
      const payload = {
        currentWeight_g: formData.currentWeight_g,
        nfcTagId: formData.nfcTagId || null,
        storageLocationId: storageLocationId.value ?? null,
      };
      const updated = await spoolStore.updateSpool(props.spool.spoolId, payload);
      emit("saved", updated);
    } else {
      // Create: full payload
      const payload = { ...formData };
      if (!payload.filamentTypeId && selectedVariant.value) {
        payload.filamentTypeData = { ...selectedVariant.value, spoolWeight_g: spoolCoreWeight.value };
      }
      payload.filamentTypeSpoolWeight_g = spoolCoreWeight.value;
      payload.filamentTypeReorderThreshold_g = filamentTypeReorderThreshold_g.value;
      payload.storageLocationId = storageLocationId.value ?? null;
      const created = await spoolStore.createSpool(payload);
      emit("saved", created);
    }
  } finally {
    saving.value = false;
  }
}
</script>

<style scoped>
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

.color-swatch:hover {
  transform: scale(1.15);
}

.color-swatch--active {
  border-color: rgba(255, 255, 255, 0.9);
  box-shadow: 0 0 0 2px rgba(0, 0, 0, 0.5);
}
</style>
