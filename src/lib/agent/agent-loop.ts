import { wsServer } from '../ws-server';
import {
  detectComponents,
  suggestImprovements,
  provideFeedback,
  chat,
} from './openai-client';
import { scanPage } from '../playwright';
import type {
  WSClientMessage,
  DetectedComponent,
  ComponentChange,
  AgentLog,
  Suggestion,
} from '@/types';
import type { WebSocket as WS } from 'ws';
import demoScanResult from '@/data/demo-scan-result.json';

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
  private isProcessing: boolean = false;

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
            await this.handleScan(msg.payload, ws);
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
            // Mobile view changes are handled by the frontend canvas.
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
    if (this.isProcessing) {
      wsServer.send(ws, {
        type: 'status',
        payload: { status: 'idle', detail: 'Agent is busy. Please wait.' },
      });
      return;
    }

    this.isProcessing = true;

    try {
      // Step 1: Scan the page
      wsServer.send(ws, {
        type: 'status',
        payload: { status: 'scanning', detail: `Scanning ${payload.url}...` },
      });
      this.addLog('scan_start', payload.url);

      const effectiveProjectPath = payload.projectPath || this.projectPath;
      const scanResult = await scanPage(payload.url, effectiveProjectPath);
      this.addLog(
        'scan_complete',
        `${scanResult.elements.length} elements found`
      );

      // Step 2: Detect components
      wsServer.send(ws, {
        type: 'status',
        payload: {
          status: 'detecting',
          detail: `Analyzing ${scanResult.elements.length} DOM elements...`,
        },
      });

      this.components = await detectComponents(
        scanResult.elements,
        scanResult.sourceFiles
      );
      this.addLog(
        'detection_complete',
        `${this.components.length} components detected`
      );

      wsServer.send(ws, {
        type: 'components_detected',
        payload: { components: this.components },
      });

      // Step 3: Auto-chain suggest improvements
      wsServer.send(ws, {
        type: 'status',
        payload: { status: 'suggesting', detail: 'Generating improvement suggestions...' },
      });

      const suggestions: Suggestion[] = await suggestImprovements(
        this.components
      );
      this.addLog(
        'suggestions_generated',
        `${suggestions.length} suggestions`
      );

      for (const s of suggestions) {
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

      wsServer.send(ws, {
        type: 'status',
        payload: { status: 'idle', detail: 'Scan complete.' },
      });
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      console.error('[Agent] Scan/detect failed, falling back to demo mode:', errorMsg);
      this.addLog('fallback_demo', `Error: ${errorMsg} — using cached demo data`);

      // Fallback: use cached demo scan result
      const demo = demoScanResult as { components: DetectedComponent[]; suggestions: Suggestion[] };
      this.components = demo.components || [];

      wsServer.send(ws, {
        type: 'components_detected',
        payload: { components: this.components },
      });

      const suggestions = (demo.suggestions || []) as Suggestion[];
      for (const s of suggestions) {
        wsServer.send(ws, {
          type: 'suggestion',
          payload: {
            id: s.id,
            title: s.title,
            description: s.description,
            changes: s.changes || [],
            confidence: s.confidence,
          },
        });
      }

      wsServer.send(ws, {
        type: 'status',
        payload: { status: 'idle', detail: 'Scan complete (demo mode — AI unavailable).' },
      });
    } finally {
      this.isProcessing = false;
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

    // When a plan is confirmed, we would execute the planned changes.
    // For now, send a status update acknowledging confirmation.
    // The actual refactoring (file modifications) will use the Claude API
    // and the /api/apply REST endpoint for safety.
    wsServer.send(ws, {
      type: 'status',
      payload: {
        status: 'refactoring',
        detail: `Executing plan ${payload.planId}...`,
      },
    });

    // TODO: Integrate Claude API for code refactoring in a future iteration.
    // This would:
    // 1. Read source files for affected components
    // 2. Send to Claude with tool_use for code modifications
    // 3. Generate CodeDiff[] for preview
    // 4. Send diff_preview to client

    wsServer.send(ws, {
      type: 'status',
      payload: {
        status: 'idle',
        detail: 'Plan acknowledged. Refactoring integration pending.',
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
