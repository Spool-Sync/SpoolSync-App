<template>
  <v-card rounded="xl">
    <v-card-title class="pa-4">{{ user ? 'Edit User' : 'Add User' }}</v-card-title>
    <v-card-text>
      <v-form ref="form" @submit.prevent="handleSubmit">
        <v-text-field
          v-model="formData.username"
          label="Username"
          variant="outlined"
          density="compact"
          :rules="[v => !!v || 'Username is required']"
          required
          class="mb-2"
        />

        <v-text-field
          v-model="formData.email"
          label="Email"
          type="email"
          variant="outlined"
          density="compact"
          :rules="[v => !!v || 'Email is required']"
          required
          class="mb-2"
        />

        <v-select
          v-model="formData.roleIds"
          :items="availableRoles"
          item-title="name"
          item-value="id"
          label="Roles"
          variant="outlined"
          density="compact"
          multiple
          chips
          closable-chips
          :loading="rolesLoading"
          class="mb-2"
        />

        <v-divider class="mb-3" />

        <div class="text-subtitle-2 mb-2">
          {{ user ? 'Change Password (leave blank to keep current)' : 'Password' }}
        </div>

        <v-text-field
          v-model="formData.password"
          label="Password"
          :type="showPassword ? 'text' : 'password'"
          variant="outlined"
          density="compact"
          :append-inner-icon="showPassword ? 'mdi-eye-off' : 'mdi-eye'"
          :rules="!user ? [v => !!v || 'Password is required'] : []"
          :required="!user"
          class="mb-2"
          @click:append-inner="showPassword = !showPassword"
        />

        <v-text-field
          v-if="formData.password"
          v-model="confirmPassword"
          label="Confirm Password"
          :type="showPassword ? 'text' : 'password'"
          variant="outlined"
          density="compact"
          :rules="[v => v === formData.password || 'Passwords do not match']"
          required
          class="mb-2"
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
import { ref, reactive, onMounted } from 'vue';
import apiClient from '@/services/apiClient';
import { useUiStore } from '@/store/ui';

const props = defineProps({
  user: { type: Object, default: null },
});
const emit = defineEmits(['saved', 'cancel']);

const uiStore = useUiStore();
const form = ref(null);
const saving = ref(false);
const showPassword = ref(false);
const confirmPassword = ref('');
const availableRoles = ref([]);
const rolesLoading = ref(false);

const formData = reactive({
  username: props.user?.username || '',
  email: props.user?.email || '',
  roleIds: props.user?.customRoles ? props.user.customRoles.map((r) => r.id) : [],
  password: '',
});

onMounted(async () => {
  rolesLoading.value = true;
  try {
    const { data } = await apiClient.get('/roles');
    availableRoles.value = data;
  } catch {
    // silently ignore — roles list stays empty
  } finally {
    rolesLoading.value = false;
  }
});

async function handleSubmit() {
  const { valid } = await form.value.validate();
  if (!valid) return;

  saving.value = true;
  try {
    const payload = {
      username: formData.username,
      email: formData.email,
      roleIds: formData.roleIds,
    };
    if (formData.password) {
      payload.password = formData.password;
    }

    if (props.user) {
      await apiClient.put(`/users/${props.user.userId}`, payload);
      uiStore.notify({ message: 'User updated', type: 'success' });
    } else {
      await apiClient.post('/users', payload);
      uiStore.notify({ message: 'User created', type: 'success' });
    }
    emit('saved');
  } finally {
    saving.value = false;
  }
}
</script>
