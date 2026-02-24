<template>
  <div>
    <div class="d-flex align-center mb-4">
      <h1 class="text-h5 font-weight-bold">Roles</h1>
      <v-spacer />
      <v-btn color="primary" prepend-icon="mdi-plus" @click="openCreate">New Role</v-btn>
    </div>

    <v-row>
      <!-- Role list -->
      <v-col cols="12" md="4">
        <v-card rounded="xl" variant="outlined">
          <v-list lines="two" nav>
            <v-list-item
              v-for="role in roles"
              :key="role.id"
              :active="selectedRole?.id === role.id"
              rounded="lg"
              @click="selectRole(role)"
            >
              <template #prepend>
                <v-icon :icon="role.isSystem ? 'mdi-shield-lock-outline' : 'mdi-shield-account-outline'" />
              </template>
              <v-list-item-title class="d-flex align-center gap-2">
                {{ role.name }}
                <v-chip v-if="role.isSystem" size="x-small" color="warning" variant="tonal">System</v-chip>
                <v-chip v-if="role.source === 'sso'" size="x-small" color="info" variant="tonal">SSO</v-chip>
              </v-list-item-title>
              <v-list-item-subtitle>
                {{ role.description || 'No description' }} &bull; {{ role._count?.users ?? 0 }} user{{ role._count?.users === 1 ? '' : 's' }}
              </v-list-item-subtitle>
              <template #append>
                <v-btn
                  icon="mdi-pencil"
                  size="small"
                  variant="text"
                  @click.stop="openEdit(role)"
                />
                <v-btn
                  v-if="!role.isSystem"
                  icon="mdi-delete"
                  size="small"
                  variant="text"
                  color="error"
                  @click.stop="handleDelete(role)"
                />
              </template>
            </v-list-item>
            <v-list-item v-if="roles.length === 0">
              <v-list-item-title class="text-medium-emphasis">No roles defined</v-list-item-title>
            </v-list-item>
          </v-list>
        </v-card>
      </v-col>

      <!-- Permission matrix -->
      <v-col cols="12" md="8">
        <v-card rounded="xl" variant="outlined">
          <v-card-title v-if="selectedRole" class="d-flex align-center pa-4">
            <v-icon class="mr-2" :icon="selectedRole.isSystem ? 'mdi-shield-lock-outline' : 'mdi-shield-account-outline'" />
            {{ selectedRole.name }}
            <v-chip v-if="selectedRole.isSystem" size="x-small" color="warning" variant="tonal" class="ml-2">System</v-chip>
            <v-chip v-if="selectedRole.source === 'sso'" size="x-small" color="info" variant="tonal" class="ml-2" title="Auto-created from SSO claim — edit permissions to grant access">SSO</v-chip>
            <v-spacer />
            <template v-if="editingPermissions">
              <v-btn variant="text" class="mr-1" @click="cancelEdit">Cancel</v-btn>
              <v-btn color="primary" :loading="saving" @click="savePermissions">Save</v-btn>
            </template>
            <v-btn v-else icon="mdi-pencil" variant="text" size="small" @click="startEditPermissions" />
          </v-card-title>
          <v-card-text v-if="selectedRole" class="pa-4 pt-0">
            <div
              v-for="group in permissionGroups"
              :key="group.group"
              class="mb-4"
            >
              <div class="text-subtitle-2 text-medium-emphasis mb-2 text-uppercase">{{ group.label }}</div>
              <div class="d-flex flex-wrap gap-2">
                <v-chip
                  v-for="perm in group.permissions"
                  :key="perm"
                  :color="hasPermission(perm) ? 'primary' : undefined"
                  :variant="hasPermission(perm) ? 'tonal' : 'outlined'"
                  size="small"
                  :class="editingPermissions ? 'cursor-pointer' : ''"
                  @click="editingPermissions ? togglePermission(perm) : undefined"
                >
                  <template v-if="editingPermissions" #prepend>
                    <v-icon :icon="hasPermission(perm) ? 'mdi-check' : 'mdi-close'" size="14" class="mr-1" />
                  </template>
                  {{ permLabel(perm) }}
                </v-chip>
              </div>
            </div>
          </v-card-text>
          <v-card-text v-else class="text-center text-medium-emphasis py-12">
            Select a role to view its permissions
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>

    <!-- Create / Edit role dialog -->
    <v-dialog v-model="showForm" max-width="460">
      <v-card rounded="xl">
        <v-card-title class="pa-4">{{ editingRole ? 'Edit Role' : 'New Role' }}</v-card-title>
        <v-card-text>
          <v-form ref="formRef" @submit.prevent="handleSave">
            <v-text-field
              v-model="formData.name"
              label="Name"
              variant="outlined"
              density="compact"
              :rules="[v => !!v || 'Name is required']"
              required
              class="mb-2"
            />
            <v-text-field
              v-model="formData.description"
              label="Description (optional)"
              variant="outlined"
              density="compact"
            />
          </v-form>
        </v-card-text>
        <v-card-actions class="pa-4 pt-0">
          <v-spacer />
          <v-btn @click="showForm = false">Cancel</v-btn>
          <v-btn color="primary" :loading="formSaving" @click="handleSave">Save</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Delete confirmation -->
    <v-dialog v-model="showDeleteConfirm" max-width="400">
      <v-card rounded="xl">
        <v-card-title class="pa-4">Delete Role</v-card-title>
        <v-card-text>
          Are you sure you want to delete <strong>{{ deletingRole?.name }}</strong>? This cannot be undone.
        </v-card-text>
        <v-card-actions class="pa-4 pt-0">
          <v-spacer />
          <v-btn @click="showDeleteConfirm = false">Cancel</v-btn>
          <v-btn color="error" :loading="deleting" @click="confirmDelete">Delete</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue';
import apiClient from '@/services/apiClient';
import { useUiStore } from '@/store/ui';

const uiStore = useUiStore();

const roles = ref([]);
const permissionGroups = ref([]);
const selectedRole = ref(null);
const editingPermissions = ref(false);
const draftPermissions = ref([]);
const saving = ref(false);

const showForm = ref(false);
const editingRole = ref(null);
const formRef = ref(null);
const formSaving = ref(false);
const formData = reactive({ name: '', description: '' });

const showDeleteConfirm = ref(false);
const deletingRole = ref(null);
const deleting = ref(false);

onMounted(async () => {
  await Promise.all([fetchRoles(), fetchPermissions()]);
});

async function fetchRoles() {
  const { data } = await apiClient.get('/roles');
  roles.value = data;
}

async function fetchPermissions() {
  const { data } = await apiClient.get('/roles/permissions');
  permissionGroups.value = data;
}

function selectRole(role) {
  selectedRole.value = role;
  editingPermissions.value = false;
  draftPermissions.value = [];
}

function hasPermission(perm) {
  if (editingPermissions.value) return draftPermissions.value.includes(perm);
  return selectedRole.value?.permissions?.includes(perm) ?? false;
}

function togglePermission(perm) {
  const idx = draftPermissions.value.indexOf(perm);
  if (idx === -1) draftPermissions.value.push(perm);
  else draftPermissions.value.splice(idx, 1);
}

function startEditPermissions() {
  draftPermissions.value = [...(selectedRole.value?.permissions ?? [])];
  editingPermissions.value = true;
}

function cancelEdit() {
  editingPermissions.value = false;
  draftPermissions.value = [];
}

async function savePermissions() {
  saving.value = true;
  try {
    const { data } = await apiClient.put(`/roles/${selectedRole.value.id}`, {
      permissions: draftPermissions.value,
    });
    // Update role in the list and selected
    const idx = roles.value.findIndex((r) => r.id === data.id);
    if (idx !== -1) roles.value[idx] = { ...roles.value[idx], ...data };
    selectedRole.value = { ...selectedRole.value, permissions: data.permissions };
    editingPermissions.value = false;
    uiStore.notify({ message: 'Permissions saved', type: 'success' });
  } catch (err) {
    uiStore.notify({ message: err?.response?.data?.message || 'Failed to save', type: 'error' });
  } finally {
    saving.value = false;
  }
}

function permLabel(perm) {
  return perm.split(':')[1];
}

function openCreate() {
  editingRole.value = null;
  formData.name = '';
  formData.description = '';
  showForm.value = true;
}

function openEdit(role) {
  editingRole.value = role;
  formData.name = role.name;
  formData.description = role.description || '';
  showForm.value = true;
}

async function handleSave() {
  const { valid } = await formRef.value.validate();
  if (!valid) return;
  formSaving.value = true;
  try {
    if (editingRole.value) {
      const { data } = await apiClient.put(`/roles/${editingRole.value.id}`, {
        name: formData.name,
        description: formData.description,
      });
      const idx = roles.value.findIndex((r) => r.id === data.id);
      if (idx !== -1) roles.value[idx] = { ...roles.value[idx], ...data };
      if (selectedRole.value?.id === data.id) {
        selectedRole.value = { ...selectedRole.value, name: data.name, description: data.description };
      }
      uiStore.notify({ message: 'Role updated', type: 'success' });
    } else {
      const { data } = await apiClient.post('/roles', {
        name: formData.name,
        description: formData.description,
        permissions: [],
      });
      roles.value.push(data);
      uiStore.notify({ message: 'Role created', type: 'success' });
    }
    showForm.value = false;
  } catch (err) {
    uiStore.notify({ message: err?.response?.data?.message || 'Failed to save', type: 'error' });
  } finally {
    formSaving.value = false;
  }
}

function handleDelete(role) {
  deletingRole.value = role;
  showDeleteConfirm.value = true;
}

async function confirmDelete() {
  deleting.value = true;
  try {
    await apiClient.delete(`/roles/${deletingRole.value.id}`);
    roles.value = roles.value.filter((r) => r.id !== deletingRole.value.id);
    if (selectedRole.value?.id === deletingRole.value.id) selectedRole.value = null;
    showDeleteConfirm.value = false;
    uiStore.notify({ message: 'Role deleted', type: 'success' });
  } catch (err) {
    uiStore.notify({ message: err?.response?.data?.message || 'Failed to delete', type: 'error' });
  } finally {
    deleting.value = false;
    deletingRole.value = null;
  }
}
</script>
