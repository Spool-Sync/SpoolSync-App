<template>
  <v-dialog
    :model-value="modelValue"
    max-width="580"
    @update:model-value="$emit('update:modelValue', $event)"
  >
    <v-card rounded="xl">
      <v-card-title class="pa-4 pb-2 d-flex align-center ga-2">
        <v-icon color="success" size="20">mdi-recycle</v-icon>
        Refill Spool
      </v-card-title>

      <v-card-text class="pb-2">
        <v-form ref="form">

          <!-- ── Current filament summary ── -->
          <v-list-item
            v-if="spool?.filamentType"
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

          <!-- ── Filament section ── -->
          <div class="text-caption text-uppercase text-medium-emphasis mb-2 letter-spacing-wide">Filament</div>

          <v-btn-toggle
            v-model="filamentMode"
            mandatory
            density="compact"
            variant="outlined"
            color="primary"
            divided
            class="mb-3 w-100"
          >
            <v-btn value="same" class="flex-grow-1 text-caption">
              <v-icon size="16" start>mdi-check-circle-outline</v-icon>
              Same filament
            </v-btn>
            <v-btn value="different" class="flex-grow-1 text-caption">
              <v-icon size="16" start>mdi-swap-horizontal</v-icon>
              Changed filament
            </v-btn>
          </v-btn-toggle>

          <!-- Cascade: Brand → Material Type → Material → Color -->
          <template v-if="filamentMode === 'different'">
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
            <div v-if="selectedMaterial" class="mb-4">
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
          </template>

          <!-- ── Weight section ── -->
          <div class="text-caption text-uppercase text-medium-emphasis mb-2 letter-spacing-wide">New Weight</div>

          <!-- Ingest mode -->
          <div
            v-if="showIngest"
            class="pa-3 rounded-lg mb-2"
            style="border: 1px solid rgba(var(--v-border-color), 0.2); background: rgba(var(--v-theme-surface-variant), 0.3)"
          >
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
              <div class="d-flex ga-4 mb-3">
                <div class="flex-1">
                  <div class="text-caption text-medium-emphasis mb-1">Previous weight</div>
                  <div class="text-h6 font-weight-bold">{{ Math.round(initialWeight_g) }}g</div>
                </div>
                <v-divider vertical />
                <div class="flex-1">
                  <div class="text-caption text-medium-emphasis mb-1">On scale now</div>
                  <div class="text-h6 font-weight-bold" :class="liveWeight != null ? '' : 'text-medium-emphasis'">
                    {{ liveWeight != null ? `${Math.round(liveWeight)}g` : '—' }}
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

          <!-- Manual mode -->
          <v-text-field
            v-else
            v-model.number="initialWeight_g"
            label="Initial Weight (g)"
            type="number"
            variant="outlined"
            density="compact"
            hide-details
            required
            class="mb-2"
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

        </v-form>
      </v-card-text>

      <v-card-actions class="pa-4 pt-2">
        <v-spacer />
        <v-btn @click="close">Cancel</v-btn>
        <v-btn
          color="success"
          :loading="saving"
          prepend-icon="mdi-recycle"
          @click="handleSubmit"
        >
          Refill
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue';
import { useSpoolStore } from '@/store/spools';
import { useFilamentTypeStore } from '@/store/filamentTypes';
import { useSpoolHolderStore } from '@/store/spoolHolders';
import { useAuthStore } from '@/store/auth';
import { useFavoriteBrands } from '@/composables/useFavoriteBrands';
import apiClient from '@/services/apiClient';

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  spool: { type: Object, default: null },
});
const emit = defineEmits(['update:modelValue', 'refilled']);

const spoolStore = useSpoolStore();
const filamentTypeStore = useFilamentTypeStore();
const spoolHolderStore = useSpoolHolderStore();
const authStore = useAuthStore();
const { favoriteBrands, toggleFavorite } = useFavoriteBrands();

const saving = ref(false);
const filamentMode = ref('same');
const initialWeight_g = ref(1000);

// ── Ingest-point live weighing ────────────────────────────────────────────────
const showIngest = ref(false);
const selectedIngestId = ref(null);
const ingestHolders = ref([]);

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
    initialWeight_g.value = Math.round(liveWeight.value * 10) / 10;
  }
}

// ── Cascading dropdowns (different filament mode) ─────────────────────────────
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

function isSelected(variant) {
  if (!selectedVariant.value) return false;
  return (
    selectedVariant.value.color === variant.color &&
    selectedVariant.value.colorHex === variant.colorHex
  );
}

function selectVariant(variant) {
  selectedVariant.value = variant;
}

async function onBrandChange() {
  selectedMaterialType.value = '';
  selectedMaterial.value = '';
  selectedVariant.value = null;
  materialTypesLoading.value = true;
  materialTypes.value = await filamentTypeStore.fetchMaterialTypes(selectedBrand.value);
  materialTypesLoading.value = false;
  materials.value = [];
  filteredFilamentTypes.value = [];
}

async function onMaterialTypeChange() {
  selectedMaterial.value = '';
  selectedVariant.value = null;
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
  filteredFilamentTypes.value = [];
  await filamentTypeStore.fetchFilamentTypes({
    brand: selectedBrand.value,
    material: selectedMaterialType.value,
    name: material,
  });
  filteredFilamentTypes.value = filamentTypeStore.filamentTypes;
}

// ── Reset cascade when switching back to "same" ───────────────────────────────
watch(filamentMode, (mode) => {
  if (mode === 'same') {
    selectedBrand.value = '';
    selectedMaterialType.value = '';
    selectedMaterial.value = '';
    selectedVariant.value = null;
    filteredFilamentTypes.value = [];
    materials.value = [];
    materialTypes.value = [];
  }
});

// ── Initialise on open ────────────────────────────────────────────────────────
watch(() => props.modelValue, async (open) => {
  if (!open) return;

  filamentMode.value = 'same';
  selectedBrand.value = '';
  selectedMaterialType.value = '';
  selectedMaterial.value = '';
  selectedVariant.value = null;
  filteredFilamentTypes.value = [];
  initialWeight_g.value = props.spool?.initialWeight_g ?? 1000;

  const [brandsResult, holdersResult] = await Promise.all([
    filamentTypeStore.fetchBrands(),
    apiClient.get('/spool-holders', { params: { assignmentType: 'INGEST_POINT' } }),
  ]);
  brands.value = brandsResult;
  ingestHolders.value = holdersResult.data.filter((h) => h.hasLoadCell);

  const savedId = authStore.preferences.ingestStationId;
  const savedMode = authStore.preferences.useIngestMode;
  if (savedMode && ingestHolders.value.length > 0) {
    showIngest.value = true;
    if (savedId && ingestHolders.value.find((h) => h.spoolHolderId === savedId)) {
      selectedIngestId.value = savedId;
    }
  } else {
    showIngest.value = false;
    selectedIngestId.value = null;
  }
});

function close() {
  emit('update:modelValue', false);
}

async function handleSubmit() {
  if (!props.spool) return;

  let filamentTypeId = props.spool.filamentTypeId;
  if (filamentMode.value === 'different') {
    if (!selectedVariant.value) return; // must pick a color
    filamentTypeId = selectedVariant.value.filamentTypeId;
  }

  saving.value = true;
  try {
    await spoolStore.refillSpool(props.spool.spoolId, {
      filamentTypeId,
      initialWeight_g: initialWeight_g.value,
    });
    emit('refilled');
    close();
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

.letter-spacing-wide {
  letter-spacing: 0.06em;
}
</style>
