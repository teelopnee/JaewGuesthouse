/**
 * AppDataContext
 * The only place the page talks to the server. Holds the shared state (room settings,
 * photos, pricing mode, page text, bookings) and every admin action. Each action waits
 * for the server and then shows exactly what the server saved, so what the admin sees
 * is always what customers see.
 */

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  BookingRecord,
  CreativeElementsState,
  GuesthouseConfig,
  PricingMode,
  RoomItem,
  RoomOverride,
  ServerConfig,
  ServerState,
} from '../types';
import { ROOMS_DATA } from '../data/roomsData';
import { GUESTHOUSE_CONFIG } from '../data/config';
import { apiRequest, ApiError, getAdminToken, setAdminToken } from '../services/api';
import { useToast } from './ToastContext';

// Customers check for new availability every 30 s, the admin every 10 s
// (Cloudflare's free plan allows 100,000 requests a day).
const POLL_MS_GUEST = 30_000;
const POLL_MS_ADMIN = 10_000;
const POLL_MS_ON_ERROR = 30_000;
const pollMs = () => (getAdminToken() ? POLL_MS_ADMIN : POLL_MS_GUEST);
const CACHE_KEY = 'jaew_public_state_v2';

const EMPTY_CONFIG: ServerConfig = {
  roomOverrides: {},
  guesthouseConfig: {},
  pricingMode: 'full',
  creativeOverrides: {},
  roomImages: {},
  isDefaultPin: true,
};

function readCachedState(): ServerState | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ServerState;
    if (parsed && parsed.config && Array.isArray(parsed.bookings)) {
      return { ...parsed, isAdmin: false };
    }
  } catch {
    // ignore
  }
  return null;
}

function writeCachedState(state: ServerState) {
  if (state.isAdmin) return; // never cache guests' personal data on this device
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(state));
  } catch {
    // quota / private mode - not important
  }
}

/** Default room data + the admin's saved changes. */
export function applyRoomOverrides(overrides: Record<string, RoomOverride>): RoomItem[] {
  return ROOMS_DATA.map((room) => {
    const override = overrides[room.id];
    if (!override) return room;
    return {
      ...room,
      ...override,
      prices: { ...room.prices, ...(override.prices || {}) },
      badges: override.badges || room.badges,
      amenities: override.amenities || room.amenities,
      isHiddenFromRental: Boolean(override.isHiddenFromRental),
    };
  });
}

interface AppDataContextType {
  isReady: boolean;
  isLoading: boolean;
  isOffline: boolean;
  lastSyncedTime: Date;
  isAdmin: boolean;
  config: ServerConfig;
  guesthouse: GuesthouseConfig;
  rooms: RoomItem[];
  bookings: BookingRecord[];
  logbookOk: boolean;

  refresh: (manual?: boolean) => Promise<void>;
  login: (pin: string) => Promise<void>;
  logout: () => void;
  changePin: (currentPin: string, newPin: string) => Promise<void>;
  setPricingMode: (mode: PricingMode) => Promise<void>;
  toggleRoomRental: (roomId: string, isHidden: boolean) => Promise<void>;
  saveRoomOverride: (roomId: string, override: RoomOverride) => Promise<void>;
  saveBulkRoomOverrides: (roomIds: string[], override: RoomOverride) => Promise<void>;
  resetRoomOverride: (roomId: string) => Promise<void>;
  saveGuesthouseSettings: (cfg: Partial<GuesthouseConfig>) => Promise<void>;
  resetAllSettings: () => Promise<void>;
  saveCreativeOverrides: (overrides: CreativeElementsState) => Promise<void>;
  uploadImage: (dataUrl: string) => Promise<string>;
  saveRoomImages: (roomId: string, images: string[]) => Promise<void>;
  resetRoomImages: (roomId: string) => Promise<void>;
  createBooking: (data: Partial<BookingRecord>) => Promise<void>;
  updateBooking: (id: string, data: Partial<BookingRecord>) => Promise<void>;
  deleteBooking: (id: string) => Promise<void>;
  deleteBookings: (ids: string[]) => Promise<void>;
  clearAllBookings: () => Promise<void>;
  downloadBackup: () => Promise<void>;
}

const AppDataContext = createContext<AppDataContextType | null>(null);

export const AppDataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { showToast } = useToast();
  const [state, setState] = useState<ServerState | null>(() => readCachedState());
  const [isReady, setIsReady] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isOffline, setIsOffline] = useState(false);
  const [lastSyncedTime, setLastSyncedTime] = useState<Date>(new Date());
  const [hasToken, setHasToken] = useState<boolean>(() => Boolean(getAdminToken()));

  const stateRef = useRef<ServerState | null>(state);
  // Bumped by every admin change so a slower poll started earlier can't overwrite fresher data.
  const changeSeq = useRef(0);
  const pollTimer = useRef<number | undefined>(undefined);
  const inFlight = useRef(false);

  const applyState = useCallback((next: ServerState) => {
    const prev = stateRef.current;
    if (!prev || prev.rev !== next.rev || prev.isAdmin !== next.isAdmin || prev.sync.ok !== next.sync.ok) {
      stateRef.current = next;
      setState(next);
      writeCachedState(next);
    }
    setIsReady(true);
    setIsOffline(false);
    setLastSyncedTime(new Date());
  }, []);

  const handleAuthLoss = useCallback(() => {
    setAdminToken(null);
    setHasToken(false);
    showToast('เซสชันแอดมินหมดอายุ กรุณาใส่รหัส PIN อีกครั้ง', 'error');
  }, [showToast]);

  const fetchState = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    const seqAtStart = changeSeq.current;
    const hadToken = Boolean(getAdminToken());
    try {
      const next = await apiRequest<ServerState>('/api/state', { timeoutMs: 12000 });
      if (seqAtStart !== changeSeq.current) return; // an admin change landed meanwhile
      if (hadToken && !next.isAdmin) handleAuthLoss();
      applyState(next);
    } finally {
      inFlight.current = false;
    }
  }, [applyState, handleAuthLoss]);

  const schedulePoll = useCallback(
    (delay: number) => {
      window.clearTimeout(pollTimer.current);
      pollTimer.current = window.setTimeout(async () => {
        if (document.visibilityState === 'hidden') {
          schedulePoll(pollMs());
          return;
        }
        try {
          await fetchState();
          schedulePoll(pollMs());
        } catch {
          setIsOffline(true);
          schedulePoll(POLL_MS_ON_ERROR);
        }
      }, delay);
    },
    [fetchState]
  );

  const refresh = useCallback(
    async (manual = false) => {
      if (manual) setIsLoading(true);
      try {
        await fetchState();
      } catch (err) {
        setIsOffline(true);
        if (manual) showToast((err as Error).message, 'error');
      } finally {
        setIsLoading(false);
        schedulePoll(pollMs());
      }
    },
    [fetchState, schedulePoll, showToast]
  );

  useEffect(() => {
    refresh(true);
    const onVisible = () => {
      if (document.visibilityState === 'visible') refresh(false);
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('online', onVisible);
    return () => {
      window.clearTimeout(pollTimer.current);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('online', onVisible);
    };
  }, [refresh]);

  /** Runs an admin request and applies the state the server returns. */
  const mutate = useCallback(
    async <T,>(path: string, method: string, body?: unknown, pick?: (res: T) => ServerState): Promise<T> => {
      changeSeq.current += 1;
      try {
        const res = await apiRequest<T>(path, { method, body, timeoutMs: 30000 });
        const next = pick ? pick(res) : (res as unknown as ServerState);
        if (next && next.config) applyState(next);
        return res;
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) {
          handleAuthLoss();
          refresh(false);
        }
        throw err;
      }
    },
    [applyState, handleAuthLoss, refresh]
  );

  const login = useCallback(
    async (pin: string) => {
      const res = await apiRequest<{ token: string; expiresAt: number }>('/api/admin/login', {
        method: 'POST',
        body: { pin },
        auth: false,
      });
      setAdminToken(res.token, res.expiresAt);
      setHasToken(true);
      changeSeq.current += 1;
      try {
        applyState(await apiRequest<ServerState>('/api/state'));
      } catch {
        // the regular poll will pick it up
      }
    },
    [applyState]
  );

  const logout = useCallback(() => {
    setAdminToken(null);
    setHasToken(false);
    changeSeq.current += 1;
    try {
      localStorage.removeItem(CACHE_KEY);
    } catch {}
    // Drop the admin-only booking details from memory straight away.
    setState((prev) => (prev ? { ...prev, isAdmin: false, bookings: [] } : prev));
    stateRef.current = stateRef.current ? { ...stateRef.current, isAdmin: false, rev: '' } : null;
    refresh(false);
  }, [refresh]);

  const changePin = useCallback(
    async (currentPin: string, newPin: string) => {
      const res = await mutate<{ token: string; expiresAt: number; state: ServerState }>(
        '/api/admin/change-pin',
        'POST',
        { currentPin, newPin },
        (r) => r.state
      );
      setAdminToken(res.token, res.expiresAt);
    },
    [mutate]
  );

  const actions = useMemo(
    () => ({
      setPricingMode: (mode: PricingMode) => mutate('/api/admin/pricing-mode', 'PUT', { mode }).then(() => {}),
      toggleRoomRental: (roomId: string, isHidden: boolean) =>
        mutate(`/api/admin/rooms/${encodeURIComponent(roomId)}`, 'PUT', {
          override: { isHiddenFromRental: isHidden },
        }).then(() => {}),
      saveRoomOverride: (roomId: string, override: RoomOverride) =>
        mutate(`/api/admin/rooms/${encodeURIComponent(roomId)}`, 'PUT', { override }).then(() => {}),
      saveBulkRoomOverrides: (roomIds: string[], override: RoomOverride) =>
        mutate('/api/admin/rooms/bulk', 'POST', { roomIds, override }).then(() => {}),
      resetRoomOverride: (roomId: string) =>
        mutate(`/api/admin/rooms/${encodeURIComponent(roomId)}`, 'DELETE').then(() => {}),
      saveGuesthouseSettings: (cfg: Partial<GuesthouseConfig>) =>
        mutate('/api/admin/guesthouse', 'PUT', { config: cfg }).then(() => {}),
      resetAllSettings: () => mutate('/api/admin/reset-all', 'POST').then(() => {}),
      saveCreativeOverrides: (overrides: CreativeElementsState) =>
        mutate('/api/admin/creative', 'PUT', { overrides }).then(() => {}),
      uploadImage: async (dataUrl: string) => {
        const res = await apiRequest<{ url: string }>('/api/admin/upload', {
          method: 'POST',
          body: { dataUrl },
          timeoutMs: 60000,
        });
        return res.url;
      },
      saveRoomImages: (roomId: string, images: string[]) =>
        mutate(`/api/admin/room-images/${encodeURIComponent(roomId)}`, 'PUT', { images }).then(() => {}),
      resetRoomImages: (roomId: string) =>
        mutate(`/api/admin/room-images/${encodeURIComponent(roomId)}`, 'DELETE').then(() => {}),
      createBooking: (data: Partial<BookingRecord>) =>
        mutate<{ state: ServerState }>('/api/admin/bookings', 'POST', data, (r) => r.state).then(() => {}),
      updateBooking: (id: string, data: Partial<BookingRecord>) =>
        mutate<{ state: ServerState }>(`/api/admin/bookings/${encodeURIComponent(id)}`, 'PUT', data, (r) => r.state).then(
          () => {}
        ),
      deleteBooking: (id: string) =>
        mutate(`/api/admin/bookings/${encodeURIComponent(id)}`, 'DELETE').then(() => {}),
      deleteBookings: (ids: string[]) => mutate('/api/admin/bookings/delete-many', 'POST', { ids }).then(() => {}),
      clearAllBookings: () => mutate('/api/admin/bookings/clear', 'POST').then(() => {}),
      downloadBackup: async () => {
        const data = await apiRequest<unknown>('/api/admin/backup', { timeoutMs: 60000 });
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `jaew-backup-${new Date().toISOString().slice(0, 10)}.json`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      },
    }),
    [mutate]
  );

  const config = state?.config || EMPTY_CONFIG;
  const isAdmin = Boolean(hasToken && state?.isAdmin);

  const guesthouse = useMemo<GuesthouseConfig>(() => {
    const merged = { ...GUESTHOUSE_CONFIG };
    for (const [k, v] of Object.entries(config.guesthouseConfig || {})) {
      if (typeof v === 'string' && v.trim() !== '') (merged as Record<string, string>)[k] = v;
    }
    return merged;
  }, [config.guesthouseConfig]);

  const rooms = useMemo(() => applyRoomOverrides(config.roomOverrides || {}), [config.roomOverrides]);

  const value: AppDataContextType = {
    isReady,
    isLoading,
    isOffline,
    lastSyncedTime,
    isAdmin,
    config,
    guesthouse,
    rooms,
    bookings: state?.bookings || [],
    logbookOk: Boolean(state?.sync?.ok),
    refresh,
    login,
    logout,
    changePin,
    ...actions,
  };

  return <AppDataContext.Provider value={value}>{children}</AppDataContext.Provider>;
};

export function useAppData(): AppDataContextType {
  const ctx = useContext(AppDataContext);
  if (!ctx) throw new Error('useAppData must be used within AppDataProvider');
  return ctx;
}

/** Shortcut for components that only need the guesthouse contact info. */
export function useGuesthouse(): GuesthouseConfig {
  return useAppData().guesthouse;
}
