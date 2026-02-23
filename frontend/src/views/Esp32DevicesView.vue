<template>
  <div>
    <div class="d-flex align-center mb-4">
      <h1 class="text-h5 font-weight-bold">Devices</h1>
      <v-spacer />
      <v-btn color="primary" prepend-icon="mdi-chip" @click="showProvisioning = true">
        <span class="d-none d-sm-inline">Provision Device</span>
      </v-btn>
    </div>

    <v-data-table
      :headers="headers"
      :items="store.devices"
      :loading="store.loading"
      item-value="deviceId"
      rounded="lg"
      style="cursor: pointer"
      @click:row="(_, { item }) => $router.push(`/esp32-devices/${item.deviceId}`)"
    >
      <template #item.lastSeen="{ item }">
        {{ item.lastSeen ? new Date(item.lastSeen).toLocaleString() : '—' }}
      </template>
      <template #item.channels="{ item }">
        <v-chip size="small" variant="tonal">{{ item.spoolHolders?.length ?? 0 }}</v-chip>
      </template>
      <template #item.ipAddress="{ item }">
        {{ item.ipAddress || '—' }}
      </template>
      <template #item.actions="{ item }">
        <v-btn icon="mdi-delete" size="small" variant="text" color="error" @click.stop="handleDelete(item.deviceId)" />
      </template>
    </v-data-table>

    <Esp32ProvisioningDialog
      v-model="showProvisioning"
      @provisioned="onProvisioned"
    />
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { useDisplay } from 'vuetify';
import { useEsp32DeviceStore } from '@/store/esp32Devices';
import Esp32ProvisioningDialog from '@/components/dialogs/Esp32ProvisioningDialog.vue';

const store = useEsp32DeviceStore();
const router = useRouter();
const showProvisioning = ref(false);
const { smAndDown } = useDisplay();

const headers = computed(() => [
  { title: 'Name', key: 'name', sortable: true },
  ...(!smAndDown.value ? [
    { title: 'IP Address', key: 'ipAddress', sortable: false },
  ] : []),
  { title: 'Channels', key: 'channels', sortable: false },
  ...(!smAndDown.value ? [
    { title: 'Last Seen', key: 'lastSeen', sortable: true },
  ] : []),
  { title: '', key: 'actions', sortable: false, align: 'end' },
]);

onMounted(() => store.fetchDevices());

async function onProvisioned(deviceId) {
  await store.fetchDevices();
  router.push(`/esp32-devices/${deviceId}`);
}

async function handleDelete(deviceId) {
  await store.deleteDevice(deviceId);
}
</script>
