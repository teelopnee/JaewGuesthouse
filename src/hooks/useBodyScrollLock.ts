import { useEffect } from 'react';

// Several modals can be open at once (e.g. room details + LINE QR). Count them so
// closing one doesn't unlock page scrolling while another is still open.
let openCount = 0;

export function useBodyScrollLock(active: boolean) {
  useEffect(() => {
    if (!active) return;
    openCount += 1;
    document.body.style.overflow = 'hidden';
    return () => {
      openCount = Math.max(0, openCount - 1);
      if (openCount === 0) document.body.style.overflow = '';
    };
  }, [active]);
}
