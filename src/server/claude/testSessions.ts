#!/usr/bin/env tsx

/**
 * Test script for Claude session tree analysis
 *
 * Usage:
 *   tsx test-sessions.ts [directory]
 *
 * If no directory is provided, it will use the default Claude sessions directory
 * for the chess-helper project.
 */

import {
  getSessionTreesJSON,
  getLatestSessions,
  extractSessionData,
  getLatestDescendant,
} from './sessions';
import type { SessionNode } from '@shared/claude/types';
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

/**
 * Print tree structure recursively with colors
 */
function printTree(node: SessionNode, indent: string = '', isLast: boolean = true): void {
  const nodePrefix = indent + (indent ? (isLast ? '└─ ' : '├─ ') : '');
  const nodeInfo = `${node.filename} (${node.messageCount} msgs)`;

  // Add fork indicator if this node has multiple branches
  const forkIndicator = node.branches.length > 1 ? ` ${colors.red}[FORK]${colors.reset}` : '';

  console.log(`${nodePrefix}${colors.cyan}${nodeInfo}${colors.reset}${forkIndicator}`);

  const extendedIndent = indent + (indent ? (isLast ? '   ' : '│  ') : '');

  for (let i = 0; i < node.branches.length; i++) {
    const isLastBranch = i === node.branches.length - 1;
    const branch = node.branches[i];
    if (branch) {
      printTree(branch, extendedIndent, isLastBranch);
    }
  }
}

/**
 * Main test function
 */
async function testSessions(): Promise<void> {
  // Get directory from command line or use first directory in test data
  let directory = process.argv[2];

  if (!directory) {
    // Try to find the first available project directory in test data
    try {
      const entries = await fs.readdir(TEST_BASE_DIR, { withFileTypes: true });
      const dirs = entries.filter((e) => e.isDirectory()).map((e) => e.name);
      if (dirs.length > 0) {
        directory = path.join(TEST_BASE_DIR, dirs[0]!);
      } else {
        console.error(
          `${colors.red}No test project directories found in ${TEST_BASE_DIR}${colors.reset}`,
        );
        process.exit(1);
      }
    } catch {
      console.error(
        `${colors.red}Could not access test directory: ${TEST_BASE_DIR}${colors.reset}`,
      );
      process.exit(1);
    }
  }

  console.log(
    `${colors.bright}${colors.blue}═══════════════════════════════════════════════════════════${colors.reset}`,
  );
  console.log(`${colors.bright}Testing Claude Session Analysis${colors.reset}`);
  console.log(`${colors.dim}Directory: ${directory}${colors.reset}`);
  console.log(
    `${colors.bright}${colors.blue}═══════════════════════════════════════════════════════════${colors.reset}\n`,
  );

  try {
    // Check if directory exists
    await fs.access(directory);

    // Test 1: Get session trees
    console.log(`${colors.yellow}▶ Test 1: Analyzing session trees...${colors.reset}`);
    const result = await getSessionTreesJSON(directory);

    console.log(
      `${colors.green}✓ Found ${result.totalTrees} tree(s) from ${result.totalSessions} session files${colors.reset}\n`,
    );

    // Display each tree
    for (const tree of result.trees) {
      console.log(`${colors.bright}${colors.magenta}📊 Tree Root: ${tree.root}${colors.reset}`);
      console.log(`   ${colors.dim}Root ID: ${tree.rootId}${colors.reset}`);
      console.log(`   ${colors.dim}Total fork points: ${tree.totalBranches}${colors.reset}`);
      console.log(`   ${colors.dim}Max depth: ${tree.maxDepth}${colors.reset}`);

      if (tree.firstMessage) {
        console.log(
          `   ${colors.dim}First message: "${tree.firstMessage.substring(0, 50)}..."${colors.reset}`,
        );
      }

      if (tree.latestUserMessage && tree.totalBranches === 0) {
        console.log(
          `   ${colors.dim}Latest message: "${tree.latestUserMessage.substring(0, 50)}..."${colors.reset}`,
        );
      }

      // Show fork points
      if (tree.forkPoints && tree.forkPoints.length > 0) {
        console.log(`\n   ${colors.yellow}Fork Points:${colors.reset}`);
        for (const fork of tree.forkPoints) {
          console.log(
            `   ${colors.dim}- At ${fork.forkAt} (${fork.branchCount} branches):${colors.reset}`,
          );
          for (const branch of fork.branches) {
            console.log(`     ${colors.cyan}→ ${branch}${colors.reset}`);
          }
        }
      }

      // Show branch endpoints
      if (tree.branches && tree.branches.length > 0) {
        console.log(`\n   ${colors.yellow}Branch Endpoints:${colors.reset}`);
        for (const branch of tree.branches) {
          console.log(
            `   ${colors.dim}- ${branch.endpoint} (${branch.messageCount} msgs)${colors.reset}`,
          );
          if (branch.lastMessage) {
            console.log(
              `     ${colors.dim}Last: "${branch.lastMessage.substring(0, 40)}..."${colors.reset}`,
            );
          }
        }
      }

      // Print tree structure
      console.log(`\n   ${colors.yellow}Structure:${colors.reset}`);
      printTree(tree.structure, '   ', true);
      console.log();
    }

    // Test 2: Get latest sessions
    console.log(`${colors.yellow}▶ Test 2: Getting latest sessions...${colors.reset}`);
    const latestSessions = await getLatestSessions(directory);

    console.log(
      `${colors.green}✓ Found ${latestSessions.length} latest session(s)${colors.reset}\n`,
    );

    for (const session of latestSessions) {
      console.log(`${colors.cyan}Latest Session:${colors.reset}`);
      console.log(`  ${colors.dim}Session ID: ${session.sessionId}${colors.reset}`);
      console.log(`  ${colors.dim}Filename: ${session.filename}${colors.reset}`);
      console.log(`  ${colors.dim}Message count: ${session.messageCount}${colors.reset}`);
      console.log(`  ${colors.dim}Is fork: ${session.isFork ? 'Yes' : 'No'}${colors.reset}`);

      if (session.isFork && session.forkFrom) {
        console.log(`  ${colors.dim}Forked from: ${session.forkFrom}${colors.reset}`);
      }

      if (session.lastMessage) {
        console.log(
          `  ${colors.dim}Last message: "${session.lastMessage.substring(0, 60)}..."${colors.reset}`,
        );
      }
      console.log();
    }

    // Test 3: Test individual file extraction
    console.log(`${colors.yellow}▶ Test 3: Testing individual file extraction...${colors.reset}`);
    const files = await fs.readdir(directory);
    const jsonlFiles = files.filter((f) => f.endsWith('.jsonl'));

    if (jsonlFiles.length > 0) {
      const firstFile = jsonlFiles[0];
      if (firstFile) {
        const testFile = path.join(directory, firstFile);
        const sessionData = await extractSessionData(testFile);

        console.log(`${colors.green}✓ Extracted data from ${firstFile}:${colors.reset}`);
        console.log(`  ${colors.dim}Session ID: ${sessionData.sessionId}${colors.reset}`);
        console.log(`  ${colors.dim}Messages: ${sessionData.messages.length}${colors.reset}`);
        console.log(`  ${colors.dim}UUIDs: ${sessionData.uuids.size}${colors.reset}`);

        if (sessionData.messages.length > 0) {
          const firstMsg = sessionData.messages[0];
          if (firstMsg) {
            console.log(`  ${colors.dim}First message type: ${firstMsg.type}${colors.reset}`);
            console.log(
              `  ${colors.dim}First message preview: "${firstMsg.text.substring(0, 50)}..."${colors.reset}`,
            );
          }
        }
      }
    }

    // Test 4: Test getLatestDescendant
    console.log(`\n${colors.yellow}▶ Test 4: Testing getLatestDescendant...${colors.reset}`);

    // Find a session that has descendants (branches)
    let testSessionId: string | null = null;
    let projectName = path.basename(directory);

    for (const tree of result.trees) {
      // Look for a tree with branches (has descendants)
      if (tree.totalBranches > 0) {
        testSessionId = tree.rootId;
        break;
      }
    }

    if (testSessionId) {
      console.log(`  ${colors.dim}Testing with session ID: ${testSessionId}${colors.reset}`);

      // Get the latest descendant
      const latestDescendantId = await getLatestDescendant(
        projectName,
        testSessionId,
        path.dirname(directory),
      );

      console.log(`  ${colors.green}✓ Latest descendant: ${latestDescendantId}${colors.reset}`);

      // Verify it's different from the root (if there are descendants)
      if (latestDescendantId !== testSessionId) {
        console.log(
          `  ${colors.dim}Found a descendant different from the root session${colors.reset}`,
        );
      } else {
        console.log(
          `  ${colors.dim}No descendants found or input session is the latest${colors.reset}`,
        );
      }

      // Test with a leaf node (should return itself)
      const leafSessions = latestSessions.filter((s) => !s.isFork || s.messageCount > 0);
      if (leafSessions.length > 0 && leafSessions[0]) {
        const leafId = leafSessions[0].sessionId;
        console.log(`\n  ${colors.dim}Testing with leaf session ID: ${leafId}${colors.reset}`);

        const leafDescendant = await getLatestDescendant(
          projectName,
          leafId,
          path.dirname(directory),
        );

        if (leafDescendant === leafId) {
          console.log(`  ${colors.green}✓ Leaf node correctly returns itself${colors.reset}`);
        } else {
          console.log(
            `  ${colors.yellow}⚠ Unexpected: Leaf node returned different ID${colors.reset}`,
          );
        }
      }
    } else {
      console.log(
        `  ${colors.yellow}⚠ No sessions with branches found to test getLatestDescendant${colors.reset}`,
      );

      // Test with any available session (should return itself if no descendants)
      if (result.trees.length > 0 && result.trees[0]) {
        const anySessionId = result.trees[0].rootId;
        console.log(`  ${colors.dim}Testing with session ID: ${anySessionId}${colors.reset}`);

        const descendantId = await getLatestDescendant(
          projectName,
          anySessionId,
          path.dirname(directory),
        );

        if (descendantId === anySessionId) {
          console.log(
            `  ${colors.green}✓ Session with no descendants correctly returns itself${colors.reset}`,
          );
        }
      }
    }

    console.log(
      `\n${colors.bright}${colors.green}✅ All tests completed successfully!${colors.reset}`,
    );
  } catch (error) {
    console.error(`${colors.bright}${colors.red}❌ Error during testing:${colors.reset}`);

    if (error instanceof Error) {
      console.error(`${colors.red}${error.message}${colors.reset}`);

      if ('code' in error && error.code === 'ENOENT') {
        console.error(
          `${colors.yellow}Directory not found. Please provide a valid directory path.${colors.reset}`,
        );
        console.error(`${colors.dim}Usage: tsx test-sessions.ts [directory]${colors.reset}`);
      }
    } else {
      console.error(`${colors.red}Unknown error occurred${colors.reset}`);
    }

    process.exit(1);
  }
}

// Run the test
testSessions().catch(console.error);
