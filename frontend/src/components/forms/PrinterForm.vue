<template>
  <v-card rounded="xl">
    <v-card-title class="pa-4">{{ printer ? 'Edit Printer' : 'Add Printer' }}</v-card-title>
    <v-card-text>
      <v-form @submit.prevent="handleSubmit">
        <v-text-field
          v-model="formData.name"
          label="Printer Name"
          variant="outlined"
          density="compact"
          required
          class="mb-2"
        />

        <v-select
          v-model="formData.type"
          :items="integrationTypes"
          item-value="id"
          item-title="name"
          label="Printer Type / Integration"
          variant="outlined"
          density="compact"
          required
          class="mb-2"
          @update:model-value="onTypeChange"
        />

        <!-- Dynamic connection fields from integration config -->
        <template v-if="selectedIntegration?.connectionFields?.length">
          <v-text-field
            v-for="field in selectedIntegration.connectionFields"
            :key="field.key"
            v-model="formData.connectionDetails[field.key]"
            :label="field.label"
            :type="field.type === 'password' ? 'password' : 'text'"
            :placeholder="field.placeholder"
            :hint="field.hint"
            :persistent-hint="!!field.hint"
            :required="field.required"
            variant="outlined"
            density="compact"
            class="mb-2"
          />
        </template>

        <!-- Fallback for integrations without connection_fields -->
        <template v-else-if="formData.type">
          <v-text-field
            v-model="formData.connectionDetails.base_url"
            label="Base URL"
            placeholder="https://connect.prusa3d.com"
            variant="outlined"
            density="compact"
            class="mb-2"
          />
          <v-text-field
            v-model="formData.connectionDetails.apiKey"
            label="API Key"
            type="password"
            variant="outlined"
            density="compact"
            class="mb-2"
          />
        </template>
      </v-form>
    </v-card-text>
    <v-card-actions class="pa-4 pt-0">
      <v-spacer />
      <v-btn @click="$emit('cancel')">Cancel</v-btn>
      <v-btn color="primary" :loading="saving" @click="handleSubmit">Save</v-btn>
    </v-card-actions>
  </v-card>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue';
import { usePrinterStore } from '@/store/printers';
import apiClient from '@/services/apiClient';

const props = defineProps({
  printer: { type: Object, default: null },
});
const emit = defineEmits(['saved', 'cancel']);

const printerStore = usePrinterStore();
const saving = ref(false);
const integrationTypes = ref([]);

const formData = reactive({
  name: props.printer?.name || '',
  type: props.printer?.type || '',
  connectionDetails: { ...(props.printer?.connectionDetails || {}) },
});

const selectedIntegration = computed(() =>
  integrationTypes.value.find((t) => t.id === formData.type) || null,
);

function onTypeChange() {
  // Preserve existing keys, just reset to empty for new type selection when not editing
  if (!props.printer) {
    formData.connectionDetails = {};
  }
}

onMounted(async () => {
  const { data } = await apiClient.get('/integrations/types');
  integrationTypes.value = data;
});

async function handleSubmit() {
  saving.value = true;
  try {
    if (props.printer) {
      await printerStore.updatePrinter(props.printer.printerId, formData);
    } else {
      await printerStore.createPrinter(formData);
    }
    emit('saved');
  } finally {
    saving.value = false;
  }
}
</script>
