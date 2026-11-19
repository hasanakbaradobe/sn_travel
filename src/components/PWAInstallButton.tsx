import React, { useState } from 'react';
import {
  Smartphone,
  Download,
  Share,
  PlusSquare,
  MoreVertical,
  X,
  Check,
  Copy,
  CheckCircle2,
} from 'lucide-react';
import { usePWAInstall, useOnlineStatus } from '../hooks/usePWAInstall';

interface PWAInstallButtonProps {
  variant?: 'header' | 'sidebar';
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({ variant = 'header' }) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showGuideModal, setShowGuideModal] = useState(false);
  const [activeDeviceTab, setActiveDeviceTab] = useState<'android' | 'ios'>(
    isIOS ? 'ios' : 'android'
  );
  const [copiedUrl, setCopiedUrl] = useState(false);

  if (isInstalled) {
    return null;
  }

  const handleInstallClick = async () => {
    if (isInstallable) {
      const installed = await install();
      if (installed) return;
    }
    setActiveDeviceTab(isIOS ? 'ios' : 'android');
    setShowGuideModal(true);
  };

  const handleCopyAppUrl = () => {
    const url = window.location.origin;
    navigator.clipboard.writeText(url).then(() => {
      setCopiedUrl(true);
      setTimeout(() => setCopiedUrl(false), 2500);
    });
  };

  return (
    <>
      {variant === 'sidebar' ? (
        <button
          type="button"
          onClick={handleInstallClick}
          className="w-full mb-2.5 flex items-center justify-between px-3 py-2.5 rounded-xl bg-gradient-to-r from-sky-600 to-cyan-600 hover:from-sky-500 hover:to-cyan-500 text-white text-xs font-bold shadow-md shadow-sky-950/50 transition active:scale-[0.98] cursor-pointer"
        >
          <span className="flex items-center gap-2">
            <Smartphone className="w-4 h-4 shrink-0" />
            <span>Install Mobile App</span>
          </span>
          <Download className="w-3.5 h-3.5 shrink-0 opacity-90" />
        </button>
      ) : (
        <button
          type="button"
          onClick={handleInstallClick}
          title="Install SN Travels App on Mobile or Desktop"
          className="flex items-center gap-1.5 px-2.5 sm:px-3 py-2 sm:py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl sm:rounded-lg text-xs font-semibold shadow-xs transition active:scale-95 cursor-pointer"
        >
          <Smartphone className="w-3.5 h-3.5 shrink-0" />
          <span className="hidden xl:inline">Install App</span>
        </button>
      )}

      {showGuideModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-150"
          onClick={() => setShowGuideModal(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl bg-white border border-slate-200 shadow-2xl overflow-hidden text-slate-900 animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="bg-slate-900 text-white px-5 py-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white p-1 flex items-center justify-center shrink-0">
                  <img
                    src="https://lh3.googleusercontent.com/d/1wJCY1RJCq0hASsYGGRnScbXDOW9YdPsM"
                    alt="SN Travels Logo"
                    className="w-full h-full object-contain"
                    referrerPolicy="no-referrer"
                  />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white leading-tight">
                    Install SN Travels Mobile App
                  </h3>
                  <p className="text-[11px] text-sky-400">
                    Add directly to your phone&apos;s Home Screen
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowGuideModal(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              {/* Native 1-Click Install if browser supports beforeinstallprompt */}
              {isInstallable && (
                <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 space-y-2.5">
                  <div className="flex items-center gap-2 text-xs font-bold text-emerald-950">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>Ready for 1-Tap Installation</span>
                  </div>
                  <button
                    type="button"
                    onClick={async () => {
                      const ok = await install();
                      if (ok) setShowGuideModal(false);
                    }}
                    className="w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-sm flex items-center justify-center gap-2 transition cursor-pointer"
                  >
                    <Download className="w-4 h-4" />
                    <span>Install App Now</span>
                  </button>
                </div>
              )}

              {/* App Link Copy Bar */}
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Step 1: Open this link in your mobile browser
                  </div>
                  <div className="text-xs font-mono text-slate-700 truncate mt-0.5">
                    {typeof window !== 'undefined' ? window.location.origin : ''}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleCopyAppUrl}
                  className="shrink-0 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
                >
                  {copiedUrl ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy Link</span>
                    </>
                  )}
                </button>
              </div>

              {/* Platform Switcher Tabs */}
              <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-100 rounded-xl">
                <button
                  type="button"
                  onClick={() => setActiveDeviceTab('android')}
                  className={`py-2 px-3 rounded-lg text-xs font-bold transition cursor-pointer ${
                    activeDeviceTab === 'android'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Android (Chrome)
                </button>
                <button
                  type="button"
                  onClick={() => setActiveDeviceTab('ios')}
                  className={`py-2 px-3 rounded-lg text-xs font-bold transition cursor-pointer ${
                    activeDeviceTab === 'ios'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  iPhone / iPad (Safari)
                </button>
              </div>

              {/* Platform Instructions */}
              {activeDeviceTab === 'android' ? (
                <div className="space-y-2.5 text-xs text-slate-700">
                  <div className="flex items-start gap-3 p-3 rounded-xl bg-slate-50 border border-slate-200/80">
                    <span className="w-6 h-6 rounded-full bg-sky-600 text-white font-bold text-xs flex items-center justify-center shrink-0">
                      1
                    </span>
                    <div>
                      <span className="font-bold text-slate-900 block">Open in Google Chrome</span>
                      <span>
                        Open the app link in <strong>Google Chrome</strong> on your Android phone.
                      </span>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 p-3 rounded-xl bg-slate-50 border border-slate-200/80">
                    <span className="w-6 h-6 rounded-full bg-sky-600 text-white font-bold text-xs flex items-center justify-center shrink-0">
                      2
                    </span>
                    <div>
                      <span className="font-bold text-slate-900 flex items-center gap-1">
                        Tap the 3-Dots Menu <MoreVertical className="w-3.5 h-3.5 inline text-slate-600" />
                      </span>
                      <span>
                        Tap the menu icon in the top-right corner of Chrome and select{' '}
                        <strong>&ldquo;Install app&rdquo;</strong> or{' '}
                        <strong>&ldquo;Add to Home screen&rdquo;</strong>.
                      </span>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 p-3 rounded-xl bg-slate-50 border border-slate-200/80">
                    <span className="w-6 h-6 rounded-full bg-sky-600 text-white font-bold text-xs flex items-center justify-center shrink-0">
                      3
                    </span>
                    <div>
                      <span className="font-bold text-slate-900 block">Launch from Home Screen</span>
                      <span>
                        Tap <strong>Install</strong>. The <strong>SN Travels</strong> app icon will
                        appear on your phone like a native app!
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-2.5 text-xs text-slate-700">
                  <div className="flex items-start gap-3 p-3 rounded-xl bg-slate-50 border border-slate-200/80">
                    <span className="w-6 h-6 rounded-full bg-sky-600 text-white font-bold text-xs flex items-center justify-center shrink-0">
                      1
                    </span>
                    <div>
                      <span className="font-bold text-slate-900 block">Open in Safari</span>
                      <span>
                        Open the app link in the <strong>Safari</strong> browser on your iPhone or
                        iPad.
                      </span>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 p-3 rounded-xl bg-slate-50 border border-slate-200/80">
                    <span className="w-6 h-6 rounded-full bg-sky-600 text-white font-bold text-xs flex items-center justify-center shrink-0">
                      2
                    </span>
                    <div>
                      <span className="font-bold text-slate-900 flex items-center gap-1">
                        Tap the Share Button <Share className="w-3.5 h-3.5 inline text-sky-600" />
                      </span>
                      <span>
                        Tap the <strong>Share</strong> icon (square with an upward arrow) at the
                        bottom of Safari.
                      </span>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 p-3 rounded-xl bg-slate-50 border border-slate-200/80">
                    <span className="w-6 h-6 rounded-full bg-sky-600 text-white font-bold text-xs flex items-center justify-center shrink-0">
                      3
                    </span>
                    <div>
                      <span className="font-bold text-slate-900 flex items-center gap-1">
                        Tap &ldquo;Add to Home Screen&rdquo;{' '}
                        <PlusSquare className="w-3.5 h-3.5 inline text-slate-700" />
                      </span>
                      <span>
                        Scroll down the share sheet, tap <strong>Add to Home Screen</strong>, then
                        tap <strong>Add</strong> in the top-right corner.
                      </span>
                    </div>
                  </div>
                </div>
              )}

              <button
                type="button"
                onClick={() => setShowGuideModal(false)}
                className="w-full py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-xs font-bold text-slate-700 transition cursor-pointer"
              >
                Got It
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div className="fixed bottom-16 lg:bottom-4 left-4 z-50 flex items-center gap-2 rounded-xl bg-amber-500 px-3.5 py-2 text-xs font-bold text-white shadow-lg">
      <span className="h-2 w-2 rounded-full bg-white animate-pulse" />
      <span>Offline Mode — Using cached data</span>
    </div>
  );
};
