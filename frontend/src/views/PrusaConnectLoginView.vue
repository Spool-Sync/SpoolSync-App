<template>
  <div class="prusa-connect-login">
    <h2>Prusa Connect Login</h2>
    <form @submit.prevent="submit">
      <div>
        <label>Email</label>
        <input v-model="email" type="email" required />
      </div>
      <div>
        <label>Password</label>
        <input v-model="password" type="password" required />
      </div>
      <div v-if="needsOtp">
        <label>2FA Code</label>
        <input v-model="otp" type="text" maxlength="6" />
      </div>
      <button type="submit">Login</button>
      <div v-if="error" class="error">{{ error }}</div>
      <div v-if="success" class="success">Login successful!</div>
    </form>
  </div>
</template>

<script setup>
import { ref } from "vue";
import apiClient from "../services/apiClient";

const email = ref("");
const password = ref("");
const otp = ref("");
const needsOtp = ref(false);
const error = ref("");
const success = ref(false);

async function submit() {
  error.value = "";
  success.value = false;
  try {
    const payload = { email: email.value, password: password.value };
    if (needsOtp.value) payload.otp = otp.value;
    await apiClient.post("/printers/prusa-connect/login", payload);
    success.value = true;
  } catch (err) {
    const msg = err.response?.data?.message || err.message;
    if (err.response?.status === 403 && msg?.includes("OTP")) {
      needsOtp.value = true;
      error.value = "2FA required — enter your code above.";
    } else {
      error.value = msg || "Login failed";
    }
  }
}
</script>
