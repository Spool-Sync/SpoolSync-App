<template>
  <v-chip
    :color="meta.color"
    variant="tonal"
    :prepend-icon="meta.icon"
    v-bind="$attrs"
  >
    {{ label }}
  </v-chip>
</template>

<script setup>
import { computed } from 'vue';
import { usePrinterStore } from '@/store/printers';
import { statusMeta, statusLabel } from '@/utils/printerStatus';

const props = defineProps({
  status: { type: String, required: true },
  /** printer.type string — used to look up integration-specific display labels */
  printerType: { type: String, default: null },
});

const printerStore = usePrinterStore();

const integrationType = computed(() =>
  props.printerType ? printerStore.getIntegrationType(props.printerType) : null,
);

const meta = computed(() => statusMeta(props.status));
const label = computed(() => statusLabel(props.status, integrationType.value));
</script>
