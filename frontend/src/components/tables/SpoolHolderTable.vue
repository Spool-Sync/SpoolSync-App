<template>
  <v-data-table
    :headers="headers"
    :items="filteredHolders"
    :loading="loading"
    :search="search"
    :items-per-page="25"
    :items-per-page-options="[10, 25, 50]"
    rounded="xl"
    hover
    @click:row="(_event, { item }) => $router.push(`/spool-holders/${item.spoolHolderId}`)"
  >
    <template #item.assignment="{ item }">
      <v-chip
        :color="assignmentColor(item.assignmentType)"
        :prepend-icon="assignmentIcon(item.assignmentType)"
        size="small"
        variant="tonal"
      >
        {{ assignmentLabel(item.assignmentType) }}
      </v-chip>
    </template>

    <template #item.esp32="{ item }">
      <span v-if="item.esp32Device">{{ item.esp32Device.name }}</span>
      <span v-else class="text-medium-emphasis">—</span>
    </template>

    <template #item.channel="{ item }">
      <span v-if="item.channel !== null && item.channel !== undefined">{{ item.channel }}</span>
      <span v-else class="text-medium-emphasis">—</span>
    </template>

    <template #item.sensors="{ item }">
      <div class="d-flex gap-1">
        <v-chip v-if="item.hasLoadCell" size="x-small" color="blue" variant="tonal" prepend-icon="mdi-scale">
          Scale
        </v-chip>
        <v-chip v-if="item.hasNfc" size="x-small" color="purple" variant="tonal" prepend-icon="mdi-nfc">
          NFC
        </v-chip>
        <span v-if="!item.hasLoadCell && !item.hasNfc" class="text-medium-emphasis">—</span>
      </div>
    </template>

    <template #item.weight="{ item }">
      <span v-if="item.hasLoadCell && item.currentWeight_g !== null && item.currentWeight_g !== undefined">
        <template v-if="item.associatedSpool">
          {{ Math.round(Math.max(0, item.currentWeight_g - (item.associatedSpool.filamentType?.spoolWeight_g ?? 200))) }}g
        </template>
        <template v-else>
          {{ Math.round(item.currentWeight_g) }}g
        </template>
      </span>
      <span v-else class="text-medium-emphasis">---</span>
    </template>

    <template #item.spool="{ item }">
      <v-chip
        v-if="item.associatedSpool"
        size="small"
        variant="tonal"
        :style="{ backgroundColor: (item.associatedSpool.filamentType?.colorHex || '#aaa') + '33' }"
      >
        <v-avatar
          size="12"
          :style="{ backgroundColor: item.associatedSpool.filamentType?.colorHex || '#aaa' }"
          class="mr-1"
        />
        {{ item.associatedSpool.filamentType?.name || 'Spool' }}
      </v-chip>
      <span v-else class="text-medium-emphasis">—</span>
    </template>

    <template #item.actions="{ item }">
      <v-btn icon="mdi-pencil" size="small" variant="text" @click.stop="$emit('edit', item)" />
      <v-btn icon="mdi-delete" size="small" variant="text" color="error" @click.stop="$emit('delete', item.spoolHolderId)" />
    </template>
  </v-data-table>
</template>

<script setup>
import { computed } from 'vue';
import { useDisplay } from 'vuetify';

const props = defineProps({
  holders: { type: Array, default: () => [] },
  loading: { type: Boolean, default: false },
  search: { type: String, default: '' },
  assignmentFilter: { type: String, default: null },
});
defineEmits(['edit', 'delete']);

const { smAndDown } = useDisplay();

const filteredHolders = computed(() =>
  props.assignmentFilter
    ? props.holders.filter((h) => h.assignmentType === props.assignmentFilter)
    : props.holders,
);

const headers = computed(() => [
  { title: 'Name', key: 'name' },
  { title: 'Assignment', key: 'assignment', sortable: false },
  ...(!smAndDown.value ? [
    { title: 'ESP32 Device', key: 'esp32', sortable: false },
    { title: 'Channel', key: 'channel', sortable: false },
    { title: 'Sensors', key: 'sensors', sortable: false },
  ] : []),
  { title: 'Weight', key: 'weight', sortable: false },
  ...(!smAndDown.value ? [
    { title: 'Associated Spool', key: 'spool', sortable: false },
  ] : []),
  { title: 'Actions', key: 'actions', sortable: false, align: 'end' },
]);

function assignmentColor(type) {
  const map = { PRINTER: 'blue', STORAGE: 'green', INGEST_POINT: 'orange' };
  return map[type] || 'default';
}

function assignmentIcon(type) {
  const map = { PRINTER: 'mdi-printer-3d', STORAGE: 'mdi-archive', INGEST_POINT: 'mdi-tray-arrow-down' };
  return map[type] || 'mdi-help';
}

function assignmentLabel(type) {
  const map = { PRINTER: 'Printer', STORAGE: 'Storage', INGEST_POINT: 'Ingest' };
  return map[type] || type;
}
</script>
