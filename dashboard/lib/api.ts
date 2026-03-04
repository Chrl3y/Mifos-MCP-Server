import axios from "axios";

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export const api = axios.create({ baseURL: BASE });

export const callMcp = async (tool: string, args: Record<string, unknown> = {}): Promise<unknown> => {
  const { data } = await api.post(`/api/mcp/${tool}`, args);
  return data;
};

export const getEvents = () => api.get("/api/events").then(r => r.data);
export const getHealth = () => api.get("/api/health").then(r => r.data);
