import type { Response } from 'express';

interface SSEClient {
  id: string;
  res: Response;
}

class SSEManager {
  private clients: Map<string, SSEClient> = new Map();

  constructor() {
    // Keep-alive heartbeat every 25s
    const timer = setInterval(() => {
      this.broadcast('ping', { time: Date.now() });
    }, 25000);
    timer.unref();
  }

  addClient(id: string, res: Response) {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    this.clients.set(id, { id, res });

    // Send initial connected event
    this.sendToClient(res, 'connected', { clientId: id, timestamp: new Date().toISOString() });
  }

  removeClient(id: string) {
    this.clients.delete(id);
  }

  private sendToClient(res: Response, event: string, data: any) {
    try {
      res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    } catch {
      // Stream error handled on close
    }
  }

  broadcast(event: string, data: any) {
    for (const [id, client] of this.clients.entries()) {
      try {
        client.res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
      } catch {
        this.clients.delete(id);
      }
    }
  }

  getClientCount(): number {
    return this.clients.size;
  }
}

export const sseManager = new SSEManager();
