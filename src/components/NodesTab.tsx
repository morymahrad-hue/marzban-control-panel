import React, { useState } from 'react';
import {
  AlertCircle,
  Check,
  CheckCircle2,
  Copy,
  Edit3,
  Key,
  Plus,
  RefreshCw,
  Server,
  Trash2,
  X,
  XCircle,
} from 'lucide-react';
import {
  createNode,
  deleteNode,
  formatBytes,
  MarzbanApiError,
  modifyNode,
  reconnectNode,
} from '../lib/marzbanApi';
import type { Locale } from '../lib/i18n';
import { copy } from '../lib/i18n';
import type {
  ConnectionConfig,
  NodeRecord,
  NodeSettings,
  NodeStatus,
  NodeUsageRecord,
} from '../types/marzban';

interface NodesTabProps {
  locale: Locale;
  config: ConnectionConfig;
  nodes: NodeRecord[];
  nodeSettings: NodeSettings | null;
  nodeUsages: NodeUsageRecord[];
  onRefresh: () => void;
}

export function NodesTab({
  locale,
  config,
  nodes,
  nodeSettings,
  nodeUsages,
  onRefresh,
}: NodesTabProps) {
  const t = copy[locale];
  const [modalOpen, setModalOpen] = useState(false);
  const [editingNode, setEditingNode] = useState<NodeRecord | null>(null);
  const [showCert, setShowCert] = useState(false);
  const [copiedCert, setCopiedCert] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [port, setPort] = useState('62050');
  const [apiPort, setApiPort] = useState('62051');
  const [coefficient, setCoefficient] = useState('1.0');
  const [addAsNewHost, setAddAsNewHost] = useState(true);
  const [nodeStatus, setNodeStatus] = useState<NodeStatus>('connected');
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const openCreate = () => {
    setEditingNode(null);
    setName('');
    setAddress('');
    setPort('62050');
    setApiPort('62051');
    setCoefficient('1.0');
    setAddAsNewHost(true);
    setFormError(null);
    setModalOpen(true);
  };

  const openEdit = (n: NodeRecord) => {
    setEditingNode(n);
    setName(n.name);
    setAddress(n.address);
    setPort(String(n.port));
    setApiPort(String(n.api_port));
    setCoefficient(String(n.usage_coefficient));
    setNodeStatus(n.status === 'disabled' ? 'disabled' : 'connected');
    setFormError(null);
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setSubmitting(true);
    try {
      if (editingNode) {
        await modifyNode(config, editingNode.id, {
          name: name.trim(),
          address: address.trim(),
          port: Number(port),
          api_port: Number(apiPort),
          usage_coefficient: Number(coefficient),
          status: nodeStatus === 'disabled' ? 'disabled' : undefined,
        });
      } else {
        await createNode(config, {
          name: name.trim(),
          address: address.trim(),
          port: Number(port),
          api_port: Number(apiPort),
          usage_coefficient: Number(coefficient),
          add_as_new_host: addAsNewHost,
        });
      }
      setModalOpen(false);
      onRefresh();
    } catch (err) {
      setFormError(
        err instanceof MarzbanApiError
          ? err.detail
          : err instanceof Error
            ? err.message
            : 'Failed'
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleReconnect = async (id: number) => {
    setBusyId(id);
    try {
      await reconnectNode(config, id);
      onRefresh();
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (id: number) => {
    setBusyId(id);
    try {
      await deleteNode(config, id);
      setConfirmDeleteId(null);
      onRefresh();
    } finally {
      setBusyId(null);
    }
  };

  const handleCopyCert = async () => {
    if (!nodeSettings?.certificate) return;
    await navigator.clipboard.writeText(nodeSettings.certificate);
    setCopiedCert(true);
    setTimeout(() => setCopiedCert(false), 1500);
  };

  const renderNodeStatus = (status: NodeStatus) => {
    switch (status) {
      case 'connected':
        return (
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>{locale === 'fa' ? 'متصل' : 'Connected'}</span>
          </span>
        );
      case 'connecting':
        return (
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-600 dark:text-amber-400">
            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            <span>{locale === 'fa' ? 'در حال اتصال' : 'Connecting'}</span>
          </span>
        );
      case 'error':
        return (
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-rose-600 dark:text-rose-400">
            <AlertCircle className="w-3.5 h-3.5" />
            <span>{locale === 'fa' ? 'خطا' : 'Error'}</span>
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 dark:text-slate-400">
            <XCircle className="w-3.5 h-3.5" />
            <span>{locale === 'fa' ? 'غیرفعال' : 'Disabled'}</span>
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-semibold">{t.nodesTitle}</h2>
        <div className="flex items-center gap-2">
          {nodeSettings && (
            <button
              type="button"
              onClick={() => setShowCert((v) => !v)}
              className="px-3 py-2 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 inline-flex items-center gap-1.5 whitespace-nowrap"
            >
              <Key className="w-3.5 h-3.5" />
              <span>{t.nodeCertificate}</span>
            </button>
          )}
          <button
            type="button"
            onClick={openCreate}
            className="px-3.5 py-2 text-xs font-medium rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white inline-flex items-center gap-1.5 whitespace-nowrap"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{t.newNode}</span>
          </button>
        </div>
      </div>

      {showCert && nodeSettings && (
        <div className="p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium">
              {t.nodeCertificate} (min {nodeSettings.min_node_version})
            </span>
            <button
              type="button"
              onClick={handleCopyCert}
              className="px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 inline-flex items-center gap-1.5"
            >
              {copiedCert ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedCert ? t.copied : t.copyCert}</span>
            </button>
          </div>
          <pre
            dir="ltr"
            className="p-3 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-[11px] font-mono overflow-x-auto max-h-48"
          >
            {nodeSettings.certificate}
          </pre>
        </div>
      )}

      {nodes.length === 0 ? (
        <div className="p-12 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-center space-y-2">
          <Server className="w-7 h-7 mx-auto text-slate-400" />
          <div className="text-sm font-medium">
            {locale === 'fa' ? 'هیچ نودی ثبت نشده است' : 'No external nodes configured'}
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {locale === 'fa'
              ? 'می‌توانید نودهای جانبی Marzban Node را با کلیک روی نود جدید اضافه کنید.'
              : 'Add remote Marzban Node servers to distribute proxy traffic.'}
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-slate-50 dark:bg-slate-950/50 text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="py-3 px-4 text-start font-medium">
                    {locale === 'fa' ? 'نام' : 'Name'}
                  </th>
                  <th className="py-3 px-4 text-start font-medium">
                    {locale === 'fa' ? 'آدرس و پورت' : 'Address'}
                  </th>
                  <th className="py-3 px-4 text-start font-medium">{t.colStatus}</th>
                  <th className="py-3 px-4 text-start font-medium">Xray</th>
                  <th className="py-3 px-4 text-end font-medium">{t.colTraffic}</th>
                  <th className="py-3 px-4 text-end font-medium">{t.colActions}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {nodes.map((node) => {
                  const usage = nodeUsages.find((u) => u.node_id === node.id);
                  const totalBytes = usage ? usage.uplink + usage.downlink : 0;

                  return (
                    <tr key={node.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                      <td className="py-3 px-4 font-medium">
                        <div>{node.name}</div>
                        <div className="text-[11px] font-mono text-slate-400">
                          ×{node.usage_coefficient}
                        </div>
                      </td>
                      <td className="py-3 px-4 font-mono tabular-nums" dir="ltr">
                        {node.address}:{node.port} ({node.api_port})
                      </td>
                      <td className="py-3 px-4">
                        {renderNodeStatus(node.status)}
                        {node.message && (
                          <div className="text-[11px] text-rose-500 truncate max-w-[200px]">
                            {node.message}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4 font-mono tabular-nums">
                        {node.xray_version || '—'}
                      </td>
                      <td className="py-3 px-4 text-end font-mono tabular-nums" dir="ltr">
                        {formatBytes(totalBytes)}
                      </td>
                      <td className="py-3 px-4 text-end whitespace-nowrap">
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            disabled={busyId === node.id}
                            onClick={() => handleReconnect(node.id)}
                            title={t.reconnect}
                            className="p-1.5 rounded-md text-slate-500 hover:text-emerald-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                          >
                            <RefreshCw className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => openEdit(node)}
                            className="p-1.5 rounded-md text-slate-500 hover:text-sky-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          {confirmDeleteId === node.id ? (
                            <div className="inline-flex items-center gap-1 ms-1">
                              <button
                                type="button"
                                disabled={busyId === node.id}
                                onClick={() => handleDelete(node.id)}
                                className="px-2 py-1 rounded bg-rose-600 text-white text-[11px]"
                              >
                                {t.confirmDelete}
                              </button>
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteId(null)}
                                className="px-1.5 py-1 rounded border border-slate-300 dark:border-slate-700 text-[11px]"
                              >
                                ✕
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteId(node.id)}
                              className="p-1.5 rounded-md text-slate-500 hover:text-rose-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <h3 className="text-sm font-semibold">
                {editingNode ? editingNode.name : t.newNode}
              </h3>
              <button type="button" onClick={() => setModalOpen(false)}>
                <X className="w-4 h-4 text-slate-400" />
              </button>
            </div>
            <form onSubmit={handleSave} className="p-6 space-y-4">
              <div className="space-y-1.5">
                <label className="block text-xs font-medium">
                  {locale === 'fa' ? 'نام نود' : 'Node Name'}
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Germany DE-1"
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-medium">
                  {locale === 'fa' ? 'آدرس IP یا دامنه' : 'Address (IP / Domain)'}
                </label>
                <input
                  type="text"
                  dir="ltr"
                  required
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="185.10.20.30"
                  className="w-full px-3 py-2 text-sm font-mono rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="block text-[11px] font-medium">Service Port</label>
                  <input
                    type="number"
                    dir="ltr"
                    value={port}
                    onChange={(e) => setPort(e.target.value)}
                    className="w-full px-2.5 py-2 text-xs font-mono tabular-nums rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-[11px] font-medium">API Port</label>
                  <input
                    type="number"
                    dir="ltr"
                    value={apiPort}
                    onChange={(e) => setApiPort(e.target.value)}
                    className="w-full px-2.5 py-2 text-xs font-mono tabular-nums rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-[11px] font-medium">Coeff</label>
                  <input
                    type="number"
                    step="0.1"
                    min="0.1"
                    dir="ltr"
                    value={coefficient}
                    onChange={(e) => setCoefficient(e.target.value)}
                    className="w-full px-2.5 py-2 text-xs font-mono tabular-nums rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950"
                  />
                </div>
              </div>

              {!editingNode ? (
                <label className="flex items-center gap-2 text-xs cursor-pointer">
                  <input
                    type="checkbox"
                    checked={addAsNewHost}
                    onChange={(e) => setAddAsNewHost(e.target.checked)}
                    className="rounded border-slate-300 dark:border-slate-700 text-emerald-600"
                  />
                  <span>
                    {locale === 'fa'
                      ? 'افزودن خودکار به لیست Hosts اینباندها'
                      : 'Add automatically as new host for inbounds'}
                  </span>
                </label>
              ) : (
                <div className="space-y-1">
                  <label className="block text-xs font-medium">{t.colStatus}</label>
                  <select
                    value={nodeStatus}
                    onChange={(e) => setNodeStatus(e.target.value as NodeStatus)}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950"
                  >
                    <option value="connected">{locale === 'fa' ? 'فعال' : 'Enabled'}</option>
                    <option value="disabled">{locale === 'fa' ? 'غیرفعال' : 'Disabled'}</option>
                  </select>
                </div>
              )}

              {formError && (
                <div className="p-2.5 rounded-lg bg-rose-50 dark:bg-rose-950/40 text-xs text-rose-600 dark:text-rose-300">
                  {formError}
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-800"
                >
                  {t.cancel}
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 text-xs font-medium rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white"
                >
                  {submitting ? '...' : t.save}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
