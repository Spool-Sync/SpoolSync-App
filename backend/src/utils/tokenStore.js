// Simple in-memory token store (replace with DB/secure store in production)
const tokens = {};

export function storeToken(key, token) {
  tokens[key] = token;
}

export function getToken(key) {
  return tokens[key];
}

export function refreshToken(key) {
  // Implement refresh logic if needed
  return tokens[key];
}
