<template>
  <v-card rounded="xl">
    <v-card-title class="pa-4">{{ location ? 'Edit Location' : 'Add Storage Location' }}</v-card-title>
    <v-card-text>
      <v-form @submit.prevent="handleSubmit">
        <v-text-field
          v-model="formData.name"
          label="Name"
          variant="outlined"
          density="compact"
          required
          class="mb-2"
        />

        <v-select
          v-model="formData.type"
          :items="typeOptions"
          label="Type"
          variant="outlined"
          density="compact"
          class="mb-2"
        />

        <v-textarea
          v-model="formData.description"
          label="Description (optional)"
          variant="outlined"
          density="compact"
          rows="2"
        />
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
import { ref, reactive } from 'vue';
import apiClient from '@/services/apiClient';

const props = defineProps({
  location: { type: Object, default: null },
});
const emit = defineEmits(['saved', 'cancel']);

const saving = ref(false);
const typeOptions = ['DRYER', 'LONG_TERM_STORAGE', 'OPEN_SHELF', 'OTHER'];

const formData = reactive({
  name: props.location?.name || '',
  type: props.location?.type || 'OTHER',
  description: props.location?.description || '',
});

async function handleSubmit() {
  saving.value = true;
  try {
    let result;
    if (props.location) {
      const { data } = await apiClient.put(`/storage-locations/${props.location.storageLocationId}`, formData);
      result = data;
    } else {
      const { data } = await apiClient.post('/storage-locations', formData);
      result = data;
    }
    emit('saved', result);
  } finally {
    saving.value = false;
  }
}
</script>
