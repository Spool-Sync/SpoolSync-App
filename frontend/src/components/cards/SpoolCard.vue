<template>
  <v-card rounded="xl">
    <v-card-text>
      <div class="d-flex align-center mb-4">
        <v-tooltip :text="spool.filamentType?.color || 'No color'" location="top">
          <template #activator="{ props: tip }">
            <v-avatar
              v-bind="tip"
              size="48"
              :style="{ backgroundColor: spool.filamentType?.colorHex || '#aaa' }"
              class="mr-3"
            />
          </template>
        </v-tooltip>
        <div>
          <div class="text-h6 font-weight-bold">{{ spool.filamentType?.brand }}</div>
          <div class="text-body-2 text-medium-emphasis">{{ spool.filamentType?.name }}</div>
        </div>
      </div>

      <v-divider class="mb-4" />

      <v-list density="compact" lines="one">
        <v-list-item>
          <template #prepend><v-icon icon="mdi-scale" size="18" class="mr-2" /></template>
          <template #title>
            Filament: <strong>{{ Math.round(netCurrent) }}g</strong> / {{ Math.round(netInitial) }}g
          </template>
          <template #subtitle>
            {{ Math.round(spool.currentWeight_g) }}g gross · {{ spoolCoreWeight }}g spool core
          </template>
        </v-list-item>

        <v-list-item>
          <template #prepend><v-icon icon="mdi-percent" size="18" class="mr-2" /></template>
          <template #title>
            <v-progress-linear
              :model-value="weightPercent"
              :color="weightPercent > 50 ? 'success' : weightPercent > 20 ? 'warning' : 'error'"
              height="8"
              rounded
            />
            {{ weightPercent.toFixed(1) }}% filament remaining
          </template>
        </v-list-item>

        <v-list-item v-if="spool.filamentType?.material">
          <template #prepend><v-icon icon="mdi-beaker-outline" size="18" class="mr-2" /></template>
          <template #title>{{ spool.filamentType.material }}</template>
        </v-list-item>

        <v-list-item v-if="spool.filamentType?.diameter_mm">
          <template #prepend><v-icon icon="mdi-diameter-outline" size="18" class="mr-2" /></template>
          <template #title>{{ spool.filamentType.diameter_mm }}mm</template>
        </v-list-item>

        <v-list-item v-if="spool.spoolHolder?.attachedPrinter">
          <template #prepend><v-icon icon="mdi-printer-3d" size="18" class="mr-2" /></template>
          <template #title>
            <router-link :to="`/printers/${spool.spoolHolder.attachedPrinter.printerId}`" class="text-decoration-none text-primary">
              {{ spool.spoolHolder.attachedPrinter.name }}
            </router-link>
          </template>
          <template #subtitle>On printer</template>
        </v-list-item>

        <v-list-item v-else-if="spool.storageLocations?.length">
          <template #prepend><v-icon icon="mdi-map-marker-outline" size="18" class="mr-2" /></template>
          <template #title>{{ spool.storageLocations[0].storageLocation?.name ?? spool.storageLocations[0].name }}</template>
          <template #subtitle>Storage location</template>
        </v-list-item>

        <v-list-item v-else>
          <template #prepend><v-icon icon="mdi-map-marker-off-outline" size="18" class="mr-2" color="medium-emphasis" /></template>
          <template #title><span class="text-medium-emphasis">No location assigned</span></template>
        </v-list-item>

        <v-list-item v-if="spool.nfcTagId">
          <template #prepend><v-icon icon="mdi-nfc" size="18" class="mr-2" /></template>
          <template #title>NFC: {{ spool.nfcTagId }}</template>
        </v-list-item>
      </v-list>

      <v-chip
        :color="statusColor"
        class="mt-3"
        variant="tonal"
        size="small"
      >
        {{ spool.orderStatus?.replace('_', ' ') }}
      </v-chip>
    </v-card-text>
  </v-card>
</template>

<script setup>
import { computed } from 'vue';

const props = defineProps({
  spool: { type: Object, required: true },
});

const spoolCoreWeight = computed(() => props.spool.filamentType?.spoolWeight_g ?? 200);
const netCurrent = computed(() => Math.max(0, props.spool.currentWeight_g - spoolCoreWeight.value));
const netInitial = computed(() => Math.max(0, props.spool.initialWeight_g - spoolCoreWeight.value));
const weightPercent = computed(() =>
  netInitial.value > 0 ? (netCurrent.value / netInitial.value) * 100 : 0
);

const statusColor = computed(() => {
  const map = { IN_STOCK: 'success', REORDER_NEEDED: 'warning', ORDERED: 'info', DELIVERED: 'success' };
  return map[props.spool.orderStatus] || 'default';
});
</script>
