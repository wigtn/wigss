// === Component Types ===

export type ComponentType =
  | 'navbar' | 'header' | 'hero' | 'grid' | 'card'
  | 'sidebar' | 'footer' | 'section' | 'form' | 'modal';

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface DetectedComponent {
  id: string;
  name: string;
  type: ComponentType;
  elementIds: string[];
  boundingBox: BoundingBox;
  sourceFile: string;
  reasoning: string;
  children?: DetectedComponent[];
  depth?: number;
  fullClassName?: string;
  cssInfo?: CssStrategyInfo;
  textHint?: string;
}

// === CSS Strategy Types ===

export type CssStrategy = 'tailwind' | 'inline-style' | 'css-module' | 'plain-css' | 'html-css';

export interface CssStrategyInfo {
  strategy: CssStrategy;
  bindingName?: string;
  stylesheetPath?: string;
  cssClassName?: string;
  styleExpression?: string;
}

// === Change Types ===

export interface ComponentChange {
  componentId: string;
  type: 'move' | 'resize';
  from: { x?: number; y?: number; width?: number; height?: number };
  to: { x?: number; y?: number; width?: number; height?: number };
}

export interface CodeDiff {
  file: string;
  original: string;
  modified: string;
  lineNumber: number;
  explanation: string;
  strategy?: CssStrategy;
}

// === Feedback Types ===

export type FeedbackType = 'sizing' | 'spacing' | 'alignment' | 'min_size' | 'viewport' | 'overlap';
export type FeedbackSeverity = 'warning' | 'error';

export interface AgentFeedback {
  id: string;
  type: FeedbackType;
  severity: FeedbackSeverity;
  message: string;
  affectedComponents: string[];
  suggestedChanges: ComponentChange[];
}

// === Chat Types ===

export interface ChatMessage {
  role: 'user' | 'agent';
  content: string;
  suggestions?: { id: string; title: string; changes: ComponentChange[] }[];
  plan?: { planId: string; steps: string[]; awaiting_confirm: boolean };
  timestamp: number;
}

// === Scan Types ===

export interface DOMElement {
  id: string;
  tagName: string;
  className: string;
  boundingBox: BoundingBox;
  visible: boolean;
  children: DOMElement[];
  attributes: Record<string, string>;
  textContent: string;
}

export interface ScanResult {
  url: string;
  timestamp: number;
  elements: DOMElement[];
  screenshot?: string;
  sourceFiles: string[];
}

// === Store Types ===

export type AgentStatus =
  | 'idle' | 'scanning' | 'detecting' | 'suggesting'
  | 'feedback' | 'chatting' | 'refactoring' | 'applying' | 'verifying';

export interface AgentLog {
  timestamp: number;
  step: string;
  detail: string;
}

export interface VerificationResult {
  passed: boolean;
  attempts: { mismatches: unknown[]; autoFix: unknown }[];
  totalAttempts: number;
}

// === v2.2 Fidelity Verification ===

/**
 * What the pipeline *expected* to be true about a component after applying an intent.
 * Produced alongside a CodeDiff and consumed by the post-apply verification loop.
 */
export interface FidelityExpectation {
  componentId: string;
  expectedStyles: Record<string, string>;  // camelCase, absolute values where possible
  sourceFile: string;
}

/**
 * A single mismatch between expected and actual computed style.
 */
export interface FidelityMismatch {
  componentId: string;
  property: string;
  expected: string;
  actual: string;
  deltaPx?: number;
}

/**
 * Result of comparing an expectation against the re-measured component state.
 */
export interface FidelityReport {
  passed: boolean;
  componentId: string;
  mismatches: FidelityMismatch[];
}

// === WebSocket Message Types ===

export type WSClientMessage =
  | { type: 'scan'; payload: { url: string; projectPath: string } }
  | { type: 'drag_end'; payload: { componentId: string; from: BoundingBox; to: BoundingBox } }
  | { type: 'resize_end'; payload: { componentId: string; from: BoundingBox; to: BoundingBox } }
  | { type: 'save'; payload: { changes: ComponentChange[] } }
  | { type: 'chat'; payload: { message: string } }
  | { type: 'mobile_view'; payload: { targetWidth: number } }
  | { type: 'accept_suggestion'; payload: { suggestionId: string; changes: ComponentChange[] } }
  | { type: 'accept_feedback'; payload: { feedbackId: string; changes: ComponentChange[] } }
  | { type: 'plan_confirmed'; payload: { planId: string } }
  | { type: 'apply'; payload: { diffs: CodeDiff[] } }
  | { type: 'components_synced'; payload: { components: DetectedComponent[] } }
  | { type: 'auto_fix'; payload: { feedbackId: string; message: string; affectedComponents: string[]; type: string } };

export type WSServerMessage =
  | { type: 'status'; payload: { status: AgentStatus; detail?: string } }
  | { type: 'components_detected'; payload: { components: DetectedComponent[] } }
  | { type: 'suggestion'; payload: { id: string; title: string; description: string; changes: ComponentChange[]; confidence: number } }
  | { type: 'feedback'; payload: AgentFeedback }
  | { type: 'chat_response'; payload: { message: string; suggestions?: ChatMessage['suggestions']; plan?: ChatMessage['plan'] } }
  | { type: 'plan_confirm'; payload: { planId: string; steps: string[]; message: string } }
  | { type: 'auto_modify'; payload: { componentId: string; change: ComponentChange } }
  | { type: 'diff_preview'; payload: { diffs: CodeDiff[] } }
  | { type: 'refactoring_progress'; payload: { step: string; detail: string } }
  | { type: 'verification_result'; payload: VerificationResult }
  | { type: 'file_changed'; payload: { file: string } };

// === Suggestion Type ===

export interface Suggestion {
  id: string;
  title: string;
  description: string;
  changes: ComponentChange[];
  confidence: number;
}

// === v2.2 Fidelity Pipeline Types ===
// Intent-based refactor pipeline: StyleIntent → TargetLocator → SourceRewriter.
// See docs/prd/PRD_wigss-v2.2-fidelity-pipeline.md.

/**
 * Source file input for locators and rewriters.
 * Shared boundary type between filesystem I/O and pure pipeline functions.
 */
export interface SourceInput {
  path: string;
  content: string;
}

/**
 * Language-agnostic description of "what the user wants this component to look like".
 * targetStyles uses camelCase JS property names (e.g., `marginTop`, `backgroundColor`).
 * Rewriters convert to kebab-case where needed (CSS files).
 */
export interface StyleIntent {
  componentId: string;
  targetStyles: Record<string, string>;
  sourceHint?: {
    file?: string;
    className?: string;
    elementPath?: string[];
    componentName?: string;
    cssStrategy?: CssStrategyInfo;
  };
}

/**
 * How the rewriter should apply the intent at the located position.
 */
export type WriteMode =
  | 'replace-attribute'   // JSX className / HTML class attr swap
  | 'replace-css-rule'    // existing CSS rule body update
  | 'add-css-rule'        // append new CSS rule to stylesheet
  | 'add-inline-style'    // inject `style=""` on an element
  | 'add-style-block';    // inject new <style> block into an HTML doc

/**
 * Where a specific intent should be written. Produced by a TargetLocator.
 * `range` uses character offsets into the source content.
 */
export interface TargetLocation {
  file: string;
  range: { start: number; end: number };
  writeMode: WriteMode;
  metadata?: Record<string, unknown>;
}

/**
 * Language-specific strategy for finding where a StyleIntent should be applied.
 * Must be deterministic and pure (no filesystem side effects).
 */
export interface TargetLocator {
  readonly id: string;
  locate(intent: StyleIntent, sources: SourceInput[]): TargetLocation | null;
}

/**
 * Language-specific strategy for producing a CodeDiff from a TargetLocation.
 * Returning `null` signals "cannot rewrite" — dispatcher will try fallback rewriters.
 * Rewriters must be all-or-nothing: never return a partial diff.
 */
export interface SourceRewriter {
  readonly id: string;
  rewrite(target: TargetLocation, intent: StyleIntent, sources: SourceInput[]): CodeDiff | null;
}
