export async function register() {
  // Only run in Node.js runtime (not Edge, not client)
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { wsServer } = await import('./lib/ws-server');
    const { agent } = await import('./lib/agent/agent-loop');

    const wsPort = parseInt(process.env.WS_PORT || '4001', 10);
    const projectPath = process.env.SOURCE_PATH || process.cwd();

    wsServer.start(wsPort);
    agent.start(projectPath);

    console.log(`[WIGSS] Agent ready — ws://localhost:${wsPort}`);

    // Graceful shutdown
    const shutdown = () => {
      wsServer.stop();
      process.exit(0);
    };
    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);
  }
}
