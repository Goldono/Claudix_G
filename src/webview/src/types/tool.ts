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
  /** Check whether a specific tool_use block has been individually reverted */
  isToolUseReverted?: (toolUseId: string) => boolean;
  /** Mark/unmark a tool_use block as individually reverted (persisted across tab switches) */
  setToolUseReverted?: (toolUseId: string, reverted: boolean) => void;
  /** Register a file edit globally (called when a tool_use renders with a successful result) */
  registerFileEdit?: (toolUseId: string, filePath: string) => void;
  /** Get blocked state: 'none' = can revert, 'locked' = another session has active edits, 'conflict' = permanently impossible */
  getToolUseBlockedState?: (toolUseId: string, filePath: string) => 'none' | 'locked' | 'conflict';
  editAndRestart?: (messageIndex: number, newContent: string) => Promise<void>;
  showNotification?: (message: string, severity: 'info' | 'warning' | 'error') => Promise<any>;
  /** Send a user message to the active Claude session (used by "Execute Plan" button) */
  sendUserMessage?: (message: string) => void;
  /** Write content to a file (used for in-chat plan editing) */
  writeFile?: (filePath: string, content: string) => Promise<{ success: boolean; error?: string }>;
  /** Start a plan in a new session, including all file paths from the current session */
  startPlanInNewSession?: (planContent: string) => void;
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
