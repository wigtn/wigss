import { WebSocketServer, WebSocket as WS } from 'ws';
import type { IncomingMessage } from 'http';
import type { WSClientMessage, WSServerMessage } from '@/types';

type MessageHandler = (msg: WSClientMessage, ws: WS) => void;
type ConnectionHandler = (ws: WS) => void;

// Rate limiting: max messages per second per client
const MESSAGE_RATE_LIMIT = 30;
const ALLOWED_ORIGINS = ['http://localhost:3000', 'http://localhost:4000', 'http://localhost:4001'];

class WIGSSWebSocketServer {
  private wss: WebSocketServer | null = null;
  private clients: Set<WS> = new Set();
  private messageHandler: MessageHandler | null = null;
  private connectionHandler: ConnectionHandler | null = null;
  private closeHandler: ConnectionHandler | null = null;
  private rateLimitMap = new WeakMap<WS, { count: number; resetTime: number }>();

  /**
   * Start the WebSocket server on the given port.
   */
  start(port: number): void {
    if (this.wss) {
      console.warn('[WS] Server already running. Stopping previous instance.');
      this.stop();
    }

    this.wss = new WebSocketServer({ port });
    console.log(`[WS] WebSocket server listening on ws://localhost:${port}`);

    this.wss.on('connection', (ws: WS, req: IncomingMessage) => {
      // Origin validation
      const origin = req.headers.origin;
      if (origin && !ALLOWED_ORIGINS.includes(origin)) {
        console.warn(`[WS] Rejected connection from origin: ${origin}`);
        ws.close(1008, 'Origin not allowed');
        return;
      }

      this.clients.add(ws);
      console.log(`[WS] Client connected. Total clients: ${this.clients.size}`);

      if (this.connectionHandler) {
        this.connectionHandler(ws);
      }

      ws.on('message', (data: Buffer | string) => {
        // Rate limiting
        const now = Date.now();
        let rateInfo = this.rateLimitMap.get(ws);
        if (!rateInfo || now > rateInfo.resetTime) {
          rateInfo = { count: 0, resetTime: now + 1000 };
        }
        rateInfo.count++;
        this.rateLimitMap.set(ws, rateInfo);
        if (rateInfo.count > MESSAGE_RATE_LIMIT) {
          console.warn('[WS] Rate limit exceeded, dropping message');
          return;
        }

        try {
          const raw = typeof data === 'string' ? data : data.toString('utf-8');
          const parsed = JSON.parse(raw);

          // Validate that parsed message has a type field
          if (!parsed || typeof parsed.type !== 'string') {
            console.warn('[WS] Received message without valid type field:', raw.slice(0, 200));
            this.send(ws, {
              type: 'status',
              payload: { status: 'idle', detail: 'Invalid message: missing type field' },
            });
            return;
          }

          if (this.messageHandler) {
            this.messageHandler(parsed as WSClientMessage, ws);
          }
        } catch (err) {
          console.error('[WS] Failed to parse message:', err);
          this.send(ws, {
            type: 'status',
            payload: { status: 'idle', detail: 'Invalid JSON message' },
          });
        }
      });

      ws.on('close', () => {
        this.clients.delete(ws);
        console.log(`[WS] Client disconnected. Total clients: ${this.clients.size}`);

        if (this.closeHandler) {
          this.closeHandler(ws);
        }
      });

      ws.on('error', (err: Error) => {
        console.error('[WS] Client error:', err.message);
        this.clients.delete(ws);
      });
    });

    this.wss.on('error', (err: Error) => {
      console.error('[WS] Server error:', err.message);
    });
  }

  /**
   * Register a handler for incoming messages from clients.
   */
  onMessage(handler: MessageHandler): void {
    this.messageHandler = handler;
  }

  /**
   * Register a handler for new client connections.
   */
  onConnection(handler: ConnectionHandler): void {
    this.connectionHandler = handler;
  }

  /**
   * Register a handler for client disconnections.
   */
  onClose(handler: ConnectionHandler): void {
    this.closeHandler = handler;
  }

  /**
   * Broadcast a message to all connected clients.
   */
  broadcast(msg: WSServerMessage): void {
    const payload = JSON.stringify(msg);
    let sent = 0;

    for (const client of this.clients) {
      if (client.readyState === WS.OPEN) {
        client.send(payload);
        sent++;
      }
    }

    if (sent > 0) {
      console.log(`[WS] Broadcast "${msg.type}" to ${sent} client(s)`);
    }
  }

  /**
   * Send a message to a specific client.
   */
  send(ws: WS, msg: WSServerMessage): void {
    if (ws.readyState === WS.OPEN) {
      ws.send(JSON.stringify(msg));
    } else {
      console.warn(`[WS] Cannot send to client: readyState=${ws.readyState}`);
    }
  }

  /**
   * Get the number of currently connected clients.
   */
  getClientCount(): number {
    return this.clients.size;
  }

  /**
   * Stop the WebSocket server and close all connections.
   */
  stop(): void {
    if (!this.wss) return;

    for (const client of this.clients) {
      try {
        client.close(1000, 'Server shutting down');
      } catch {
        // Ignore close errors during shutdown
      }
    }

    this.clients.clear();

    this.wss.close((err) => {
      if (err) {
        console.error('[WS] Error closing server:', err.message);
      } else {
        console.log('[WS] Server stopped.');
      }
    });

    this.wss = null;
  }
}

export const wsServer = new WIGSSWebSocketServer();
