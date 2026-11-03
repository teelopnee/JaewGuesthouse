/**
 * Canva-style creative mode: the admin can change text, size and colours of marked
 * elements on the page. Changes are saved to the server (shared with every customer),
 * not just the admin's own browser.
 */

import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { CreativeElementOverride, CreativeElementsState } from '../types';
import { useAppData } from './AppDataContext';
import { useToast } from './ToastContext';

interface CreativeContextType {
  isCreativeMode: boolean;
  setIsCreativeMode: (val: boolean) => void;
  selectedId: string | null;
  setSelectedId: (id: string | null) => void;
  overrides: CreativeElementsState;
  updateOverride: (id: string, partial: Partial<CreativeElementOverride>) => void;
  resetOverrides: () => void;
  getOverride: (id: string) => CreativeElementOverride | undefined;
  isSaving: boolean;
}

const CreativeContext = createContext<CreativeContextType | undefined>(undefined);

const SAVE_DELAY_MS = 800;

export const CreativeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { config, isAdmin, saveCreativeOverrides } = useAppData();
  const { showToast } = useToast();
  const [isCreativeModeRaw, setIsCreativeMode] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [overrides, setOverrides] = useState<CreativeElementsState>(config.creativeOverrides || {});
  const [isSaving, setIsSaving] = useState(false);
  const dirty = useRef(false);
  const saveTimer = useRef<number | undefined>(undefined);
  const inFlight = useRef(false);
  const latest = useRef(overrides);

  // Creative mode is an admin tool only.
  const isCreativeMode = isCreativeModeRaw && isAdmin;

  useEffect(() => {
    if (!isAdmin) {
      setIsCreativeMode(false);
      setSelectedId(null);
    }
  }, [isAdmin]);

  // Follow the server unless the admin has edits that are not saved yet.
  useEffect(() => {
    if (!dirty.current) {
      setOverrides(config.creativeOverrides || {});
      latest.current = config.creativeOverrides || {};
    }
  }, [config.creativeOverrides]);

  const flush = useCallback(async () => {
    window.clearTimeout(saveTimer.current);
    // A save already running picks up newer edits itself when it finishes.
    if (!dirty.current || inFlight.current) return;
    inFlight.current = true;
    setIsSaving(true);
    try {
      for (;;) {
        const snapshot = latest.current;
        try {
          await saveCreativeOverrides(snapshot);
        } catch (err) {
          showToast(`บันทึกการตกแต่งไม่สำเร็จ: ${(err as Error).message}`, 'error');
          break;
        }
        // Only mark clean if nothing changed while the request was out.
        if (latest.current === snapshot) {
          dirty.current = false;
          break;
        }
      }
    } finally {
      inFlight.current = false;
      setIsSaving(false);
    }
  }, [saveCreativeOverrides, showToast]);

  const scheduleSave = useCallback(
    (next: CreativeElementsState) => {
      latest.current = next;
      dirty.current = true;
      window.clearTimeout(saveTimer.current);
      saveTimer.current = window.setTimeout(flush, SAVE_DELAY_MS);
    },
    [flush]
  );

  // Save straight away when creative mode is closed.
  useEffect(() => {
    if (!isCreativeMode && dirty.current) flush();
  }, [isCreativeMode, flush]);

  const updateOverride = useCallback(
    (id: string, partial: Partial<CreativeElementOverride>) => {
      setOverrides((prev) => {
        const next = { ...prev, [id]: { ...(prev[id] || { id }), ...partial } };
        scheduleSave(next);
        return next;
      });
    },
    [scheduleSave]
  );

  const resetOverrides = useCallback(() => {
    if (window.confirm('คุณต้องการรีเซ็ตการตกแต่งและข้อความทั้งหมดกลับเป็นค่าเริ่มต้นหรือไม่?')) {
      setOverrides({});
      setSelectedId(null);
      scheduleSave({});
    }
  }, [scheduleSave]);

  const getOverride = useCallback((id: string) => overrides[id], [overrides]);

  return (
    <CreativeContext.Provider
      value={{
        isCreativeMode,
        setIsCreativeMode,
        selectedId,
        setSelectedId,
        overrides,
        updateOverride,
        resetOverrides,
        getOverride,
        isSaving,
      }}
    >
      {children}
    </CreativeContext.Provider>
  );
};

export const useCreative = () => {
  const context = useContext(CreativeContext);
  if (!context) {
    throw new Error('useCreative must be used within a CreativeProvider');
  }
  return context;
};
