'use client';

import { useEffect, useRef } from 'react';
import FloatingToolbar from '@/components/editor/FloatingToolbar';
import VisualEditor from '@/components/editor/VisualEditor';
import AgentPanel from '@/components/panels/AgentPanel';
import { useEditorStore } from '@/stores/editor-store';
import { useAgentStore } from '@/stores/agent-store';

export default function EditorPage() {
  const initialized = useRef(false);

  useEffect(() => {
    // StrictMode guard: only run once
    if (initialized.current) return;
    initialized.current = true;

    // Set default target URL (demo-target)
    useEditorStore.getState().setTargetUrl('http://localhost:3001');

    // Set project path from URL params
    const params = new URLSearchParams(window.location.search);
    // projectPath is resolved server-side from SOURCE_PATH env var.
    // Client passes 'auto' to signal the server should use its default.
    const projectPath = params.get('project') || 'auto';
    useEditorStore.getState().setProjectPath(projectPath);

    // Connect to WebSocket server
    const wsPort = params.get('wsPort') || '4001';
    useAgentStore.getState().connect(`ws://localhost:${wsPort}`);

    // No cleanup — connection persists for the app lifetime
  }, []);

  return (
    <div className="h-screen flex bg-gray-950 relative">
      <FloatingToolbar />
      <VisualEditor />
      <AgentPanel />
    </div>
  );
}
