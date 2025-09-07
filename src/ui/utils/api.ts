// Mock API utilities for demo
export const api = {
  // Real sessionMessages endpoint
  sessionMessages: async (
    projectName: string,
    sessionId: string,
    limit: number | null = null,
    offset: number = 0,
  ) => {
    const params = new URLSearchParams();
    if (limit !== null) {
      params.append('limit', limit.toString());
      params.append('offset', offset.toString());
    }
    const queryString = params.toString();
    const url = `/api/projects/${projectName}/sessions/${sessionId}/messages${queryString ? `?${queryString}` : ''}`;

    return fetch(url);
  },
  config: async () => {},
  // Get files for a project
  getFiles: async (projectName: string) => {
    return fetch(`/api/projects/${projectName}/files`);
  },
  getLatestDescendant: async (projectName: string, sessionId: string) => {
    return fetch(`/api/projects/${projectName}/sessions/${sessionId}/latestDescendant`);
  },
};

export const authenticatedFetch = (url: string, options?: RequestInit) => {
  return fetch(url, options);
};
