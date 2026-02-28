<template>
  <v-data-table-server
    :headers="headers"
    :items="spools"
    :items-length="total"
    :loading="loading"
    :items-per-page="itemsPerPage"
    :items-per-page-options="perPageOptions"
    :page="page"
    :group-by="tableGroupBy"
    :row-props="rowProps"
    rounded="xl"
    hover
    @update:options="onOptions"
    @click:row="(_event, { item }) => $router.push(`/spools/${item.spoolId}`)"
  >
    <template #group-header="{ item, columns, toggleGroup, isGroupOpen }">
      <tr class="cursor-pointer" @click="toggleGroup(item)">
        <td :colspan="columns.length" class="bg-surface-variant">
          <div class="d-flex align-center ga-2 py-1">
            <v-icon size="18" color="medium-emphasis">{{ isGroupOpen(item) ? 'mdi-chevron-down' : 'mdi-chevron-right' }}</v-icon>
            <v-chip size="small" variant="tonal" label>{{ item.value }}</v-chip>
            <span class="text-caption text-medium-emphasis">{{ item.items.length }} spool{{ item.items.length === 1 ? '' : 's' }}</span>
          </div>
        </td>
      </tr>
    </template>
    <template #item.filament="{ item }">
      <div class="d-flex align-center">
        <v-tooltip
          :text="item.filamentType?.color || 'No color'"
          location="top"
        >
          <template #activator="{ props: tip }">
            <v-avatar
              v-bind="tip"
              size="20"
              :style="{
                backgroundColor: item.filamentType?.colorHex || '#aaa',
              }"
              class="mr-2 flex-shrink-0"
            />
          </template>
        </v-tooltip>
        <div style="min-width: 0">
          <div class="d-flex align-center ga-1 text-body-2">
            <span class="text-truncate"
              >{{ item.filamentType?.brand }}
              {{ item.filamentType?.name }}</span
            >
            <v-chip
              v-if="item.status === 'SPENT'"
              size="x-small"
              color="error"
              variant="tonal"
              >Spent</v-chip
            >
          </div>
          <v-chip size="x-small" variant="tonal">{{
            item.filamentType?.material
          }}</v-chip>
          <v-chip
            class="ml-2"
            size="x-small"
            variant="tonal"
            :color="item.filamentType?.colorHex || '#aaa'"
            >{{ item.filamentType?.color || "No color" }}</v-chip
          >
        </div>
      </div>
    </template>

    <template #item.weight="{ item }">
      <div>
        <span class="font-weight-medium"
          >{{
            Math.round(
              Math.max(
                0,
                item.currentWeight_g -
                  (item.filamentType?.spoolWeight_g ?? 200),
              ),
            )
          }}g</span
        >
        <v-progress-linear
          :model-value="netWeightPct(item)"
          :color="weightColor(item)"
          height="4"
          rounded
          class="mt-1"
          style="max-width: 100px"
        />
      </div>
    </template>

    <template #item.orderStatus="{ item }">
      <v-chip
        :color="statusColor(item.orderStatus)"
        size="small"
        variant="tonal"
      >
        {{ item.orderStatus.replace(/_/g, " ") }}
      </v-chip>
    </template>

    <template #item.location="{ item }">
      <v-chip
        v-if="item.spoolHolder?.attachedPrinter"
        size="small"
        variant="tonal"
        color="primary"
        prepend-icon="mdi-printer-3d"
      >
        {{ item.spoolHolder.attachedPrinter.name }}
      </v-chip>
      <v-chip
        v-else-if="item.storageLocations?.[0]?.storageLocation"
        size="small"
        variant="tonal"
        prepend-icon="mdi-package-variant"
      >
        {{ item.storageLocations[0].storageLocation.name }}
      </v-chip>
      <span v-else class="text-medium-emphasis">—</span>
    </template>

    <template #item.actions="{ item }">
      <v-tooltip
        v-if="item.status !== 'SPENT'"
        location="top"
        text="Mark as spent"
      >
        <template #activator="{ props: tip }">
          <v-btn
            v-bind="tip"
            icon="mdi-archive-arrow-down"
            size="small"
            variant="text"
            color="warning"
            @click.stop="$emit('mark-spent', item.spoolId)"
          />
        </template>
      </v-tooltip>
      <v-tooltip v-else location="top" text="Refill spool">
        <template #activator="{ props: tip }">
          <v-btn
            v-bind="tip"
            icon="mdi-recycle"
            size="small"
            variant="text"
            color="success"
            @click.stop="$emit('refill', item.spoolId)"
          />
        </template>
      </v-tooltip>
      <v-btn
        icon="mdi-pencil"
        size="small"
        variant="text"
        @click.stop="$emit('edit', item)"
      />
      <v-btn
        icon="mdi-delete"
        size="small"
        variant="text"
        color="error"
        @click.stop="$emit('delete', item.spoolId)"
      />
    </template>
  </v-data-table-server>
</template>

<script setup>
import { computed } from "vue";
import { useDisplay } from "vuetify";

const props = defineProps({
  spools: { type: Array, default: () => [] },
  loading: { type: Boolean, default: false },
  total: { type: Number, default: 0 },
  page: { type: Number, default: 1 },
  itemsPerPage: { type: Number, default: 25 },
  groupBy: { type: String, default: 'none' },
});
const emit = defineEmits([
  "edit",
  "delete",
  "mark-spent",
  "refill",
  "update:options",
]);

const { smAndDown } = useDisplay();
const perPageOptions = [10, 25, 50, 100];

const headers = computed(() => [
  { title: "Filament", key: "filament", sortable: false },
  { title: "Weight", key: "weight", sortable: false },
  { title: "Status", key: "orderStatus", sortable: false },
  ...(!smAndDown.value
    ? [
        { title: "Location", key: "location", sortable: false },
        { title: "NFC Tag", key: "nfcTagId", sortable: false },
      ]
    : []),
  { title: "Actions", key: "actions", sortable: false, align: "end" },
]);

// Map groupBy preference to Vuetify group-by config
const tableGroupBy = computed(() => {
  if (props.groupBy === 'material') return [{ key: 'filamentType.material', order: 'asc' }];
  if (props.groupBy === 'brand')    return [{ key: 'filamentType.brand',    order: 'asc' }];
  return [];
});

function rowProps({ item }) {
  return item.status === "SPENT" ? { style: "opacity: 0.6" } : {};
}

function onOptions({ page, itemsPerPage, sortBy }) {
  const sort = sortBy?.[0];
  emit("update:options", {
    page,
    itemsPerPage,
    sortBy: sort?.key ?? null,
    sortOrder: sort?.order ?? null,
  });
}

function netWeightPct(spool) {
  const sw = spool.filamentType?.spoolWeight_g ?? 200;
  const net = Math.max(0, spool.currentWeight_g - sw);
  const init = Math.max(0, spool.initialWeight_g - sw);
  return init > 0 ? (net / init) * 100 : 0;
}

function weightColor(spool) {
  if (spool.status === "SPENT") return "error";
  const pct = netWeightPct(spool);
  if (pct > 50) return "success";
  if (pct > 20) return "warning";
  return "error";
}

function statusColor(status) {
  const map = {
    IN_STOCK: "success",
    REORDER_NEEDED: "warning",
    ORDERED: "info",
    DELIVERED: "success",
  };
  return map[status] || "default";
}
</script>
