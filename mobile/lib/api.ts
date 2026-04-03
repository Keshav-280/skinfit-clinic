import { apiUrl } from "./apiBase";

export { getApiBase, apiUrl } from "./apiBase";


export class ApiError extends Error {
  constructor(
    public status: number,
    public body: Record<string, unknown>,
    message?: string
  ) {
    super(
      message ??
        (typeof body.message === "string"
          ? body.message
          : typeof body.error === "string"
            ? body.error
            : `Request failed (${status})`)
    );
    this.name = "ApiError";
  }
}

export async function apiFetch(
  path: string,
  token: string | null,
  init: RequestInit = {}
): Promise<Response> {
  const headers = new Headers(init.headers);
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  const isForm = init.body != null && typeof FormData !== "undefined" && init.body instanceof FormData;
  if (!isForm && init.body != null && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  return fetch(apiUrl(path), { ...init, headers });
}

export async function apiJson<T>(
  path: string,
  token: string | null,
  init: RequestInit = {}
): Promise<T> {
  const res = await apiFetch(path, token, init);
  const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    throw new ApiError(res.status, body);
  }
  return body as T;
}
