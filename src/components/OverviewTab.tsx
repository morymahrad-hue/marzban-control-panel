import React, { useState } from 'react';
import {
  Activity,
  ArrowDown,
  ArrowUp,
  Cpu,
  HardDrive,
  RotateCcw,
  Users,
} from 'lucide-react';
import { formatBytes, formatSpeed, restartCore } from '../lib/marzbanApi';
import type { Locale } from '../lib/i18n';
import { copy } from '../lib/i18n';
import type { ConnectionConfig, CoreStats, NodeUsageRecord, SystemStats } from '../types/marzban';

interface OverviewTabProps {
  locale: Locale;
  config: ConnectionConfig;
  system: SystemStats | null;
  core: CoreStats | null;
  nodeUsages: NodeUsageRecord[];
  loading: boolean;
  onRefresh: () => void;
}

export function OverviewTab({
  locale,
  config,
  system,
  core,
  nodeUsages,
  loading,
  onRefresh,
}: OverviewTabProps) {
  const t = copy[locale];
  const [confirmRestart, setConfirmRestart] = useState(false);
  const [restarting, setRestarting] = useState(false);
  const [actionMsg, setActionMsg] = useState<string | null>(null);

  const handleRestartCore = async () => {
    setRestarting(true);
    setActionMsg(null);
    try {
      await restartCore(config);
      setConfirmRestart(false);
      setActionMsg(t.savedSuccess);
      onRefresh();
    } catch (err) {
      setActionMsg(err instanceof Error ? err.message : 'Error');
    } finally {
      setRestarting(false);
    }
  };

  if (loading && !system) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="h-28 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 animate-pulse"
            />
          ))}
        </div>
        <div className="h-64 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 animate-pulse" />
      </div>
    );
  }

  const memPercent =
    system && system.mem_total > 0 ? Math.round((system.mem_used / system.mem_total) * 100) : 0;
  const cpuPercent = system ? Math.round(system.cpu_usage) : 0;
  const totalUsers = system?.total_user || 0;

  const userSegments = [
    { label: t.statusActive, count: system?.users_active || 0, color: 'bg-emerald-500', text: 'text-emerald-600 dark:text-emerald-400' },
    { label: t.statusLimited, count: system?.users_limited || 0, color: 'bg-amber-500', text: 'text-amber-600 dark:text-amber-400' },
    { label: t.statusExpired, count: system?.users_expired || 0, color: 'bg-rose-500', text: 'text-rose-600 dark:text-rose-400' },
    { label: t.statusDisabled, count: system?.users_disabled || 0, color: 'bg-slate-400', text: 'text-slate-500 dark:text-slate-400' },
    { label: t.statusOnHold, count: system?.users_on_hold || 0, color: 'bg-sky-500', text: 'text-sky-600 dark:text-sky-400' },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>{t.onlineUsers}</span>
            <Activity className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-bold font-mono tabular-nums">
            {system?.online_users ?? 0}
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums">
            {locale === 'fa' ? `از ${totalUsers} کاربر کل` : `of ${totalUsers} total users`}
          </div>
        </div>

        <div className="p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>{t.activeUsers}</span>
            <Users className="w-4 h-4 text-sky-500" />
          </div>
          <div className="text-2xl font-bold font-mono tabular-nums">
            {system?.users_active ?? 0}
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums">
            {locale === 'fa'
              ? `${system?.users_on_hold ?? 0} در انتظار اتصال`
              : `${system?.users_on_hold ?? 0} on hold`}
          </div>
        </div>

        <div className="p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>{t.totalTraffic}</span>
            <ArrowDown className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-bold font-mono tabular-nums" dir="ltr">
            {formatBytes((system?.incoming_bandwidth || 0) + (system?.outgoing_bandwidth || 0))}
          </div>
          <div
            className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums"
            dir="ltr"
          >
            <span className="inline-flex items-center gap-1">
              <ArrowDown className="w-3 h-3 text-emerald-500" />
              {formatSpeed(system?.incoming_bandwidth_speed)}
            </span>
            <span className="inline-flex items-center gap-1">
              <ArrowUp className="w-3 h-3 text-sky-500" />
              {formatSpeed(system?.outgoing_bandwidth_speed)}
            </span>
          </div>
        </div>

        <div className="p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>{t.serverResources}</span>
            <Cpu className="w-4 h-4 text-amber-500" />
          </div>
          <div className="flex items-baseline gap-3 font-mono tabular-nums" dir="ltr">
            <span className="text-2xl font-bold">{cpuPercent}%</span>
            <span className="text-xs text-slate-500 dark:text-slate-400">
              CPU ({system?.cpu_cores ?? 0}c)
            </span>
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums" dir="ltr">
            <HardDrive className="w-3.5 h-3.5 shrink-0" />
            <span>
              {formatBytes(system?.mem_used, 1)} / {formatBytes(system?.mem_total, 1)} ({memPercent}%)
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 p-6 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-5">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">{t.userBreakdown}</h2>
            <span className="text-xs font-mono tabular-nums text-slate-500 dark:text-slate-400">
              {totalUsers} {locale === 'fa' ? 'کاربر' : 'users'}
            </span>
          </div>

          <div className="h-2.5 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden flex">
            {totalUsers > 0 &&
              userSegments.map((seg) =>
                seg.count > 0 ? (
                  <div
                    key={seg.label}
                    style={{ width: `${(seg.count / totalUsers) * 100}%` }}
                    className={`${seg.color} h-full transition-all`}
                  />
                ) : null
              )}
          </div>

          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {userSegments.map((seg) => (
              <div key={seg.label} className="py-2.5 flex items-center justify-between text-xs">
                <span className={`font-medium ${seg.text}`}>{seg.label}</span>
                <span className="font-mono tabular-nums text-slate-700 dark:text-slate-300">
                  {seg.count}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="lg:col-span-5 p-6 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col justify-between space-y-5">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold">{t.xrayCore}</h2>
              <span
                className={`text-xs font-medium ${
                  core?.started
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : 'text-rose-600 dark:text-rose-400'
                }`}
              >
                {core?.started ? t.coreRunning : t.coreStopped}
              </span>
            </div>

            <div className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
              <div className="py-2.5 flex items-center justify-between">
                <span className="text-slate-500 dark:text-slate-400">Marzban</span>
                <span className="font-mono tabular-nums">v{system?.version || '—'}</span>
              </div>
              <div className="py-2.5 flex items-center justify-between">
                <span className="text-slate-500 dark:text-slate-400">Xray Core</span>
                <span className="font-mono tabular-nums">v{core?.version || '—'}</span>
              </div>
              <div className="py-2.5 flex items-center justify-between">
                <span className="text-slate-500 dark:text-slate-400">
                  {locale === 'fa' ? 'آدرس سرور' : 'Server'}
                </span>
                <span className="font-mono truncate max-w-[200px]" dir="ltr">
                  {config.serverUrl}
                </span>
              </div>
            </div>
          </div>

          <div className="space-y-2.5 pt-2">
            {actionMsg && (
              <div className="text-xs text-emerald-600 dark:text-emerald-400">{actionMsg}</div>
            )}
            {confirmRestart ? (
              <div className="p-3 rounded-lg border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 space-y-2.5">
                <p className="text-xs text-amber-800 dark:text-amber-300">{t.confirmRestartCore}</p>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={restarting}
                    onClick={handleRestartCore}
                    className="px-3 py-1.5 rounded-md bg-amber-600 hover:bg-amber-500 text-white text-xs font-medium whitespace-nowrap"
                  >
                    {restarting ? t.restarting : t.restartCore}
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmRestart(false)}
                    className="px-3 py-1.5 rounded-md border border-slate-300 dark:border-slate-700 text-xs whitespace-nowrap"
                  >
                    {t.cancel}
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmRestart(true)}
                className="w-full py-2 px-4 rounded-lg border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-medium flex items-center justify-center gap-2 transition-colors whitespace-nowrap"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>{t.restartCore}</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {nodeUsages.length > 0 && (
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800">
            <h2 className="text-sm font-semibold">{t.nodeTraffic}</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-slate-50 dark:bg-slate-950/50 text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="py-2.5 px-6 text-start font-medium">
                    {locale === 'fa' ? 'نام نود' : 'Node'}
                  </th>
                  <th className="py-2.5 px-6 text-end font-medium">
                    {locale === 'fa' ? 'دانلود (Downlink)' : 'Downlink'}
                  </th>
                  <th className="py-2.5 px-6 text-end font-medium">
                    {locale === 'fa' ? 'آپلود (Uplink)' : 'Uplink'}
                  </th>
                  <th className="py-2.5 px-6 text-end font-medium">
                    {locale === 'fa' ? 'مجموع' : 'Total'}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {nodeUsages.map((u, idx) => (
                  <tr
                    key={`${u.node_id ?? 'master'}-${idx}`}
                    className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
                  >
                    <td className="py-3 px-6 font-medium">
                      {u.node_name === 'Master' ? t.masterNode : u.node_name}
                    </td>
                    <td className="py-3 px-6 text-end font-mono tabular-nums" dir="ltr">
                      {formatBytes(u.downlink)}
                    </td>
                    <td className="py-3 px-6 text-end font-mono tabular-nums" dir="ltr">
                      {formatBytes(u.uplink)}
                    </td>
                    <td className="py-3 px-6 text-end font-mono tabular-nums font-medium" dir="ltr">
                      {formatBytes(u.uplink + u.downlink)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
