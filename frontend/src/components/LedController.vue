<template>
  <v-dialog v-model="open" max-width="520" persistent scrollable>
    <v-card rounded="xl" :style="{ background: 'linear-gradient(135deg, #0f0c29, #302b63, #24243e)' }">
      <v-card-title class="pt-5 pb-1 d-flex align-center gap-2">
        <span style="font-size:1.5rem">🎨</span>
        <span class="text-h6 font-weight-bold text-white">Printer Light Show</span>
        <v-spacer />
        <v-btn icon="mdi-close" variant="text" color="white" size="small" @click="close" />
      </v-card-title>
      <v-card-subtitle class="pb-3 text-grey-lighten-1">↑↑↓↓←→←→BA — secret unlocked</v-card-subtitle>

      <v-card-text class="pb-2">
        <!-- Printer picker -->
        <v-select
          v-model="selectedPrinterId"
          :items="buddyPrinters"
          item-title="name"
          item-value="printerId"
          label="Printer"
          variant="outlined"
          density="compact"
          color="purple-lighten-2"
          class="mb-5"
          no-data-text="No SpoolSync printers found"
          bg-color="rgba(255,255,255,0.06)"
        />

        <!-- Zone panels -->
        <div class="zones">
          <div v-for="zone in zones" :key="zone.id" class="zone-panel">
            <!-- Zone header -->
            <div class="zone-header">
              <span class="zone-icon">{{ zone.icon }}</span>
              <span class="zone-title">{{ zone.label }}</span>
              <button
                class="zone-off-btn"
                :disabled="!selectedPrinterId"
                title="Turn off"
                @click="stopZone(zone.id)"
              >✕</button>
            </div>

            <!-- Effect buttons -->
            <div class="effect-grid">
              <button
                v-for="eff in effects"
                :key="eff.id"
                class="effect-btn"
                :class="{ active: zoneState[zone.id].effect === eff.id }"
                :disabled="!selectedPrinterId || zoneState[zone.id].loading"
                @click="applyEffect(zone.id, eff.id)"
              >
                <span class="effect-emoji">{{ eff.emoji }}</span>
                <span class="effect-label">{{ eff.label }}</span>
              </button>
            </div>

            <!-- Color picker (solid only) -->
            <div v-if="zoneState[zone.id].effect === 'solid'" class="color-row">
              <input
                type="color"
                :value="zoneState[zone.id].color"
                class="color-input"
                @input="zoneState[zone.id].color = $event.target.value"
                @change="applyEffect(zone.id, 'solid')"
              />
              <div class="color-preview" :style="{ background: zoneState[zone.id].color }" />
              <span class="color-hex">{{ zoneState[zone.id].color.toUpperCase() }}</span>
            </div>
          </div>
        </div>

        <v-alert
          v-if="errorMsg"
          type="error"
          variant="tonal"
          density="compact"
          class="mt-3"
          :text="errorMsg"
        />
      </v-card-text>

      <v-card-actions class="px-4 pb-4 pt-1">
        <v-btn
          variant="tonal"
          color="red-lighten-2"
          prepend-icon="mdi-lightbulb-off-outline"
          :disabled="!selectedPrinterId || anyLoading"
          @click="stopAll"
        >
          All Off
        </v-btn>
        <v-spacer />
        <v-btn variant="text" color="grey" @click="close">Close</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup>
import { ref, computed, reactive, watch } from 'vue';
import { usePrinterStore } from '@/store/printers';

const props = defineProps({ modelValue: Boolean });
const emit  = defineEmits(['update:modelValue']);

const printerStore = usePrinterStore();

const open = computed({
  get: () => props.modelValue,
  set: (v) => emit('update:modelValue', v),
});

const zones = [
  { id: 'lcd',    icon: '🖥️',  label: 'LCD Strip'  },
  { id: 'side',   icon: '💫',  label: 'Case Strip' },
  { id: 'dwarfs', icon: '🔧',  label: 'Tool Heads' },
];

const effects = [
  { id: 'rainbow', emoji: '🌈', label: 'Rainbow' },
  { id: 'pulse',   emoji: '💓', label: 'Pulse'   },
  { id: 'police',  emoji: '🚔', label: 'Police'  },
  { id: 'fire',    emoji: '🔥', label: 'Fire'    },
  { id: 'party',   emoji: '🎉', label: 'Party'   },
  { id: 'solid',   emoji: '💡', label: 'Solid'   },
];

const zoneState = reactive({
  lcd:    { effect: null, color: '#00aaff', loading: false },
  side:   { effect: null, color: '#ff6600', loading: false },
  dwarfs: { effect: null, color: '#ff6600', loading: false },
});

const selectedPrinterId = ref(null);
const errorMsg   = ref(null);
const anyLoading = computed(() => zones.some((z) => zoneState[z.id].loading));

const buddyPrinters = computed(() =>
  printerStore.printers.filter((p) => p.type === 'prusalink_buddy'),
);

watch(open, async (isOpen) => {
  if (isOpen && printerStore.printers.length === 0) {
    await printerStore.fetchPrinters();
  }
});

watch(buddyPrinters, (list) => {
  if (!selectedPrinterId.value && list.length > 0) {
    selectedPrinterId.value = list[0].printerId;
  }
}, { immediate: true });

function hexToRgb(hex) {
  const n = parseInt(hex.replace('#', ''), 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

async function applyEffect(zoneId, effectId) {
  if (!selectedPrinterId.value) return;
  const state = zoneState[zoneId];
  state.effect  = effectId;
  state.loading = true;
  errorMsg.value = null;
  try {
    await printerStore.setLeds(
      selectedPrinterId.value,
      effectId,
      hexToRgb(state.color),
      zoneId,
    );
  } catch (e) {
    errorMsg.value = e.response?.data?.message ?? e.message ?? 'Failed';
    state.effect = null;
  } finally {
    state.loading = false;
  }
}

async function stopZone(zoneId) {
  if (!selectedPrinterId.value) return;
  const state = zoneState[zoneId];
  state.loading = true;
  errorMsg.value = null;
  try {
    await printerStore.setLeds(selectedPrinterId.value, 'restore', { r: 0, g: 0, b: 0 }, zoneId);
    state.effect = null;
  } catch (e) {
    errorMsg.value = e.response?.data?.message ?? e.message ?? 'Failed';
  } finally {
    state.loading = false;
  }
}

async function stopAll() {
  await Promise.all(zones.map((z) => stopZone(z.id)));
}

function close() {
  open.value = false;
}
</script>

<style scoped>
.zones {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.zone-panel {
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 14px;
  padding: 14px;
  background: rgba(255, 255, 255, 0.04);
}

.zone-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 10px;
}

.zone-icon { font-size: 1.05rem; }

.zone-title {
  flex: 1;
  font-size: 0.75rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: rgba(255, 255, 255, 0.65);
}

.zone-off-btn {
  background: rgba(255, 80, 80, 0.12);
  border: 1px solid rgba(255, 80, 80, 0.25);
  border-radius: 6px;
  color: rgba(255, 120, 120, 0.85);
  font-size: 0.65rem;
  width: 22px;
  height: 22px;
  cursor: pointer;
  transition: background 0.12s;
}
.zone-off-btn:hover:not(:disabled) { background: rgba(255, 80, 80, 0.28); }
.zone-off-btn:disabled { opacity: 0.25; cursor: not-allowed; }

.effect-grid {
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  gap: 5px;
}

.effect-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 3px;
  padding: 8px 2px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.04);
  cursor: pointer;
  transition: all 0.12s ease;
  color: white;
}
.effect-btn:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.1);
  border-color: rgba(255, 255, 255, 0.25);
  transform: translateY(-1px);
}
.effect-btn.active {
  background: rgba(149, 117, 205, 0.35);
  border-color: #9575cd;
  box-shadow: 0 0 8px rgba(149, 117, 205, 0.4);
}
.effect-btn:disabled { opacity: 0.3; cursor: not-allowed; }

.effect-emoji { font-size: 1.15rem; line-height: 1; }
.effect-label { font-size: 0.58rem; font-weight: 600; letter-spacing: 0.03em; text-transform: uppercase; opacity: 0.8; }

.color-row {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 10px;
}

.color-input {
  width: 34px;
  height: 34px;
  border: none;
  border-radius: 7px;
  cursor: pointer;
  padding: 2px;
  background: transparent;
}

.color-preview {
  width: 34px;
  height: 34px;
  border-radius: 7px;
  border: 1px solid rgba(255, 255, 255, 0.18);
  flex-shrink: 0;
}

.color-hex {
  font-size: 0.78rem;
  color: rgba(255, 255, 255, 0.55);
  font-family: monospace;
}
</style>
