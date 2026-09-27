export const API_URL =
  import.meta.env.VITE_API_URL ??
  (import.meta.env.PROD ? "https://janpratinidhi-api.vercel.app/api" : "http://localhost:4000/api");
export const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;
