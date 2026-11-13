export type UserStatus = 'active' | 'disabled' | 'limited' | 'expired' | 'on_hold';
export type UserStatusModify = 'active' | 'disabled' | 'on_hold';
export type DataLimitResetStrategy = 'no_reset' | 'day' | 'week' | 'month' | 'year';
export type ProxyType = 'vmess' | 'vless' | 'trojan' | 'shadowsocks';
export type NodeStatus = 'connected' | 'connecting' | 'error' | 'disabled';

export interface ConnectionConfig {
  serverUrl: string;
  token: string;
  username: string;
  allowInsecureTls: boolean;
}

export interface SavedServerProfile {
  id: string;
  label: string;
  serverUrl: string;
  username: string;
  allowInsecureTls: boolean;
  lastConnectedAt: string;
}

export interface AdminInfo {
  username: string;
  is_sudo: boolean;
  telegram_id?: number | null;
  discord_webhook?: string | null;
  users_usage?: number | null;
}

export interface SystemStats {
  version: string;
  mem_total: number;
  mem_used: number;
  cpu_cores: number;
  cpu_usage: number;
  total_user: number;
  online_users: number;
  users_active: number;
  users_on_hold: number;
  users_disabled: number;
  users_expired: number;
  users_limited: number;
  incoming_bandwidth: number;
  outgoing_bandwidth: number;
  incoming_bandwidth_speed: number;
  outgoing_bandwidth_speed: number;
}

export interface CoreStats {
  version: string;
  started: boolean;
  logs_websocket: string;
}

export interface UserRecord {
  username: string;
  proxies: Record<string, Record<string, unknown>>;
  expire: number | null;
  data_limit: number | null;
  data_limit_reset_strategy: DataLimitResetStrategy;
  inbounds: Record<string, string[]>;
  note?: string | null;
  sub_updated_at?: string | null;
  sub_last_user_agent?: string | null;
  online_at?: string | null;
  on_hold_expire_duration?: number | null;
  on_hold_timeout?: string | null;
  auto_delete_in_days?: number | null;
  status: UserStatus;
  used_traffic: number;
  lifetime_used_traffic?: number;
  created_at: string;
  links: string[];
  subscription_url: string;
  excluded_inbounds?: Record<string, string[]>;
  admin?: AdminInfo | null;
}

export interface UsersResponse {
  users: UserRecord[];
  total: number;
}

export interface UserCreatePayload {
  username: string;
  proxies: Record<string, Record<string, unknown>>;
  inbounds: Record<string, string[]>;
  expire?: number | null;
  data_limit?: number | null;
  data_limit_reset_strategy: DataLimitResetStrategy;
  status?: 'active' | 'on_hold';
  on_hold_expire_duration?: number | null;
  note?: string | null;
}

export interface UserModifyPayload {
  proxies?: Record<string, Record<string, unknown>>;
  inbounds?: Record<string, string[]>;
  expire?: number | null;
  data_limit?: number | null;
  data_limit_reset_strategy?: DataLimitResetStrategy;
  status?: UserStatusModify;
  on_hold_expire_duration?: number | null;
  note?: string | null;
}

export interface ProxyInbound {
  tag: string;
  protocol: ProxyType | string;
  network: string;
  tls: string;
  port: number | string;
}

export interface NodeRecord {
  id: number;
  name: string;
  address: string;
  port: number;
  api_port: number;
  usage_coefficient: number;
  xray_version?: string | null;
  status: NodeStatus;
  message?: string | null;
}

export interface NodeCreatePayload {
  name: string;
  address: string;
  port: number;
  api_port: number;
  usage_coefficient: number;
  add_as_new_host: boolean;
}

export interface NodeModifyPayload {
  name?: string;
  address?: string;
  port?: number;
  api_port?: number;
  usage_coefficient?: number;
  status?: NodeStatus;
}

export interface NodeUsageRecord {
  node_id: number | null;
  node_name: string;
  uplink: number;
  downlink: number;
}

export interface NodeSettings {
  min_node_version: string;
  certificate: string;
}

export interface HostConfig {
  remark: string;
  address: string;
  port?: number | null;
  sni?: string | null;
  host?: string | null;
  path?: string | null;
  security?: string;
  alpn?: string | null;
  fingerprint?: string | null;
  allowinsecure?: boolean | null;
  is_disabled?: boolean | null;
  mux_enable?: boolean | null;
  fragment_setting?: string | null;
  noise_setting?: string | null;
  random_user_agent?: boolean | null;
}
