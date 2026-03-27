'use client';

import { useEffect } from 'react';
import FloatingToolbar from '@/components/editor/FloatingToolbar';
import VisualEditor from '@/components/editor/VisualEditor';
import AgentPanel from '@/components/panels/AgentPanel';
import { useEditorStore } from '@/stores/editor-store';
import { useAgentStore } from '@/stores/agent-store';

export default function EditorPage() {
  const setTargetUrl = useEditorStore((s) => s.setTargetUrl);
  const setProjectPath = useEditorStore((s) => s.setProjectPath);
  const connect = useAgentStore((s) => s.connect);
  const disconnect = useAgentStore((s) => s.disconnect);

  useEffect(() => {
    // Set default target URL (demo-target)
    setTargetUrl('http://localhost:3001');

    // Set project path from URL params or default
    const params = new URLSearchParams(window.location.search);
    const projectPath = params.get('project') || process.cwd?.() || '';
    if (projectPath) {
      setProjectPath(projectPath);
    }

    // Connect to WebSocket server
    const wsPort = params.get('wsPort') || '4001';
    connect(`ws://localhost:${wsPort}`);

    return () => {
      disconnect();
    };
  }, [setTargetUrl, setProjectPath, connect, disconnect]);

  return (
    <div className="h-screen flex flex-col bg-gray-950">
      {/* Floating toolbar: fixed, takes no layout space. Offset content with pt. */}
      <FloatingToolbar />

      {/* Main content area */}
      <div className="flex-1 flex overflow-hidden pt-10">
        <VisualEditor />
        <AgentPanel />
      </div>
    </div>
  );
}
