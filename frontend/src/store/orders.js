import { defineStore } from 'pinia';
import { ref } from 'vue';
import apiClient from '@/services/apiClient';

export const useOrderStore = defineStore('orders', () => {
  const orders = ref([]);
  const loading = ref(false);
  const error = ref(null);

  async function fetchOrders(filters = {}) {
    loading.value = true;
    error.value = null;
    try {
      const { data } = await apiClient.get('/orders', { params: filters });
      orders.value = data;
    } catch (err) {
      error.value = err.response?.data?.message || 'Failed to load orders';
    } finally {
      loading.value = false;
    }
  }

  async function createOrder(payload) {
    const { data } = await apiClient.post('/orders', payload);
    handleOrderCreated(data);
    return data;
  }

  async function updateOrder(orderId, payload) {
    const { data } = await apiClient.put(`/orders/${orderId}`, payload);
    handleOrderUpdated(data);
    return data;
  }

  async function deleteOrder(orderId) {
    await apiClient.delete(`/orders/${orderId}`);
    handleOrderDeleted({ orderId });
  }

  function handleOrderCreated(order) {
    if (!orders.value.find((o) => o.orderId === order.orderId)) {
      orders.value.unshift(order);
    }
  }

  function handleOrderUpdated(order) {
    const idx = orders.value.findIndex((o) => o.orderId === order.orderId);
    if (idx !== -1) {
      orders.value[idx] = { ...orders.value[idx], ...order };
    }
  }

  function handleOrderDeleted({ orderId }) {
    orders.value = orders.value.filter((o) => o.orderId !== orderId);
  }

  return {
    orders,
    loading,
    error,
    fetchOrders,
    createOrder,
    updateOrder,
    deleteOrder,
    handleOrderCreated,
    handleOrderUpdated,
    handleOrderDeleted,
  };
});
