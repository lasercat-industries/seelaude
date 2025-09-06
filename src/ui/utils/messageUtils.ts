import type { SessionMessage, ContentItem } from '@shared/claude/types';
import { isContentItemArray, extractTextFromContentItem } from '@shared/claude/types';
import type { ToolUseBlock, ToolResultBlock } from '@instantlyeasy/claude-code-sdk-ts';

/**
 * Convert session messages for display in the chat interface
 * Handles tool result correlation and message formatting
 */
export function convertSessionMessages(messages: SessionMessage[]): SessionMessage[] {
  // First pass: collect all tool results indexed by tool_use_id
  const toolResults = new Map<string, ToolResultBlock>();

  messages.forEach((msg) => {
    if (msg.type === 'assistant' && msg.message?.content) {
      const content = msg.message.content;
      if (isContentItemArray(content)) {
        content.forEach((item: ContentItem) => {
          if (item && typeof item === 'object' && 'type' in item && item.type === 'tool_result') {
            const toolResult = item as unknown as ToolResultBlock;
            if (toolResult.tool_use_id) {
              toolResults.set(toolResult.tool_use_id, toolResult);
            }
          }
        });
      }
    }
  });

  // Second pass: process messages and attach tool results
  return messages.map((msg) => {
    // Skip system messages or empty messages
    if (msg.type === 'system' || !msg.message?.content) {
      return msg;
    }

    // Process assistant messages with tool uses
    if (msg.type === 'assistant' && isContentItemArray(msg.message.content)) {
      const processedContent = (msg.message.content as ContentItem[]).map((item: ContentItem) => {
        if (item && typeof item === 'object' && 'type' in item && item.type === 'tool_use') {
          const toolUse = item as unknown as ToolUseBlock;
          const result = toolResults.get(toolUse.id);

          // Attach result to tool use if found
          if (result) {
            return {
              ...toolUse,
              result: result.content,
            };
          }
        }
        return item;
      });

      return {
        ...msg,
        message: {
          ...msg.message,
          content: processedContent,
        },
      };
    }

    return msg;
  });
}

/**
 * Extract a preview of the message content for display
 */
export function getMessagePreview(message: SessionMessage, maxLength: number = 100): string {
  if (!message.message?.content) {
    return '';
  }

  const content = message.message.content;
  let text = '';

  if (typeof content === 'string') {
    text = content;
  } else if (isContentItemArray(content) && content.length > 0) {
    const firstItem = content[0];
    if (firstItem) {
      text = extractTextFromContentItem(firstItem);
    }
  }

  // Clean up whitespace and truncate
  text = text.replace(/\s+/g, ' ').trim();
  return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
}

/**
 * Check if a message contains tool usage
 */
export function hasToolUsage(message: SessionMessage): boolean {
  if (message.type !== 'assistant' || !message.message?.content) {
    return false;
  }

  const content = message.message.content;
  if (isContentItemArray(content)) {
    return content.some(
      (item: ContentItem) =>
        item && typeof item === 'object' && 'type' in item && item.type === 'tool_use',
    );
  }

  return false;
}

/**
 * Count the number of tool uses in a message
 */
export function countToolUses(message: SessionMessage): number {
  if (!hasToolUsage(message)) {
    return 0;
  }

  const content = message.message!.content;
  if (isContentItemArray(content)) {
    return content.filter(
      (item: ContentItem) =>
        item && typeof item === 'object' && 'type' in item && item.type === 'tool_use',
    ).length;
  }

  return 0;
}
