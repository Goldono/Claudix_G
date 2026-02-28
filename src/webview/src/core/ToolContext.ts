/**
 * ToolContext - Tool execution context
 * Manages Tool execution state and results
 */

import { signal } from 'alien-signals';

type Signal<T> = ReturnType<typeof signal<T>>;

/**
 * Tool result type
 */
export interface ToolResult {
  success: boolean;
  output?: string;
  error?: string;
  is_error?: boolean;
  [key: string]: any;
}

export class ToolContext {
  public readonly channelId: string;
  public readonly toolName: string;
  public readonly inputs: any;

  private toolResultSignal: Signal<ToolResult | undefined>;

  constructor(channelId: string, toolName: string, inputs: any) {
    this.channelId = channelId;
    this.toolName = toolName;
    this.inputs = inputs;
    this.toolResultSignal = signal<ToolResult | undefined>(undefined);
  }

  /**
   * Get Tool result Signal
   */
  get toolResult(): Signal<ToolResult | undefined> {
    return this.toolResultSignal;
  }

  /**
   * Set Tool result
   * @param result Tool execution result
   */
  setToolResult(result: ToolResult): void {
    this.toolResultSignal(result);
  }

  /**
   * Check if Tool executed successfully
   */
  isSuccess(): boolean {
    const result = this.toolResultSignal();
    return result ? result.success && !result.is_error : false;
  }

  /**
   * Check if Tool execution failed
   */
  isError(): boolean {
    const result = this.toolResultSignal();
    return result ? !result.success || result.is_error === true : false;
  }

  /**
   * Get error message
   */
  getErrorMessage(): string | undefined {
    const result = this.toolResultSignal();
    return result?.error;
  }

  /**
   * Get output content
   */
  getOutput(): string | undefined {
    const result = this.toolResultSignal();
    return result?.output;
  }
}
