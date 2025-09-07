#!/usr/bin/env bun
/**
 * Build validation script that handles browser-specific dependencies
 * by providing a minimal DOM shim for Node.js environments
 */

// Define minimal DOM element interface
interface MockElement {
  tagName: string;
  innerHTML: string;
  textContent: string;
  setAttribute: () => void;
  getAttribute: () => null;
  appendChild: () => void;
  removeChild: () => void;
  style: Record<string, string>;
}

// Provide minimal DOM shim for browser-specific dependencies
if (typeof document === 'undefined') {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (global as any).document = {
    createElement: (tagName: string): MockElement => ({
      tagName,
      innerHTML: '',
      textContent: '',
      setAttribute: () => {},
      getAttribute: () => null,
      appendChild: () => {},
      removeChild: () => {},
      style: {},
    }),
  };
}

// Validate ESM imports
async function validateBuild(): Promise<void> {
  try {
    // Import UI bundle (these are built JS files, not TS)
    // @ts-expect-error - Built JS files don't have type declarations
    await import('../dist/ui/index.js');
    console.log('✅ UI bundle import works');

    // Import server bundle
    // @ts-expect-error - Built JS files don't have type declarations
    await import('../dist/server/index.js');
    console.log('✅ Server bundle import works');

    console.log('✅ ESM validation complete');
    process.exit(0);
  } catch (error) {
    console.error('❌ Build validation failed:', error);
    process.exit(1);
  }
}

// Execute with proper promise handling
void validateBuild();
