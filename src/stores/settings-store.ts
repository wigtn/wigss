import { create } from 'zustand';

export type ProviderId = 'claude';

interface SettingsState {
  open: boolean;
  provider: ProviderId;
  claudeModel: string;
  loading: boolean;
  saved: boolean;

  setOpen: (open: boolean) => void;
  setProvider: (provider: ProviderId) => void;
  setClaudeModel: (v: string) => void;
  load: () => Promise<void>;
  save: () => Promise<void>;
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  open: false,
  provider: 'claude',
  claudeModel: 'claude-haiku-4-5-20251001',
  loading: false,
  saved: false,

  setOpen: (open) => set({ open }),
  setProvider: (provider) => set({ provider, saved: false }),
  setClaudeModel: (claudeModel) => set({ claudeModel, saved: false }),

  load: async () => {
    set({ loading: true });
    try {
      const res = await fetch('/api/settings');
      const { data } = await res.json();
      set({
        provider: data.provider || 'claude',
        claudeModel: data.claudeModel || 'claude-haiku-4-5-20251001',
        loading: false,
      });
    } catch {
      set({ loading: false });
    }
  },

  save: async () => {
    const s = get();
    set({ loading: true });
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ provider: s.provider, claudeModel: s.claudeModel }),
      });
      const { data } = await res.json();
      set({ claudeModel: data.claudeModel || s.claudeModel, loading: false, saved: true });
    } catch {
      set({ loading: false });
    }
  },
}));
