import { create } from 'zustand';
import type {
  AgentStatus,
  AgentLog,
  AgentFeedback,
  ChatMessage,
  VerificationResult,
  Suggestion,
} from '@/types';
import { useEditorStore } from './editor-store';

interface AgentState {
  // Connection
  connected: boolean;
  ws: WebSocket | null;

  // Agent state
  status: AgentStatus;
  logs: AgentLog[];

  // Feedback & suggestions
  feedbacks: AgentFeedback[];
  suggestions: Suggestion[];

  // Chat
  chatMessages: ChatMessage[];

  // Verification
  verification: VerificationResult | null;

  // Demo mode
  isDemoMode: boolean;

  // Reconnect
  _reconnectTimer: ReturnType<typeof setTimeout> | null;
  _reconnectAttempts: number;

  // Actions
  setConnected: (connected: boolean) => void;
  setWs: (ws: WebSocket | null) => void;
  setStatus: (status: AgentStatus) => void;
  addLog: (step: string, detail: string) => void;

  addFeedback: (feedback: AgentFeedback) => void;
  removeFeedback: (id: string) => void;
  clearFeedbacks: () => void;

  addSuggestion: (suggestion: Suggestion) => void;
  removeSuggestion: (id: string) => void;
  clearSuggestions: () => void;

  addChatMessage: (message: ChatMessage) => void;
  clearChat: () => void;

  setVerification: (result: VerificationResult | null) => void;
  setDemoMode: (isDemoMode: boolean) => void;

  // WebSocket send helper
  sendMessage: (type: string, payload: unknown) => void;

  // Connect to WebSocket
  connect: (url: string) => void;
  disconnect: () => void;

  reset: () => void;
}

const MAX_RECONNECT_ATTEMPTS = 10;
const BASE_RECONNECT_DELAY = 1000; // ms

const initialState = {
  connected: false,
  ws: null,
  status: 'idle' as AgentStatus,
  logs: [],
  feedbacks: [],
  suggestions: [],
  chatMessages: [],
  verification: null,
  isDemoMode: false,
  _reconnectTimer: null,
  _reconnectAttempts: 0,
};

export const useAgentStore = create<AgentState>((set, get) => ({
  ...initialState,

  setConnected: (connected) => set({ connected }),

  setWs: (ws) => set({ ws }),

  setStatus: (status) =>
    set((state) => {
      const log: AgentLog = {
        timestamp: Date.now(),
        step: 'status_change',
        detail: `${state.status} -> ${status}`,
      };
      return { status, logs: [...state.logs, log] };
    }),

  addLog: (step, detail) =>
    set((state) => ({
      logs: [...state.logs, { timestamp: Date.now(), step, detail }],
    })),

  addFeedback: (feedback) =>
    set((state) => ({
      feedbacks: [...state.feedbacks, feedback],
    })),

  removeFeedback: (id) =>
    set((state) => ({
      feedbacks: state.feedbacks.filter((f) => f.id !== id),
    })),

  clearFeedbacks: () => set({ feedbacks: [] }),

  addSuggestion: (suggestion) =>
    set((state) => ({
      suggestions: [...state.suggestions, suggestion],
    })),

  removeSuggestion: (id) =>
    set((state) => ({
      suggestions: state.suggestions.filter((s) => s.id !== id),
    })),

  clearSuggestions: () => set({ suggestions: [] }),

  addChatMessage: (message) =>
    set((state) => ({
      chatMessages: [...state.chatMessages, message],
    })),

  clearChat: () => set({ chatMessages: [] }),

  setVerification: (result) => set({ verification: result }),

  setDemoMode: (isDemoMode) => set({ isDemoMode }),

  sendMessage: (type, payload) => {
    const { ws, connected } = get();
    if (!ws || !connected) {
      console.warn('[AgentStore] Cannot send message: not connected');
      return;
    }
    try {
      ws.send(JSON.stringify({ type, payload }));
    } catch (err) {
      console.error('[AgentStore] Failed to send message:', err);
    }
  },

  connect: (url) => {
    const state = get();

    // Clean up existing connection
    if (state.ws) {
      state.ws.close();
    }
    if (state._reconnectTimer) {
      clearTimeout(state._reconnectTimer);
    }

    const ws = new WebSocket(url);

    set({ ws, _reconnectAttempts: 0, _reconnectTimer: null });

    ws.onopen = () => {
      console.log('[AgentStore] WebSocket connected');
      set({ connected: true, _reconnectAttempts: 0 });
      get().addLog('connection', `Connected to ${url}`);
    };

    ws.onclose = (event) => {
      console.log(`[AgentStore] WebSocket closed: code=${event.code} reason=${event.reason}`);
      set({ connected: false, ws: null });
      get().addLog('connection', `Disconnected (code: ${event.code})`);

      // Auto-reconnect with exponential backoff (unless intentional close)
      if (event.code !== 1000) {
        const attempts = get()._reconnectAttempts;
        if (attempts < MAX_RECONNECT_ATTEMPTS) {
          const delay = BASE_RECONNECT_DELAY * Math.pow(2, Math.min(attempts, 6));
          console.log(
            `[AgentStore] Reconnecting in ${delay}ms (attempt ${attempts + 1}/${MAX_RECONNECT_ATTEMPTS})`,
          );
          const timer = setTimeout(() => {
            set({ _reconnectAttempts: attempts + 1 });
            get().connect(url);
          }, delay);
          set({ _reconnectTimer: timer });
        } else {
          console.error(
            `[AgentStore] Max reconnect attempts (${MAX_RECONNECT_ATTEMPTS}) reached`,
          );
          get().addLog('connection', 'Max reconnect attempts reached');
        }
      }
    };

    ws.onerror = (event) => {
      console.error('[AgentStore] WebSocket error:', event);
      get().addLog('connection', 'WebSocket error');
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(typeof event.data === 'string' ? event.data : '');
        const { type, payload } = data;

        switch (type) {
          case 'status':
            get().setStatus(payload.status);
            if (payload.detail) {
              get().addLog('status', payload.detail);
            }
            break;

          case 'components_detected':
            useEditorStore.getState().setComponents(payload.components ?? []);
            get().addLog('detect', `Detected ${payload.components?.length ?? 0} components`);
            break;

          case 'suggestion':
            get().addSuggestion({
              id: payload.id,
              title: payload.title,
              description: payload.description,
              changes: payload.changes,
              confidence: payload.confidence,
            });
            break;

          case 'feedback':
            get().addFeedback(payload);
            break;

          case 'chat_response':
            get().addChatMessage({
              role: 'agent',
              content: payload.message,
              suggestions: payload.suggestions,
              plan: payload.plan,
              timestamp: Date.now(),
            });
            break;

          case 'verification_result':
            get().setVerification(payload);
            break;

          case 'file_changed':
            get().addLog('file_changed', `File changed: ${payload.file}`);
            break;

          case 'diff_preview':
            useEditorStore.getState().setDiffs(payload.diffs ?? []);
            get().addLog('diff_preview', `Received ${payload.diffs?.length ?? 0} diffs`);
            break;

          case 'refactoring_progress':
            get().addLog(payload.step, payload.detail);
            break;

          case 'plan_confirm':
            get().addChatMessage({
              role: 'agent',
              content: payload.message,
              plan: {
                planId: payload.planId,
                steps: payload.steps,
                awaiting_confirm: true,
              },
              timestamp: Date.now(),
            });
            break;

          case 'auto_modify':
            useEditorStore.getState().applyChange(payload.change);
            get().addLog('auto_modify', `Auto-modified component: ${payload.componentId}`);
            break;

          default:
            console.log(`[AgentStore] Unhandled message type: ${type}`);
            break;
        }
      } catch (err) {
        console.error('[AgentStore] Failed to parse WebSocket message:', err);
      }
    };
  },

  disconnect: () => {
    const { ws, _reconnectTimer } = get();

    if (_reconnectTimer) {
      clearTimeout(_reconnectTimer);
    }

    if (ws) {
      ws.close(1000, 'Client disconnect');
    }

    set({
      ws: null,
      connected: false,
      _reconnectTimer: null,
      _reconnectAttempts: 0,
    });
  },

  reset: () => {
    const { ws, _reconnectTimer } = get();

    if (_reconnectTimer) {
      clearTimeout(_reconnectTimer);
    }
    if (ws) {
      ws.close(1000, 'Store reset');
    }

    set(initialState);
  },
}));
