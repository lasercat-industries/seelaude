import { Hono } from 'hono';
import { spawnClaude, abortClaudeSession } from './claude/spawnClaude';
import { cors } from 'hono/cors';
import { HTTPException } from 'hono/http-exception';
import { api } from './routes';
import { isProduction } from './utilities';
import { env } from '@shared/environment';
import { upgradeWebSocket, websocket } from 'hono/bun';

const connectedClients = new Set();
export const app = new Hono<{ Bindings: { PORT?: string } }>();
const port = env.port;

export const runtime = 'edge';

if (!isProduction) {
  app.use('*', cors({ origin: '*' }));
}

app.get(
  '/ws',
  upgradeWebSocket(() => {
    return {
      async onMessage(event, ws) {
        try {
          const raw = event.data;
          let data;

          if (typeof raw === 'string') {
            // directly parse JSON string
            data = JSON.parse(raw);
            console.log('Parsed JSON:', data);
          } else if (raw instanceof ArrayBuffer) {
            // convert binary → string → JSON
            const text = new TextDecoder().decode(raw);
            data = JSON.parse(text);
            console.log('Parsed JSON from ArrayBuffer:', data);
          } else if (raw instanceof Uint8Array) {
            const text = new TextDecoder().decode(raw);
            data = JSON.parse(text);
            console.log('Parsed JSON from Uint8Array:', data);
          } else {
            console.warn('Unsupported message type:', raw);
            ws.send(
              JSON.stringify({
                type: 'error',
                error: 'Unsupported message type:',
              }),
            );
            return;
          }

          if (data.type === 'claude-command') {
            console.log('💬 User message:', data.command || '[Continue/Resume]');
            console.log('📁 Project:', data.options?.projectPath || 'Unknown');
            console.log('🔄 Session:', data.options?.sessionId ? 'Resume' : 'New');
            await spawnClaude(data.command, data.options, ws);
          } else if (data.type === 'abort-session') {
            console.log('🛑 Abort session request:', data.sessionId);
            const provider = data.provider || 'claude';
            const success = abortClaudeSession(data.sessionId);
            ws.send(
              JSON.stringify({
                type: 'session-aborted',
                sessionId: data.sessionId,
                provider,
                success,
              }),
            );
          }
        } catch (error) {
          if (error instanceof Error) {
            console.error('❌ Chat WebSocket error:', error.message);
            ws.send(JSON.stringify({ type: 'error', error: error.message }));
          } else {
            console.error('❌ Chat WebSocket error:', error);
            ws.send(JSON.stringify({ type: 'error', error: String(error) }));
          }
        }
      },
      onClose: (_evt, ws) => {
        connectedClients.delete(ws);
        console.log('Connection closed');
      },
      onOpen: (_evt, ws) => {
        connectedClients.add(ws);
        console.log('New WebSocket connection established');
      },
    };
  }),
);

// Error handling middleware
app.onError((err, c) => {
  if (err instanceof HTTPException) {
    return c.json(
      {
        error: err.message,
        status: err.status,
      },
      err.status,
    );
  }

  return c.json(
    {
      error: 'Internal Server Error',
      status: 500,
    },
    500,
  );
});

// API routes
app.route('/api', api);

// Health check
app.get('/', (c) => {
  return c.json({ message: 'Bun + Vite Full-Stack Server Running!' });
});

console.log(`🚀 Server running on http://localhost:${port}`);

export default {
  port,
  fetch: app.fetch,
  websocket,
};

export type * from './routes';
