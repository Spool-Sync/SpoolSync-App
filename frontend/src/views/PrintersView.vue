<template>
  <div>
    <div class="d-flex align-center mb-4">
      <h1 class="text-h5 font-weight-bold">Printers</h1>
      <v-spacer />
      <v-btn color="primary" prepend-icon="mdi-plus" @click="showForm = true">Add Printer</v-btn>
    </div>

    <v-text-field
      v-model="search"
      label="Search printers"
      prepend-inner-icon="mdi-magnify"
      variant="outlined"
      density="compact"
      clearable
      class="mb-4"
      style="max-width: 400px"
    />

    <PrinterTable
      :printers="printerStore.printers"
      :loading="printerStore.loading"
      :search="search"
      @edit="openEdit"
      @delete="handleDelete"
      @sync="handleSync"
    />

    <v-dialog v-model="showForm" max-width="600">
      <PrinterForm
        :printer="editingPrinter"
        @saved="handleSaved"
        @cancel="closeForm"
      />
    </v-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import PrinterTable from '@/components/tables/PrinterTable.vue';
import PrinterForm from '@/components/forms/PrinterForm.vue';
import { usePrinterStore } from '@/store/printers';

const printerStore = usePrinterStore();
const showForm = ref(false);
const editingPrinter = ref(null);
const search = ref('');

onMounted(() => printerStore.fetchPrinters());

function openEdit(printer) {
  editingPrinter.value = printer;
  showForm.value = true;
}

function closeForm() {
  showForm.value = false;
  editingPrinter.value = null;
}

async function handleSaved() {
  closeForm();
  await printerStore.fetchPrinters();
}

async function handleDelete(printerId) {
  await printerStore.deletePrinter(printerId);
}

async function handleSync(printerId) {
  await printerStore.syncStatus(printerId);
}
</script>
