import { createApp } from "vue";
import { createPinia } from "pinia";
import { createVuetify } from "vuetify";
import "@mdi/font/css/materialdesignicons.css";
import "vuetify/styles";

import App from "./App.vue";
import router from "./router/index.js";
import { websocketService } from "./services/websocketService.js";

// ── Remote console forwarding (debug aid for mobile) ─────────────────────────
// Patches console.log/warn/error to also emit over the Socket.IO connection.
// Only active when the socket is connected; never blocks the original call.
for (const level of ['log', 'warn', 'error']) {
  const original = console[level].bind(console);
  console[level] = (...args) => {
    original(...args);
    try {
      websocketService.bufferLog({
        level,
        args: args.map((a) => {
          try { return typeof a === 'object' ? JSON.stringify(a) : String(a); } catch { return String(a); }
        }),
      });
    } catch { /* never break the app */ }
  };
}

const vuetify = createVuetify({
  theme: {
    defaultTheme: "dark",
    themes: {
      light: {
        colors: {
          primary: "#6699FF",
          secondary: "#515151",
          success: "#8DCD8D",
          danger: "#E48683",
          warning: "#FFC04C",
          info: "#8CD3E8",
        },
      },
      dark: {
        colors: {
          primary: "#6699FF",
          secondary: "#515151",
          success: "#8DCD8D",
          danger: "#E48683",
          warning: "#FFC04C",
          info: "#8CD3E8",
        },
      },
    },
  },
  icons: {
    defaultSet: "mdi",
  },
});

const pinia = createPinia();
const app = createApp(App);

app.use(pinia);
app.use(router);
app.use(vuetify);

app.mount("#app");
