<template>
  <v-data-table
    :headers="headers"
    :items="locations"
    :loading="loading"
    :search="search"
    :items-per-page="25"
    :items-per-page-options="[10, 25, 50]"
    rounded="xl"
    hover
    @click:row="(_event, { item }) => $router.push(`/storage/${item.storageLocationId}`)"
  >
    <template #item.type="{ item }">
      <v-chip
        :color="storageTypeInfo(item.type).color"
        :prepend-icon="storageTypeInfo(item.type).icon"
        size="small"
        variant="tonal"
      >
        {{ storageTypeInfo(item.type).label }}
      </v-chip>
    </template>

    <template #item.spoolCount="{ item }">
      {{ item.spools?.length || 0 }}
    </template>

    <template #item.zones="{ item }">
      <v-chip v-if="item.zones?.length" size="x-small" variant="tonal" prepend-icon="mdi-map-marker">
        {{ item.zones.length }}
      </v-chip>
      <span v-else class="text-medium-emphasis">—</span>
    </template>

    <template #item.actions="{ item }">
      <v-btn icon="mdi-pencil" size="small" variant="text" @click.stop="$emit('edit', item)" />
      <v-btn icon="mdi-delete" size="small" variant="text" color="error" @click.stop="$emit('delete', item.storageLocationId)" />
    </template>
  </v-data-table>
</template>

<script setup>
import { computed } from 'vue';
import { useDisplay } from 'vuetify';
import { storageTypeInfo } from '@/utils/storageTypes';

defineProps({
  locations: { type: Array, default: () => [] },
  loading: { type: Boolean, default: false },
  search: { type: String, default: '' },
});
defineEmits(['edit', 'delete']);

const { smAndDown } = useDisplay();

const headers = computed(() => [
  { title: 'Name', key: 'name' },
  { title: 'Type', key: 'type' },
  ...(!smAndDown.value ? [
    { title: 'Description', key: 'description' },
  ] : []),
  { title: 'Spools', key: 'spoolCount', sortable: false },
  { title: 'Zones', key: 'zones', sortable: false },
  { title: 'Actions', key: 'actions', sortable: false, align: 'end' },
]);
</script>
