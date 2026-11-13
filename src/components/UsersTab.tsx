import React, { useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Edit3,
  PauseCircle,
  Plus,
  QrCode,
  RefreshCw,
  RotateCcw,
  Search,
  Trash2,
  XCircle,
} from 'lucide-react';
import {
  deleteExpiredUsers,
  deleteUser,
  formatBytes,
  resetAllUsersUsage,
  resetUserUsage,
  revokeUserSubscription,
} from '../lib/marzbanApi';
import type { Locale } from '../lib/i18n';
import { copy } from '../lib/i18n';
import type { ConnectionConfig, ProxyInbound, UserRecord, UserStatus } from '../types/marzban';
import { SubscriptionModal, UserFormModal } from './UserModals';

interface UsersTabProps {
  locale: Locale;
  config: ConnectionConfig;
  users: UserRecord[];
  total: number;
  page: number;
  pageSize: number;
  search: string;
  statusFilter: string;
  inboundsMap: Record<string, ProxyInbound[]>;
  loading: boolean;
  onSearchChange: (q: string) => void;
  onStatusFilterChange: (s: string) => void;
  onPageChange: (p: number) => void;
  onRefresh: () => void;
}

export function UsersTab({
  locale,
  config,
  users,
  total,
  page,
  pageSize,
  search,
  statusFilter,
  inboundsMap,
  loading,
  onSearchChange,
  onStatusFilterChange,
  onPageChange,
  onRefresh,
}: UsersTabProps) {
  const t = copy[locale];
  const [formModalOpen, setFormModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserRecord | null>(null);
  const [subUser, setSubUser] = useState<UserRecord | null>(null);
  const [confirmDeleteUsername, setConfirmDeleteUsername] = useState<string | null>(null);
  const [confirmResetAll, setConfirmResetAll] = useState(false);
  const [busyUser, setBusyUser] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  const statusTabs: { value: string; label: string }[] = [
    { value: 'all', label: t.statusAll },
    { value: 'active', label: t.statusActive },
    { value: 'disabled', label: t.statusDisabled },
    { value: 'limited', label: t.statusLimited },
    { value: 'expired', label: t.statusExpired },
    { value: 'on_hold', label: t.statusOnHold },
  ];

  const renderStatus = (status: UserStatus) => {
    switch (status) {
      case 'active':
        return (
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
            <span>{t.statusActive}</span>
          </span>
        );
      case 'limited':
        return (
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-600 dark:text-amber-400">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
            <span>{t.statusLimited}</span>
          </span>
        );
      case 'expired':
        return (
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-rose-600 dark:text-rose-400">
            <Clock className="w-3.5 h-3.5 shrink-0" />
            <span>{t.statusExpired}</span>
          </span>
        );
      case 'on_hold':
        return (
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-sky-600 dark:text-sky-400">
            <PauseCircle className="w-3.5 h-3.5 shrink-0" />
            <span>{t.statusOnHold}</span>
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 dark:text-slate-400">
            <XCircle className="w-3.5 h-3.5 shrink-0" />
            <span>{t.statusDisabled}</span>
          </span>
        );
    }
  };

  const renderExpire = (user: UserRecord) => {
    if (user.status === 'on_hold' && user.on_hold_expire_duration) {
      const days = Math.round(user.on_hold_expire_duration / 86400);
      return `${days} ${t.days}`;
    }
    if (!user.expire) return t.noExpire;
    const diffSec = user.expire - Math.floor(Date.now() / 1000);
    if (diffSec <= 0) return t.expired;
    const days = Math.ceil(diffSec / 86400);
    return `${days} ${t.daysLeft}`;
  };

  const handleResetUsage = async (username: string) => {
    setBusyUser(username);
    try {
      await resetUserUsage(config, username);
      setFeedback(`${username}: ${t.savedSuccess}`);
      onRefresh();
    } finally {
      setBusyUser(null);
    }
  };

  const handleRevokeSub = async (username: string) => {
    setBusyUser(username);
    try {
      await revokeUserSubscription(config, username);
      setFeedback(`${username}: ${t.savedSuccess}`);
      onRefresh();
    } finally {
      setBusyUser(null);
    }
  };

  const handleDeleteUser = async (username: string) => {
    setBusyUser(username);
    try {
      await deleteUser(config, username);
      setConfirmDeleteUsername(null);
      onRefresh();
    } finally {
      setBusyUser(null);
    }
  };

  const handlePruneExpired = async () => {
    const deleted = await deleteExpiredUsers(config);
    setFeedback(
      locale === 'fa'
        ? `${deleted.length} کاربر منقضی حذف شد.`
        : `Deleted ${deleted.length} expired users.`
    );
    onRefresh();
  };

  const handleResetAll = async () => {
    await resetAllUsersUsage(config);
    setConfirmResetAll(false);
    setFeedback(t.savedSuccess);
    onRefresh();
  };

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="space-y-4">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex items-center w-full sm:w-64">
            <Search className="w-4 h-4 text-slate-400 absolute start-3 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder={t.searchUsersPlaceholder}
              className="w-full ps-9 pe-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
            />
          </div>

          <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg overflow-x-auto">
            {statusTabs.map((tab) => (
              <button
                key={tab.value}
                type="button"
                onClick={() => onStatusFilterChange(tab.value)}
                className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                  statusFilter === tab.value
                    ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handlePruneExpired}
            className="px-3 py-2 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 whitespace-nowrap shrink-0"
          >
            {t.deleteExpiredUsers}
          </button>

          {confirmResetAll ? (
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={handleResetAll}
                className="px-3 py-2 text-xs font-medium rounded-lg bg-rose-600 text-white whitespace-nowrap shrink-0"
              >
                {t.confirmDelete}
              </button>
              <button
                type="button"
                onClick={() => setConfirmResetAll(false)}
                className="px-2.5 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-800 whitespace-nowrap shrink-0"
              >
                {t.cancel}
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmResetAll(true)}
              className="px-3 py-2 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 whitespace-nowrap shrink-0"
            >
              {t.resetAllUsage}
            </button>
          )}

          <button
            type="button"
            onClick={() => {
              setEditingUser(null);
              setFormModalOpen(true);
            }}
            className="px-3.5 py-2 text-xs font-medium rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{t.newUser}</span>
          </button>
        </div>
      </div>

      {feedback && (
        <div className="px-4 py-2.5 rounded-lg border border-emerald-200 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-950/30 text-xs text-emerald-700 dark:text-emerald-300 flex items-center justify-between">
          <span>{feedback}</span>
          <button type="button" onClick={() => setFeedback(null)} className="text-xs underline">
            OK
          </button>
        </div>
      )}

      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-slate-50 dark:bg-slate-950/50 text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="py-3 px-4 text-start font-medium">{t.colUser}</th>
                <th className="py-3 px-4 text-start font-medium">{t.colStatus}</th>
                <th className="py-3 px-4 text-start font-medium">{t.colTraffic}</th>
                <th className="py-3 px-4 text-start font-medium">{t.colExpire}</th>
                <th className="py-3 px-4 text-start font-medium">{t.colOnline}</th>
                <th className="py-3 px-4 text-end font-medium">{t.colActions}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {loading && users.length === 0 ? (
                [1, 2, 3, 4, 5].map((i) => (
                  <tr key={i}>
                    <td colSpan={6} className="py-3 px-4">
                      <div className="h-5 rounded bg-slate-100 dark:bg-slate-800 animate-pulse" />
                    </td>
                  </tr>
                ))
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-14 px-6 text-center space-y-2">
                    <div className="text-sm font-medium">{t.noUsersTitle}</div>
                    <p className="text-xs text-slate-500 dark:text-slate-400">{t.noUsersDesc}</p>
                  </td>
                </tr>
              ) : (
                users.map((u) => {
                  const limit = u.data_limit || 0;
                  const pct = limit > 0 ? Math.min(100, Math.round((u.used_traffic / limit) * 100)) : 0;

                  return (
                    <tr
                      key={u.username}
                      className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      <td className="py-2.5 px-4">
                        <div className="font-mono font-medium text-slate-900 dark:text-slate-100">
                          {u.username}
                        </div>
                        {u.note && (
                          <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate max-w-[180px]">
                            {u.note}
                          </div>
                        )}
                      </td>

                      <td className="py-2.5 px-4 whitespace-nowrap">{renderStatus(u.status)}</td>

                      <td className="py-2.5 px-4 min-w-[160px]">
                        <div className="flex items-center justify-between gap-2 font-mono tabular-nums text-[11px]" dir="ltr">
                          <span>{formatBytes(u.used_traffic)}</span>
                          <span className="text-slate-400">
                            / {u.data_limit ? formatBytes(u.data_limit) : '∞'}
                          </span>
                        </div>
                        {limit > 0 && (
                          <div className="mt-1 h-1 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                            <div
                              style={{ width: `${pct}%` }}
                              className={`h-full ${
                                pct >= 90
                                  ? 'bg-rose-500'
                                  : pct >= 70
                                    ? 'bg-amber-500'
                                    : 'bg-emerald-500'
                              }`}
                            />
                          </div>
                        )}
                      </td>

                      <td className="py-2.5 px-4 whitespace-nowrap tabular-nums text-slate-600 dark:text-slate-300">
                        {renderExpire(u)}
                      </td>

                      <td className="py-2.5 px-4 whitespace-nowrap font-mono tabular-nums text-[11px] text-slate-500 dark:text-slate-400">
                        {u.online_at
                          ? new Date(u.online_at).toLocaleString(locale === 'fa' ? 'fa-IR' : 'en-US', {
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })
                          : t.neverConnected}
                      </td>

                      <td className="py-2.5 px-4 text-end whitespace-nowrap">
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => setSubUser(u)}
                            title={t.openQr}
                            className="p-1.5 rounded-md text-slate-500 hover:text-emerald-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                          >
                            <QrCode className="w-3.5 h-3.5" />
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setEditingUser(u);
                              setFormModalOpen(true);
                            }}
                            title={t.editUser}
                            className="p-1.5 rounded-md text-slate-500 hover:text-sky-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>

                          <button
                            type="button"
                            disabled={busyUser === u.username}
                            onClick={() => handleResetUsage(u.username)}
                            title={locale === 'fa' ? 'ریست حجم' : 'Reset Traffic'}
                            className="p-1.5 rounded-md text-slate-500 hover:text-amber-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                          </button>

                          <button
                            type="button"
                            disabled={busyUser === u.username}
                            onClick={() => handleRevokeSub(u.username)}
                            title={locale === 'fa' ? 'لغو لینک اشتراک' : 'Revoke Sub'}
                            className="p-1.5 rounded-md text-slate-500 hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                          >
                            <RefreshCw className="w-3.5 h-3.5" />
                          </button>

                          {confirmDeleteUsername === u.username ? (
                            <div className="inline-flex items-center gap-1 ms-1">
                              <button
                                type="button"
                                disabled={busyUser === u.username}
                                onClick={() => handleDeleteUser(u.username)}
                                className="px-2 py-1 rounded bg-rose-600 text-white text-[11px]"
                              >
                                {t.confirmDelete}
                              </button>
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteUsername(null)}
                                className="px-1.5 py-1 rounded border border-slate-300 dark:border-slate-700 text-[11px]"
                              >
                                ✕
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteUsername(u.username)}
                              title={locale === 'fa' ? 'حذف' : 'Delete'}
                              className="p-1.5 rounded-md text-slate-500 hover:text-rose-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <div className="px-4 py-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
          <span className="font-mono tabular-nums">
            {total} {locale === 'fa' ? 'کاربر' : 'total'} · {page + 1} / {totalPages}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={page === 0}
              onClick={() => onPageChange(Math.max(0, page - 1))}
              className="px-3 py-1 rounded-md border border-slate-200 dark:border-slate-800 disabled:opacity-40 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              {t.previous}
            </button>
            <button
              type="button"
              disabled={page + 1 >= totalPages}
              onClick={() => onPageChange(page + 1)}
              className="px-3 py-1 rounded-md border border-slate-200 dark:border-slate-800 disabled:opacity-40 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              {t.next}
            </button>
          </div>
        </div>
      </div>

      {formModalOpen && (
        <UserFormModal
          locale={locale}
          config={config}
          inboundsMap={inboundsMap}
          editingUser={editingUser}
          onClose={() => setFormModalOpen(false)}
          onSaved={onRefresh}
        />
      )}

      {subUser && (
        <SubscriptionModal
          locale={locale}
          serverUrl={config.serverUrl}
          user={subUser}
          onClose={() => setSubUser(null)}
        />
      )}
    </div>
  );
}
