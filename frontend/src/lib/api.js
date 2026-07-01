import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const API = `${BACKEND_URL}/api`;

export const api = axios.create({
  baseURL: API,
  withCredentials: true,
});

export const adminApi = axios.create({
  baseURL: API,
});

adminApi.interceptors.request.use((config) => {
  const t = localStorage.getItem("pg_admin_token");
  if (t) config.headers.Authorization = `Bearer ${t}`;
  return config;
});
