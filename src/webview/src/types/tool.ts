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
  restoreCheckpoint?: (messageId: string) => Promise<void>;
  showNotification?: (message: string, severity: 'info' | 'warning' | 'error') => Promise<any>;
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
