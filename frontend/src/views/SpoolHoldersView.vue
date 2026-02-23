<template>
  <div>
    <div class="d-flex align-center mb-4">
      <h1 class="text-h5 font-weight-bold">Scales</h1>
      <v-spacer />
      <v-btn color="primary" prepend-icon="mdi-plus" @click="showForm = true">Add Holder</v-btn>
    </div>

    <v-alert type="info" variant="tonal" density="compact" class="mb-4" icon="mdi-information-outline">
      Printer spool holders are managed from each printer's detail page.
    </v-alert>

    <v-row class="mb-4" dense>
      <v-col cols="12" sm="5">
        <v-text-field
          v-model="search"
          label="Search holders"
          prepend-inner-icon="mdi-magnify"
          variant="outlined"
          density="compact"
          clearable
          hide-details
        />
      </v-col>
      <v-col cols="12" sm="7">
        <div class="d-flex flex-wrap gap-2">
          <v-chip
            v-for="opt in assignmentOptions"
            :key="opt.value"
            :color="assignmentFilter === opt.value ? opt.color : undefined"
            :variant="assignmentFilter === opt.value ? 'tonal' : 'outlined'"
            :prepend-icon="opt.icon"
            clickable
            @click="assignmentFilter = assignmentFilter === opt.value ? null : opt.value"
          >
            {{ opt.label }}
          </v-chip>
        </div>
      </v-col>
    </v-row>

    <SpoolHolderTable
      :holders="spoolHolderStore.holders"
      :loading="spoolHolderStore.loading"
      :search="search"
      :assignment-filter="assignmentFilter"
      @edit="openEdit"
      @delete="handleDelete"
    />

    <v-dialog v-model="showForm" max-width="600">
      <SpoolHolderForm
        :holder="editingHolder"
        @saved="handleSaved"
        @cancel="closeForm"
      />
    </v-dialog>

  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import SpoolHolderTable from '@/components/tables/SpoolHolderTable.vue';
import SpoolHolderForm from '@/components/forms/SpoolHolderForm.vue';
import { useSpoolHolderStore } from '@/store/spoolHolders';

const spoolHolderStore = useSpoolHolderStore();
const showForm = ref(false);
const editingHolder = ref(null);
const search = ref('');
const assignmentFilter = ref(null);

// Only show STORAGE and INGEST_POINT here; PRINTER is managed on Printer detail page
const assignmentOptions = [
  { value: 'STORAGE', label: 'Storage', color: 'green', icon: 'mdi-archive' },
  { value: 'INGEST_POINT', label: 'Ingest', color: 'orange', icon: 'mdi-tray-arrow-down' },
];

onMounted(() => spoolHolderStore.fetchSpoolHolders({ excludeAssignmentType: 'PRINTER' }));

function openEdit(holder) {
  editingHolder.value = holder;
  showForm.value = true;
}

function closeForm() {
  showForm.value = false;
  editingHolder.value = null;
}

async function handleSaved() {
  closeForm();
  await spoolHolderStore.fetchSpoolHolders({ excludeAssignmentType: 'PRINTER' });
}

async function handleDelete(spoolHolderId) {
  await spoolHolderStore.deleteHolder(spoolHolderId);
}
</script>
