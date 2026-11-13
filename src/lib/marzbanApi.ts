import type {
  AdminInfo,
  ConnectionConfig,
  CoreStats,
  HostConfig,
  NodeCreatePayload,
  NodeModifyPayload,
  NodeRecord,
  NodeSettings,
  NodeUsageRecord,
  ProxyInbound,
  SystemStats,
  UserCreatePayload,
  UserModifyPayload,
  UserRecord,
  UsersResponse,
} from '../types/marzban';

export class MarzbanApiError extends Error {
  status: number;
  detail: string;

  constructor(status: number, detail: string) {
    super(detail);
    this.status = status;
    this.detail = detail;
  }
}

export function normalizeBaseUrl(raw: string): string {
  const trimmed = raw.trim().replace(/\/+$/, '');
  if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
    return `https://${trimmed}`;
  }
  return trimmed;
}

async function callDirectBrowser<T>(
  baseUrl: string,
  path: string,
  options?: {
    method?: string;
    body?: unknown;
    formBody?: Record<string, string>;
    headers?: Record<string, string>;
  }
): Promise<T> {
  const cleanBase = baseUrl.replace(/\/+$/, '');
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  const fullUrl = `${cleanBase}${cleanPath}`;
  const headers: Record<string, string> = { ...(options?.headers || {}) };

  let fetchBody: string | undefined;
  if (options?.formBody) {
    fetchBody = new URLSearchParams(options.formBody).toString();
    headers['Content-Type'] = 'application/x-www-form-urlencoded';
  } else if (options?.body !== undefined) {
    fetchBody = typeof options.body === 'string' ? options.body : JSON.stringify(options.body);
    if (!headers['Content-Type']) {
      headers['Content-Type'] = 'application/json';
    }
  }

  let res: Response;
  try {
    res = await fetch(fullUrl, {
      method: options?.method || 'GET',
      headers,
      body: options?.method && options.method !== 'GET' ? fetchBody : undefined,
    });
  } catch (err) {
    throw new MarzbanApiError(
      0,
      err instanceof Error
        ? `${err.message} (CORS or HTTPS required on static hosting like GitHub Pages)`
        : 'Direct browser request failed (check CORS / HTTPS on Marzban server)'
    );
  }

  const text = await res.text();
  let data: unknown = text;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }

  if (!res.ok) {
    const detail =
      (typeof data === 'object' && data && 'detail' in data
        ? String((data as { detail: unknown }).detail)
        : null) ||
      (typeof data === 'string' && data ? data : null) ||
      `HTTP ${res.status}`;
    throw new MarzbanApiError(res.status, detail);
  }

  return data as T;
}

async function callProxy<T>(
  config: Pick<ConnectionConfig, 'serverUrl' | 'allowInsecureTls'> & { token?: string },
  path: string,
  options?: {
    method?: string;
    body?: unknown;
    formBody?: Record<string, string>;
    headers?: Record<string, string>;
  }
): Promise<T> {
  const headers: Record<string, string> = {
    Accept: 'application/json',
    ...(options?.headers || {}),
  };

  if (config.token) {
    headers.Authorization = `Bearer ${config.token}`;
  }

  const normalizedUrl = normalizeBaseUrl(config.serverUrl);

  let response: Response;
  try {
    response = await fetch('/api/proxy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        targetUrl: normalizedUrl,
        path,
        method: options?.method || 'GET',
        headers,
        body: options?.body,
        formBody: options?.formBody,
        allowInsecureTls: config.allowInsecureTls,
      }),
    });
  } catch {
    return callDirectBrowser<T>(normalizedUrl, path, { ...options, headers });
  }

  // On static hosting (e.g. GitHub Pages), /api/proxy does not exist (404 / 405).
  // Fall back to direct browser fetch to the Marzban API server.
  if (response.status === 404 || response.status === 405) {
    return callDirectBrowser<T>(normalizedUrl, path, { ...options, headers });
  }

  const payload = await response.json();

  if (!response.ok || !payload.ok) {
    const status = payload.status || response.status || 500;
    const detail =
      (typeof payload.data === 'object' && payload.data && 'detail' in payload.data
        ? String((payload.data as { detail: unknown }).detail)
        : null) ||
      payload.detail ||
      (typeof payload.data === 'string' && payload.data ? payload.data : null) ||
      `HTTP ${status}`;
    throw new MarzbanApiError(status, detail);
  }

  return payload.data as T;
}

export async function loginAdmin(params: {
  serverUrl: string;
  username: string;
  password: string;
  allowInsecureTls: boolean;
}): Promise<{ access_token: string; token_type: string }> {
  return callProxy(
    { serverUrl: params.serverUrl, allowInsecureTls: params.allowInsecureTls },
    '/api/admin/token',
    {
      method: 'POST',
      formBody: {
        username: params.username,
        password: params.password,
      },
    }
  );
}

export async function getCurrentAdmin(config: ConnectionConfig): Promise<AdminInfo> {
  return callProxy<AdminInfo>(config, '/api/admin');
}

export async function getAdmins(config: ConnectionConfig): Promise<AdminInfo[]> {
  return callProxy<AdminInfo[]>(config, '/api/admins');
}

export async function createAdmin(
  config: ConnectionConfig,
  payload: { username: string; password: string; is_sudo: boolean }
): Promise<AdminInfo> {
  return callProxy<AdminInfo>(config, '/api/admin', {
    method: 'POST',
    body: payload,
  });
}

export async function deleteAdmin(config: ConnectionConfig, username: string): Promise<void> {
  await callProxy(config, `/api/admin/${encodeURIComponent(username)}`, {
    method: 'DELETE',
  });
}

export async function getSystemStats(config: ConnectionConfig): Promise<SystemStats> {
  return callProxy<SystemStats>(config, '/api/system');
}

export async function getCoreStats(config: ConnectionConfig): Promise<CoreStats> {
  return callProxy<CoreStats>(config, '/api/core');
}

export async function restartCore(config: ConnectionConfig): Promise<void> {
  await callProxy(config, '/api/core/restart', { method: 'POST' });
}

export async function getCoreConfig(config: ConnectionConfig): Promise<Record<string, unknown>> {
  return callProxy<Record<string, unknown>>(config, '/api/core/config');
}

export async function updateCoreConfig(
  config: ConnectionConfig,
  coreConfig: Record<string, unknown>
): Promise<Record<string, unknown>> {
  return callProxy<Record<string, unknown>>(config, '/api/core/config', {
    method: 'PUT',
    body: coreConfig,
  });
}

export async function getUsers(
  config: ConnectionConfig,
  params?: { offset?: number; limit?: number; search?: string; status?: string }
): Promise<UsersResponse> {
  const qs = new URLSearchParams();
  if (params?.offset !== undefined) qs.set('offset', String(params.offset));
  if (params?.limit !== undefined) qs.set('limit', String(params.limit));
  if (params?.search) qs.set('search', params.search);
  if (params?.status && params.status !== 'all') qs.set('status', params.status);
  const query = qs.toString();
  return callProxy<UsersResponse>(config, `/api/users${query ? `?${query}` : ''}`);
}

export async function createUser(
  config: ConnectionConfig,
  payload: UserCreatePayload
): Promise<UserRecord> {
  return callProxy<UserRecord>(config, '/api/user', {
    method: 'POST',
    body: payload,
  });
}

export async function modifyUser(
  config: ConnectionConfig,
  username: string,
  payload: UserModifyPayload
): Promise<UserRecord> {
  return callProxy<UserRecord>(config, `/api/user/${encodeURIComponent(username)}`, {
    method: 'PUT',
    body: payload,
  });
}

export async function deleteUser(config: ConnectionConfig, username: string): Promise<void> {
  await callProxy(config, `/api/user/${encodeURIComponent(username)}`, {
    method: 'DELETE',
  });
}

export async function resetUserUsage(config: ConnectionConfig, username: string): Promise<UserRecord> {
  return callProxy<UserRecord>(config, `/api/user/${encodeURIComponent(username)}/reset`, {
    method: 'POST',
  });
}

export async function revokeUserSubscription(
  config: ConnectionConfig,
  username: string
): Promise<UserRecord> {
  return callProxy<UserRecord>(config, `/api/user/${encodeURIComponent(username)}/revoke_sub`, {
    method: 'POST',
  });
}

export async function resetAllUsersUsage(config: ConnectionConfig): Promise<void> {
  await callProxy(config, '/api/users/reset', { method: 'POST' });
}

export async function deleteExpiredUsers(config: ConnectionConfig): Promise<string[]> {
  return callProxy<string[]>(config, '/api/users/expired', { method: 'DELETE' });
}

export async function getInbounds(
  config: ConnectionConfig
): Promise<Record<string, ProxyInbound[]>> {
  return callProxy<Record<string, ProxyInbound[]>>(config, '/api/inbounds');
}

export async function getHosts(config: ConnectionConfig): Promise<Record<string, HostConfig[]>> {
  return callProxy<Record<string, HostConfig[]>>(config, '/api/hosts');
}

export async function updateHosts(
  config: ConnectionConfig,
  hosts: Record<string, HostConfig[]>
): Promise<Record<string, HostConfig[]>> {
  return callProxy<Record<string, HostConfig[]>>(config, '/api/hosts', {
    method: 'PUT',
    body: hosts,
  });
}

export async function getNodes(config: ConnectionConfig): Promise<NodeRecord[]> {
  return callProxy<NodeRecord[]>(config, '/api/nodes');
}

export async function getNodeSettings(config: ConnectionConfig): Promise<NodeSettings> {
  return callProxy<NodeSettings>(config, '/api/node/settings');
}

export async function getNodesUsage(config: ConnectionConfig): Promise<{ usages: NodeUsageRecord[] }> {
  return callProxy<{ usages: NodeUsageRecord[] }>(config, '/api/nodes/usage');
}

export async function createNode(
  config: ConnectionConfig,
  payload: NodeCreatePayload
): Promise<NodeRecord> {
  return callProxy<NodeRecord>(config, '/api/node', {
    method: 'POST',
    body: payload,
  });
}

export async function modifyNode(
  config: ConnectionConfig,
  nodeId: number,
  payload: NodeModifyPayload
): Promise<NodeRecord> {
  return callProxy<NodeRecord>(config, `/api/node/${nodeId}`, {
    method: 'PUT',
    body: payload,
  });
}

export async function reconnectNode(config: ConnectionConfig, nodeId: number): Promise<void> {
  await callProxy(config, `/api/node/${nodeId}/reconnect`, { method: 'POST' });
}

export async function deleteNode(config: ConnectionConfig, nodeId: number): Promise<void> {
  await callProxy(config, `/api/node/${nodeId}`, { method: 'DELETE' });
}

export function formatBytes(bytes: number | null | undefined, decimals = 2): string {
  if (bytes === null || bytes === undefined || Number.isNaN(bytes)) return '0 B';
  if (bytes === 0) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
  const i = Math.min(Math.floor(Math.log(Math.abs(bytes)) / Math.log(k)), sizes.length - 1);
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

export function formatSpeed(bytesPerSec: number | null | undefined): string {
  return `${formatBytes(bytesPerSec, 1)}/s`;
}

export function resolveSubscriptionUrl(serverUrl: string, subscriptionUrl: string): string {
  if (!subscriptionUrl) return '';
  if (subscriptionUrl.startsWith('http://') || subscriptionUrl.startsWith('https://')) {
    return subscriptionUrl;
  }
  const base = normalizeBaseUrl(serverUrl);
  const path = subscriptionUrl.startsWith('/') ? subscriptionUrl : `/${subscriptionUrl}`;
  return `${base}${path}`;
}
