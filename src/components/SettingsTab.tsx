import React, { useEffect, useState } from 'react';
import { Plus, Save, Shield, Trash2 } from 'lucide-react';
import {
  createAdmin,
  deleteAdmin,
  MarzbanApiError,
  updateCoreConfig,
} from '../lib/marzbanApi';
import type { Locale } from '../lib/i18n';
import { copy } from '../lib/i18n';
import type { AdminInfo, ConnectionConfig } from '../types/marzban';

interface SettingsTabProps {
  locale: Locale;
  config: ConnectionConfig;
  currentAdmin: AdminInfo | null;
  admins: AdminInfo[];
  coreConfig: Record<string, unknown> | null;
  onRefresh: () => void;
}

export function SettingsTab({
  locale,
  config,
  currentAdmin,
  admins,
  coreConfig,
  onRefresh,
}: SettingsTabProps) {
  const t = copy[locale];
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newIsSudo, setNewIsSudo] = useState(false);
  const [adminError, setAdminError] = useState<string | null>(null);
  const [creatingAdmin, setCreatingAdmin] = useState(false);

  const [jsonText, setJsonText] = useState('');
  const [configError, setConfigError] = useState<string | null>(null);
  const [configSuccess, setConfigSuccess] = useState<string | null>(null);
  const [savingConfig, setSavingConfig] = useState(false);

  useEffect(() => {
    if (coreConfig) {
      setJsonText(JSON.stringify(coreConfig, null, 2));
    }
  }, [coreConfig]);

  const handleCreateAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdminError(null);
    setCreatingAdmin(true);
    try {
      await createAdmin(config, {
        username: newUsername.trim(),
        password: newPassword,
        is_sudo: newIsSudo,
      });
      setNewUsername('');
      setNewPassword('');
      setNewIsSudo(false);
      onRefresh();
    } catch (err) {
      setAdminError(
        err instanceof MarzbanApiError
          ? err.detail
          : err instanceof Error
            ? err.message
            : 'Error'
      );
    } finally {
      setCreatingAdmin(false);
    }
  };

  const handleDeleteAdmin = async (username: string) => {
    try {
      await deleteAdmin(config, username);
      onRefresh();
    } catch (err) {
      setAdminError(err instanceof Error ? err.message : 'Error');
    }
  };

  const handleSaveCoreConfig = async () => {
    setConfigError(null);
    setConfigSuccess(null);
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(jsonText);
    } catch {
      setConfigError(t.invalidJson);
      return;
    }

    setSavingConfig(true);
    try {
      await updateCoreConfig(config, parsed);
      setConfigSuccess(t.savedSuccess);
      onRefresh();
    } catch (err) {
      setConfigError(
        err instanceof MarzbanApiError
          ? err.detail
          : err instanceof Error
            ? err.message
            : 'Error'
      );
    } finally {
      setSavingConfig(false);
    }
  };

  if (!currentAdmin?.is_sudo) {
    return (
      <div className="p-8 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-center space-y-2">
        <Shield className="w-7 h-7 mx-auto text-slate-400" />
        <div className="text-sm font-medium">
          {locale === 'fa' ? 'نیازمند دسترسی Sudo Admin' : 'Sudo Admin Access Required'}
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          {locale === 'fa'
            ? 'مدیریت ادمین‌ها و ویرایش تنظیمات هسته Xray فقط برای ادمین با سطح دسترسی Sudo فعال است.'
            : 'Managing panel admins and editing Xray Core JSON requires a sudo administrator account.'}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800">
            <h2 className="text-sm font-semibold">{t.adminsTitle}</h2>
          </div>
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {admins.map((a) => (
              <div key={a.username} className="px-5 py-3 flex items-center justify-between text-xs">
                <div className="space-y-0.5">
                  <div className="font-mono font-medium">{a.username}</div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400">
                    {a.is_sudo ? t.sudoAdmin : t.standardAdmin}
                  </div>
                </div>
                {a.username !== currentAdmin.username && (
                  <button
                    type="button"
                    onClick={() => handleDeleteAdmin(a.username)}
                    className="p-1.5 text-slate-400 hover:text-rose-500"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        <form
          onSubmit={handleCreateAdmin}
          className="lg:col-span-5 p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-4"
        >
          <h3 className="text-sm font-semibold">{t.newAdmin}</h3>
          <div className="space-y-1.5">
            <label className="block text-xs font-medium">{t.usernameLabel}</label>
            <input
              type="text"
              dir="ltr"
              required
              value={newUsername}
              onChange={(e) => setNewUsername(e.target.value)}
              className="w-full px-3 py-2 text-xs font-mono rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950"
            />
          </div>
          <div className="space-y-1.5">
            <label className="block text-xs font-medium">{t.passwordLabel}</label>
            <input
              type="password"
              dir="ltr"
              required
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full px-3 py-2 text-xs font-mono rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950"
            />
          </div>
          <label className="flex items-center gap-2 text-xs cursor-pointer">
            <input
              type="checkbox"
              checked={newIsSudo}
              onChange={(e) => setNewIsSudo(e.target.checked)}
              className="rounded border-slate-300 dark:border-slate-700 text-emerald-600"
            />
            <span>{t.sudoAdmin}</span>
          </label>
          {adminError && <div className="text-xs text-rose-500">{adminError}</div>}
          <button
            type="submit"
            disabled={creatingAdmin}
            className="w-full py-2 px-4 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium inline-flex items-center justify-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{creatingAdmin ? '...' : t.newAdmin}</span>
          </button>
        </form>
      </section>

      <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-semibold">{t.coreConfigTitle}</h2>
          <button
            type="button"
            disabled={savingConfig}
            onClick={handleSaveCoreConfig}
            className="px-4 py-2 text-xs font-medium rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white inline-flex items-center gap-1.5 whitespace-nowrap"
          >
            <Save className="w-3.5 h-3.5" />
            <span>{savingConfig ? '...' : t.saveCoreConfig}</span>
          </button>
        </div>

        <div className="p-5 space-y-3">
          {configError && (
            <div className="p-3 rounded-lg border border-rose-200 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/30 text-xs text-rose-600 dark:text-rose-300">
              {configError}
            </div>
          )}
          {configSuccess && (
            <div className="p-3 rounded-lg border border-emerald-200 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-950/30 text-xs text-emerald-600 dark:text-emerald-300">
              {configSuccess}
            </div>
          )}
          <textarea
            dir="ltr"
            rows={18}
            value={jsonText}
            onChange={(e) => setJsonText(e.target.value)}
            spellCheck={false}
            className="w-full p-4 text-xs font-mono leading-relaxed rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
          />
        </div>
      </section>
    </div>
  );
}
