import type { SessionMessage } from '@shared/claude/types';

/**
 * Parse a JSONL string into SessionMessage objects
 * Each line should be a valid JSON object representing a message
 */
export function parseJsonl(jsonlText: string): SessionMessage[] {
  const messages: SessionMessage[] = [];

  // Split by newlines and filter out empty lines
  const lines = jsonlText.split('\n').filter((line) => line.trim());

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue;

    try {
      const entry = JSON.parse(line);

      // Skip summary entries and other non-message entries
      if (entry.type === 'summary' || !entry.message) {
        continue;
      }

      // Extract the actual message content
      let messageContent: any = entry.message?.content;

      // Handle assistant messages with content array
      if (entry.type === 'assistant' && Array.isArray(messageContent)) {
        // Keep the content as-is for tool uses and text blocks
        messageContent = messageContent;
      } else if (typeof messageContent !== 'string' && messageContent) {
        // For other content types, try to extract text
        messageContent = JSON.stringify(messageContent);
      }

      // Create the SessionMessage
      const message: SessionMessage = {
        sessionId: entry.sessionId || 'unknown',
        type: entry.type || 'user',
        message: {
          role: entry.message?.role || entry.type || 'user',
          content: messageContent,
        },
        timestamp: entry.timestamp || new Date().toISOString(),
        uuid: entry.uuid || `msg-${i}`,
      };

      // Add optional fields if present
      if (entry.parentUuid) {
        (message as any).parentMessageId = entry.parentUuid;
      }

      messages.push(message);
    } catch (err) {
      console.warn(`Failed to parse line ${i + 1}:`, err);
      // Continue parsing other lines
    }
  }

  console.log(`Successfully parsed ${messages.length} messages from ${lines.length} lines`);
  return messages;
}
