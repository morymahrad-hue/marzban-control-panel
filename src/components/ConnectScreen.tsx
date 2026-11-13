import React, { useState } from 'react';
import {
  AlertCircle,
  ArrowRight,
  Globe,
  KeyRound,
  Lock,
  Server,
  ShieldAlert,
  Trash2,
  User,
} from 'lucide-react';
import { getCurrentAdmin, loginAdmin, MarzbanApiError, normalizeBaseUrl } from '../lib/marzbanApi';
import type { Locale } from '../lib/i18n';
import { copy } from '../lib/i18n';
import type { AdminInfo, ConnectionConfig, SavedServerProfile } from '../types/marzban';

interface ConnectScreenProps {
  locale: Locale;
  onToggleLocale: () => void;
  isDark: boolean;
  onToggleTheme: () => void;
  savedProfiles: SavedServerProfile[];
  onRemoveProfile: (id: string) => void;
  onConnected: (config: ConnectionConfig, admin: AdminInfo) => void;
}

export function ConnectScreen({
  locale,
  onToggleLocale,
  isDark,
  onToggleTheme,
  savedProfiles,
  onRemoveProfile,
  onConnected,
}: ConnectScreenProps) {
  const t = copy[locale];
  const [serverUrl, setServerUrl] = useState(savedProfiles[0]?.serverUrl || '');
  const [authMode, setAuthMode] = useState<'credentials' | 'token'>('credentials');
  const [username, setUsername] = useState(savedProfiles[0]?.username || '');
  const [password, setPassword] = useState('');
  const [token, setToken] = useState('');
  const [allowInsecureTls, setAllowInsecureTls] = useState(
    savedProfiles[0]?.allowInsecureTls ?? false
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const normalizedUrl = normalizeBaseUrl(serverUrl);
    if (!normalizedUrl || normalizedUrl === 'https://') {
      setError(
        locale === 'fa'
          ? 'لطفاً آدرس معتبر سرور مرزبان را وارد کنید.'
          : 'Please enter a valid Marzban server URL.'
      );
      return;
    }

    setLoading(true);
    try {
      let accessToken = token.trim();
      let resolvedUsername = username.trim();

      if (authMode === 'credentials') {
        if (!resolvedUsername || !password) {
          setError(
            locale === 'fa'
              ? 'نام کاربری و رمز عبور الزامی است.'
              : 'Username and password are required.'
          );
          setLoading(false);
          return;
        }
        const authRes = await loginAdmin({
          serverUrl: normalizedUrl,
          username: resolvedUsername,
          password,
          allowInsecureTls,
        });
        accessToken = authRes.access_token;
      } else {
        if (!accessToken) {
          setError(
            locale === 'fa' ? 'توکن دسترسی را وارد کنید.' : 'Please enter your Bearer JWT token.'
          );
          setLoading(false);
          return;
        }
      }

      const config: ConnectionConfig = {
        serverUrl: normalizedUrl,
        token: accessToken,
        username: resolvedUsername,
        allowInsecureTls,
      };

      const admin = await getCurrentAdmin(config);
      config.username = admin.username;
      onConnected(config, admin);
    } catch (err) {
      if (err instanceof MarzbanApiError) {
        if (err.status === 401) {
          setError(
            locale === 'fa'
              ? 'نام کاربری، رمز عبور یا توکن نادرست است (401).'
              : 'Invalid credentials or expired token (401).'
          );
        } else {
          setError(`${err.detail} (${err.status})`);
        }
      } else {
        setError(
          err instanceof Error
            ? err.message
            : locale === 'fa'
              ? 'خطا در برقراری ارتباط با سرور مرزبان.'
              : 'Failed to connect to Marzban server.'
        );
      }
    } finally {
      setLoading(false);
    }
  };

  const applySavedProfile = (profile: SavedServerProfile) => {
    setServerUrl(profile.serverUrl);
    setUsername(profile.username);
    setAllowInsecureTls(profile.allowInsecureTls);
    setAuthMode('credentials');
    setError(null);
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col">
      <header className="w-full border-b border-slate-200 dark:border-slate-800 px-6 py-4 flex items-center justify-between gap-8">
        <div className="flex items-center gap-2.5 whitespace-nowrap shrink-0">
          <Server className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
          <span className="text-base font-bold tracking-tight">{t.brand}</span>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={onToggleLocale}
            className="px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-900 transition-colors whitespace-nowrap shrink-0"
          >
            {locale === 'fa' ? 'EN' : 'فا'}
          </button>
          <button
            type="button"
            onClick={onToggleTheme}
            className="px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-900 transition-colors whitespace-nowrap shrink-0"
          >
            {isDark ? (locale === 'fa' ? 'حالت روشن' : 'Light') : locale === 'fa' ? 'حالت تیره' : 'Dark'}
          </button>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-4xl grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
          <div className="lg:col-span-5 space-y-6 pt-2">
            <div className="space-y-3">
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight [text-wrap:balance]">
                {t.connectTitle}
              </h1>
              <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                {t.connectSubtitle}
              </p>
            </div>

            <div className="border-t border-slate-200 dark:border-slate-800 pt-5 space-y-3 text-xs text-slate-600 dark:text-slate-400">
              <div className="flex items-start gap-2.5">
                <Globe className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                <span>
                  {locale === 'fa'
                    ? 'درخواست‌ها از طریق پروکسی امن همین سرویس به سرور شما ارسال می‌شوند تا مشکل CORS یا HTTP/HTTPS رخ ندهد.'
                    : 'Requests are routed cleanly through the built-in server proxy to bypass browser CORS and Mixed-Content restrictions.'}
                </span>
              </div>
              <div className="flex items-start gap-2.5">
                <Lock className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                <span>
                  {locale === 'fa'
                    ? 'رمز عبور شما ذخیره نمی‌شود و تنها توکن نشست در مرورگر شما نگهداری می‌گردد.'
                    : 'Admin passwords are never persisted; only your active session token is kept locally in your browser.'}
                </span>
              </div>
            </div>

            {savedProfiles.length > 0 && (
              <div className="border-t border-slate-200 dark:border-slate-800 pt-5 space-y-3">
                <h2 className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                  {t.savedServers}
                </h2>
                <div className="space-y-2">
                  {savedProfiles.map((p) => (
                    <div
                      key={p.id}
                      className="flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900"
                    >
                      <button
                        type="button"
                        onClick={() => applySavedProfile(p)}
                        className="flex-1 min-w-0 text-start hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors"
                      >
                        <div className="text-xs font-medium font-mono truncate" dir="ltr">
                          {p.serverUrl}
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                          {p.username}
                        </div>
                      </button>
                      <button
                        type="button"
                        onClick={() => onRemoveProfile(p.id)}
                        aria-label={t.removeSaved}
                        className="p-1.5 text-slate-400 hover:text-red-500 transition-colors shrink-0"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <form
            onSubmit={handleSubmit}
            className="lg:col-span-7 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 sm:p-8 space-y-5"
          >
            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                {t.serverUrlLabel}
              </label>
              <div className="relative">
                <input
                  type="text"
                  dir="ltr"
                  value={serverUrl}
                  onChange={(e) => setServerUrl(e.target.value)}
                  placeholder={t.serverUrlPlaceholder}
                  className="w-full px-3.5 py-2.5 text-sm font-mono rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500"
                  required
                />
              </div>
            </div>

            <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg">
              <button
                type="button"
                onClick={() => setAuthMode('credentials')}
                className={`flex-1 px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                  authMode === 'credentials'
                    ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                {t.authModeCredentials}
              </button>
              <button
                type="button"
                onClick={() => setAuthMode('token')}
                className={`flex-1 px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                  authMode === 'token'
                    ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                {t.authModeToken}
              </button>
            </div>

            {authMode === 'credentials' ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                    {t.usernameLabel}
                  </label>
                  <div className="relative flex items-center">
                    <User className="w-4 h-4 text-slate-400 absolute start-3 pointer-events-none" />
                    <input
                      type="text"
                      dir="ltr"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="sudo_admin"
                      className="w-full ps-9 pe-3.5 py-2.5 text-sm font-mono rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                    {t.passwordLabel}
                  </label>
                  <div className="relative flex items-center">
                    <KeyRound className="w-4 h-4 text-slate-400 absolute start-3 pointer-events-none" />
                    <input
                      type="password"
                      dir="ltr"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full ps-9 pe-3.5 py-2.5 text-sm font-mono rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500"
                    />
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                  {t.tokenLabel}
                </label>
                <textarea
                  dir="ltr"
                  rows={3}
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                  className="w-full px-3.5 py-2.5 text-xs font-mono rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500"
                />
              </div>
            )}

            <label className="flex items-center gap-2.5 text-xs text-slate-600 dark:text-slate-400 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={allowInsecureTls}
                onChange={(e) => setAllowInsecureTls(e.target.checked)}
                className="w-4 h-4 rounded border-slate-300 dark:border-slate-700 text-emerald-600 focus:ring-emerald-500"
              />
              <ShieldAlert className="w-3.5 h-3.5 text-amber-500 shrink-0" />
              <span>{t.insecureTlsLabel}</span>
            </label>

            {error && (
              <div className="flex items-start gap-2.5 p-3.5 rounded-lg border border-red-200 dark:border-red-900/60 bg-red-50 dark:bg-red-950/40 text-xs text-red-700 dark:text-red-300">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span className="leading-relaxed">{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 px-4 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white text-sm font-medium transition-colors flex items-center justify-center gap-2 whitespace-nowrap"
            >
              <span>{loading ? t.connecting : t.connectButton}</span>
              <ArrowRight className={`w-4 h-4 ${locale === 'fa' ? 'rotate-180' : ''}`} />
            </button>
          </form>
        </div>
      </main>
    </div>
  );
}
