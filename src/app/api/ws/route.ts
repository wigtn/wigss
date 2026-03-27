import { NextResponse } from 'next/server';

/**
 * WebSocket health check endpoint.
 *
 * Next.js App Router does not natively support WebSocket upgrade.
 * The actual WebSocket server runs on a separate port (4001) via ws-server.ts.
 * This route serves as a health check / info endpoint.
 */
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    message: 'WebSocket server runs on separate port. Connect to ws://localhost:4001',
  });
}
