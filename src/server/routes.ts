import { Hono } from 'hono';
import { getSessionMessages } from './claude/sessions';
import { getProjects, getSessions } from './claude/projects';

const PORT = process.env.PORT || 3000;

export const api = new Hono()
  .get('/check', (c) => {
    return c.json({
      message: 'Hello from the API!',
      timestamp: new Date().toISOString(),
    });
  })

  .get('/config', async (c) => {
    const { req } = c;
    const url = new URL(req.url);
    const host = req.header('host') || `${url.host}:${PORT}`;
    const protocol =
      url.protocol === 'https' || req.header('x-forwarded-proto') === 'https' ? 'wss' : 'ws';

    console.log('Config API called - Returning host:', host, 'Protocol:', protocol);

    return c.json({
      serverPort: PORT,
      wsUrl: `${protocol}://${host}`,
    });
  })

  // Projects endpoint
  .get('/projects', async (c) => {
    try {
      const projects = await getProjects();
      return c.json(projects);
    } catch (error) {
      console.error('Error fetching projects:', error);
      return c.json([], 500);
    }
  })

  // Sessions endpoint for a specific project
  .get('/projects/:projectName/sessions', async (c) => {
    const projectName = c.req.param('projectName');
    const limit = parseInt(c.req.query('limit') || '5', 10);
    const offset = parseInt(c.req.query('offset') || '0', 10);

    try {
      const result = await getSessions(projectName, limit, offset);
      return c.json(result);
    } catch (error) {
      console.error('Error fetching sessions:', error);
      return c.json(
        {
          sessions: [],
          hasMore: false,
          total: 0,
          offset: 0,
          limit: limit,
        },
        500,
      );
    }
  })

  // Session messages endpoint
  .get('/projects/:projectName/sessions/:sessionId/messages', async (c) => {
    const projectName = c.req.param('projectName');
    const sessionId = c.req.param('sessionId');
    const limit = c.req.query('limit') ? parseInt(c.req.query('limit')!, 10) : null;
    const offset = parseInt(c.req.query('offset') || '0', 10);

    try {
      // Get all messages for this session
      console.log(`loading messages for session ${sessionId}`);
      const sessionMessages = await getSessionMessages(projectName, sessionId);
      const totalMessages = sessionMessages.length;

      // Apply pagination if limit is provided
      if (limit !== null) {
        // For scroll-up pagination: get messages from the end, working backwards
        // offset=0 means get the LAST messages (newest)
        // offset=50 means get messages before those
        const startIndex = Math.max(0, totalMessages - offset - limit);
        const endIndex = totalMessages - offset;
        const paginatedMessages = sessionMessages.slice(startIndex, endIndex);

        return c.json({
          messages: paginatedMessages,
          hasMore: startIndex > 0,
          total: totalMessages,
        });
      } else {
        // Return all messages without pagination (backward compatibility)
        return c.json({
          messages: sessionMessages,
        });
      }
    } catch (error) {
      console.error('Error fetching session messages:', error);
      return c.json(
        {
          messages: [],
          hasMore: false,
          total: 0,
          error: error instanceof Error ? error.message : 'Unknown error',
        },
        500,
      );
    }
  });

export type APIRoutes = typeof api;
