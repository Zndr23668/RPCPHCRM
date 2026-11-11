import { LOCAL_AUTH_ENDPOINT, LOCAL_SESSION_STORAGE_KEY, SUPABASE_PUBLISHABLE_KEY } from "./config";

export type LocalRole = "superadmin" | "admin" | "employee";

export interface LocalUser {
  id: string;
  display_name: string;
  role: LocalRole;
  assigned_agent_id?: string | null;
  last_login_at?: string | null;
}

export interface SessionResponse {
  user: LocalUser;
}

function getToken(): string {
  try {
    return window.localStorage.getItem(LOCAL_SESSION_STORAGE_KEY) || "";
  } catch {
    return "";
  }
}

function saveToken(token: string): void {
  try {
    window.localStorage.setItem(LOCAL_SESSION_STORAGE_KEY, token);
  } catch {
    throw new Error("This browser cannot save the CRM session. Check its privacy settings.");
  }
}

function clearToken(): void {
  try {
    window.localStorage.removeItem(LOCAL_SESSION_STORAGE_KEY);
  } catch {
    // The session is still invalidated server-side when possible.
  }
}

async function request<T>(action: string, payload: Record<string, unknown> = {}): Promise<T> {
  const token = getToken();
  let response: Response;
  try {
    response = await fetch(LOCAL_AUTH_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: SUPABASE_PUBLISHABLE_KEY
      },
      body: JSON.stringify({ action, ...payload, ...(token ? { token } : {}) })
    });
  } catch {
    throw new Error("Unable to reach the sign-in service. Check your connection and try again.");
  }

  const body = await response.json().catch(() => ({ error: "Invalid server response." }));
  if (!response.ok) {
    throw new Error(typeof body.error === "string" ? body.error : "The request could not be completed.");
  }
  return body as T;
}

export const localAuth = {
  getToken,
  clearToken,
  async login(idKey: string): Promise<{ token: string }> {
    const result = await request<{ token: string }>("login", { id_key: idKey });
    if (!result.token) throw new Error("The sign-in service did not return a session.");
    saveToken(result.token);
    return result;
  },
  me(): Promise<SessionResponse> {
    return request<SessionResponse>("me");
  },
  async logout(): Promise<void> {
    if (!getToken()) return;
    try {
      await request("logout");
    } finally {
      clearToken();
    }
  },
  clear(): void {
    clearToken();
  },
  createLead(payload: {
    lead_name: string;
    town_or_county: string;
    lead_type: string;
    county_used: string;
    lead_source: string;
    matched_area_id: string | null;
  }): Promise<{ lead?: { id: string; isa_name: string } }> {
    return request("create_lead", payload);
  }
};