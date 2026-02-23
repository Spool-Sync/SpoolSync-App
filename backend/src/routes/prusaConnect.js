import express from "express";
import {
  prusaConnectLogin,
  getPrusaConnectToken,
} from "../services/prusaConnectAuthService.js";

const router = express.Router();

// POST /api/v1/prusa-connect/login
router.post("/login", async (req, res) => {
  const { email, password, otp } = req.body;
  try {
    await prusaConnectLogin({ email, password, otpCb: () => otp });
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// GET /api/v1/prusa-connect/token
router.get("/token", async (req, res) => {
  const token = await getPrusaConnectToken();
  if (token) {
    res.json({ token });
  } else {
    res.status(404).json({ error: "No token found" });
  }
});

export default router;
import express from "express";
import {
  prusaConnectLogin,
  getPrusaConnectToken,
} from "../services/prusaConnectAuthService.js";

const router = express.Router();

// POST /api/v1/prusa-connect/login
router.post("/login", async (req, res) => {
  const { email, password, otp } = req.body;
  try {
    await prusaConnectLogin({ email, password, otpCb: () => otp });
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// GET /api/v1/prusa-connect/token
router.get("/token", async (req, res) => {
  const token = await getPrusaConnectToken();
  if (token) {
    res.json({ token });
  } else {
    res.status(404).json({ error: "No token found" });
  }
});

export default router;
