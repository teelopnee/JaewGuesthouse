import React, { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Share2, Copy, Check, Send } from 'lucide-react';
import { useGuesthouse } from '../context/AppDataContext';
import { copyText } from '../utils/clipboard';
import { useEscapeKey } from '../hooks/useEscapeKey';

interface FloatingShareButtonProps {
  guesthouseName?: string;
  variant?: 'floating' | 'header';
}

const canNativeShare = () => typeof navigator !== 'undefined' && typeof navigator.share === 'function';

export const FloatingShareButton: React.FC<FloatingShareButtonProps> = ({ guesthouseName, variant = 'floating' }) => {
  const gh = useGuesthouse();
  const name = guesthouseName || gh.name;
  const [copied, setCopied] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [menuPos, setMenuPos] = useState<{ top: number; right: number }>({ top: 56, right: 12 });
  const buttonRef = useRef<HTMLButtonElement>(null);
  useEscapeKey(showMenu, () => setShowMenu(false));

  const pageUrl = () => window.location.href.split('#')[0];

  const handleShare = async () => {
    const shareData = { title: name, text: `${name} - ที่พักแหลมแท่น ข้ามถนนถึงทะเล ห่างหาดบางแสน 300 ม.`, url: pageUrl() };
    if (canNativeShare()) {
      try {
        await navigator.share(shareData);
        return;
      } catch (err) {
        if ((err as Error).name === 'AbortError') return;
      }
    }
    openMenu();
  };

  const openMenu = () => {
    const rect = buttonRef.current?.getBoundingClientRect();
    if (rect) {
      setMenuPos({ top: rect.bottom + 8, right: Math.max(8, window.innerWidth - rect.right) });
    }
    setShowMenu(true);
  };

  const handleCopyLink = async () => {
    const ok = await copyText(pageUrl());
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
    setTimeout(() => setShowMenu(false), 600);
  };

  const handleLineShare = () => {
    window.open(`https://social-plugins.line.me/lineit/share?url=${encodeURIComponent(pageUrl())}`, '_blank', 'noopener');
    setShowMenu(false);
  };

  const handleFacebookShare = () => {
    window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(pageUrl())}`, '_blank', 'noopener');
    setShowMenu(false);
  };

  const menuContent = (
    <>
      <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-100">
        <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
          <Share2 className="w-3.5 h-3.5 text-sky-600" />
          แชร์ที่พักนี้ให้เพื่อน
        </span>
        <button
          onClick={() => setShowMenu(false)}
          className="text-slate-400 hover:text-slate-600 text-xs font-bold px-1.5 py-0.5 rounded-full hover:bg-slate-100 cursor-pointer"
          aria-label="ปิด"
        >
          ✕
        </button>
      </div>

      <div className="space-y-1.5">
        {canNativeShare() && (
          <button
            onClick={() => {
              setShowMenu(false);
              navigator.share({ title: name, url: pageUrl() }).catch(() => {});
            }}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl bg-sky-50 hover:bg-sky-100 text-sky-900 text-xs font-bold transition-all cursor-pointer"
          >
            <Send className="w-4 h-4 text-sky-600 shrink-0" />
            <span>แชร์ผ่านระบบมือถือ / แอปโซเชียล</span>
          </button>
        )}

        <button
          onClick={handleCopyLink}
          className="w-full flex items-center justify-between px-3 py-2 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-800 text-xs font-semibold transition-all cursor-pointer"
        >
          <div className="flex items-center gap-2.5">
            {copied ? <Check className="w-4 h-4 text-emerald-600 shrink-0" /> : <Copy className="w-4 h-4 text-slate-500 shrink-0" />}
            <span>{copied ? 'คัดลอกลิงก์สำเร็จ!' : 'คัดลอกลิงก์เว็บ'}</span>
          </div>
          {copied && (
            <span className="text-[10px] bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded-full font-bold">คัดลอกแล้ว</span>
          )}
        </button>

        <button
          onClick={handleLineShare}
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl bg-[#06C755]/10 hover:bg-[#06C755]/20 text-[#06C755] text-xs font-bold transition-all cursor-pointer"
        >
          <div className="w-4 h-4 rounded-full bg-[#06C755] text-white flex items-center justify-center text-[10px] font-black shrink-0">
            L
          </div>
          <span>แชร์ไปที่ LINE</span>
        </button>

        <button
          onClick={handleFacebookShare}
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-bold transition-all cursor-pointer"
        >
          <div className="w-4 h-4 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px] font-black shrink-0">
            f
          </div>
          <span>แชร์ไปที่ Facebook</span>
        </button>
      </div>
    </>
  );

  if (variant === 'header') {
    return (
      <>
        <button
          ref={buttonRef}
          onClick={() => (showMenu ? setShowMenu(false) : openMenu())}
          className="flex items-center justify-center w-8 h-8 rounded-lg hover:bg-slate-100 active:scale-95 text-slate-700 transition-all touch-manipulation cursor-pointer border border-slate-200 bg-white shrink-0"
          title="แชร์ที่พัก"
          aria-label="แชร์ที่พัก"
        >
          <Share2 className="w-4 h-4 text-slate-600" />
        </button>
        {showMenu &&
          createPortal(
            <>
              <div className="fixed inset-0 z-[55]" onClick={() => setShowMenu(false)} aria-hidden="true" />
              <div
                className="fixed z-[56] w-64 bg-white/95 backdrop-blur-md rounded-2xl shadow-2xl border border-slate-200/90 p-3 animate-in fade-in slide-in-from-top-3"
                style={{ top: menuPos.top, right: menuPos.right }}
              >
                {menuContent}
              </div>
            </>,
            document.body
          )}
      </>
    );
  }

  return (
    <>
      <div className="fixed right-4 top-4 z-50 flex flex-col items-end">
        {showMenu && (
          <div className="mb-2 w-64 bg-white/95 backdrop-blur-md rounded-2xl shadow-2xl border border-slate-200/90 p-3 animate-in fade-in slide-in-from-bottom-3">
            {menuContent}
          </div>
        )}

        <button
          ref={buttonRef}
          onClick={() => {
            if (canNativeShare() && !showMenu) handleShare();
            else setShowMenu(!showMenu);
          }}
          onContextMenu={(e) => {
            e.preventDefault();
            setShowMenu(!showMenu);
          }}
          className="group relative flex items-center gap-2 bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-500 hover:to-indigo-500 text-white px-4 py-3 rounded-full shadow-[0_10px_25px_rgba(14,165,233,0.4)] active:scale-95 transition-all duration-300 cursor-pointer touch-manipulation font-bold text-xs sm:text-sm border border-white/20"
          title="แชร์ที่พัก"
          id="floating-share-btn"
        >
          <Share2 className="w-4 h-4 sm:w-5 sm:h-5" />
          <span className="hidden sm:inline">แชร์ที่พัก</span>
          <span className="sm:hidden font-bold">แชร์</span>
        </button>
      </div>

      {showMenu && <div className="fixed inset-0 z-40 bg-transparent" onClick={() => setShowMenu(false)} />}
    </>
  );
};
