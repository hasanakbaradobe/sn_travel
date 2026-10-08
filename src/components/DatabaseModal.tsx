import React, { useState, useEffect } from 'react';
import {
  X,
  Database,
  Check,
  Copy,
  Download,
  Server,
  FileCode,
  ShieldCheck,
  ExternalLink,
} from 'lucide-react';
import { DatabaseStatus } from '../types';

interface DatabaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  status: DatabaseStatus | null;
}

export const DatabaseModal: React.FC<DatabaseModalProps> = ({ isOpen, onClose, status }) => {
  const [activeTab, setActiveTab] = useState<'status' | 'schema' | 'seed'>('status');
  const [schemaSql, setSchemaSql] = useState<string>('');
  const [seedSql, setSeedSql] = useState<string>('');
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (isOpen) {
      fetch('/api/db/schema-sql')
        .then((r) => r.text())
        .then((txt) => setSchemaSql(txt))
        .catch(() => {});
      fetch('/api/db/seed-sql')
        .then((r) => r.text())
        .then((txt) => setSeedSql(txt))
        .catch(() => {});
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(null), 2000);
  };

  const downloadFile = (content: string, filename: string) => {
    const blob = new Blob([content], { type: 'text/sql' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 cursor-pointer"
      onClick={onClose}
    >
      <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs" />
      <div
        className="relative bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-3xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150 cursor-default"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-sky-700 flex items-center justify-center">
              <Database className="w-4 h-4 text-white" />
            </div>
            <div>
              <h2 className="font-bold text-base">MySQL / phpMyAdmin Database Center</h2>
              <p className="text-xs text-sky-400">SN Travels Agency • sn_travels_visa Database Architecture</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Sub-tabs */}
        <div className="flex items-center gap-2 px-6 pt-3 border-b border-slate-200 bg-slate-50 shrink-0">
          <button
            onClick={() => setActiveTab('status')}
            className={`pb-2.5 px-3 text-xs font-semibold border-b-2 transition flex items-center gap-1.5 ${
              activeTab === 'status'
                ? 'border-sky-600 text-sky-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Server className="w-3.5 h-3.5" />
            <span>Connection & phpMyAdmin Guide</span>
          </button>
          <button
            onClick={() => setActiveTab('schema')}
            className={`pb-2.5 px-3 text-xs font-semibold border-b-2 transition flex items-center gap-1.5 ${
              activeTab === 'schema'
                ? 'border-sky-600 text-sky-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <FileCode className="w-3.5 h-3.5" />
            <span>database/schema.sql</span>
          </button>
          <button
            onClick={() => setActiveTab('seed')}
            className={`pb-2.5 px-3 text-xs font-semibold border-b-2 transition flex items-center gap-1.5 ${
              activeTab === 'seed'
                ? 'border-sky-600 text-sky-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>database/seed.sql</span>
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-4">
          {activeTab === 'status' && (
            <div className="space-y-4">
              {/* Status Card */}
              <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-xs">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span
                      className={`w-3 h-3 rounded-full ${
                        status?.connected_to_mysql ? 'bg-emerald-500 animate-pulse' : 'bg-blue-500'
                      }`}
                    />
                    <span className="font-bold text-sm text-slate-900">
                      {status?.connected_to_mysql
                        ? 'MySQL Database Connected'
                        : 'Active Database Engine (phpMyAdmin Ready)'}
                    </span>
                  </div>
                  <span className="text-xs font-mono px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                    Engine: {status?.engine}
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs bg-slate-50 p-3 rounded-lg border border-slate-100">
                  <div>
                    <span className="text-slate-400 block">Database</span>
                    <span className="font-mono font-semibold text-slate-800">{status?.database || 'sn_travels_visa'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Host:Port</span>
                    <span className="font-mono font-semibold text-slate-800">{status?.host}:{status?.port || 3306}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Clients Stored</span>
                    <span className="font-bold text-sky-700">{status?.records?.clients || 0} records</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Applications</span>
                    <span className="font-bold text-emerald-700">{status?.records?.applications || 0} cases</span>
                  </div>
                </div>
              </div>

              {/* phpMyAdmin Instructions */}
              <div className="p-4 rounded-xl border border-sky-100 bg-sky-50/50 space-y-3">
                <h3 className="font-bold text-sm text-sky-950 flex items-center gap-2">
                  <span>How to Import into phpMyAdmin</span>
                </h3>
                <ol className="text-xs text-sky-900 space-y-2 list-decimal list-inside leading-relaxed">
                  <li>
                    Open your <strong>phpMyAdmin</strong> dashboard at your server or hosting control panel.
                  </li>
                  <li>
                    Create a new database named <code className="bg-white px-1.5 py-0.5 rounded font-mono border border-sky-200">sn_travels_visa</code> with collation <code className="bg-white px-1.5 py-0.5 rounded font-mono border border-sky-200">utf8mb4_unicode_ci</code>.
                  </li>
                  <li>
                    Click the <strong>Import</strong> tab at the top of phpMyAdmin.
                  </li>
                  <li>
                    Upload <code className="bg-white px-1.5 py-0.5 rounded font-mono border border-sky-200">database/schema.sql</code> (or copy from the tab above) and click <strong>Go</strong>.
                  </li>
                  <li>
                    Upload <code className="bg-white px-1.5 py-0.5 rounded font-mono border border-sky-200">database/seed.sql</code> to populate default users, China visa types, and sample clients.
                  </li>
                  <li>
                    Configure the environment variables in your server environment:
                    <pre className="mt-2 p-2.5 bg-slate-900 text-sky-300 rounded-lg font-mono text-[11px] overflow-x-auto">
{`DB_HOST=localhost
DB_PORT=3306
DB_NAME=sn_travels_visa
DB_USER=sn_travels_user
DB_PASSWORD=your_password`}
                    </pre>
                  </li>
                </ol>
              </div>
            </div>
          )}

          {activeTab === 'schema' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500 font-mono">database/schema.sql (MySQL 8.0+ / MariaDB)</span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => copyToClipboard(schemaSql, 'schema')}
                    className="px-2.5 py-1 bg-white border border-slate-200 hover:bg-slate-50 rounded text-xs font-medium text-slate-700 flex items-center gap-1.5"
                  >
                    {copied === 'schema' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copied === 'schema' ? 'Copied!' : 'Copy SQL'}</span>
                  </button>
                  <button
                    onClick={() => downloadFile(schemaSql, 'schema.sql')}
                    className="px-2.5 py-1 bg-sky-700 hover:bg-sky-800 text-white rounded text-xs font-medium flex items-center gap-1.5"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download schema.sql</span>
                  </button>
                </div>
              </div>
              <pre className="p-4 bg-slate-900 text-slate-100 rounded-xl font-mono text-xs overflow-x-auto max-h-96 leading-relaxed">
                {schemaSql || '-- Loading schema.sql...'}
              </pre>
            </div>
          )}

          {activeTab === 'seed' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500 font-mono">database/seed.sql (Sample Clients, Applications, Tasks)</span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => copyToClipboard(seedSql, 'seed')}
                    className="px-2.5 py-1 bg-white border border-slate-200 hover:bg-slate-50 rounded text-xs font-medium text-slate-700 flex items-center gap-1.5"
                  >
                    {copied === 'seed' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copied === 'seed' ? 'Copied!' : 'Copy SQL'}</span>
                  </button>
                  <button
                    onClick={() => downloadFile(seedSql, 'seed.sql')}
                    className="px-2.5 py-1 bg-sky-700 hover:bg-sky-800 text-white rounded text-xs font-medium flex items-center gap-1.5"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download seed.sql</span>
                  </button>
                </div>
              </div>
              <pre className="p-4 bg-slate-900 text-slate-100 rounded-xl font-mono text-xs overflow-x-auto max-h-96 leading-relaxed">
                {seedSql || '-- Loading seed.sql...'}
              </pre>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between shrink-0">
          <div className="text-xs text-slate-500">
            Strict MySQL / phpMyAdmin architecture as specified in project requirements.
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-xs font-semibold"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
