#!/usr/bin/env tsx

/**
 * Test script for Claude session messages loader
 *
 * Usage:
 *   tsx test-session-messages.ts [projectName] [sessionId]
 *
 * If no arguments provided, it will use the first available project and session
 */

import { getSessionMessages } from './sessions';
import { getProjects } from './projects';
import type { SessionMessage } from '@shared/claude/types';
import { extractTextFromContentItem, isContentItemArray } from '../../shared/claude/types';
import * as path from 'path';
import * as fs from 'fs/promises';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// Get the directory of the current file
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Use local dotclaudedata directory for testing
const TEST_BASE_DIR = path.join(__dirname, 'dotclaudedata');

// ANSI color codes for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
};

// Removed unused formatBytes function

/**
 * Get message preview text
 */
function getMessagePreview(msg: SessionMessage, maxLength: number = 100): string {
  const content = msg.message?.content;
  let text = '';

  if (typeof content === 'string') {
    text = content;
  } else if (content && isContentItemArray(content) && content.length > 0) {
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
 * Analyze tool usage in messages
 */
function analyzeToolUsage(messages: SessionMessage[]): Map<string, number> {
  const toolCounts = new Map<string, number>();

  for (const msg of messages) {
    if (msg.type === 'assistant' && msg.message?.content) {
      const content = msg.message.content;
      if (isContentItemArray(content)) {
        for (const item of content) {
          if (item && typeof item === 'object' && 'type' in item && item.type === 'tool_use') {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const toolName = (item as any).name;
            if (toolName) {
              toolCounts.set(toolName, (toolCounts.get(toolName) || 0) + 1);
            }
          }
        }
      }
    }
  }

  return toolCounts;
}

/**
 * Find file modifications in messages
 */
function findFileModifications(
  messages: SessionMessage[],
): Array<{ tool: string; file: string; timestamp: string }> {
  const modifications: Array<{ tool: string; file: string; timestamp: string }> = [];

  for (const msg of messages) {
    if (msg.type === 'assistant' && msg.message?.content) {
      const content = msg.message.content;
      if (isContentItemArray(content)) {
        for (const item of content) {
          if (item && typeof item === 'object' && 'type' in item && item.type === 'tool_use') {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const tool = item as any;
            if (tool.name === 'Write' || tool.name === 'Edit' || tool.name === 'MultiEdit') {
              const filePath = tool.input?.file_path;
              if (filePath) {
                modifications.push({
                  tool: tool.name,
                  file: filePath,
                  timestamp: msg.timestamp,
                });
              }
            }
          }
        }
      }
    }
  }

  return modifications;
}

/**
 * Test loading messages for a specific session
 */
async function testLoadMessages(projectName: string, sessionId: string): Promise<void> {
  console.log(
    `${colors.yellow}▶ Loading messages for session "${sessionId.substring(0, 8)}..."${colors.reset}`,
  );
  console.log(`  ${colors.dim}Project: ${projectName}${colors.reset}`);

  const startTime = Date.now();

  try {
    const messages = await getSessionMessages(projectName, sessionId, TEST_BASE_DIR);
    const loadTime = Date.now() - startTime;

    console.log(
      `${colors.green}✓ Successfully loaded ${messages.length} messages in ${loadTime}ms${colors.reset}\n`,
    );

    if (messages.length === 0) {
      console.log(`${colors.yellow}  No messages found for this session${colors.reset}`);
      return;
    }

    // Basic statistics
    console.log(`${colors.cyan}📊 Message Statistics:${colors.reset}`);
    const userMessages = messages.filter((m) => m.type === 'user').length;
    const assistantMessages = messages.filter((m) => m.type === 'assistant').length;
    const systemMessages = messages.filter((m) => m.type === 'system').length;

    console.log(`  ${colors.dim}User messages: ${userMessages}${colors.reset}`);
    console.log(`  ${colors.dim}Assistant messages: ${assistantMessages}${colors.reset}`);
    console.log(`  ${colors.dim}System messages: ${systemMessages}${colors.reset}`);

    // Time span analysis
    if (messages.length > 0) {
      const firstMsg = messages[0];
      const lastMsg = messages[messages.length - 1];
      if (firstMsg && lastMsg) {
        const firstTime = new Date(firstMsg.timestamp);
        const lastTime = new Date(lastMsg.timestamp);
        const duration = lastTime.getTime() - firstTime.getTime();
        const hours = Math.floor(duration / (1000 * 60 * 60));
        const minutes = Math.floor((duration % (1000 * 60 * 60)) / (1000 * 60));

        console.log(`  ${colors.dim}First message: ${firstTime.toLocaleString()}${colors.reset}`);
        console.log(`  ${colors.dim}Last message: ${lastTime.toLocaleString()}${colors.reset}`);
        console.log(`  ${colors.dim}Duration: ${hours}h ${minutes}m${colors.reset}`);
      }
    }

    // Tool usage analysis
    console.log(`\n${colors.cyan}🔧 Tool Usage:${colors.reset}`);
    const toolUsage = analyzeToolUsage(messages);

    if (toolUsage.size > 0) {
      // Sort by usage count
      const sortedTools = Array.from(toolUsage.entries()).sort((a, b) => b[1] - a[1]);
      for (const [tool, count] of sortedTools.slice(0, 10)) {
        console.log(`  ${colors.dim}${tool}: ${count} usage(s)${colors.reset}`);
      }
    } else {
      console.log(`  ${colors.dim}No tool usage found${colors.reset}`);
    }

    // File modifications
    console.log(`\n${colors.cyan}📝 File Modifications:${colors.reset}`);
    const modifications = findFileModifications(messages);

    if (modifications.length > 0) {
      // Group by file
      const fileGroups = new Map<string, Array<{ tool: string; timestamp: string }>>();
      for (const mod of modifications) {
        const filename = path.basename(mod.file);
        if (!fileGroups.has(filename)) {
          fileGroups.set(filename, []);
        }
        fileGroups.get(filename)!.push({ tool: mod.tool, timestamp: mod.timestamp });
      }

      // Show first 5 files
      const files = Array.from(fileGroups.entries()).slice(0, 5);
      for (const [file, mods] of files) {
        console.log(`  ${colors.dim}${file}: ${mods.length} modification(s)${colors.reset}`);
        // Show tools used
        const tools = new Set(mods.map((m) => m.tool));
        console.log(`    ${colors.dim}Tools: ${Array.from(tools).join(', ')}${colors.reset}`);
      }

      if (fileGroups.size > 5) {
        console.log(`  ${colors.dim}... and ${fileGroups.size - 5} more files${colors.reset}`);
      }
    } else {
      console.log(`  ${colors.dim}No file modifications found${colors.reset}`);
    }

    // Message samples
    console.log(`\n${colors.cyan}💬 Message Samples:${colors.reset}`);

    // First messages
    console.log(`  ${colors.yellow}First messages:${colors.reset}`);
    for (const msg of messages.slice(0, 2)) {
      const preview = getMessagePreview(msg);
      console.log(`  ${colors.dim}[${msg.type}] ${preview}${colors.reset}`);
    }

    // Last messages
    if (messages.length > 2) {
      console.log(`\n  ${colors.yellow}Last messages:${colors.reset}`);
      for (const msg of messages.slice(-2)) {
        const preview = getMessagePreview(msg);
        console.log(`  ${colors.dim}[${msg.type}] ${preview}${colors.reset}`);
      }
    }
  } catch (error) {
    console.error(
      `${colors.red}❌ Failed to load messages: ${error instanceof Error ? error.message : 'Unknown error'}${colors.reset}`,
    );
    throw error;
  }
}

/**
 * Main test function
 */
async function runTests(): Promise<void> {
  console.log(
    `${colors.bright}${colors.blue}═══════════════════════════════════════════════════════════${colors.reset}`,
  );
  console.log(`${colors.bright}Testing Claude Session Messages Loader${colors.reset}`);
  console.log(`${colors.dim}Test directory: ${TEST_BASE_DIR}${colors.reset}`);
  console.log(
    `${colors.bright}${colors.blue}═══════════════════════════════════════════════════════════${colors.reset}\n`,
  );

  try {
    // Check test directory exists
    await fs.access(TEST_BASE_DIR);

    let projectName = process.argv[2];
    let sessionId = process.argv[3];

    // If no arguments provided, find first available project and session
    if (!projectName) {
      console.log(
        `${colors.yellow}No project specified, finding first available...${colors.reset}\n`,
      );

      const projects = await getProjects(TEST_BASE_DIR);
      if (projects.length === 0) {
        throw new Error(`No projects found in ${TEST_BASE_DIR}`);
      }

      const project = projects[0];
      if (!project) {
        throw new Error('No project available');
      }

      projectName = project.name;
      console.log(
        `${colors.green}✓ Using project: ${project.displayName} (${projectName})${colors.reset}`,
      );

      // If no session specified, use first session from project
      if (!sessionId && project.sessions.length > 0) {
        const session = project.sessions[0];
        if (session) {
          sessionId = session.id;
          console.log(
            `${colors.green}✓ Using session: ${sessionId.substring(0, 8)}...${colors.reset}`,
          );
          if (session.summary) {
            console.log(`  ${colors.dim}Summary: ${session.summary}${colors.reset}`);
          }
        }
      }
    }

    if (!sessionId) {
      throw new Error('No session ID provided and no sessions found in project');
    }

    console.log();

    // Run the test
    await testLoadMessages(projectName, sessionId);

    console.log(`\n${colors.bright}${colors.green}✅ Test completed successfully!${colors.reset}`);
  } catch (error) {
    console.error(`\n${colors.bright}${colors.red}❌ Test failed:${colors.reset}`);
    if (error instanceof Error) {
      console.error(`${colors.red}${error.message}${colors.reset}`);
      if (error.stack && process.env.DEBUG) {
        console.error(`${colors.dim}${error.stack}${colors.reset}`);
      }
    } else {
      console.error(`${colors.red}Unknown error occurred${colors.reset}`);
    }
    process.exit(1);
  }
}

// Run tests
runTests().catch(console.error);
