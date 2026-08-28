import axios from "axios";

// Vite automatically pulls the local URL during 'npm run dev' and the production URL during 'npm run build'
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "https://api.aerostatelab.com";

const api = axios.create({
  baseURL: API_BASE_URL,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("hotel_erp_token");

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

export default api;