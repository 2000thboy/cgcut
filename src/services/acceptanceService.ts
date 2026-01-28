import {
  type AcceptanceResponse,
  type AcceptanceStoryboardItem,
  type AcceptanceMatchItem,
} from "../types/DataModel";

interface AcceptanceConfig {
  apiEndpoint?: string;
  apiKey?: string;
}

class AcceptanceService {
  private baseUrl: string;
  private apiKey?: string;

  constructor(config: AcceptanceConfig = {}) {
    this.baseUrl = config.apiEndpoint || import.meta.env.VITE_ACCEPT_SERVICE_URL || "/api/accept";
    this.apiKey = config.apiKey || import.meta.env.VITE_ACCEPT_API_KEY;
  }

  private headers() {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (this.apiKey) {
      headers["Authorization"] = `Bearer ${this.apiKey}`;
    }
    return headers;
  }

  async review(payload: {
    storyboard: AcceptanceStoryboardItem[];
    matches: AcceptanceMatchItem[];
    rules?: any;
    kb_paths?: string[];
  }): Promise<AcceptanceResponse> {
    const response = await fetch(`${this.baseUrl}/review`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`验收请求失败: ${response.status} ${text}`);
    }

    return (await response.json()) as AcceptanceResponse;
  }

  async reload(): Promise<void> {
    const response = await fetch(`${this.baseUrl}/reload`, {
      method: "POST",
      headers: this.headers(),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`reload 失败: ${response.status} ${text}`);
    }
  }
}

export const acceptanceService = new AcceptanceService();
