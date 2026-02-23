<template>
  <v-card rounded="xl">
    <v-card-text>
      <div class="d-flex align-center mb-4">
        <v-icon icon="mdi-printer-3d" size="48" class="mr-3" :color="meta.color" />
        <div>
          <div class="text-h6 font-weight-bold">{{ printer.name }}</div>
          <div class="text-body-2 text-medium-emphasis">{{ printer.type }}</div>
        </div>
      </div>

      <div class="d-flex flex-wrap ga-2 mb-4">
        <PrinterStatusChip :status="printer.status" :printer-type="printer.type" />
        <v-chip
          v-if="printer.type === 'prusalink_buddy'"
          color="teal"
          variant="tonal"
          prepend-icon="mdi-link-variant"
          size="small"
        >
          SpoolSync Active
        </v-chip>
      </div>

      <v-divider class="mb-3" />

      <div v-if="printer.currentJobDetails" class="text-body-2">
        <div class="text-subtitle-2 mb-1">Current Job</div>
        <v-progress-linear
          :model-value="printer.currentJobDetails?.progress || 0"
          color="primary"
          height="8"
          rounded
          class="mb-1"
        />
        <div class="d-flex justify-space-between text-caption text-medium-emphasis">
          <span>{{ printer.currentJobDetails?.progress?.toFixed(1) || 0 }}% complete</span>
          <span v-if="printer.currentJobDetails?.timeRemaining">
            {{ formatTime(printer.currentJobDetails.timeRemaining) }} remaining
          </span>
        </div>
      </div>
      <div v-else class="text-medium-emphasis text-body-2">No active job</div>
    </v-card-text>
  </v-card>
</template>

<script setup>
import { computed } from 'vue';
import PrinterStatusChip from '@/components/PrinterStatusChip.vue';
import { statusMeta } from '@/utils/printerStatus';

const props = defineProps({
  printer: { type: Object, required: true },
});

const meta = computed(() => statusMeta(props.printer.status));

function formatTime(seconds) {
  if (!seconds) return '';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}
</script>
