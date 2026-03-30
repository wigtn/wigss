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
}

// === CSS Strategy Types ===

export type CssStrategy = 'tailwind' | 'inline-style' | 'css-module' | 'plain-css';

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
