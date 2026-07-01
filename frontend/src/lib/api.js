import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const API = `${BACKEND_URL}/api`;

const TOKEN_KEY = "pg_session_token";

export const setCustomerToken = (t) => {
  if (t) localStorage.setItem(TOKEN_KEY, t);
  else localStorage.removeItem(TOKEN_KEY);
};
export const getCustomerToken = () => localStorage.getItem(TOKEN_KEY);

export const api = axios.create({
  baseURL: API,
  withCredentials: true,
});

// Attach Bearer token as fallback when browsers block cross-site cookies
// (production frontend + preview backend on different domains).
api.interceptors.request.use((config) => {
  const t = getCustomerToken();
  if (t) config.headers.Authorization = `Bearer ${t}`;
  return config;
});

export const adminApi = axios.create({
  baseURL: API,
});

adminApi.interceptors.request.use((config) => {
  const t = localStorage.getItem("pg_admin_token");
  if (t) config.headers.Authorization = `Bearer ${t}`;
  return config;
});

export const downloadFile = async (path, filename) => {
  const t = getCustomerToken();
  const r = await fetch(`${API}${path}`, {
    credentials: "include",
    headers: t ? { Authorization: `Bearer ${t}` } : {},
  });
  if (!r.ok) throw new Error("download failed");
  const blob = await r.blob();
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
};
