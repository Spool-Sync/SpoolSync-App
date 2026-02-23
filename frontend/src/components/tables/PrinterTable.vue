<template>
  <v-data-table
    :headers="headers"
    :items="printers"
    :loading="loading"
    :search="search"
    :items-per-page="25"
    :items-per-page-options="[10, 25, 50]"
    rounded="xl"
    hover
    @click:row="(_event, { item }) => $router.push(`/printers/${item.printerId}`)"
  >
    <template #item.status="{ item }">
      <PrinterStatusChip :status="item.status" :printer-type="item.type" size="small" />
    </template>

    <template #item.type="{ item }">
      <div class="d-flex align-center ga-1">
        <span>{{ item.type }}</span>
        <v-chip
          v-if="item.type === 'prusalink_buddy'"
          color="teal"
          variant="tonal"
          size="x-small"
          prepend-icon="mdi-link-variant"
        >
          SpoolSync
        </v-chip>
      </div>
    </template>

    <template #item.activeSpool="{ item }">
      {{ item.spoolHolders?.find(h => h.associatedSpool)?.associatedSpool?.filamentType?.brand || '—' }}
    </template>

    <template #item.actions="{ item }">
      <v-btn icon="mdi-sync" size="small" variant="text" @click.stop="$emit('sync', item.printerId)" />
      <v-btn icon="mdi-pencil" size="small" variant="text" @click.stop="$emit('edit', item)" />
      <v-btn icon="mdi-delete" size="small" variant="text" color="error" @click.stop="$emit('delete', item.printerId)" />
    </template>
  </v-data-table>
</template>

<script setup>
import { computed } from 'vue';
import { useDisplay } from 'vuetify';
import PrinterStatusChip from '@/components/PrinterStatusChip.vue';

defineProps({
  printers: { type: Array, default: () => [] },
  loading: { type: Boolean, default: false },
  search: { type: String, default: '' },
});
defineEmits(['edit', 'delete', 'sync']);

const { smAndDown } = useDisplay();

const headers = computed(() => [
  { title: 'Name', key: 'name' },
  { title: 'Status', key: 'status' },
  ...(!smAndDown.value ? [
    { title: 'Type', key: 'type' },
    { title: 'Active Spool', key: 'activeSpool', sortable: false },
  ] : []),
  { title: 'Actions', key: 'actions', sortable: false, align: 'end' },
]);
</script>
