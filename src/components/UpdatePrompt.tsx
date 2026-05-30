import { useRegisterSW } from 'virtual:pwa-register/react';

export default function UpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW();

  if (!needRefresh) return null;

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 w-[calc(100%-2rem)] max-w-sm">
      <div className="flex items-center justify-between gap-3 rounded-2xl border border-white/70 dark:border-white/[0.10] bg-white/90 dark:bg-[#1a1a2e]/95 backdrop-blur-xl shadow-xl px-4 py-3">
        <p className="text-sm text-gray-700 dark:text-gray-200">
          A new version is available.
        </p>
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setNeedRefresh(false)}
            className="rounded-xl px-3 py-1.5 text-xs font-medium text-gray-500 dark:text-gray-400 hover:bg-black/[0.04] dark:hover:bg-white/[0.04] transition-colors focus:outline-none"
          >
            Dismiss
          </button>
          <button
            type="button"
            onClick={() => updateServiceWorker(true)}
            className="rounded-xl bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-500 transition-colors focus:outline-none shadow-sm shadow-indigo-500/20"
          >
            Update
          </button>
        </div>
      </div>
    </div>
  );
}
