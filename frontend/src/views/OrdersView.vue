<template>
  <div>
    <div class="d-flex align-center mb-4">
      <h1 class="text-h5 font-weight-bold">Orders</h1>
      <v-spacer />
      <v-btn color="primary" prepend-icon="mdi-plus" @click="showForm = true">
        <span class="d-none d-sm-inline">New Order</span>
      </v-btn>
    </div>

    <v-data-table
      :headers="headers"
      :items="orderStore.orders"
      :loading="orderStore.loading"
      rounded="xl"
    >
      <template #item.status="{ item }">
        <v-chip :color="statusColor(item.status)" size="small" variant="tonal">
          {{ item.status.replace(/_/g, ' ') }}
        </v-chip>
      </template>
      <template #item.filamentType="{ item }">
        {{ item.filamentType?.brand }} {{ item.filamentType?.name }}
      </template>
      <template #item.orderDate="{ item }">
        {{ new Date(item.orderDate).toLocaleDateString() }}
      </template>
      <template #item.actions="{ item }">
        <v-btn icon="mdi-pencil" size="small" variant="text" @click="openEdit(item)" />
        <v-btn icon="mdi-delete" size="small" variant="text" color="error" @click="handleDelete(item.orderId)" />
      </template>
    </v-data-table>

    <v-dialog v-model="showForm" max-width="500">
      <v-card rounded="xl">
        <v-card-title class="pa-4">{{ editingOrder ? 'Edit Order' : 'New Order' }}</v-card-title>
        <v-card-text>
          <p class="text-medium-emphasis">Order form coming soon</p>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn @click="showForm = false">Cancel</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>

<script setup>
import { computed, ref, onMounted } from 'vue';
import { useDisplay } from 'vuetify';
import { useOrderStore } from '@/store/orders';

const orderStore = useOrderStore();
const { smAndDown } = useDisplay();

const showForm = ref(false);
const editingOrder = ref(null);

const headers = computed(() => [
  { title: 'Filament', key: 'filamentType', sortable: false },
  { title: 'Status', key: 'status' },
  ...(!smAndDown.value ? [
    { title: 'Quantity', key: 'quantity' },
    { title: 'Unit', key: 'unit' },
    { title: 'Order Date', key: 'orderDate' },
    { title: 'Retailer', key: 'retailer' },
  ] : []),
  { title: 'Actions', key: 'actions', sortable: false, align: 'end' },
]);

onMounted(() => orderStore.fetchOrders());

function openEdit(order) {
  editingOrder.value = order;
  showForm.value = true;
}

async function handleDelete(orderId) {
  await orderStore.deleteOrder(orderId);
}

function statusColor(status) {
  const map = { IN_STOCK: 'success', REORDER_NEEDED: 'warning', ORDERED: 'info', DELIVERED: 'success' };
  return map[status] || 'default';
}
</script>
