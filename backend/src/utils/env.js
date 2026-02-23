// Utility to get browserless URL from env
export function getBrowserlessUrl() {
  return process.env.BROWSERLESS_URL || "http://localhost:3001";
}
