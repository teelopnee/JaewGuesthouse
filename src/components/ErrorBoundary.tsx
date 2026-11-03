import React from 'react';
import { GUESTHOUSE_CONFIG } from '../data/config';

interface State {
  hasError: boolean;
}

/** If anything on the page crashes, customers still get a way to contact the guesthouse. */
export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: unknown) {
    console.error('Page crashed:', error);
  }

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
        <div className="max-w-sm w-full bg-white rounded-3xl border border-slate-200 shadow-sm p-6 text-center space-y-4">
          <div className="text-4xl">🌊</div>
          <h1 className="font-extrabold text-slate-900 text-lg">{GUESTHOUSE_CONFIG.name}</h1>
          <p className="text-sm text-slate-600">หน้าเว็บโหลดไม่สำเร็จ กรุณาลองใหม่ หรือติดต่อจองห้องพักได้โดยตรง</p>
          <div className="space-y-2">
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="w-full py-3 rounded-2xl bg-sky-600 hover:bg-sky-500 text-white font-bold text-sm cursor-pointer"
            >
              โหลดหน้าเว็บใหม่
            </button>
            <a
              href={GUESTHOUSE_CONFIG.lineOaUrl}
              className="block w-full py-3 rounded-2xl bg-[#06C755] text-white font-bold text-sm"
            >
              ทัก LINE {GUESTHOUSE_CONFIG.lineId}
            </a>
            <a
              href={`tel:${GUESTHOUSE_CONFIG.phonePrimary}`}
              className="block w-full py-3 rounded-2xl bg-slate-100 text-slate-800 font-bold text-sm"
            >
              โทร {GUESTHOUSE_CONFIG.phonePrimaryDisplay}
            </a>
          </div>
        </div>
      </div>
    );
  }
}
