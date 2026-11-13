import React, { useEffect, useState } from 'react';
import { Plus, Save, Trash2 } from 'lucide-react';
import { MarzbanApiError, updateHosts } from '../lib/marzbanApi';
import type { Locale } from '../lib/i18n';
import { copy } from '../lib/i18n';
import type { ConnectionConfig, HostConfig, ProxyInbound } from '../types/marzban';

interface InboundsHostsTabProps {
  locale: Locale;
  config: ConnectionConfig;
  inboundsMap: Record<string, ProxyInbound[]>;
  hostsMap: Record<string, HostConfig[]>;
  onRefresh: () => void;
}

export function InboundsHostsTab({
  locale,
  config,
  inboundsMap,
  hostsMap,
  onRefresh,
}: InboundsHostsTabProps) {
  const t = copy[locale];
  const [draftHosts, setDraftHosts] = useState<Record<string, HostConfig[]>>(hostsMap);
  const [saving, setSaving] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    setDraftHosts(hostsMap);
  }, [hostsMap]);

  const updateHostField = (
    tag: string,
    index: number,
    field: keyof HostConfig,
    value: string | number | boolean | null
  ) => {
    setDraftHosts((prev) => {
      const list = [...(prev[tag] || [])];
      list[index] = { ...list[index], [field]: value };
      return { ...prev, [tag]: list };
    });
  };

  const addHostRow = (tag: string) => {
    setDraftHosts((prev) => {
      const list = [...(prev[tag] || [])];
      list.push({
        remark: `${tag}-host`,
        address: '',
        port: null,
        sni: '',
        host: '',
        security: 'inbound_default',
        is_disabled: false,
      });
      return { ...prev, [tag]: list };
    });
  };

  const removeHostRow = (tag: string, index: number) => {
    setDraftHosts((prev) => {
      const list = [...(prev[tag] || [])];
      list.splice(index, 1);
      return { ...prev, [tag]: list };
    });
  };

  const handleSaveHosts = async () => {
    setSaving(true);
    setStatusMsg(null);
    setErrorMsg(null);
    try {
      await updateHosts(config, draftHosts);
      setStatusMsg(t.savedSuccess);
      onRefresh();
    } catch (err) {
      setErrorMsg(
        err instanceof MarzbanApiError
          ? err.detail
          : err instanceof Error
            ? err.message
            : 'Error'
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-8">
      <section className="space-y-4">
        <h2 className="text-sm font-semibold">{t.inboundsTitle}</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {Object.entries(inboundsMap).map(([protocol, items]) => (
            <div
              key={protocol}
              className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-3"
            >
              <div className="text-xs font-semibold font-mono text-emerald-600 dark:text-emerald-400">
                {protocol}
              </div>
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {items.map((inbound) => (
                  <div key={inbound.tag} className="py-2 text-xs space-y-0.5">
                    <div className="font-mono font-medium">{inbound.tag}</div>
                    <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400" dir="ltr">
                      Port {inbound.port} · {inbound.network} · {inbound.tls}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-semibold">{t.hostsTitle}</h2>
          <button
            type="button"
            disabled={saving}
            onClick={handleSaveHosts}
            className="px-4 py-2 text-xs font-medium rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white inline-flex items-center gap-1.5 whitespace-nowrap"
          >
            <Save className="w-3.5 h-3.5" />
            <span>{saving ? '...' : t.saveHosts}</span>
          </button>
        </div>

        {statusMsg && (
          <div className="p-3 rounded-lg border border-emerald-200 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-950/30 text-xs text-emerald-700 dark:text-emerald-300">
            {statusMsg}
          </div>
        )}
        {errorMsg && (
          <div className="p-3 rounded-lg border border-rose-200 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/30 text-xs text-rose-700 dark:text-rose-300">
            {errorMsg}
          </div>
        )}

        <div className="space-y-4">
          {Object.entries(draftHosts).map(([tag, hostList]) => (
            <div
              key={tag}
              className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden"
            >
              <div className="px-5 py-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-950/50">
                <span className="text-xs font-semibold font-mono">{tag}</span>
                <button
                  type="button"
                  onClick={() => addHostRow(tag)}
                  className="px-2.5 py-1 text-xs rounded-md border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 inline-flex items-center gap-1"
                >
                  <Plus className="w-3 h-3" />
                  <span>{locale === 'fa' ? 'افزودن هاست' : 'Add Host'}</span>
                </button>
              </div>

              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {hostList.map((host, idx) => (
                  <div key={idx} className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3 items-end">
                    <div className="space-y-1">
                      <label className="block text-[11px] text-slate-500">Remark</label>
                      <input
                        type="text"
                        value={host.remark}
                        onChange={(e) => updateHostField(tag, idx, 'remark', e.target.value)}
                        className="w-full px-2.5 py-1.5 text-xs rounded-md border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="block text-[11px] text-slate-500">Address</label>
                      <input
                        type="text"
                        dir="ltr"
                        value={host.address}
                        onChange={(e) => updateHostField(tag, idx, 'address', e.target.value)}
                        className="w-full px-2.5 py-1.5 text-xs font-mono rounded-md border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="block text-[11px] text-slate-500">Port</label>
                      <input
                        type="number"
                        dir="ltr"
                        value={host.port ?? ''}
                        onChange={(e) =>
                          updateHostField(
                            tag,
                            idx,
                            'port',
                            e.target.value ? Number(e.target.value) : null
                          )
                        }
                        className="w-full px-2.5 py-1.5 text-xs font-mono tabular-nums rounded-md border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="block text-[11px] text-slate-500">SNI</label>
                      <input
                        type="text"
                        dir="ltr"
                        value={host.sni ?? ''}
                        onChange={(e) => updateHostField(tag, idx, 'sni', e.target.value || null)}
                        className="w-full px-2.5 py-1.5 text-xs font-mono rounded-md border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="block text-[11px] text-slate-500">Host / Header</label>
                      <input
                        type="text"
                        dir="ltr"
                        value={host.host ?? ''}
                        onChange={(e) => updateHostField(tag, idx, 'host', e.target.value || null)}
                        className="w-full px-2.5 py-1.5 text-xs font-mono rounded-md border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950"
                      />
                    </div>
                    <div className="flex items-center justify-between gap-2 pb-1">
                      <label className="inline-flex items-center gap-1.5 text-xs cursor-pointer">
                        <input
                          type="checkbox"
                          checked={!host.is_disabled}
                          onChange={(e) =>
                            updateHostField(tag, idx, 'is_disabled', !e.target.checked)
                          }
                          className="rounded border-slate-300 dark:border-slate-700 text-emerald-600"
                        />
                        <span>{locale === 'fa' ? 'فعال' : 'Active'}</span>
                      </label>
                      <button
                        type="button"
                        onClick={() => removeHostRow(tag, idx)}
                        className="p-1.5 text-slate-400 hover:text-rose-500"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
