/**
 * ContentBlockWrapper - Content Block
 * alien-signals tool_result
 * 1. content block
 * 2. Signal toolResult（）
 * 3. setToolResult
 * - tool_use tool_result messages
 * - （ tool_result ， tool_use）
 * - signal UI
 */

import { signal } from 'alien-signals';
import type { ContentBlockType, ToolResultBlock } from './ContentBlock';

export class ContentBlockWrapper {
  /**
 * content block
   */
  public readonly content: ContentBlockType;

  /**
 * Tool Result Signal（）
 * tool_result
   */
  private readonly toolResultSignal = signal<ToolResultBlock | undefined>(undefined);

  /**
 * Tool Use Result（）
 * toolUseResult（）
   */
  public toolUseResult?: any;

  constructor(content: ContentBlockType) {
    this.content = content;
  }

  /**
 * toolResult signal
 * @returns Alien signal
   */
  get toolResult() {
    return this.toolResultSignal;
  }

  /**
 * tool result
 * 🔥 alien-signals API
 * @param result Tool
   */
  setToolResult(result: ToolResultBlock): void {
    this.toolResultSignal(result);
  }

  /**
 * tool_result
   */
  hasToolResult(): boolean {
    return this.toolResultSignal() !== undefined;
  }

  /**
 * tool_result （）
   */
  getToolResultValue(): ToolResultBlock | undefined {
    return this.toolResultSignal();
  }
}
