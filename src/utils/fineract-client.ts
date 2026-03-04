import axios, { AxiosInstance, AxiosResponse } from "axios";
import { FineractConfig } from "../types/index.js";

export class FineractClient {
  private http: AxiosInstance;
  constructor(private config: FineractConfig) {
    const token = Buffer.from(`${config.username}:${config.password}`).toString("base64");
    this.http = axios.create({
      baseURL: config.baseUrl,
      headers: {
        Authorization: `Basic ${token}`,
        "Fineract-Platform-TenantId": config.tenantId,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      timeout: 30_000,
    });
  }

  async get<T>(path: string, params?: Record<string, unknown>): Promise<T> {
    const r: AxiosResponse<T> = await this.http.get(path, { params });
    return r.data;
  }

  async post<T>(path: string, body: Record<string, unknown>): Promise<T> {
    const r: AxiosResponse<T> = await this.http.post(path, body);
    return r.data;
  }

  async put<T>(path: string, body: Record<string, unknown>): Promise<T> {
    const r: AxiosResponse<T> = await this.http.put(path, body);
    return r.data;
  }

  async delete<T>(path: string): Promise<T> {
    const r: AxiosResponse<T> = await this.http.delete(path);
    return r.data;
  }

  /** Fetch all pages of a paginated Fineract list endpoint */
  async getAllPages<T>(path: string, params: Record<string, unknown> = {}): Promise<T[]> {
    const results: T[] = [];
    let offset = 0;
    const limit = 200;
    for (;;) {
      const page = await this.get<{ pageItems: T[]; totalFilteredRecords: number }>(
        path, { ...params, limit, offset }
      );
      results.push(...(page.pageItems ?? []));
      if (results.length >= (page.totalFilteredRecords ?? results.length)) break;
      offset += limit;
    }
    return results;
  }

  getBaseUrl() { return this.config.baseUrl; }
}

export function createClient(): FineractClient {
  return new FineractClient({
    baseUrl:  process.env.FINERACT_BASE_URL   ?? "http://localhost:8080/fineract-provider/api/v1",
    tenantId: process.env.FINERACT_TENANT_ID  ?? "default",
    username: process.env.FINERACT_USERNAME   ?? "mifos",
    password: process.env.FINERACT_PASSWORD   ?? "password",
  });
}
