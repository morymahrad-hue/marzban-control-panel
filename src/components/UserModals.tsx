import React, { useEffect, useState } from 'react';
import { Check, Copy, Link2, QrCode, X } from 'lucide-react';
import QRCode from 'qrcode';
import {
  createUser,
  MarzbanApiError,
  modifyUser,
  resolveSubscriptionUrl,
} from '../lib/marzbanApi';
import type { Locale } from '../lib/i18n';
import { copy } from '../lib/i18n';
import type {
  ConnectionConfig,
  DataLimitResetStrategy,
  ProxyInbound,
  UserRecord,
} from '../types/marzban';

interface UserFormModalProps {
  locale: Locale;
  config: ConnectionConfig;
  inboundsMap: Record<string, ProxyInbound[]>;
  editingUser: UserRecord | null;
  onClose: () => void;
  onSaved: () => void;
}

export function UserFormModal({
  locale,
  config,
  inboundsMap,
  editingUser,
  onClose,
  onSaved,
}: UserFormModalProps) {
  const t = copy[locale];
  const isEdit = Boolean(editingUser);

  const [username, setUsername] = useState(editingUser?.username || '');
  const [dataLimitGb, setDataLimitGb] = useState(() => {
    if (!editingUser?.data_limit) return '';
    return String(Number((editingUser.data_limit / (1024 ** 3)).toFixed(2)));
  });
  const [expireDays, setExpireDays] = useState(() => {
    if (!editingUser) return '30';
    if (editingUser.status === 'on_hold' && editingUser.on_hold_expire_duration) {
      return String(Math.round(editingUser.on_hold_expire_duration / 86400));
    }
    if (!editingUser.expire) return '';
    const diffDays = Math.ceil((editingUser.expire - Math.floor(Date.now() / 1000)) / 86400);
    return String(Math.max(0, diffDays));
  });
  const [resetStrategy, setResetStrategy] = useState<DataLimitResetStrategy>(
    editingUser?.data_limit_reset_strategy || 'no_reset'
  );
  const [status, setStatus] = useState<'active' | 'disabled' | 'on_hold'>(() => {
    if (!editingUser) return 'active';
    if (editingUser.status === 'disabled') return 'disabled';
    if (editingUser.status === 'on_hold') return 'on_hold';
    return 'active';
  });
  const [note, setNote] = useState(editingUser?.note || '');

  const [selectedInbounds, setSelectedInbounds] = useState<Record<string, string[]>>(() => {
    if (editingUser?.inbounds) {
      return editingUser.inbounds;
    }
    const defaults: Record<string, string[]> = {};
    for (const [proto, list] of Object.entries(inboundsMap)) {
      if (list.length > 0) {
        defaults[proto] = list.map((item) => item.tag);
      }
    }
    return defaults;
  });

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggleInbound = (protocol: string, tag: string) => {
    setSelectedInbounds((prev) => {
      const current = prev[protocol] || [];
      const exists = current.includes(tag);
      const nextList = exists ? current.filter((item) => item !== tag) : [...current, tag];
      const next = { ...prev };
      if (nextList.length === 0) {
        delete next[protocol];
      } else {
        next[protocol] = nextList;
      }
      return next;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const parsedGb = dataLimitGb.trim() === '' ? null : Number(dataLimitGb);
    if (parsedGb !== null && (Number.isNaN(parsedGb) || parsedGb < 0)) {
      setError(locale === 'fa' ? 'حجم ترافیک نامعتبر است.' : 'Invalid data limit value.');
      return;
    }
    const dataLimitBytes = parsedGb !== null ? Math.round(parsedGb * 1024 ** 3) : null;

    const parsedDays = expireDays.trim() === '' ? null : Number(expireDays);
    if (parsedDays !== null && (Number.isNaN(parsedDays) || parsedDays < 0)) {
      setError(locale === 'fa' ? 'تعداد روز اعتبار نامعتبر است.' : 'Invalid expiration days.');
      return;
    }

    const proxies: Record<string, Record<string, unknown>> = {};
    for (const proto of Object.keys(selectedInbounds)) {
      proxies[proto] = editingUser?.proxies?.[proto] || {};
    }

    if (Object.keys(selectedInbounds).length === 0) {
      setError(
        locale === 'fa'
          ? 'حداقل یک اینباند (Inbound) باید انتخاب شود.'
          : 'Select at least one inbound.'
      );
      return;
    }

    setSubmitting(true);
    try {
      const expireUnix =
        status !== 'on_hold' && parsedDays !== null
          ? Math.floor(Date.now() / 1000) + Math.round(parsedDays * 86400)
          : null;
      const onHoldDuration =
        status === 'on_hold' && parsedDays !== null ? Math.round(parsedDays * 86400) : null;

      if (isEdit && editingUser) {
        await modifyUser(config, editingUser.username, {
          proxies,
          inbounds: selectedInbounds,
          data_limit: dataLimitBytes ?? 0,
          data_limit_reset_strategy: resetStrategy,
          expire: expireUnix ?? 0,
          on_hold_expire_duration: onHoldDuration ?? 0,
          status,
          note: note.trim() || null,
        });
      } else {
        await createUser(config, {
          username: username.trim(),
          proxies,
          inbounds: selectedInbounds,
          data_limit: dataLimitBytes,
          data_limit_reset_strategy: resetStrategy,
          expire: expireUnix,
          on_hold_expire_duration: onHoldDuration,
          status: status === 'on_hold' ? 'on_hold' : 'active',
          note: note.trim() || null,
        });
      }
      onSaved();
      onClose();
    } catch (err) {
      setError(
        err instanceof MarzbanApiError
          ? err.detail
          : err instanceof Error
            ? err.message
            : 'Request failed'
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="w-full max-w-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden max-h-[90vh] flex flex-col">
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <h3 className="text-sm font-semibold">
            {isEdit ? `${t.editUserTitle}: ${editingUser?.username}` : t.createUserTitle}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5 overflow-y-auto">
          {!isEdit && (
            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                {t.colUser}
              </label>
              <input
                type="text"
                dir="ltr"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="ali_rezaei"
                required
                className="w-full px-3.5 py-2 text-sm font-mono rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
              />
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                {t.dataLimitGb}
              </label>
              <input
                type="number"
                step="0.1"
                min="0"
                dir="ltr"
                value={dataLimitGb}
                onChange={(e) => setDataLimitGb(e.target.value)}
                placeholder="50"
                className="w-full px-3.5 py-2 text-sm font-mono tabular-nums rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                {t.expireDays}
              </label>
              <input
                type="number"
                min="0"
                dir="ltr"
                value={expireDays}
                onChange={(e) => setExpireDays(e.target.value)}
                placeholder="30"
                className="w-full px-3.5 py-2 text-sm font-mono tabular-nums rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                {t.resetStrategy}
              </label>
              <select
                value={resetStrategy}
                onChange={(e) => setResetStrategy(e.target.value as DataLimitResetStrategy)}
                className="w-full px-3.5 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
              >
                <option value="no_reset">{t.resetNo}</option>
                <option value="day">{t.resetDay}</option>
                <option value="week">{t.resetWeek}</option>
                <option value="month">{t.resetMonth}</option>
                <option value="year">{t.resetYear}</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                {t.initialStatus}
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as 'active' | 'disabled' | 'on_hold')}
                className="w-full px-3.5 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
              >
                <option value="active">{t.statusActive}</option>
                <option value="on_hold">{t.statusOnHold}</option>
                {isEdit && <option value="disabled">{t.statusDisabled}</option>}
              </select>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
              {t.noteLabel}
            </label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="w-full px-3.5 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
            />
          </div>

          <div className="space-y-2.5">
            <div className="text-xs font-medium text-slate-700 dark:text-slate-300">
              {t.protocolsInbounds}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {Object.entries(inboundsMap).map(([protocol, items]) => (
                <div
                  key={protocol}
                  className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 space-y-2"
                >
                  <div className="text-xs font-semibold font-mono text-emerald-600 dark:text-emerald-400">
                    {protocol}
                  </div>
                  <div className="space-y-1.5">
                    {items.map((inbound) => {
                      const checked = (selectedInbounds[protocol] || []).includes(inbound.tag);
                      return (
                        <label
                          key={inbound.tag}
                          className="flex items-center justify-between gap-2 text-xs cursor-pointer"
                        >
                          <span className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleInbound(protocol, inbound.tag)}
                              className="rounded border-slate-300 dark:border-slate-700 text-emerald-600 focus:ring-emerald-500"
                            />
                            <span className="font-mono">{inbound.tag}</span>
                          </span>
                          <span className="text-[11px] font-mono text-slate-400">
                            {inbound.network}/{inbound.tls} · {inbound.port}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {error && (
            <div className="p-3 rounded-lg border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/40 text-xs text-red-700 dark:text-red-300">
              {error}
            </div>
          )}

          <div className="pt-2 flex items-center justify-end gap-3 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 whitespace-nowrap"
            >
              {t.cancel}
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 text-xs font-medium rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white whitespace-nowrap"
            >
              {submitting ? '...' : isEdit ? t.save : t.create}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

interface SubscriptionModalProps {
  locale: Locale;
  serverUrl: string;
  user: UserRecord;
  onClose: () => void;
}

export function SubscriptionModal({ locale, serverUrl, user, onClose }: SubscriptionModalProps) {
  const t = copy[locale];
  const fullSubUrl = resolveSubscriptionUrl(serverUrl, user.subscription_url);
  const [activeValue, setActiveValue] = useState(fullSubUrl || user.links[0] || '');
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  useEffect(() => {
    if (!activeValue) return;
    QRCode.toDataURL(activeValue, {
      width: 220,
      margin: 2,
      color: { dark: '#0f172a', light: '#ffffff' },
    })
      .then(setQrDataUrl)
      .catch(() => setQrDataUrl(''));
  }, [activeValue]);

  const handleCopy = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 1500);
    } catch {
      // Clipboard fallback ignored
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="w-full max-w-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden max-h-[90vh] flex flex-col">
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <QrCode className="w-4 h-4 text-emerald-500" />
            <h3 className="text-sm font-semibold">
              {t.subModalTitle} — <span className="font-mono">{user.username}</span>
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-5 overflow-y-auto">
          {qrDataUrl && (
            <div className="flex flex-col items-center justify-center gap-3 p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950">
              <img
                src={qrDataUrl}
                alt={`QR ${user.username}`}
                className="w-44 h-44 rounded-lg bg-white p-1.5"
              />
              <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400 truncate max-w-full" dir="ltr">
                {activeValue}
              </div>
            </div>
          )}

          {fullSubUrl && (
            <div className="space-y-1.5">
              <div className="text-xs font-medium text-slate-600 dark:text-slate-400">
                Subscription URL
              </div>
              <div className="flex items-center gap-2">
                <input
                  readOnly
                  dir="ltr"
                  value={fullSubUrl}
                  onClick={() => setActiveValue(fullSubUrl)}
                  className="flex-1 px-3 py-2 text-xs font-mono rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950"
                />
                <button
                  type="button"
                  onClick={() => handleCopy(fullSubUrl, 'sub')}
                  className="px-3 py-2 text-xs font-medium rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
                >
                  {copiedKey === 'sub' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedKey === 'sub' ? t.copied : t.copyLink}</span>
                </button>
              </div>
            </div>
          )}

          {user.links.length > 0 && (
            <div className="space-y-2">
              <div className="text-xs font-medium text-slate-600 dark:text-slate-400">
                {t.individualLinks} ({user.links.length})
              </div>
              <div className="space-y-2 max-h-52 overflow-y-auto">
                {user.links.map((link, idx) => (
                  <div
                    key={idx}
                    className="flex items-center gap-2 p-2.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950"
                  >
                    <button
                      type="button"
                      onClick={() => setActiveValue(link)}
                      className="flex-1 min-w-0 text-start font-mono text-[11px] truncate text-slate-700 dark:text-slate-300 hover:text-emerald-500"
                      dir="ltr"
                    >
                      {link}
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveValue(link)}
                      className="p-1.5 text-slate-400 hover:text-emerald-500 shrink-0"
                      title={t.openQr}
                    >
                      <Link2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleCopy(link, `link-${idx}`)}
                      className="p-1.5 text-slate-400 hover:text-emerald-500 shrink-0"
                      title={t.copyLink}
                    >
                      {copiedKey === `link-${idx}` ? (
                        <Check className="w-3.5 h-3.5 text-emerald-500" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
