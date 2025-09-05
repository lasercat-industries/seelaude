import type { SessionMessage } from '@shared/claude/types';
import { parseJsonl } from './parseJsonl';

// Import the JSONL file as raw text
// @ts-ignore - We'll handle the import at build time
import jsonlData from './935f5343-163f-461b-a7f3-c7e9b3a4a686.jsonl?raw';

// Load and parse the perlox session data
export async function loadPerloxSession(): Promise<SessionMessage[]> {
  try {
    // If we have the imported data, use it directly
    if (typeof jsonlData === 'string') {
      const messages = parseJsonl(jsonlData);
      return messages;
    }
  } catch (err) {
    console.warn('Failed to parse imported JSONL data:', err);
  }
  
  // Fallback: try to fetch the file
  try {
    const response = await fetch('/935f5343-163f-461b-a7f3-c7e9b3a4a686.jsonl');
    const text = await response.text();
    const messages = parseJsonl(text);
    return messages;
  } catch (err) {
    console.error('Failed to fetch JSONL file:', err);
    return getFallbackMessages();
  }
}

// Fallback messages for demo if JSONL can't be loaded
function getFallbackMessages(): SessionMessage[] {
  return [
    {
      sessionId: 'demo-session',
      type: 'user',
      message: {
        role: 'user',
        content: 'Hello! Can you help me build a parser?'
      },
      timestamp: new Date().toISOString(),
      uuid: 'demo-1'
    },
    {
      sessionId: 'demo-session',
      type: 'assistant',
      message: {
        role: 'assistant',
        content: `I'd be happy to help you build a parser! 

A parser is a program that analyzes text according to a formal grammar. Here's a simple example of a recursive descent parser in TypeScript:

\`\`\`typescript
class Parser {
  private tokens: Token[];
  private current: number = 0;

  parse(): ASTNode {
    return this.expression();
  }

  private expression(): ASTNode {
    // Parse expression logic
    return this.term();
  }
}
\`\`\`

What kind of parser are you looking to build? I can help with:
- Expression parsers (arithmetic, boolean)
- Programming language parsers
- Configuration file parsers (JSON, YAML)
- Custom DSL parsers`
      },
      timestamp: new Date().toISOString(),
      uuid: 'demo-2'
    }
  ];
}