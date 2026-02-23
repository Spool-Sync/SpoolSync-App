import { createRouter, createWebHistory } from "vue-router";
import { useAuthStore } from "@/store/auth";

const routes = [
  {
    path: "/",
    redirect: "/dashboard",
  },
  {
    path: "/login",
    name: "Login",
    component: () => import("@/views/LoginView.vue"),
    meta: { public: true },
  },
  {
    path: "/auth/callback",
    name: "OidcCallback",
    component: () => import("@/views/OidcCallbackView.vue"),
    meta: { public: true },
  },
  {
    path: "/dashboard",
    name: "Dashboard",
    component: () => import("@/views/DashboardView.vue"),
  },
  {
    path: "/spools",
    name: "Spools",
    component: () => import("@/views/SpoolsView.vue"),
  },
  {
    path: "/spools/:spoolId",
    name: "SpoolDetail",
    component: () => import("@/views/SpoolDetailView.vue"),
  },
  {
    path: "/printers",
    name: "Printers",
    component: () => import("@/views/PrintersView.vue"),
  },
  {
    path: "/printers/:printerId",
    name: "PrinterDetail",
    component: () => import("@/views/PrinterDetailView.vue"),
  },
  {
    path: "/storage",
    name: "Storage",
    component: () => import("@/views/StorageLocationsView.vue"),
  },
  {
    path: "/storage/:locationId",
    name: "StorageDetail",
    component: () => import("@/views/StorageLocationDetailView.vue"),
  },
  {
    path: "/inventory",
    name: "Inventory",
    component: () => import("@/views/InventoryView.vue"),
  },
  {
    path: "/orders",
    name: "Orders",
    component: () => import("@/views/OrdersView.vue"),
  },
  {
    path: "/esp32-devices",
    name: "Esp32Devices",
    component: () => import("@/views/Esp32DevicesView.vue"),
  },
  {
    path: "/esp32-devices/:deviceId",
    name: "Esp32DeviceDetail",
    component: () => import("@/views/Esp32DeviceDetailView.vue"),
  },
  {
    path: "/spool-holders",
    name: "SpoolHolders",
    component: () => import("@/views/SpoolHoldersView.vue"),
  },
  {
    path: "/spool-holders/:spoolHolderId",
    name: "SpoolHolderDetail",
    component: () => import("@/views/SpoolHolderDetailView.vue"),
  },
  {
    path: "/weigh",
    name: "Weigh",
    component: () => import("@/views/WeighView.vue"),
  },
  {
    path: "/settings",
    name: "Settings",
    component: () => import("@/views/SettingsView.vue"),
  },
  {
    path: "/admin/users",
    name: "Users",
    component: () => import("@/views/UsersView.vue"),
    meta: { adminOnly: true },
  },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

router.beforeEach((to) => {
  const authStore = useAuthStore();
  if (!to.meta.public && !authStore.isAuthenticated) {
    return { name: "Login", query: { redirect: to.fullPath } };
  }
  if (to.meta.adminOnly && !authStore.isAdmin) {
    return { name: "Dashboard" };
  }
});

export default router;
