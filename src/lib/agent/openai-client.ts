import OpenAI from 'openai';
import { openaiTools } from './tools';
import {
  DETECT_SYSTEM_PROMPT,
  SUGGEST_SYSTEM_PROMPT,
  FEEDBACK_SYSTEM_PROMPT,
  CHAT_SYSTEM_PROMPT,
} from './prompts';
import type {
  DetectedComponent,
  AgentFeedback,
  ComponentChange,
  Suggestion,
  DOMElement,
  BoundingBox,
  FeedbackType,
  FeedbackSeverity,
} from '@/types';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// ---------------------------------------------------------------------------
// OpenAI SDK v6 type helpers
// ---------------------------------------------------------------------------

/**
 * Extract function name and arguments from a tool call.
 * OpenAI SDK v6 defines ChatCompletionMessageToolCall as a union of
 * ChatCompletionMessageFunctionToolCall | ChatCompletionMessageCustomToolCall.
 * We only handle function-type tool calls.
 */
function parseFunctionToolCall(
  call: { type: string; function?: { name: string; arguments: string }; [key: string]: unknown }
): { name: string; arguments: string } | null {
  if (call.type === 'function' && call.function) {
    return { name: call.function.name, arguments: call.function.arguments };
  }
  return null;
}

// ---------------------------------------------------------------------------
// Retry helper for rate-limited API calls
// ---------------------------------------------------------------------------

async function withRetry<T>(
  fn: () => Promise<T>,
  label: string,
  maxRetries = 2
): Promise<T> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err: unknown) {
      const status = (err as { status?: number }).status;
      const isRetryable = status === 429 || status === 500 || status === 503;

      if (isRetryable && attempt < maxRetries) {
        const delay = Math.pow(2, attempt + 1) * 1000; // 2s, 4s
        console.warn(`[OpenAI] ${label} rate limited (${status}), retrying in ${delay}ms (attempt ${attempt + 1}/${maxRetries})...`);
        await new Promise((r) => setTimeout(r, delay));
        continue;
      }
      throw err;
    }
  }
  throw new Error('Unreachable');
}

// ---------------------------------------------------------------------------
// Helper: compute bounding box from child elements
// ---------------------------------------------------------------------------

function computeBoundingBox(
  elementIds: string[],
  elements: DOMElement[]
): BoundingBox {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  function findElements(els: DOMElement[]): void {
    for (const el of els) {
      if (elementIds.includes(el.id)) {
        const bb = el.boundingBox;
        minX = Math.min(minX, bb.x);
        minY = Math.min(minY, bb.y);
        maxX = Math.max(maxX, bb.x + bb.width);
        maxY = Math.max(maxY, bb.y + bb.height);
      }
      if (el.children.length > 0) {
        findElements(el.children);
      }
    }
  }

  findElements(elements);

  // Fallback if no elements matched
  if (minX === Infinity) {
    return { x: 0, y: 0, width: 0, height: 0 };
  }

  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY,
  };
}

// ---------------------------------------------------------------------------
// detectComponents
// ---------------------------------------------------------------------------

/**
 * Use GPT-4o with identify_component tool to detect UI components from DOM elements.
 */
export async function detectComponents(
  elements: DOMElement[],
  sourceFiles: string[]
): Promise<DetectedComponent[]> {
  // Flatten elements to a simplified representation for the prompt
  // Limit to top 40 elements by size (largest first = most significant layout elements)
  const flattened = flattenElements(elements);
  const sorted = [...flattened].sort((a, b) => {
    const areaA = a.boundingBox.width * a.boundingBox.height;
    const areaB = b.boundingBox.width * b.boundingBox.height;
    return areaB - areaA;
  });
  const topElements = sorted.slice(0, 40);

  const simplifiedElements = topElements.map((el) => ({
    id: el.id,
    tag: el.tagName,
    className:
      typeof el.className === 'string'
        ? el.className.split(/\s+/).slice(0, 5).join(' ')
        : '',
    text: el.textContent.slice(0, 40),
    box: el.boundingBox,
  }));

  // Limit source files to relevant ones only (max 30)
  const relevantSourceFiles = sourceFiles
    .filter((f) =>
      f.endsWith('.tsx') || f.endsWith('.jsx') || f.endsWith('.css')
    )
    .filter((f) =>
      f.includes('component') || f.includes('page') || f.includes('layout') ||
      f.includes('app/') || f.includes('src/')
    )
    .slice(0, 30);

  const userMessage = `Here are the top ${simplifiedElements.length} DOM elements from the scanned page (sorted by size):

\`\`\`json
${JSON.stringify(simplifiedElements, null, 2)}
\`\`\`

Available source files:
${relevantSourceFiles.map((f) => `- ${f}`).join('\n')}

Analyze these elements and call identify_component for each distinct UI component you detect.
Group related elements together. Identify the component type, name, and which elements belong to it.`;

  const response = await withRetry(
    () => openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: DETECT_SYSTEM_PROMPT },
        { role: 'user', content: userMessage },
      ],
      tools: openaiTools.filter((t) => t.function.name === 'identify_component'),
      tool_choice: 'auto',
      temperature: 0.3,
      max_tokens: 4096,
    }),
    'detectComponents'
  );

  const components: DetectedComponent[] = [];
  const toolCalls = response.choices[0]?.message?.tool_calls || [];

  for (let i = 0; i < toolCalls.length; i++) {
    const fn = parseFunctionToolCall(toolCalls[i] as never);
    if (!fn || fn.name !== 'identify_component') continue;

    try {
      const args = JSON.parse(fn.arguments);
      const id = `comp-${args.type}-${i + 1}`;
      const elementIds: string[] = args.elementIds || [];

      components.push({
        id,
        name: args.name || `Component ${i + 1}`,
        type: args.type,
        elementIds,
        boundingBox: computeBoundingBox(elementIds, elements),
        sourceFile: args.sourceFile || '',
        reasoning: args.reasoning || '',
      });
    } catch (err) {
      console.error('[OpenAI] Failed to parse identify_component args:', err);
    }
  }

  console.log(`[OpenAI] Detected ${components.length} components`);
  return components;
}

// ---------------------------------------------------------------------------
// suggestImprovements
// ---------------------------------------------------------------------------

/**
 * Use GPT-4o with suggest_improvement tool to generate design improvement suggestions.
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

  const response = await withRetry(
    () => openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: SUGGEST_SYSTEM_PROMPT },
        { role: 'user', content: userMessage },
      ],
      tools: openaiTools.filter((t) => t.function.name === 'suggest_improvement'),
      tool_choice: 'auto',
      temperature: 0.4,
      max_tokens: 4096,
    }),
    'suggestImprovements'
  );

  const suggestions: Suggestion[] = [];
  const toolCalls = response.choices[0]?.message?.tool_calls || [];

  for (let i = 0; i < toolCalls.length; i++) {
    const fn = parseFunctionToolCall(toolCalls[i] as never);
    if (!fn || fn.name !== 'suggest_improvement') continue;

    try {
      const args = JSON.parse(fn.arguments);

      // Map raw changes from the AI into typed ComponentChange[]
      const changes: ComponentChange[] = (args.changes || []).map(
        (ch: Record<string, unknown>) => ({
          componentId: ch.componentId || '',
          type: ch.type || 'move',
          from: ch.from || {},
          to: ch.to || {},
        })
      );

      suggestions.push({
        id: `sug-${i + 1}`,
        title: args.title || `Suggestion ${i + 1}`,
        description: args.description || '',
        confidence: typeof args.confidence === 'number' ? args.confidence : 50,
        changes,
      });
    } catch (err) {
      console.error('[OpenAI] Failed to parse suggest_improvement args:', err);
    }
  }

  console.log(`[OpenAI] Generated ${suggestions.length} suggestions`);
  return suggestions;
}

// ---------------------------------------------------------------------------
// provideFeedback
// ---------------------------------------------------------------------------

/**
 * Use GPT-4o with provide_feedback tool to evaluate a layout change.
 * Returns feedback if there is an issue, or null if the change looks fine.
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

  const response = await withRetry(
    () => openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: FEEDBACK_SYSTEM_PROMPT },
        { role: 'user', content: userMessage },
      ],
      tools: openaiTools.filter((t) => t.function.name === 'provide_feedback'),
      tool_choice: 'auto',
      temperature: 0.2,
      max_tokens: 2048,
    }),
    'provideFeedback'
  );

  const toolCalls = response.choices[0]?.message?.tool_calls || [];

  if (toolCalls.length === 0) {
    // No issues detected
    return null;
  }

  const fn = parseFunctionToolCall(toolCalls[0] as never);
  if (!fn || fn.name !== 'provide_feedback') return null;

  try {
    const args = JSON.parse(fn.arguments);

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

    console.log(`[OpenAI] Feedback: ${feedback.severity} - ${feedback.type}`);
    return feedback;
  } catch (err) {
    console.error('[OpenAI] Failed to parse provide_feedback args:', err);
    return null;
  }
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

  // Build messages: system + history + current user message
  const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    { role: 'system', content: systemMessage },
  ];

  // Add conversation history (limit to last 20 turns to stay within context)
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

  const response = await withRetry(
    () => openai.chat.completions.create({
      model: 'gpt-4o',
      messages,
      tools: openaiTools.filter(
        (t) =>
          t.function.name === 'suggest_improvement' ||
          t.function.name === 'modify_overlay'
      ),
      tool_choice: 'auto',
      temperature: 0.5,
      max_tokens: 4096,
    }),
    'chat'
  );

  const choice = response.choices[0];
  const assistantMessage = choice?.message?.content || '';
  const toolCalls = choice?.message?.tool_calls || [];

  // Parse tool calls into suggestions or modifications
  const suggestions: { id: string; title: string; changes: ComponentChange[] }[] = [];

  for (let i = 0; i < toolCalls.length; i++) {
    const fn = parseFunctionToolCall(toolCalls[i] as never);
    if (!fn) continue;

    try {
      const args = JSON.parse(fn.arguments);

      if (fn.name === 'suggest_improvement') {
        const changes: ComponentChange[] = (args.changes || []).map(
          (ch: Record<string, unknown>) => ({
            componentId: ch.componentId || '',
            type: ch.type || 'move',
            from: ch.from || {},
            to: ch.to || {},
          })
        );
        suggestions.push({
          id: `chat-sug-${i + 1}`,
          title: args.title || `Suggestion ${i + 1}`,
          changes,
        });
      } else if (fn.name === 'modify_overlay') {
        suggestions.push({
          id: `chat-mod-${i + 1}`,
          title: `Modify ${args.componentId}`,
          changes: [
            {
              componentId: args.componentId,
              type: args.changes.width !== undefined || args.changes.height !== undefined
                ? 'resize'
                : 'move',
              from: {},
              to: args.changes,
            },
          ],
        });
      }
    } catch (err) {
      console.error('[OpenAI] Failed to parse chat tool call:', err);
    }
  }

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
    `[OpenAI] Chat response: ${assistantMessage.slice(0, 80)}... | ${suggestions.length} suggestions | plan: ${!!plan}`
  );

  return result;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Flatten nested DOMElement tree into a flat array.
 */
function flattenElements(elements: DOMElement[]): DOMElement[] {
  const result: DOMElement[] = [];

  function walk(els: DOMElement[]): void {
    for (const el of els) {
      result.push(el);
      if (el.children.length > 0) {
        walk(el.children);
      }
    }
  }

  walk(elements);
  return result;
}
