// Service to automate Prusa Connect login using browserless and manage JWT tokens
import { getBrowserlessUrl } from "../utils/env.js";
import { storeToken, getToken, refreshToken } from "../utils/tokenStore.js";
import { loginPrusaConnect } from "./prusaConnectBrowserless.js";

export async function prusaConnectLogin({ email, password, otpCb }) {
  const browserlessUrl = getBrowserlessUrl();
  const otp = otpCb ? await otpCb() : "";
  const jwt = await loginPrusaConnect({ email, password, otp, browserlessUrl });
  if (!jwt) throw new Error("Failed to retrieve JWT");
  storeToken("prusaConnect", jwt);
}

export async function getPrusaConnectToken() {
  return getToken("prusaConnect");
}
