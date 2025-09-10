import React, { useState } from 'react';
import {
  isBashInput,
  isFileEditInput,
  isFileMultiEditInput,
  isFileWriteInput,
  isGlobInput,
  isWebFetchInput,
  isWebSearchInput,
  ToolType,
  type PermissionPayload,
} from '@shared/claude/types';
import type { PermissionResult } from '@anthropic-ai/claude-code';
import type {
  BashInput,
  FileEditInput,
  FileMultiEditInput,
  FileWriteInput,
  GlobInput,
  WebFetchInput,
  WebSearchInput,
} from '@anthropic-ai/claude-code/sdk-tools';

interface PermissionRequestMessageProps {
  payload: PermissionPayload;
  onRespond: (result: PermissionResult) => void;
  sessionId: string;
  id: string;
}

type AllowScope = 'once' | 'session' | 'local' | 'project';

export const PermissionRequestMessage: React.FC<PermissionRequestMessageProps> = ({
  payload,
  onRespond,
}) => {
  const [showDenyOptions, setShowDenyOptions] = useState(false);
  const [showAllowOptions, setShowAllowOptions] = useState(false);
  const [denyMessage, setDenyMessage] = useState('');
  const [allowScope, setAllowScope] = useState<AllowScope>('once');
  const [isResolved, setIsResolved] = useState(false);
  const [resolution, setResolution] = useState<'allowed' | 'denied' | null>(null);
  const [resolvedScope, setResolvedScope] = useState<AllowScope | null>(null);
  const [resolvedRuleContent, setResolvedRuleContent] = useState<string | null>(null);
  const [editableRuleContent, setEditableRuleContent] = useState<string>('');

  // Helper function to extract rule content from payload
  const extractRuleContent = (payload: PermissionPayload): string | undefined => {
    const { input, toolName } = payload;

    if (toolName === ToolType.Bash && isBashInput(input)) {
      return (input as BashInput).command;
    } else if (toolName === ToolType.Edit && isFileEditInput(input)) {
      return (input as FileEditInput).file_path;
    } else if (toolName === ToolType.Glob && isGlobInput(input)) {
      return (input as GlobInput).pattern;
    } else if (toolName === ToolType.WebFetch && isWebFetchInput(input)) {
      return (input as WebFetchInput).url;
    } else if (toolName === ToolType.WebSearch && isWebSearchInput(input)) {
      return (input as WebSearchInput).query;
    } else if (toolName === ToolType.Write && isFileWriteInput(input)) {
      return (input as FileWriteInput).file_path;
    } else if (toolName === ToolType.MultiEdit && isFileMultiEditInput(input)) {
      return (input as FileMultiEditInput).file_path;
    }

    return undefined;
  };

  // Initialize editable rule content from payload
  React.useEffect(() => {
    const initialRuleContent = extractRuleContent(payload);
    setEditableRuleContent(initialRuleContent || '');
  }, [payload]);

  const handleDeny = () => {
    // Immediately show resolved state
    setIsResolved(true);
    setResolution('denied');

    // Use the original rule content for deny (not edited)
    const ruleContent = extractRuleContent(payload);
    setResolvedRuleContent(ruleContent || null);

    onRespond({
      behavior: 'deny',
      message: denyMessage || 'Permission denied by user',
      interrupt: false,
    });
  };

  const handleAllow = () => {
    // Immediately show resolved state
    setIsResolved(true);
    setResolution('allowed');
    setResolvedScope(allowScope);

    const result: PermissionResult = {
      behavior: 'allow',
      updatedInput: payload.input as Record<string, unknown>,
    };

    // Use the edited rule content (or fallback to original if empty)
    const finalRuleContent = editableRuleContent || extractRuleContent(payload);
    setResolvedRuleContent(finalRuleContent || null);

    const toolName = payload.toolName;
    // Add updatedPermissions based on scope selection
    if (allowScope !== 'once') {
      if (toolName === ToolType.MCPTool) {
        console.log('Updating permissions for MCP tools is not supported!');
      } else if (finalRuleContent) {
        result.updatedPermissions = [
          {
            type: 'addRules',
            rules: [
              {
                toolName: payload.toolName,
                ruleContent: finalRuleContent,
              },
            ],
            behavior: 'allow',
            destination:
              allowScope === 'session'
                ? 'session'
                : allowScope === 'local'
                  ? 'localSettings'
                  : 'projectSettings',
          },
        ];
      }
    }

    onRespond(result);
  };

  // Show compact resolved state
  if (isResolved) {
    return (
      <div className="bg-gray-50 dark:bg-gray-800 border-l-2 border-blue-300 dark:border-blue-600 pl-3 py-2 text-sm">
        <div className="flex items-center gap-2">
          {resolution === 'allowed' ? (
            <>
              <span className="text-green-600">✅</span>
              <span className="text-gray-700 dark:text-gray-300">
                Permission granted for {payload.toolName}
                {resolvedRuleContent && (
                  <code className="mx-1 px-1 py-0.5 bg-gray-200 dark:bg-gray-700 rounded text-xs">
                    {resolvedRuleContent}
                  </code>
                )}
                {resolvedScope && resolvedScope !== 'once' && (
                  <span className="text-gray-500 dark:text-gray-400">
                    {' '}
                    (
                    {resolvedScope === 'session'
                      ? 'for this session'
                      : resolvedScope === 'local'
                        ? 'local settings'
                        : 'project settings'}
                    )
                  </span>
                )}
              </span>
            </>
          ) : (
            <>
              <span className="text-red-600">❌</span>
              <span className="text-gray-700 dark:text-gray-300">
                Permission denied for {payload.toolName}
                {resolvedRuleContent && (
                  <code className="mx-1 px-1 py-0.5 bg-gray-200 dark:bg-gray-700 rounded text-xs">
                    {resolvedRuleContent}
                  </code>
                )}
                {denyMessage && (
                  <span className="text-gray-500 dark:text-gray-400 italic"> — {denyMessage}</span>
                )}
              </span>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 bg-amber-500 rounded-full flex items-center justify-center flex-shrink-0">
          <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 
  11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
            />
          </svg>
        </div>

        <div className="flex-1">
          <h4 className="font-semibold text-amber-900 dark:text-amber-100 text-base mb-2">
            Permission Request
          </h4>

          <div className="bg-white dark:bg-gray-800 rounded-lg p-3 mb-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Tool:</span>
              <code className="bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded text-sm font-mono">
                {payload.toolName}
              </code>
            </div>

            <details className="mt-2">
              <summary className="text-sm text-gray-600 dark:text-gray-400 cursor-pointer hover:text-gray-800 dark:hover:text-gray-200">
                View input parameters
              </summary>
              <pre className="mt-2 text-xs bg-gray-100 dark:bg-gray-900 p-2 rounded overflow-x-auto text-gray-700 dark:text-gray-300">
                {JSON.stringify(payload.input, null, 2)}
              </pre>
            </details>
          </div>

          {!showDenyOptions && !showAllowOptions ? (
            <div className="space-y-3">
              {/* Allow button */}
              <button
                onClick={() => setShowAllowOptions(true)}
                className="w-full text-left px-4 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium">Allow</span>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                </div>
              </button>

              {/* Deny button */}
              <button
                onClick={() => setShowDenyOptions(true)}
                className="w-full text-left px-4 py-3 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium">Deny</span>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </div>
              </button>
            </div>
          ) : showAllowOptions ? (
            <div className="space-y-3">
              {/* Editable rule content field */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Rule Pattern (edit to customize):
                </label>
                <input
                  type="text"
                  value={editableRuleContent}
                  onChange={(e) => setEditableRuleContent(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg 
                             bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 
                             font-mono text-sm"
                  placeholder={`Enter ${payload.toolName} pattern...`}
                />
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  This pattern will be used for the permission rule. You can use wildcards (*) for
                  broader permissions.
                </p>
              </div>

              {/* Scope selection radio buttons */}
              <div className="space-y-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="allowScope"
                    value="once"
                    checked={allowScope === 'once'}
                    onChange={(e) => setAllowScope(e.target.value as AllowScope)}
                    className="text-green-600"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">Just once</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="allowScope"
                    value="session"
                    checked={allowScope === 'session'}
                    onChange={(e) => setAllowScope(e.target.value as AllowScope)}
                    className="text-green-600"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">For this session</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="allowScope"
                    value="local"
                    checked={allowScope === 'local'}
                    onChange={(e) => setAllowScope(e.target.value as AllowScope)}
                    className="text-green-600"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">Local settings</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="allowScope"
                    value="project"
                    checked={allowScope === 'project'}
                    onChange={(e) => setAllowScope(e.target.value as AllowScope)}
                    className="text-green-600"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">Project settings</span>
                </label>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleAllow}
                  className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded transition-colors text-sm"
                >
                  Confirm Allow
                </button>
                <button
                  onClick={() => {
                    setShowAllowOptions(false);
                    setAllowScope('once'); // Reset to default
                  }}
                  className="px-4 py-2 bg-gray-300 dark:bg-gray-700 hover:bg-gray-400 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded transition-colors text-sm"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <textarea
                value={denyMessage}
                onChange={(e) => setDenyMessage(e.target.value)}
                placeholder="Optional: Explain why (helps Claude understand)..."
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900
  dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 text-sm"
                rows={3}
              />
              <div className="flex gap-2">
                <button
                  onClick={handleDeny}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded transition-colors text-sm"
                >
                  Confirm Deny
                </button>
                <button
                  onClick={() => {
                    setShowDenyOptions(false);
                    setDenyMessage('');
                  }}
                  className="px-4 py-2 bg-gray-300 dark:bg-gray-700 hover:bg-gray-400 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300
  rounded transition-colors text-sm"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
