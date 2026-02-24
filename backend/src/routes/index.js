import { Router } from "express";
import authRoutes from "./auth.js";
import userRoutes from "./users.js";
import rolesRoutes from "./roles.js";
import filamentTypeRoutes from "./filamentTypes.js";
import spoolRoutes from "./spools.js";
import printerRoutes from "./printers.js";
import spoolHolderRoutes from "./spoolHolders.js";
import storageLocationRoutes from "./storageLocations.js";
import orderRoutes from "./orders.js";
import integrationRoutes from "./integrations.js";
import esp32DeviceRoutes from "./esp32Devices.js";

const router = Router();

router.use("/auth", authRoutes);
router.use("/users", userRoutes);
router.use("/roles", rolesRoutes);
router.use("/filament-types", filamentTypeRoutes);
router.use("/spools", spoolRoutes);
router.use("/printers", printerRoutes);
router.use("/spool-holders", spoolHolderRoutes);
router.use("/storage-locations", storageLocationRoutes);
router.use("/orders", orderRoutes);
router.use("/integrations", integrationRoutes);
router.use("/esp32-devices", esp32DeviceRoutes);

export default router;
