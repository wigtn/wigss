import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useAgentStore } from '../stores/agent-store';
import type {
  AgentFeedback,
  BoundingBox,
  ChatMessage,
  FidelityExpectation,
  FidelityReport,
  Suggestion,
} from '../types';

function makeFeedback(id: string): AgentFeedback {
  return {
    id, type: 'sizing', severity: 'warning',
    message: `Feedback ${id}`, affectedComponents: [], suggestedChanges: [],
  };
}

function makeSuggestion(id: string): Suggestion {
  return {
    id, title: `Suggestion ${id}`, description: 'desc',
    changes: [], confidence: 0.8,
  };
}

function makeChatMessage(role: 'user' | 'agent', content: string): ChatMessage {
  return { role, content, timestamp: Date.now() };
}

describe('agent-store', () => {
  beforeEach(() => {
    useAgentStore.getState().reset();
  });

  describe('initial state', () => {
    it('has correct defaults', () => {
      const state = useAgentStore.getState();
      expect(state.connected).toBe(false);
      expect(state.ws).toBeNull();
      expect(state.status).toBe('idle');
      expect(state.logs).toEqual([]);
      expect(state.feedbacks).toEqual([]);
      expect(state.suggestions).toEqual([]);
      expect(state.chatMessages).toEqual([]);
      expect(state.verification).toBeNull();
      expect(state.isDemoMode).toBe(false);
    });
  });

  describe('setStatus', () => {
    it('updates status and adds log entry', () => {
      useAgentStore.getState().setStatus('scanning');
      expect(useAgentStore.getState().status).toBe('scanning');
      expect(useAgentStore.getState().logs).toHaveLength(1);
      expect(useAgentStore.getState().logs[0].step).toBe('status_change');
      expect(useAgentStore.getState().logs[0].detail).toContain('idle -> scanning');
    });
  });

  describe('addLog', () => {
    it('appends log with timestamp', () => {
      useAgentStore.getState().addLog('test_step', 'test detail');
      const logs = useAgentStore.getState().logs;
      expect(logs).toHaveLength(1);
      expect(logs[0].step).toBe('test_step');
      expect(logs[0].detail).toBe('test detail');
      expect(logs[0].timestamp).toBeGreaterThan(0);
    });

    it('caps at MAX_LOGS (500)', () => {
      for (let i = 0; i < 510; i++) {
        useAgentStore.getState().addLog('step', `log ${i}`);
      }
      expect(useAgentStore.getState().logs.length).toBeLessThanOrEqual(500);
    });
  });

  describe('addFeedback / removeFeedback / clearFeedbacks', () => {
    it('adds feedback', () => {
      useAgentStore.getState().addFeedback(makeFeedback('f1'));
      expect(useAgentStore.getState().feedbacks).toHaveLength(1);
    });

    it('removes by id', () => {
      useAgentStore.getState().addFeedback(makeFeedback('f1'));
      useAgentStore.getState().addFeedback(makeFeedback('f2'));
      useAgentStore.getState().removeFeedback('f1');
      expect(useAgentStore.getState().feedbacks).toHaveLength(1);
      expect(useAgentStore.getState().feedbacks[0].id).toBe('f2');
    });

    it('clears all', () => {
      useAgentStore.getState().addFeedback(makeFeedback('f1'));
      useAgentStore.getState().addFeedback(makeFeedback('f2'));
      useAgentStore.getState().clearFeedbacks();
      expect(useAgentStore.getState().feedbacks).toEqual([]);
    });

    it('caps at MAX_FEEDBACKS (50)', () => {
      for (let i = 0; i < 55; i++) {
        useAgentStore.getState().addFeedback(makeFeedback(`f${i}`));
      }
      expect(useAgentStore.getState().feedbacks.length).toBeLessThanOrEqual(50);
    });
  });

  describe('addSuggestion / removeSuggestion / clearSuggestions', () => {
    it('adds suggestion', () => {
      useAgentStore.getState().addSuggestion(makeSuggestion('s1'));
      expect(useAgentStore.getState().suggestions).toHaveLength(1);
    });

    it('removes by id', () => {
      useAgentStore.getState().addSuggestion(makeSuggestion('s1'));
      useAgentStore.getState().addSuggestion(makeSuggestion('s2'));
      useAgentStore.getState().removeSuggestion('s1');
      expect(useAgentStore.getState().suggestions).toHaveLength(1);
      expect(useAgentStore.getState().suggestions[0].id).toBe('s2');
    });

    it('clears all', () => {
      useAgentStore.getState().addSuggestion(makeSuggestion('s1'));
      useAgentStore.getState().clearSuggestions();
      expect(useAgentStore.getState().suggestions).toEqual([]);
    });

    it('caps at MAX_SUGGESTIONS (50)', () => {
      for (let i = 0; i < 55; i++) {
        useAgentStore.getState().addSuggestion(makeSuggestion(`s${i}`));
      }
      expect(useAgentStore.getState().suggestions.length).toBeLessThanOrEqual(50);
    });
  });

  describe('addChatMessage / clearChat', () => {
    it('adds chat message', () => {
      useAgentStore.getState().addChatMessage(makeChatMessage('user', 'hello'));
      expect(useAgentStore.getState().chatMessages).toHaveLength(1);
      expect(useAgentStore.getState().chatMessages[0].content).toBe('hello');
    });

    it('clears all', () => {
      useAgentStore.getState().addChatMessage(makeChatMessage('user', 'hello'));
      useAgentStore.getState().clearChat();
      expect(useAgentStore.getState().chatMessages).toEqual([]);
    });

    it('caps at MAX_CHAT_MESSAGES (200)', () => {
      for (let i = 0; i < 210; i++) {
        useAgentStore.getState().addChatMessage(makeChatMessage('user', `msg ${i}`));
      }
      expect(useAgentStore.getState().chatMessages.length).toBeLessThanOrEqual(200);
    });
  });

  describe('sendMessage', () => {
    it('warns when not connected', () => {
      const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      useAgentStore.getState().sendMessage('test', {});
      expect(spy).toHaveBeenCalledWith(expect.stringContaining('not connected'));
      spy.mockRestore();
    });

    it('sends JSON when connected', () => {
      const mockSend = vi.fn();
      const mockWs = { send: mockSend, close: vi.fn() } as unknown as WebSocket;
      useAgentStore.setState({ ws: mockWs, connected: true });
      useAgentStore.getState().sendMessage('scan', { url: 'http://test' });
      expect(mockSend).toHaveBeenCalledWith(
        JSON.stringify({ type: 'scan', payload: { url: 'http://test' } }),
      );
    });
  });

  describe('setVerification / setDemoMode', () => {
    it('sets verification result', () => {
      const result = { passed: true, attempts: [], totalAttempts: 1 };
      useAgentStore.getState().setVerification(result);
      expect(useAgentStore.getState().verification).toEqual(result);
    });

    it('sets demo mode', () => {
      useAgentStore.getState().setDemoMode(true);
      expect(useAgentStore.getState().isDemoMode).toBe(true);
    });
  });

  describe('v2.2 fidelity verification state', () => {
    it('has correct initial fidelity defaults', () => {
      const state = useAgentStore.getState();
      expect(state.lastBackupId).toBeNull();
      expect(state.lastExpectations).toEqual([]);
      expect(state.lastPriorBoxes).toEqual({});
      expect(state.verificationReports).toBeNull();
      expect(state.verificationWarning).toBeNull();
    });

    it('setApplyResult captures backupId, expectations, priorBoxes and clears stale reports', () => {
      const expectations: FidelityExpectation[] = [
        { componentId: 'c1', expectedStyles: { width: '100px' }, sourceFile: 'a.tsx' },
      ];
      const priorBoxes: Record<string, BoundingBox> = {
        c1: { x: 0, y: 0, width: 50, height: 50 },
      };
      // Pre-seed stale state
      useAgentStore.getState().setVerificationReports([
        { passed: false, componentId: 'old', mismatches: [] },
      ]);
      useAgentStore.getState().setVerificationWarning('stale');
      useAgentStore.getState().setApplyResult('backup-123', expectations, priorBoxes);

      const state = useAgentStore.getState();
      expect(state.lastBackupId).toBe('backup-123');
      expect(state.lastExpectations).toEqual(expectations);
      expect(state.lastPriorBoxes).toEqual(priorBoxes);
      expect(state.verificationReports).toBeNull();
      expect(state.verificationWarning).toBeNull();
    });

    it('setVerificationReports stores reports', () => {
      const reports: FidelityReport[] = [
        { passed: true, componentId: 'c1', mismatches: [] },
      ];
      useAgentStore.getState().setVerificationReports(reports);
      expect(useAgentStore.getState().verificationReports).toEqual(reports);
    });

    it('setVerificationWarning sets and clears', () => {
      useAgentStore.getState().setVerificationWarning('something went wrong');
      expect(useAgentStore.getState().verificationWarning).toBe('something went wrong');
      useAgentStore.getState().setVerificationWarning(null);
      expect(useAgentStore.getState().verificationWarning).toBeNull();
    });

    it('clearVerification resets every fidelity field', () => {
      useAgentStore.getState().setApplyResult(
        'backup-x',
        [{ componentId: 'a', expectedStyles: {}, sourceFile: 'f' }],
        { a: { x: 0, y: 0, width: 1, height: 1 } },
      );
      useAgentStore.getState().setVerificationReports([
        { passed: false, componentId: 'a', mismatches: [] },
      ]);
      useAgentStore.getState().setVerificationWarning('warn');

      useAgentStore.getState().clearVerification();

      const state = useAgentStore.getState();
      expect(state.lastBackupId).toBeNull();
      expect(state.lastExpectations).toEqual([]);
      expect(state.lastPriorBoxes).toEqual({});
      expect(state.verificationReports).toBeNull();
      expect(state.verificationWarning).toBeNull();
    });
  });

  describe('reset', () => {
    it('returns to initial state', () => {
      useAgentStore.getState().setStatus('scanning');
      useAgentStore.getState().addLog('test', 'data');
      useAgentStore.getState().addFeedback(makeFeedback('f1'));
      useAgentStore.getState().setDemoMode(true);
      useAgentStore.getState().reset();

      const state = useAgentStore.getState();
      expect(state.status).toBe('idle');
      expect(state.logs).toEqual([]);
      expect(state.feedbacks).toEqual([]);
      expect(state.isDemoMode).toBe(false);
      expect(state.connected).toBe(false);
    });
  });
});
