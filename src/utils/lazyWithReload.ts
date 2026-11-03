import { lazy, ComponentType } from 'react';

const RELOAD_KEY = 'jaew_chunk_reload_at';

/**
 * React.lazy for a named export. If the file can't be downloaded - usually because the site
 * was updated while this page was open and the old file no longer exists - reload the page
 * once to pick up the new version instead of showing an error.
 */
export function lazyNamed<T extends ComponentType<any>>(
  factory: () => Promise<Record<string, unknown>>,
  name: string
) {
  return lazy(async () => {
    try {
      const mod = await factory();
      return { default: mod[name] as T };
    } catch (err) {
      let last = 0;
      try {
        last = Number(sessionStorage.getItem(RELOAD_KEY) || 0);
      } catch {}
      if (Date.now() - last > 60_000) {
        try {
          sessionStorage.setItem(RELOAD_KEY, String(Date.now()));
        } catch {}
        window.location.reload();
        return new Promise<never>(() => {});
      }
      throw err;
    }
  });
}
