import { defineStore } from 'pinia';
import { ref } from 'vue';
import apiClient from '@/services/apiClient';

export const useEsp32DeviceStore = defineStore('esp32Devices', () => {
  const devices = ref([]);
  const loading = ref(false);
  const error = ref(null);

  async function fetchDevices() {
    loading.value = true;
    error.value = null;
    try {
      const res = await apiClient.get('/esp32-devices');
      devices.value = res.data;
    } catch (e) {
      error.value = e.message;
    } finally {
      loading.value = false;
    }
  }

  async function fetchDevice(deviceId) {
    const res = await apiClient.get(`/esp32-devices/${deviceId}`);
    return res.data;
  }

  async function updateDevice(deviceId, data) {
    const res = await apiClient.put(`/esp32-devices/${deviceId}`, data);
    const idx = devices.value.findIndex((d) => d.deviceId === deviceId);
    if (idx !== -1) devices.value[idx] = res.data;
    return res.data;
  }

  async function deleteDevice(deviceId) {
    await apiClient.delete(`/esp32-devices/${deviceId}`);
    handleDeviceDeleted({ deviceId });
  }

  function handleDeviceCreated(device) {
    if (!devices.value.find((d) => d.deviceId === device.deviceId)) {
      devices.value.push(device);
    }
  }

  function handleDeviceUpdated(device) {
    const idx = devices.value.findIndex((d) => d.deviceId === device.deviceId);
    if (idx !== -1) {
      devices.value[idx] = { ...devices.value[idx], ...device };
    }
  }

  function handleDeviceDeleted({ deviceId }) {
    devices.value = devices.value.filter((d) => d.deviceId !== deviceId);
  }

  return { devices, loading, error, fetchDevices, fetchDevice, updateDevice, deleteDevice, handleDeviceCreated, handleDeviceUpdated, handleDeviceDeleted };
});
