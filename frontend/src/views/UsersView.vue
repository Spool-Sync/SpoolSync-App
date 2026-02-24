<template>
  <div>
    <div class="d-flex align-center mb-4">
      <h1 class="text-h5 font-weight-bold">Users</h1>
      <v-spacer />
      <v-btn color="primary" prepend-icon="mdi-plus" @click="openCreate">Add User</v-btn>
    </div>

    <v-text-field
      v-model="search"
      label="Search users"
      prepend-inner-icon="mdi-magnify"
      variant="outlined"
      density="compact"
      clearable
      class="mb-4"
      style="max-width: 400px"
    />

    <v-data-table
      :headers="headers"
      :items="users"
      :loading="loading"
      :search="search"
      :items-per-page="25"
      :items-per-page-options="[10, 25, 50]"
      rounded="xl"
      hover
    >
      <template #item.customRoles="{ item }">
        <div class="d-flex gap-1 flex-wrap">
          <v-chip
            v-if="item.isSuperAdmin"
            color="warning"
            size="x-small"
            variant="tonal"
          >
            Super Admin
          </v-chip>
          <v-chip
            v-for="role in item.customRoles"
            :key="role.id"
            :color="role.source === 'sso' ? 'info' : roleColor(role.name)"
            size="x-small"
            variant="tonal"
          >
            {{ role.name }}
          </v-chip>
        </div>
      </template>

      <template #item.createdAt="{ item }">
        <span class="text-medium-emphasis text-body-2">
          {{ new Date(item.createdAt).toLocaleDateString() }}
        </span>
      </template>

      <template #item.actions="{ item }">
        <v-btn
          icon="mdi-pencil"
          size="small"
          variant="text"
          @click.stop="openEdit(item)"
        />
        <v-btn
          v-if="item.userId !== authStore.user?.userId"
          icon="mdi-delete"
          size="small"
          variant="text"
          color="error"
          @click.stop="handleDelete(item)"
        />
      </template>
    </v-data-table>

    <v-dialog v-model="showForm" max-width="500">
      <UserForm :user="editingUser" @saved="handleSaved" @cancel="closeForm" />
    </v-dialog>

    <!-- Delete confirmation -->
    <v-dialog v-model="showDeleteConfirm" max-width="400">
      <v-card rounded="xl">
        <v-card-title class="pa-4">Delete User</v-card-title>
        <v-card-text>
          Are you sure you want to delete <strong>{{ deletingUser?.username }}</strong>? This cannot be undone.
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
import { ref, onMounted } from 'vue';
import UserForm from '@/components/forms/UserForm.vue';
import apiClient from '@/services/apiClient';
import { useAuthStore } from '@/store/auth';
import { useUiStore } from '@/store/ui';

const ROLE_COLORS = ['primary', 'secondary', 'info', 'success', 'teal', 'indigo', 'purple'];
function roleColor(name) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  return ROLE_COLORS[hash % ROLE_COLORS.length];
}

const authStore = useAuthStore();
const uiStore = useUiStore();

const users = ref([]);
const loading = ref(false);
const search = ref('');
const showForm = ref(false);
const editingUser = ref(null);
const showDeleteConfirm = ref(false);
const deletingUser = ref(null);
const deleting = ref(false);

const headers = [
  { title: 'Username', key: 'username' },
  { title: 'Email', key: 'email' },
  { title: 'Roles', key: 'customRoles', sortable: false },
  { title: 'Joined', key: 'createdAt' },
  { title: 'Actions', key: 'actions', sortable: false, align: 'end' },
];

onMounted(fetchUsers);

async function fetchUsers() {
  loading.value = true;
  try {
    const { data } = await apiClient.get('/users');
    users.value = data;
  } finally {
    loading.value = false;
  }
}

function openCreate() {
  editingUser.value = null;
  showForm.value = true;
}

function openEdit(user) {
  editingUser.value = user;
  showForm.value = true;
}

function closeForm() {
  showForm.value = false;
  editingUser.value = null;
}

async function handleSaved() {
  closeForm();
  await fetchUsers();
}

function handleDelete(user) {
  deletingUser.value = user;
  showDeleteConfirm.value = true;
}

async function confirmDelete() {
  deleting.value = true;
  try {
    await apiClient.delete(`/users/${deletingUser.value.userId}`);
    users.value = users.value.filter((u) => u.userId !== deletingUser.value.userId);
    showDeleteConfirm.value = false;
    uiStore.notify({ message: 'User deleted', type: 'success' });
  } finally {
    deleting.value = false;
    deletingUser.value = null;
  }
}
</script>
