import { loadPerloxSession } from '../utilities/testDataLoader';

// Cache the loaded messages to avoid re-parsing on every call
let cachedMessages: any[] | null = null;

// Mock API utilities for demo
export const api = {
  // Mock sessionMessages endpoint that returns JSONL data
  sessionMessages: async (projectName: string, sessionId: string, limit: number = 50, offset: number = 0) => {
    // Load and cache messages from JSONL file
    if (!cachedMessages) {
      cachedMessages = await loadPerloxSession();
      console.log('Loaded', cachedMessages.length, 'messages from JSONL for mock API');
    }
    
    // Simulate pagination
    const paginatedMessages = cachedMessages.slice(offset, offset + limit);
    const hasMore = offset + limit < cachedMessages.length;
    
    console.log(`Returning messages ${offset}-${offset + paginatedMessages.length} of ${cachedMessages.length}`);
    
    // Return Response-like object
    return {
      ok: true,
      json: async () => ({
        messages: paginatedMessages,
        hasMore: hasMore,
        total: cachedMessages.length
      })
    };
  }
};

export const authenticatedFetch = (url: string, options?: RequestInit) => {
  return fetch(url, options);
};