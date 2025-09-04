#!/usr/bin/env tsx

/**
 * Test script for Claude projects loader
 *
 * Usage:
 *   tsx test-projects.ts
 *
 * This tests loading projects, sessions, and messages from the Claude config directory
 */

import { getProjects, getSessions, getAllSessionsForProject, type ClaudeProject } from './projects';
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

// Unused function - commented out to fix warning
// /**
//  * Format bytes to human readable size
//  */
// function formatBytes(bytes: number): string {
//   if (bytes === 0) return '0 Bytes';
//   const k = 1024;
//   const sizes = ['Bytes', 'KB', 'MB', 'GB'];
//   const i = Math.floor(Math.log(bytes) / Math.log(k));
//   return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
// }

/**
 * Test loading all projects
 */
async function testLoadProjects(): Promise<ClaudeProject[]> {
  console.log(`${colors.yellow}▶ Test 1: Loading all Claude projects...${colors.reset}`);
  console.log(`${colors.dim}Using test directory: ${TEST_BASE_DIR}${colors.reset}`);

  try {
    const projects = await getProjects(TEST_BASE_DIR);
    console.log(
      `${colors.green}✓ Successfully loaded ${projects.length} project(s)${colors.reset}\n`,
    );

    if (projects.length === 0) {
      console.log(
        `${colors.dim}No projects found in test directory: ${TEST_BASE_DIR}${colors.reset}`,
      );
      return [];
    }

    // Display project summary
    for (const project of projects) {
      console.log(`${colors.cyan}📁 ${project.displayName}${colors.reset}`);
      console.log(`   ${colors.dim}Name: ${project.name}${colors.reset}`);
      console.log(`   ${colors.dim}Path: ${project.path}${colors.reset}`);

      if (project.sessionMeta) {
        console.log(
          `   ${colors.dim}Sessions: ${project.sessions.length} loaded (${project.sessionMeta.total} total)${colors.reset}`,
        );
        if (project.sessionMeta.hasMore) {
          console.log(`   ${colors.yellow}   ⚠️ More sessions available${colors.reset}`);
        }
      } else {
        console.log(`   ${colors.dim}Sessions: ${project.sessions.length}${colors.reset}`);
      }

      // Show first few sessions
      if (project.sessions.length > 0) {
        console.log(`   ${colors.dim}Recent sessions:${colors.reset}`);
        for (const session of project.sessions.slice(0, 2)) {
          const summary =
            session.summary || session.title || `Session ${session.id.substring(0, 8)}`;
          console.log(
            `   ${colors.dim}  • ${summary.substring(0, 60)}${summary.length > 60 ? '...' : ''}${colors.reset}`,
          );
        }
      }
      console.log();
    }

    return projects;
  } catch (error) {
    if (error instanceof Error) {
      console.error(`${colors.red}❌ Failed to load projects: ${error.message}${colors.reset}`);
    } else {
      console.error(`${colors.red}❌ Failed to load projects${colors.reset}`);
    }
    throw error;
  }
}

/**
 * Test loading sessions for a specific project
 */
async function testLoadSessions(projectName: string): Promise<void> {
  console.log(
    `${colors.yellow}▶ Test 2: Loading sessions for project "${projectName}"...${colors.reset}`,
  );

  try {
    // Test paginated loading
    const page1 = await getSessions(projectName, 3, 0, TEST_BASE_DIR);
    console.log(
      `${colors.green}✓ Page 1: Loaded ${page1.sessions.length} of ${page1.total} sessions${colors.reset}`,
    );
    console.log(`   ${colors.dim}Has more: ${page1.hasMore}${colors.reset}`);
    console.log(`   ${colors.dim}Offset: ${page1.offset}, Limit: ${page1.limit}${colors.reset}`);

    // Display sessions from page 1
    for (const session of page1.sessions) {
      console.log(`\n   ${colors.cyan}Session: ${session.id.substring(0, 8)}...${colors.reset}`);
      console.log(`   ${colors.dim}Messages: ${session.messageCount}${colors.reset}`);
      console.log(
        `   ${colors.dim}Created: ${new Date(session.created).toLocaleString()}${colors.reset}`,
      );
      console.log(
        `   ${colors.dim}Last activity: ${new Date(session.lastActivity).toLocaleString()}${colors.reset}`,
      );
      if (session.summary) {
        console.log(
          `   ${colors.dim}Summary: ${session.summary.substring(0, 80)}${session.summary.length > 80 ? '...' : ''}${colors.reset}`,
        );
      }
    }

    // Test loading page 2 if there are more sessions
    if (page1.hasMore) {
      console.log(`\n${colors.yellow}   Loading page 2...${colors.reset}`);
      const page2 = await getSessions(projectName, 3, 3, TEST_BASE_DIR);
      console.log(
        `${colors.green}✓ Page 2: Loaded ${page2.sessions.length} sessions${colors.reset}`,
      );
      console.log(
        `   ${colors.dim}Showing sessions ${page2.offset + 1}-${page2.offset + page2.sessions.length} of ${page2.total}${colors.reset}`,
      );
    }

    // Test loading all sessions
    console.log(`\n${colors.yellow}   Loading all sessions...${colors.reset}`);
    const allSessions = await getAllSessionsForProject(projectName, TEST_BASE_DIR);
    console.log(`${colors.green}✓ Loaded all ${allSessions.length} sessions${colors.reset}`);
  } catch (error) {
    if (error instanceof Error) {
      console.error(`${colors.red}❌ Failed to load sessions: ${error.message}${colors.reset}`);
    } else {
      console.error(`${colors.red}❌ Failed to load sessions${colors.reset}`);
    }
  }
}

/**
 * Test filesystem checks
 */
async function testFilesystem(): Promise<void> {
  console.log(`${colors.yellow}▶ Test 4: Checking filesystem...${colors.reset}`);

  const projectsDir = TEST_BASE_DIR;

  try {
    // Check test directory
    try {
      await fs.access(projectsDir);
      const projectsDirStat = await fs.stat(projectsDir);
      if (projectsDirStat.isDirectory()) {
        const entries = await fs.readdir(projectsDir);
        const directories = [];

        for (const entry of entries) {
          const entryPath = path.join(projectsDir, entry);
          const stat = await fs.stat(entryPath);
          if (stat.isDirectory()) {
            directories.push(entry);
          }
        }

        console.log(
          `${colors.green}✓ Projects directory contains ${directories.length} project(s)${colors.reset}`,
        );

        // Show directory sizes
        if (directories.length > 0 && directories.length <= 10) {
          console.log(`   ${colors.dim}Project directories:${colors.reset}`);
          for (const dir of directories.slice(0, 5)) {
            const dirPath = path.join(projectsDir, dir);
            const files = await fs.readdir(dirPath);
            const jsonlFiles = files.filter((f) => f.endsWith('.jsonl'));
            console.log(
              `   ${colors.dim}  • ${dir} (${jsonlFiles.length} session files)${colors.reset}`,
            );
          }
          if (directories.length > 5) {
            console.log(`   ${colors.dim}  ... and ${directories.length - 5} more${colors.reset}`);
          }
        }
      }
    } catch (error) {
      if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
        console.log(
          `${colors.yellow}⚠️  Projects directory does not exist: ${projectsDir}${colors.reset}`,
        );
      } else {
        throw error;
      }
    }
  } catch (error) {
    if (error instanceof Error) {
      console.error(`${colors.red}❌ Filesystem check failed: ${error.message}${colors.reset}`);
    } else {
      console.error(`${colors.red}❌ Filesystem check failed${colors.reset}`);
    }
  }
}

/**
 * Main test function
 */
async function runAllTests(): Promise<void> {
  console.log(
    `${colors.bright}${colors.blue}═══════════════════════════════════════════════════════════${colors.reset}`,
  );
  console.log(`${colors.bright}Testing Claude Projects Loader${colors.reset}`);
  console.log(`${colors.dim}Test directory: ${TEST_BASE_DIR}${colors.reset}`);
  console.log(
    `${colors.bright}${colors.blue}═══════════════════════════════════════════════════════════${colors.reset}\n`,
  );

  try {
    // Test 1: Load all projects
    const projects = await testLoadProjects();
    console.log();

    // Test 2: Load sessions for the first project (if any exist)
    if (projects.length > 0) {
      const firstProject = projects[0];
      if (firstProject) {
        await testLoadSessions(firstProject.name);
        console.log();
      }
    }

    // Test 4: Filesystem checks
    await testFilesystem();

    console.log(
      `\n${colors.bright}${colors.green}✅ All tests completed successfully!${colors.reset}`,
    );
  } catch (error) {
    console.error(`\n${colors.bright}${colors.red}❌ Test suite failed:${colors.reset}`);
    if (error instanceof Error) {
      console.error(`${colors.red}${error.message}${colors.reset}`);
      if (error.stack) {
        console.error(`${colors.dim}${error.stack}${colors.reset}`);
      }
    } else {
      console.error(`${colors.red}Unknown error occurred${colors.reset}`);
    }
    process.exit(1);
  }
}

// Run tests
runAllTests().catch(console.error);
