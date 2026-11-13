import React, { useCallback, useEffect, useState } from 'react';
import {
  Activity,
  LayoutDashboard,
  LogOut,
  Menu,
  Moon,
  Network,
  RefreshCw,
  Server,
  Settings,
  Sun,
  Users,
  X,
} from 'lucide-react';
import { ConnectScreen } from './components/ConnectScreen';
import { InboundsHostsTab } from './components/InboundsHostsTab';
import { NodesTab } from './components/NodesTab';
import { OverviewTab } from './components/OverviewTab';
import { SettingsTab } from './components/SettingsTab';
import { UsersTab } from './components/UsersTab';
import type { Locale } from './lib/i18n';
import { copy } from './lib/i18n';
import {
  getAdmins,
  getCoreConfig,
  getCoreStats,
  getCurrentAdmin,
  getHosts,
  getInbounds,
  getNodes,
  getNodeSettings,
  getNodesUsage,
  getSystemStats,
  getUsers,
  MarzbanApiError,
} from './lib/marzbanApi';
import type {
  AdminInfo,
  ConnectionConfig,
  CoreStats,
  HostConfig,
  NodeRecord,
  NodeSettings,
  NodeUsageRecord,
  ProxyInbound,
  SavedServerProfile,
  SystemStats,
  UserRecord,
} from './types/marzban';

type NavTab = 'overview' | 'users' | 'nodes' | 'inbounds' | 'settings';

const SESSION_KEY = 'marzban_active_session_v1';
const PROFILES_KEY = 'marzban_saved_profiles_v1';
const LOCALE_KEY = 'marzban_locale_v1';
const THEME_KEY = 'marzban_theme_v1';

export default function App() {
  const [locale, setLocale] = useState<Locale>(() => {
    const saved = localStorage.getItem(LOCALE_KEY);
    return saved === 'en' ? 'en' : 'fa';
  });

  const [isDark, setIsDark] = useState<boolean>(() => {
    const saved = localStorage.getItem(THEME_KEY);
    return saved !== 'light';
  });

  const [savedProfiles, setSavedProfiles] = useState<SavedServerProfile[]>(() => {
    try {
      const raw = localStorage.getItem(PROFILES_KEY);
      return raw ? (JSON.parse(raw) as SavedServerProfile[]) : [];
    } catch {
      return [];
    }
  });

  const [session, setSession] = useState<ConnectionConfig | null>(() => {
    try {
      const raw = localStorage.getItem(SESSION_KEY);
      return raw ? (JSON.parse(raw) as ConnectionConfig) : null;
    } catch {
      return null;
    }
  });

  const [activeTab, setActiveTab] = useState<NavTab>('overview');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const [currentAdmin, setCurrentAdmin] = useState<AdminInfo | null>(null);
  const [systemStats, setSystemStats] = useState<SystemStats | null>(null);
  const [coreStats, setCoreStats] = useState<CoreStats | null>(null);
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [usersTotal, setUsersTotal] = useState(0);
  const [usersPage, setUsersPage] = useState(0);
  const [usersSearch, setUsersSearch] = useState('');
  const [usersStatusFilter, setUsersStatusFilter] = useState('all');
  const [inboundsMap, setInboundsMap] = useState<Record<string, ProxyInbound[]>>({});
  const [hostsMap, setHostsMap] = useState<Record<string, HostConfig[]>>({});
  const [nodes, setNodes] = useState<NodeRecord[]>([]);
  const [nodeSettings, setNodeSettings] = useState<NodeSettings | null>(null);
  const [nodeUsages, setNodeUsages] = useState<NodeUsageRecord[]>([]);
  const [admins, setAdmins] = useState<AdminInfo[]>([]);
  const [coreConfig, setCoreConfig] = useState<Record<string, unknown> | null>(null);

  const [loading, setLoading] = useState(false);
  const [globalError, setGlobalError] = useState<string | null>(null);

  const pageSize = 20;
  const t = copy[locale];

  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir = locale === 'fa' ? 'rtl' : 'ltr';
    localStorage.setItem(LOCALE_KEY, locale);
  }, [locale]);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDark);
    localStorage.setItem(THEME_KEY, isDark ? 'dark' : 'light');
  }, [isDark]);

  const handleDisconnect = useCallback(() => {
    localStorage.removeItem(SESSION_KEY);
    setSession(null);
    setCurrentAdmin(null);
    setSystemStats(null);
    setUsers([]);
    setGlobalError(null);
  }, []);

  const loadWorkspaceData = useCallback(async () => {
    if (!session) return;
    setLoading(true);
    setGlobalError(null);

    try {
      const [adminRes, sysRes, coreRes, inboundsRes, nodesRes, usageRes] = await Promise.all([
        getCurrentAdmin(session),
        getSystemStats(session),
        getCoreStats(session),
        getInbounds(session),
        getNodes(session).catch(() => [] as NodeRecord[]),
        getNodesUsage(session).catch(() => ({ usages: [] as NodeUsageRecord[] })),
      ]);

      setCurrentAdmin(adminRes);
      setSystemStats(sysRes);
      setCoreStats(coreRes);
      setInboundsMap(inboundsRes);
      setNodes(nodesRes);
      setNodeUsages(usageRes.usages || []);

      const usersRes = await getUsers(session, {
        offset: usersPage * pageSize,
        limit: pageSize,
        search: usersSearch.trim() || undefined,
        status: usersStatusFilter,
      });
      setUsers(usersRes.users || []);
      setUsersTotal(usersRes.total || 0);

      if (adminRes.is_sudo) {
        const [hostsRes, nodeSettingsRes, adminsRes, coreCfgRes] = await Promise.all([
          getHosts(session).catch(() => ({})),
          getNodeSettings(session).catch(() => null),
          getAdmins(session).catch(() => [] as AdminInfo[]),
          getCoreConfig(session).catch(() => null),
        ]);
        setHostsMap(hostsRes);
        setNodeSettings(nodeSettingsRes);
        setAdmins(adminsRes);
        setCoreConfig(coreCfgRes);
      }
    } catch (err) {
      if (err instanceof MarzbanApiError && err.status === 401) {
        handleDisconnect();
        return;
      }
      setGlobalError(err instanceof Error ? err.message : 'Connection error');
    } finally {
      setLoading(false);
    }
  }, [session, usersPage, usersSearch, usersStatusFilter, handleDisconnect]);

  useEffect(() => {
    if (session) {
      loadWorkspaceData();
    }
  }, [session, loadWorkspaceData]);

  const handleConnected = (config: ConnectionConfig, admin: AdminInfo) => {
    localStorage.setItem(SESSION_KEY, JSON.stringify(config));
    setSession(config);
    setCurrentAdmin(admin);

    setSavedProfiles((prev) => {
      const id = `${config.serverUrl}::${config.username}`;
      const next: SavedServerProfile[] = [
        {
          id,
          label: config.serverUrl,
          serverUrl: config.serverUrl,
          username: config.username,
          allowInsecureTls: config.allowInsecureTls,
          lastConnectedAt: new Date().toISOString(),
        },
        ...prev.filter((item) => item.id !== id),
      ].slice(0, 6);
      localStorage.setItem(PROFILES_KEY, JSON.stringify(next));
      return next;
    });
  };

  const handleRemoveProfile = (id: string) => {
    setSavedProfiles((prev) => {
      const next = prev.filter((item) => item.id !== id);
      localStorage.setItem(PROFILES_KEY, JSON.stringify(next));
      return next;
    });
  };

  if (!session) {
    return (
      <ConnectScreen
        locale={locale}
        onToggleLocale={() => setLocale((l) => (l === 'fa' ? 'en' : 'fa'))}
        isDark={isDark}
        onToggleTheme={() => setIsDark((d) => !d)}
        savedProfiles={savedProfiles}
        onRemoveProfile={handleRemoveProfile}
        onConnected={handleConnected}
      />
    );
  }

  const navItems: { id: NavTab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: 'overview', label: t.navOverview, icon: LayoutDashboard },
    { id: 'users', label: t.navUsers, icon: Users },
    { id: 'nodes', label: t.navNodes, icon: Server },
    { id: 'inbounds', label: t.navInbounds, icon: Network },
    { id: 'settings', label: t.navSettings, icon: Settings },
  ];

  const activeNavLabel = navItems.find((item) => item.id === activeTab)?.label || t.brand;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex w-64 shrink-0 flex-col border-e border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center gap-2.5">
          <Activity className="w-5 h-5 text-emerald-500 shrink-0" />
          <span className="text-sm font-bold tracking-tight whitespace-nowrap truncate">
            {t.brand}
          </span>
        </div>

        <nav className="flex-1 p-3 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveTab(item.id)}
                className={`w-full px-3.5 py-2.5 rounded-lg text-xs font-medium flex items-center gap-3 transition-colors whitespace-nowrap ${
                  active
                    ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-slate-100'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="p-4 border-t border-slate-200 dark:border-slate-800 space-y-3">
          <div className="space-y-0.5">
            <div className="text-xs font-mono font-medium truncate" dir="ltr">
              {currentAdmin?.username || session.username}
            </div>
            <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400 truncate" dir="ltr">
              {session.serverUrl}
            </div>
          </div>
          <button
            type="button"
            onClick={handleDisconnect}
            className="w-full py-2 px-3 rounded-lg border border-slate-200 dark:border-slate-800 hover:bg-rose-500/10 hover:text-rose-500 hover:border-rose-500/30 text-xs font-medium flex items-center justify-center gap-2 transition-colors whitespace-nowrap"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>{t.disconnect}</span>
          </button>
        </div>
      </aside>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div className="w-64 bg-white dark:bg-slate-900 border-e border-slate-200 dark:border-slate-800 flex flex-col">
            <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <span className="text-sm font-bold">{t.brand}</span>
              <button type="button" onClick={() => setMobileMenuOpen(false)}>
                <X className="w-4 h-4" />
              </button>
            </div>
            <nav className="flex-1 p-3 space-y-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                const active = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setActiveTab(item.id);
                      setMobileMenuOpen(false);
                    }}
                    className={`w-full px-3.5 py-2.5 rounded-lg text-xs font-medium flex items-center gap-3 ${
                      active
                        ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                        : 'text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </nav>
            <div className="p-4 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={handleDisconnect}
                className="w-full py-2 px-3 rounded-lg border border-slate-200 dark:border-slate-800 text-xs font-medium flex items-center justify-center gap-2"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>{t.disconnect}</span>
              </button>
            </div>
          </div>
          <div className="flex-1 bg-slate-950/60" onClick={() => setMobileMenuOpen(false)} />
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 min-w-0 flex flex-col">
        <header className="px-6 py-3.5 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden p-1.5 rounded-lg border border-slate-200 dark:border-slate-800"
            >
              <Menu className="w-4 h-4" />
            </button>
            <h1 className="text-sm font-semibold truncate">{activeNavLabel}</h1>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setLocale((l) => (l === 'fa' ? 'en' : 'fa'))}
              className="px-2.5 py-1.5 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 whitespace-nowrap"
            >
              {locale === 'fa' ? 'EN' : 'فا'}
            </button>
            <button
              type="button"
              onClick={() => setIsDark((d) => !d)}
              className="p-2 rounded-lg border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800"
              aria-label="Toggle theme"
            >
              {isDark ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
            </button>
            <button
              type="button"
              onClick={loadWorkspaceData}
              disabled={loading}
              className="px-3.5 py-1.5 text-xs font-medium rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white inline-flex items-center gap-1.5 whitespace-nowrap"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>{t.refresh}</span>
            </button>
          </div>
        </header>

        <main className="flex-1 p-6 max-w-7xl w-full mx-auto space-y-6">
          {globalError && (
            <div className="p-4 rounded-xl border border-rose-200 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/30 text-xs text-rose-700 dark:text-rose-300">
              {globalError}
            </div>
          )}

          {activeTab === 'overview' && (
            <OverviewTab
              locale={locale}
              config={session}
              system={systemStats}
              core={coreStats}
              nodeUsages={nodeUsages}
              loading={loading}
              onRefresh={loadWorkspaceData}
            />
          )}

          {activeTab === 'users' && (
            <UsersTab
              locale={locale}
              config={session}
              users={users}
              total={usersTotal}
              page={usersPage}
              pageSize={pageSize}
              search={usersSearch}
              statusFilter={usersStatusFilter}
              inboundsMap={inboundsMap}
              loading={loading}
              onSearchChange={(q) => {
                setUsersSearch(q);
                setUsersPage(0);
              }}
              onStatusFilterChange={(s) => {
                setUsersStatusFilter(s);
                setUsersPage(0);
              }}
              onPageChange={setUsersPage}
              onRefresh={loadWorkspaceData}
            />
          )}

          {activeTab === 'nodes' && (
            <NodesTab
              locale={locale}
              config={session}
              nodes={nodes}
              nodeSettings={nodeSettings}
              nodeUsages={nodeUsages}
              onRefresh={loadWorkspaceData}
            />
          )}

          {activeTab === 'inbounds' && (
            <InboundsHostsTab
              locale={locale}
              config={session}
              inboundsMap={inboundsMap}
              hostsMap={hostsMap}
              onRefresh={loadWorkspaceData}
            />
          )}

          {activeTab === 'settings' && (
            <SettingsTab
              locale={locale}
              config={session}
              currentAdmin={currentAdmin}
              admins={admins}
              coreConfig={coreConfig}
              onRefresh={loadWorkspaceData}
            />
          )}
        </main>
      </div>
    </div>
  );
}
