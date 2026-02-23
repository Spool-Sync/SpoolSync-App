<template>
  <div>
    <div class="d-flex align-center mb-4">
      <v-btn icon="mdi-arrow-left" variant="text" @click="$router.back()" />
      <h1 class="text-h5 font-weight-bold ml-2">Spool Detail</h1>
      <v-spacer />
      <v-btn color="primary" variant="tonal" prepend-icon="mdi-pencil" @click="showEdit = true">Edit</v-btn>
    </div>

    <v-row v-if="spool">
      <v-col cols="12" md="4">
        <SpoolCard :spool="spool" />
      </v-col>
      <v-col cols="12" md="8">
        <v-card rounded="xl" class="mb-4">
          <v-card-title class="pa-4 pb-2 d-flex align-center">
            Weight History
            <v-spacer />
            <v-btn-toggle v-model="historyDays" density="compact" variant="outlined" class="ml-2">
              <v-btn :value="7" size="small">7d</v-btn>
              <v-btn :value="30" size="small">30d</v-btn>
              <v-btn :value="90" size="small">90d</v-btn>
            </v-btn-toggle>
          </v-card-title>
          <v-card-text>
            <WeightHistoryChart
              :history="history"
              :spool-weight_g="spool.filamentType?.spoolWeight_g ?? 200"
            />
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>

    <v-overlay v-else :model-value="loading" class="align-center justify-center">
      <v-progress-circular indeterminate size="64" />
    </v-overlay>

    <v-dialog v-model="showEdit" max-width="500">
      <SpoolForm :spool="spool" @saved="handleSaved" @cancel="showEdit = false" />
    </v-dialog>
  </div>
</template>

<script setup>
import { ref, watch, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import SpoolCard from '@/components/cards/SpoolCard.vue';
import SpoolForm from '@/components/forms/SpoolForm.vue';
import WeightHistoryChart from '@/components/charts/WeightHistoryChart.vue';
import { useSpoolStore } from '@/store/spools';
import apiClient from '@/services/apiClient';

const route = useRoute();
const spoolStore = useSpoolStore();
const spool = ref(null);
const loading = ref(true);
const showEdit = ref(false);
const history = ref([]);
const historyDays = ref(30);

onMounted(async () => {
  spool.value = await spoolStore.fetchSpool(route.params.spoolId);
  loading.value = false;
  await loadHistory();
});

watch(historyDays, loadHistory);

async function loadHistory() {
  if (!route.params.spoolId) return;
  const { data } = await apiClient.get(`/spools/${route.params.spoolId}/history`, {
    params: { days: historyDays.value },
  });
  history.value = data;
}

async function handleSaved() {
  showEdit.value = false;
  spool.value = await spoolStore.fetchSpool(route.params.spoolId);
  await loadHistory();
}
</script>
