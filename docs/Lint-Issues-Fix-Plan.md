# ESLint Issues Fix Plan

## Current Status
- **Total Issues**: 55 (39 errors, 16 warnings)
- **Created**: 2025-09-06
- **Files Affected**: 6 files
- **Main Focus**: ChatInterface.tsx (30 issues), MessageComponent.tsx (15 issues)

## Issue Breakdown by File

### 1. ChatInterface.tsx (30 issues: 27 errors, 3 warnings)
- 18 `@typescript-eslint/no-explicit-any` errors
- 4 `@typescript-eslint/no-floating-promises` errors
- 4 `no-case-declarations` errors
- 2 `no-control-regex` errors
- 1 `no-undef` error (NodeJS)
- 1 unused eslint-disable directive warning
- 1 unused variable warning

### 2. MessageComponent.tsx (15 issues: 3 errors, 12 warnings)
- 11 unused variable warnings (mostly catch block 'e')
- 2 `@typescript-eslint/no-explicit-any` errors
- 1 `@typescript-eslint/no-unused-expressions` error
- 1 unused eslint-disable directive warning

### 3. websocket.tsx (4 issues: 3 errors, 1 warning)
- 2 `@typescript-eslint/no-floating-promises` errors
- 1 `no-undef` error (NodeJS)
- 1 unused variable warning

### 4. messageUtils.ts (3 errors)
- 3 `@typescript-eslint/no-explicit-any` errors

### 5. types.ts (1 error)
- 1 `@typescript-eslint/no-explicit-any` error

### 6. TodoList.tsx (1 error)
- 1 `@typescript-eslint/no-explicit-any` error

### 7. testSpawnClaude.ts (1 warning)
- 1 unused variable warning

## Implementation Phases

### Phase 1: Quick Wins - Unused Variables & Directives (15 minutes)
**Impact**: Fix 14 warnings immediately

#### ChatInterface.tsx
- [ ] Remove unused eslint-disable directive at line 173
- [ ] Fix unused 'e' at line 854 (prefix with underscore: `_e`)

#### MessageComponent.tsx
- [ ] Remove unused eslint-disable directive at line 83
- [ ] Fix unused 'e' variables (lines 442, 556, 608, 675, 699, 781, 821, 1062, 1088) - prefix with underscore
- [ ] Fix unused 'node' and 'className' at line 1119 - prefix with underscore

#### websocket.tsx
- [ ] Fix unused 'error' at line 42 - prefix with underscore

#### testSpawnClaude.ts
- [ ] Fix unused 'timeoutError' at line 164 - prefix with underscore or remove

**Implementation**:
```typescript
// Change from:
} catch (e) {
// To:
} catch (_e) {

// Or for function params:
({ node, className, ...props }) => {
// To:
({ node: _node, className: _className, ...props }) => {
```

### Phase 2: Fix NodeJS Type Issues (10 minutes)
**Impact**: Fix 2 errors

#### ChatInterface.tsx (line 280)
- [ ] Change `NodeJS.Timeout` to `ReturnType<typeof setTimeout>`

#### websocket.tsx (line 8)
- [ ] Change `NodeJS.Timeout` to `ReturnType<typeof setTimeout>`

**Implementation**:
```typescript
// Change from:
const timerRef = useRef<NodeJS.Timeout | null>(null);
// To:
const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
```

### Phase 3: Fix Floating Promises (20 minutes)
**Impact**: Fix 6 errors

#### ChatInterface.tsx
- [ ] Line 1100: Add `void` operator to promise
- [ ] Line 1718: Add `void` operator to promise
- [ ] Line 2151: Add `void` operator to promise
- [ ] Line 2156: Add `void` operator to promise

#### websocket.tsx
- [ ] Line 11: Add `void` operator to promise
- [ ] Line 76: Add `void` operator to promise

**Implementation**:
```typescript
// Change from:
fetchProjectFiles();
// To:
void fetchProjectFiles();

// Or use .catch():
fetchProjectFiles().catch(console.error);
```

### Phase 4: Fix Case Declarations (15 minutes)
**Impact**: Fix 4 errors

#### ChatInterface.tsx
- [ ] Line 1564: Wrap case content in block scope
- [ ] Line 1629: Wrap case content in block scope
- [ ] Line 1635: Wrap case content in block scope
- [ ] Line 1676: Wrap case content in block scope

**Implementation**:
```typescript
// Change from:
case 'something':
  const variable = value;
  break;
// To:
case 'something': {
  const variable = value;
  break;
}
```

### Phase 5: Fix Control Characters in Regex (10 minutes)
**Impact**: Fix 2 errors

#### ChatInterface.tsx
- [ ] Line 1586: Fix control character in regex
- [ ] Line 1587: Fix control character in regex

**Implementation**:
```typescript
// Option 1: Use Unicode escape sequences
const ansiRegex = /[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g;

// Option 2: Disable for specific lines
// eslint-disable-next-line no-control-regex
const ansiRegex = /[\x1b\x9b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g;
```

### Phase 6: Fix Unused Expression (5 minutes)
**Impact**: Fix 1 error

#### MessageComponent.tsx
- [ ] Line 373: Fix unused expression (likely a ternary that should be assigned or returned)

### Phase 7: Replace 'any' Types - Critical (30 minutes)
**Impact**: Fix high-priority any types

Focus on the most critical ones that can be properly typed:

#### types.ts
- [ ] Line 32: Define proper type instead of any

#### messageUtils.ts
- [ ] Lines 10, 18, 39: Define proper types for message transformations

#### TodoList.tsx
- [ ] Line 3: Define proper type for todos

**Implementation**:
```typescript
// Instead of:
function processMessage(msg: any) { ... }

// Use:
interface ProcessedMessage {
  id: string;
  content: string;
  // ... other properties
}
function processMessage(msg: ProcessedMessage) { ... }
```

### Phase 8: Replace 'any' Types - ChatInterface (45 minutes)
**Impact**: Fix 18 any types in ChatInterface.tsx

Priority order (easiest to hardest):
- [ ] Line 37: safeLocalStorage value type
- [ ] Line 344: createDiff return type (already defined in MessageComponent)
- [ ] Lines 416, 426: Type assertions for WebSocketMessage data
- [ ] Lines 677, 688: Message object types
- [ ] Line 854: Catch block parameter
- [ ] Line 1112: setSessionMessages parameter
- [ ] Lines 1183, 1258, 1395, 1431, 1454, 1526: WebSocketMessage data assertions
- [ ] Line 1584: Cursor message data
- [ ] Line 1676: Claude status data
- [ ] Lines 2003, 2078: Type assertions for sendMessage

### Phase 9: Replace 'any' Types - MessageComponent (10 minutes)
**Impact**: Fix 2 any types

- [ ] Line 735: Edit parameter type
- [ ] Line 1119: ReactMarkdown code component props

## Verification Commands

### After Each Phase:
```bash
# Check current error/warning count
bun lint 2>&1 | tail -1

# Check specific file
bun lint src/ui/components/ChatInterface.tsx

# Auto-fix what's possible
bun lint --fix
```

### Final Validation:
```bash
# Full lint check
bun lint

# Type check still passes
bun run typecheck

# Build succeeds
bun run build
```

## Success Criteria

- [ ] Zero ESLint errors
- [ ] Minimal warnings (only justified ones)
- [ ] All TypeScript checks still pass
- [ ] No functionality broken
- [ ] Code remains readable and maintainable

## Priority Order

1. **High Priority** (Phases 1-3): Quick fixes and critical errors
   - Unused variables
   - NodeJS types
   - Floating promises

2. **Medium Priority** (Phases 4-6): Structural issues
   - Case declarations
   - Control regex
   - Unused expressions

3. **Lower Priority** (Phases 7-9): Type improvements
   - Replace any types with proper types
   - Can be done incrementally

## Time Estimate

**Total**: ~3 hours
- Quick wins: 15 min
- NodeJS & Promises: 30 min
- Structural fixes: 25 min
- Type replacements: 1.5 hours
- Testing & validation: 30 min

## Notes

- Many 'any' types were added during TypeScript migration
- Consider creating shared types for commonly used structures
- Some 'any' types might be acceptable if proper typing is too complex
- Use `@typescript-eslint/no-explicit-any` disable comments sparingly
- The unused 'e' in catch blocks is common - underscore prefix is standard solution
- Control characters in regex are for ANSI escape sequences - may need to keep with disable comment

## Risk Areas

1. **Floating Promises**: Make sure adding void doesn't hide real errors
2. **Any Types**: Some might require significant refactoring to type properly
3. **Control Regex**: These are likely needed for ANSI color stripping
4. **Case Declarations**: Ensure block scoping doesn't break logic