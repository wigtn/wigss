import { wsServer } from '../ws-server';
import {
  suggestImprovements,
  provideFeedback,
  chat,
} from './openai-client';
import type {
  WSClientMessage,
  DetectedComponent,
  ComponentChange,
  AgentLog,
} from '@/types';
import type { WebSocket as WS } from 'ws';

/**
 * WIGSSAgent - Main agent event loop (PRD 7.2).
 *
 * Listens on the WebSocket server for client messages and orchestrates:
 *  - Page scanning (Playwright)
 *  - Component detection (OpenAI)
 *  - Improvement suggestions (OpenAI)
 *  - Real-time feedback on edits (OpenAI)
 *  - Chat interactions (OpenAI)
 */
class WIGSSAgent {
  private components: DetectedComponent[] = [];
  private history: { role: string; content: string }[] = [];
  private logs: AgentLog[] = [];
  private projectPath: string = '';
  private processingLock: Promise<void> = Promise.resolve();

  private async withLock<T>(fn: () => Promise<T>): Promise<T> {
    let release: () => void;
    const next = new Promise<void>((r) => { release = r; });
    const prev = this.processingLock;
    this.processingLock = next;
    await prev;
    try {
      return await fn();
    } finally {
      release!();
    }
  }

  private applyLocalChange(change: ComponentChange): void {
    this.components = this.components.map((component) => {
      if (component.id !== change.componentId) return component;
      const next = { ...component.boundingBox };
      if (change.to.x !== undefined) next.x = change.to.x;
      if (change.to.y !== undefined) next.y = change.to.y;
      if (change.to.width !== undefined) next.width = change.to.width;
      if (change.to.height !== undefined) next.height = change.to.height;
      return { ...component, boundingBox: next };
    });
  }

  /**
   * Start the agent loop. Registers message handlers on the WebSocket server.
   */
  start(projectPath: string): void {
    this.projectPath = projectPath;
    console.log(`[Agent] Started with project path: ${projectPath}`);

    wsServer.onMessage(async (msg: WSClientMessage, ws: WS) => {
      try {
        this.addLog('message_received', `type=${msg.type}`);

        switch (msg.type) {
          case 'scan':
            await this.withLock(() => this.handleScan(msg.payload, ws));
            break;

          case 'drag_end':
            await this.handleEditEnd(
              {
                componentId: msg.payload.componentId,
                type: 'move',
                from: msg.payload.from,
                to: msg.payload.to,
              },
              ws
            );
            break;

          case 'resize_end':
            await this.handleEditEnd(
              {
                componentId: msg.payload.componentId,
                type: 'resize',
                from: msg.payload.from,
                to: msg.payload.to,
              },
              ws
            );
            break;

          case 'chat':
            await this.handleChat(msg.payload, ws);
            break;

          case 'accept_suggestion':
            // Frontend handles overlay updates directly.
            // Log the acceptance for audit trail.
            this.addLog(
              'suggestion_accepted',
              `id=${msg.payload.suggestionId}, changes=${msg.payload.changes.length}`
            );
            break;

          case 'accept_feedback':
            // Frontend handles overlay updates directly.
            this.addLog(
              'feedback_accepted',
              `id=${msg.payload.feedbackId}, changes=${msg.payload.changes.length}`
            );
            break;

          case 'plan_confirmed':
            await this.handlePlanConfirmed(msg.payload, ws);
            break;

          case 'save':
            this.addLog(
              'save_requested',
              `changes=${msg.payload.changes.length}`
            );
            // Save is handled by the REST /api/apply endpoint for safety.
            // Agent acknowledges but does not process file writes here.
            wsServer.send(ws, {
              type: 'status',
              payload: {
                status: 'idle',
                detail: 'Use the /api/apply endpoint to save changes to files.',
              },
            });
            break;

          case 'apply':
            this.addLog('apply_requested', `diffs=${msg.payload.diffs.length}`);
            // Apply is handled by the REST /api/apply endpoint for safety.
            wsServer.send(ws, {
              type: 'status',
              payload: {
                status: 'idle',
                detail: 'Use the /api/apply endpoint to apply diffs.',
              },
            });
            break;

          case 'mobile_view':
            this.addLog(
              'mobile_view',
              `targetWidth=${msg.payload.targetWidth}`
            );
            break;

          case 'auto_fix':
            // Direct auto-fix: generate suggestions and apply top ones immediately
            this.addLog('auto_fix', `Fixing: ${msg.payload?.message?.slice(0, 60)}`);
            wsServer.send(ws, {
              type: 'status',
              payload: { status: 'refactoring', detail: 'AI 자동 수정 중...' },
            });
            try {
              const fixes = await suggestImprovements(this.components);
              const topFixes = fixes
                .sort((a, b) => b.confidence - a.confidence)
                .flatMap((s) => s.changes)
                .slice(0, 5);

              for (const change of topFixes) {
                this.applyLocalChange(change);
                wsServer.send(ws, {
                  type: 'auto_modify',
                  payload: { componentId: change.componentId, change },
                });
              }
              wsServer.send(ws, {
                type: 'chat_response',
                payload: { message: `자동 수정 완료: ${topFixes.length}개 변경 적용됨` },
              });
            } catch (err) {
              this.addLog('auto_fix_error', err instanceof Error ? err.message : String(err));
            }
            wsServer.send(ws, {
              type: 'status',
              payload: { status: 'idle' },
            });
            break;

          case 'components_synced':
            // Frontend synced postMessage-based components (pixel-accurate IDs)
            if (Array.isArray(msg.payload?.components)) {
              this.components = msg.payload.components;
              this.addLog('components_synced', `${this.components.length} components synced from iframe`);

              // Now generate suggestions with correct component IDs
              wsServer.send(ws, {
                type: 'status',
                payload: { status: 'suggesting', detail: '개선안 생성 중...' },
              });
              try {
                const sgs = await suggestImprovements(this.components);
                this.addLog('suggestions_generated', `${sgs.length} suggestions`);
                for (const s of sgs) {
                  wsServer.send(ws, {
                    type: 'suggestion',
                    payload: {
                      id: s.id,
                      title: s.title,
                      description: s.description,
                      changes: s.changes,
                      confidence: s.confidence,
                    },
                  });
                }
              } catch (sugErr) {
                this.addLog('suggest_error', sugErr instanceof Error ? sugErr.message : String(sugErr));
              }
              wsServer.send(ws, {
                type: 'status',
                payload: { status: 'idle', detail: '스캔 및 분석 완료.' },
              });
            }
            break;

          default:
            console.warn(`[Agent] Unknown message type: ${(msg as { type: string }).type}`);
        }
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : 'Unknown error';
        console.error(`[Agent] Error handling message "${msg.type}":`, err);
        this.addLog('error', `${msg.type}: ${errorMessage}`);

        wsServer.send(ws, {
          type: 'status',
          payload: { status: 'idle', detail: `Error: ${errorMessage}` },
        });
      }
    });
  }

  // -----------------------------------------------------------------------
  // Scan Handler
  // -----------------------------------------------------------------------

  private async handleScan(
    payload: { url: string; projectPath: string },
    ws: WS
  ): Promise<void> {
    try {
      // Resolve project path for Save operations
      let effectiveProjectPath = this.projectPath;
      if (payload.projectPath && payload.projectPath !== 'auto') {
        effectiveProjectPath = payload.projectPath;
      }
      if (payload.url.includes('localhost:3001')) {
        const path = await import('path');
        const demoPath = path.join(effectiveProjectPath, 'demo-target');
        try {
          const fs = await import('fs/promises');
          await fs.access(demoPath);
          effectiveProjectPath = demoPath;
        } catch { /* not demo setup */ }
      }
      this.projectPath = effectiveProjectPath;

      // Software-based scan: tell frontend to trigger iframe postMessage scan
      // No Playwright, no GPT — pure DOM extraction + software detector on frontend
      wsServer.send(ws, {
        type: 'status',
        payload: { status: 'scanning', detail: 'DOM 스캔 중...' },
      });
      this.addLog('scan_start', `${payload.url} (software scan)`);

      // Send components_detected with empty array to trigger iframe scan in frontend
      wsServer.send(ws, {
        type: 'components_detected',
        payload: { components: [] },
      });

      // Frontend will:
      // 1. Receive components_detected → trigger iframe postMessage scan
      // 2. iframe returns raw DOM elements with CSS layout data
      // 3. Frontend runs software detector → accurate components
      // 4. Frontend sends components_synced back → server stores components
      // 5. Server generates AI suggestions (async, optional)

      wsServer.send(ws, {
        type: 'status',
        payload: { status: 'detecting', detail: '컴포넌트 감지 중...' },
      });
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      console.error('[Agent] Scan error:', errorMsg);
      this.addLog('scan_error', errorMsg);
      wsServer.send(ws, {
        type: 'status',
        payload: { status: 'idle', detail: `Error: ${errorMsg}` },
      });
    }
  }

  // -----------------------------------------------------------------------
  // Edit (drag/resize) Handler
  // -----------------------------------------------------------------------

  private async handleEditEnd(change: ComponentChange, ws: WS): Promise<void> {
    wsServer.send(ws, {
      type: 'status',
      payload: {
        status: 'feedback',
        detail: `Evaluating ${change.type} of ${change.componentId}...`,
      },
    });
    this.addLog(
      'edit_feedback_start',
      `${change.type} on ${change.componentId}`
    );

    try {
      const fb = await provideFeedback(this.components, change);

      if (fb) {
        this.addLog(
          'feedback_generated',
          `${fb.severity}: ${fb.type} - ${fb.message}`
        );
        wsServer.send(ws, { type: 'feedback', payload: fb });
      } else {
        this.addLog('feedback_none', 'Change looks fine');
      }
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Unknown error';
      console.error('[Agent] Feedback error:', err);
      this.addLog('feedback_error', errorMessage);
    }

    wsServer.send(ws, {
      type: 'status',
      payload: { status: 'idle' },
    });
  }

  // -----------------------------------------------------------------------
  // Chat Handler
  // -----------------------------------------------------------------------

  private async handleChat(
    payload: { message: string },
    ws: WS
  ): Promise<void> {
    wsServer.send(ws, {
      type: 'status',
      payload: { status: 'chatting', detail: 'Thinking...' },
    });
    this.addLog('chat_start', payload.message.slice(0, 100));

    this.history.push({ role: 'user', content: payload.message });

    try {
      const response = await chat(
        payload.message,
        this.components,
        this.history
      );

      this.history.push({ role: 'assistant', content: response.message });
      this.addLog('chat_response', response.message.slice(0, 100));

      wsServer.send(ws, {
        type: 'chat_response',
        payload: {
          message: response.message,
          suggestions: response.suggestions,
          plan: response.plan
            ? { ...response.plan, awaiting_confirm: true }
            : undefined,
        },
      });

      // If there's a plan, also send a plan_confirm message
      if (response.plan) {
        wsServer.send(ws, {
          type: 'plan_confirm',
          payload: {
            planId: response.plan.planId,
            steps: response.plan.steps,
            message: '이 계획대로 진행할까요?',
          },
        });
        this.addLog(
          'plan_proposed',
          `planId=${response.plan.planId}, steps=${response.plan.steps.length}`
        );
      }
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Unknown error';
      console.error('[Agent] Chat error:', err);
      this.addLog('chat_error', errorMessage);

      wsServer.send(ws, {
        type: 'chat_response',
        payload: {
          message: `Sorry, I encountered an error: ${errorMessage}. Please try again.`,
        },
      });
    }

    wsServer.send(ws, {
      type: 'status',
      payload: { status: 'idle' },
    });
  }

  // -----------------------------------------------------------------------
  // Plan Confirmed Handler
  // -----------------------------------------------------------------------

  private async handlePlanConfirmed(
    payload: { planId: string },
    ws: WS
  ): Promise<void> {
    this.addLog('plan_confirmed', `planId=${payload.planId}`);
    wsServer.send(ws, {
      type: 'status',
      payload: {
        status: 'refactoring',
        detail: `Executing plan ${payload.planId}...`,
      },
    });
    try {
      const suggestions = await suggestImprovements(this.components);
      const autoChanges = suggestions
        .sort((a, b) => b.confidence - a.confidence)
        .flatMap((suggestion) => suggestion.changes)
        .slice(0, 8);

      if (autoChanges.length === 0) {
        wsServer.send(ws, {
          type: 'chat_response',
          payload: {
            message: '실행 가능한 자동 수정안을 찾지 못했습니다. 조금 더 구체적으로 지시해 주세요.',
          },
        });
        wsServer.send(ws, {
          type: 'status',
          payload: { status: 'idle', detail: 'No actionable auto-modify changes found.' },
        });
        return;
      }

      for (const change of autoChanges) {
        this.applyLocalChange(change);
        wsServer.send(ws, {
          type: 'auto_modify',
          payload: {
            componentId: change.componentId,
            change,
          },
        });
        this.addLog('auto_modify_emit', `${change.type} ${change.componentId}`);
      }

      wsServer.send(ws, {
        type: 'chat_response',
        payload: {
          message: `확인된 계획을 실행했습니다. ${autoChanges.length}개 자동 수정을 적용했어요.`,
        },
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.addLog('plan_execute_error', errorMessage);
      wsServer.send(ws, {
        type: 'chat_response',
        payload: {
          message: `계획 실행 중 오류가 발생했습니다: ${errorMessage}`,
        },
      });
    }

    wsServer.send(ws, {
      type: 'status',
      payload: {
        status: 'idle',
        detail: `Plan ${payload.planId} execution finished.`,
      },
    });
  }

  // -----------------------------------------------------------------------
  // Utility
  // -----------------------------------------------------------------------

  /**
   * Add a timestamped log entry.
   */
  addLog(step: string, detail: string): void {
    const entry: AgentLog = {
      timestamp: Date.now(),
      step,
      detail,
    };
    this.logs.push(entry);
    console.log(`[Agent] ${step}: ${detail}`);

    // Keep logs bounded (max 500 entries)
    if (this.logs.length > 500) {
      this.logs = this.logs.slice(-250);
    }
  }

  /**
   * Get all agent logs.
   */
  getLogs(): AgentLog[] {
    return [...this.logs];
  }

  /**
   * Get the current detected components.
   */
  getComponents(): DetectedComponent[] {
    return [...this.components];
  }

  /**
   * Clear conversation history.
   */
  clearHistory(): void {
    this.history = [];
  }
}

export const agent = new WIGSSAgent();
