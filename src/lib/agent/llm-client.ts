import { callClaude, type ClaudeMessage } from './providers/claude';
import { readSettings } from '@/lib/settings';
import { agentTools } from './tools';
import {
  SUGGEST_SYSTEM_PROMPT,
  FEEDBACK_SYSTEM_PROMPT,
  CHAT_SYSTEM_PROMPT,
} from './prompts';
import type {
  DetectedComponent,
  AgentFeedback,
  ComponentChange,
  Suggestion,
  FeedbackType,
  FeedbackSeverity,
} from '@/types';

// ---------------------------------------------------------------------------
// LLM provider: Claude (Code 구독제) 전용 — wigss는 OpenAI를 지원하지 않는다.
// 모델은 ~/.wigss/settings.json(또는 ENV)에서 매 호출 재독 → UI에서 바꾸면 재시작 없이 반영.
// ---------------------------------------------------------------------------
function getModel(): string {
  return readSettings().claudeModel || 'claude-haiku-4-5-20251001';
}

// ---------------------------------------------------------------------------
// suggestImprovements
// ---------------------------------------------------------------------------

/**
 * Claude에 suggest_improvement tool을 주어 디자인 개선안을 생성한다.
 */
export async function suggestImprovements(
  components: DetectedComponent[]
): Promise<Suggestion[]> {
  const componentSummary = components.map((c) => ({
    id: c.id,
    name: c.name,
    type: c.type,
    box: c.boundingBox,
    sourceFile: c.sourceFile,
  }));

  const userMessage = `Here are the detected UI components:

\`\`\`json
${JSON.stringify(componentSummary, null, 2)}
\`\`\`

Analyze the layout and call suggest_improvement for each design improvement you recommend.
Focus on spacing consistency, alignment issues, sizing problems, and visual hierarchy.`;

  const res = await callClaude({
    model: getModel(),
    system: SUGGEST_SYSTEM_PROMPT,
    messages: [{ role: 'user', content: userMessage }],
    tools: agentTools.filter((t) => t.name === 'suggest_improvement'),
    tool_choice: 'auto',
    temperature: 0.4,
    max_tokens: 4096,
  });

  const suggestions: Suggestion[] = [];

  res.toolUses.forEach((tu, i) => {
    if (tu.name !== 'suggest_improvement') return;

    const args = tu.input as {
      title?: string;
      description?: string;
      confidence?: number;
      changes?: Record<string, unknown>[];
    };

    // Map raw changes from the AI into typed ComponentChange[]
    const changes: ComponentChange[] = (args.changes || []).map(
      (ch: Record<string, unknown>) => ({
        componentId: (ch.componentId as string) || '',
        type: (ch.type as ComponentChange['type']) || 'move',
        from: (ch.from as ComponentChange['from']) || {},
        to: (ch.to as ComponentChange['to']) || {},
      })
    );

    suggestions.push({
      id: `sug-${i + 1}`,
      title: args.title || `Suggestion ${i + 1}`,
      description: args.description || '',
      confidence: typeof args.confidence === 'number' ? args.confidence : 50,
      changes,
    });
  });

  console.log(`[LLM] Generated ${suggestions.length} suggestions`);
  return suggestions;
}

// ---------------------------------------------------------------------------
// provideFeedback
// ---------------------------------------------------------------------------

/**
 * Claude에 provide_feedback tool을 주어 레이아웃 변경을 평가한다.
 * 문제가 있으면 feedback을, 괜찮으면 null을 반환.
 */
export async function provideFeedback(
  components: DetectedComponent[],
  change: ComponentChange
): Promise<AgentFeedback | null> {
  const changedComponent = components.find((c) => c.id === change.componentId);
  const componentSummary = components.map((c) => ({
    id: c.id,
    name: c.name,
    type: c.type,
    box: c.boundingBox,
  }));

  const userMessage = `The user just ${change.type === 'move' ? 'moved' : 'resized'} a component.

Changed component:
${JSON.stringify(changedComponent || { id: change.componentId }, null, 2)}

Change details:
- Type: ${change.type}
- From: ${JSON.stringify(change.from)}
- To: ${JSON.stringify(change.to)}

All components:
\`\`\`json
${JSON.stringify(componentSummary, null, 2)}
\`\`\`

If this change causes any layout issues (overlap, misalignment, inconsistent spacing, too small, out of viewport), call provide_feedback.
If the change looks fine, just respond with a confirmation message.`;

  const res = await callClaude({
    model: getModel(),
    system: FEEDBACK_SYSTEM_PROMPT,
    messages: [{ role: 'user', content: userMessage }],
    tools: agentTools.filter((t) => t.name === 'provide_feedback'),
    tool_choice: 'auto',
    temperature: 0.2,
    max_tokens: 2048,
  });

  const tu = res.toolUses.find((t) => t.name === 'provide_feedback');
  if (!tu) {
    // No issues detected
    return null;
  }

  const args = tu.input as {
    type?: string;
    severity?: string;
    message?: string;
    affectedComponents?: string[];
    suggestedFix?: Record<string, number>;
  };

  // Convert suggestedFix into ComponentChange[] if present
  const suggestedChanges: ComponentChange[] = [];
  if (args.suggestedFix) {
    suggestedChanges.push({
      componentId: change.componentId,
      type: change.type,
      from: change.to, // current (problematic) position
      to: { ...change.to, ...args.suggestedFix },
    });
  }

  const feedback: AgentFeedback = {
    id: `fb-${Date.now()}`,
    type: args.type as FeedbackType,
    severity: args.severity as FeedbackSeverity,
    message: args.message || 'Layout issue detected',
    affectedComponents: args.affectedComponents || [change.componentId],
    suggestedChanges,
  };

  console.log(`[LLM] Feedback: ${feedback.severity} - ${feedback.type}`);
  return feedback;
}

// ---------------------------------------------------------------------------
// chat
// ---------------------------------------------------------------------------

/**
 * Chat with the AI assistant with full context of current components.
 * Detects user intent: opinion request, delegation, or direct instruction.
 */
export async function chat(
  message: string,
  components: DetectedComponent[],
  history: { role: string; content: string }[]
): Promise<{
  message: string;
  suggestions?: { id: string; title: string; changes: ComponentChange[] }[];
  plan?: { planId: string; steps: string[]; awaiting_confirm: boolean };
}> {
  const componentContext = components.map((c) => ({
    id: c.id,
    name: c.name,
    type: c.type,
    box: c.boundingBox,
    sourceFile: c.sourceFile,
  }));

  const systemMessage = `${CHAT_SYSTEM_PROMPT}

Current UI components:
\`\`\`json
${JSON.stringify(componentContext, null, 2)}
\`\`\``;

  // Build messages from conversation history (limit to last 20 turns)
  const messages: ClaudeMessage[] = [];
  const recentHistory = history.slice(-20);
  for (const h of recentHistory) {
    messages.push({
      role: h.role === 'user' ? 'user' : 'assistant',
      content: h.content,
    });
  }

  // Add current message if not already the last in history
  const lastHistoryMsg = recentHistory[recentHistory.length - 1];
  if (!lastHistoryMsg || lastHistoryMsg.content !== message || lastHistoryMsg.role !== 'user') {
    messages.push({ role: 'user', content: message });
  }

  // Anthropic은 첫 메시지가 user여야 한다 — 선행 assistant 턴 제거.
  while (messages.length && messages[0].role !== 'user') messages.shift();

  const res = await callClaude({
    model: getModel(),
    system: systemMessage,
    messages,
    tools: agentTools.filter(
      (t) => t.name === 'suggest_improvement' || t.name === 'modify_overlay'
    ),
    tool_choice: 'auto',
    temperature: 0.5,
    max_tokens: 4096,
  });

  const assistantMessage = res.text || '';

  // Parse tool uses into suggestions or modifications
  const suggestions: { id: string; title: string; changes: ComponentChange[] }[] = [];

  res.toolUses.forEach((tu, i) => {
    if (tu.name === 'suggest_improvement') {
      const args = tu.input as { title?: string; changes?: Record<string, unknown>[] };
      const changes: ComponentChange[] = (args.changes || []).map(
        (ch: Record<string, unknown>) => ({
          componentId: (ch.componentId as string) || '',
          type: (ch.type as ComponentChange['type']) || 'move',
          from: (ch.from as ComponentChange['from']) || {},
          to: (ch.to as ComponentChange['to']) || {},
        })
      );
      suggestions.push({
        id: `chat-sug-${i + 1}`,
        title: args.title || `Suggestion ${i + 1}`,
        changes,
      });
    } else if (tu.name === 'modify_overlay') {
      const args = tu.input as {
        componentId?: string;
        changes?: { x?: number; y?: number; width?: number; height?: number };
      };
      const ch = args.changes || {};
      suggestions.push({
        id: `chat-mod-${i + 1}`,
        title: `Modify ${args.componentId}`,
        changes: [
          {
            componentId: args.componentId || '',
            type: ch.width !== undefined || ch.height !== undefined ? 'resize' : 'move',
            from: {},
            to: ch,
          },
        ],
      });
    }
  });

  // Detect delegation intent for plan generation
  const delegationPatterns = [
    /알아서/,
    /자동으로/,
    /해줘$/,
    /해 줘$/,
    /fix it/i,
    /make it better/i,
    /improve/i,
    /자동 수정/,
    /전부 수정/,
    /다 고쳐/,
  ];

  const isDelegation = delegationPatterns.some((p) => p.test(message));

  let plan: { planId: string; steps: string[]; awaiting_confirm: boolean } | undefined;
  if (isDelegation && suggestions.length > 0) {
    plan = {
      planId: `plan-${Date.now()}`,
      steps: suggestions.map(
        (s, idx) => `${idx + 1}. ${s.title}: ${s.changes.map((c) => c.componentId).join(', ')}`
      ),
      awaiting_confirm: true,
    };
  }

  const result: {
    message: string;
    suggestions?: { id: string; title: string; changes: ComponentChange[] }[];
    plan?: { planId: string; steps: string[]; awaiting_confirm: boolean };
  } = {
    message: assistantMessage,
  };

  if (suggestions.length > 0) {
    result.suggestions = suggestions;
  }

  if (plan) {
    result.plan = plan;
  }

  console.log(
    `[LLM] Chat response: ${assistantMessage.slice(0, 80)}... | ${suggestions.length} suggestions | plan: ${!!plan}`
  );

  return result;
}
