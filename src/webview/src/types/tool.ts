/**
 * Tool UI
 * Tool
 */
export interface ToolContext {
  fileOpener: {
    open: (filePath: string, location?: { startLine?: number; endLine?: number; searchText?: string }) => void;
    openContent: (content: string, fileName: string, editable: boolean) => void;
    openDiff: (filePath: string, edits: Array<{ oldString: string; newString: string; replaceAll?: boolean }>) => void;
  };
  revertFileEdit?: (
    action: 'revert' | 'reapply',
    filePath: string,
    editType: 'edit' | 'write',
    options: { oldString?: string; newString?: string; fileContents?: string; previousContents?: string | null }
  ) => Promise<{ success: boolean; error?: string }>;
  restoreCheckpoint?: (messageIndex: number) => Promise<void>;
  isCheckpointRestored?: (messageIndex: number) => boolean;
  restoredAtIndex?: number | null;
  /** Set of tool_use IDs that are currently reverted (persisted across restarts) */
  revertedToolUseIds?: Set<string>;
  /** Mark a tool_use as reverted or un-reverted (persists to localStorage) */
  setToolUseReverted?: (toolUseId: string, reverted: boolean) => void;
  editAndRestart?: (messageIndex: number, newContent: string) => Promise<void>;
  showNotification?: (message: string, severity: 'info' | 'warning' | 'error') => Promise<any>;
  /** Send a user message to the active Claude session (used by "Execute Plan" button) */
  sendUserMessage?: (message: string) => void;
  /** Write content to a file (used for in-chat plan editing) */
  writeFile?: (filePath: string, content: string) => Promise<{ success: boolean; error?: string }>;
}

/**
 * Tool
 * Tool UI
 */
export interface ToolPermissionRenderer {
  /**
 * UI
 * @param context Tool
 * @param inputs Tool
 * @param onModify
   */
  renderPermissionRequest(
    context: ToolContext,
    inputs: any,
    onModify?: (newInputs: any) => void
  ): any;
}
