/**
 * ClaudeSdkService - Claude Agent SDK thin wrapper
 * Responsibilities:
 * 1. Wrap @anthropic-ai/claude-agent-sdk query() calls
 * 2. Build SDK Options object
 * 3. Handle parameter conversion and environment configuration
 * 4. Provide interrupt() method to interrupt queries
 * Dependencies:
 * - ILogService: Log service
 * - IConfigurationService: Configuration service
 */

import * as vscode from 'vscode';
import * as fs from 'fs';
import { createDecorator } from '../../di/instantiation';
import { ILogService } from '../logService';
import { IConfigurationService } from '../configurationService';
import { AsyncStream } from './transport';

// SDK
import type {
    Options,
    Query,
    CanUseTool,
    PermissionMode,
    SDKUserMessage,
    HookCallbackMatcher,
} from '@anthropic-ai/claude-agent-sdk';

export const IClaudeSdkService = createDecorator<IClaudeSdkService>('claudeSdkService');

/**
 * SDK query parameters
 */
export interface SdkQueryParams {
    inputStream: AsyncStream<SDKUserMessage>;
    resume: string | null;
    canUseTool: CanUseTool;
    model: string | null;  // ← Accepts null, converts internally
    cwd: string;
    permissionMode: PermissionMode | string;  // ← Accepts string
    maxThinkingTokens?: number;  // ← Thinking tokens limit
    resumeSessionAt?: string;    // ← Resume only up to this message UUID (rewind)
    forkSession?: boolean;       // ← Fork to new session ID when resuming
}

/**
 * SDK service interface
 */
export interface IClaudeSdkService {
    readonly _serviceBrand: undefined;

    /**
     * Call Claude SDK to perform query
     */
    query(params: SdkQueryParams): Promise<Query>;

    /**
     * Interrupt ongoing query
     */
    interrupt(query: Query): Promise<void>;

    /**
     * Get the stored pre-write contents for a file path.
     * Returns the content before Claude's Write overwrote it, or null if the file didn't exist.
     * Returns undefined if no content was captured.
     */
    getPreWriteContents(filePath: string): string | null | undefined;
}

const VS_CODE_APPEND_PROMPT = `
  # VSCode Extension Context

  You are running inside a VSCode native extension environment.

  ## Code References in Text
  IMPORTANT: When referencing files or code locations, use markdown link syntax to make them clickable:
  - For files: [filename.ts](src/filename.ts)
  - For specific lines: [filename.ts:42](src/filename.ts#L42)
  - For a range of lines: [filename.ts:42-51](src/filename.ts#L42-L51)
  - For folders: [src/utils/](src/utils/)
  Unless explicitly asked for by the user, DO NOT USE backtickets \` or HTML tags like code for file references - always use markdown [text](link) format.
  The URL links should be relative paths from the root of  the user's workspace.

  ## User Selection Context
  The user's IDE selection (if any) is included in the conversation context and marked with ide_selection tags. This represents code or text the user has highlighted in their editor and may or may not be relevant to their request.

  ## Plan Mode Behavior
  IMPORTANT rules for plan mode in this VSCode extension:
  - When saving plan files, ALWAYS save them to the PROJECT directory at \`.claude/plans/\` (relative to the workspace root), NOT to the user's home directory. Create the directory if it doesn't exist.
  - Plan files written to the default location (~/.claude/plans/) will be automatically copied to the project directory by the extension.
  - CRITICAL: After writing the plan file, do NOT call ExitPlanMode. NEVER call ExitPlanMode on your own. Stay in plan mode and STOP. The plan will be displayed in the chat with an "Execute Plan" button. The user decides when to start.
  - You may ONLY call ExitPlanMode when the user explicitly tells you to execute the plan (e.g. "Führe den Plan aus", "Execute the plan", clicking the Execute button). NEVER call it before that.
  - NEVER present Yes/No choices or ask "Do you want to proceed?" after creating a plan. Just write the plan file and stop.
  - If ExitPlanMode fails with "No plan file found at <path>", you MUST immediately and silently write the plan to that exact <path> and call ExitPlanMode again. Do NOT show any error to the user.

  ## Shell & Bash Commands — MANDATORY
  CRITICAL: The Bash tool runs /usr/bin/bash (Unix shell) — even on Windows. You MUST:
  - ALWAYS use Unix/POSIX syntax: \`mkdir -p\`, \`rm -rf\`, \`cp\`, \`mv\`, \`touch\`, \`ls\`, \`cat\`
  - NEVER use Windows CMD syntax: \`if not exist\`, \`del\`, \`copy\`, \`move\`, \`md\`, \`rd\`, \`dir\`
  - NEVER use PowerShell syntax: \`New-Item\`, \`Remove-Item\`, \`Test-Path\`
  - Use forward slashes in paths: \`mkdir -p "f:/path/to/dir"\` (NOT backslashes)
  - If a Bash command fails with "syntax error" or "command not found", you likely used Windows syntax. Fix it immediately.

  ## Creating New Files — MANDATORY
  The Write tool REQUIRES reading a file before writing to it. For NEW files that don't exist yet:
  1. Create the parent directory: \`mkdir -p "path/to/dir"\`
  2. Create an empty file: \`touch "path/to/file.ext"\` (or \`printf '' > "path/to/file.ext"\`)
  3. Read the (empty) file with the Read tool
  4. THEN use the Write tool to write the actual content
  NEVER skip these steps — the Write tool WILL reject writes to unread files.

  ## Read Before Edit — MANDATORY
  Before EVERY file modification (Edit or Write tool), you MUST freshly read the file with the Read tool — even if you read it earlier in the same conversation.
  - Files can change between steps (linter, formatter, failed edits).
  - The exact text in the Edit tool's old_string MUST match the current file content 1:1.
  - If an Edit fails: re-read the file immediately, then retry. NEVER reuse the same old_string blindly.
  - Rule: Read → Copy exact text → Replace. Always in this order.

  ## Large Files & Tool Parameters — MANDATORY
  - Files over ~2000 lines: ALWAYS use \`offset\` and \`limit\` parameters with the Read tool. NEVER try to load the entire file.
  - Search first with Grep to find the relevant line numbers, then read only that section.
  - Grep tool: ONLY use documented parameters (\`pattern\`, \`path\`, \`glob\`, \`type\`, \`output_mode\`, \`-A\`, \`-B\`, \`-C\`, \`-i\`, \`-n\`, \`head_limit\`, \`offset\`, \`multiline\`). NEVER invent parameters like \`context\` or uppercase \`C\`.`;

/**
 * ClaudeSdkService implementation
 */
export class ClaudeSdkService implements IClaudeSdkService {
    readonly _serviceBrand: undefined;

    /**
     * Stores the file contents BEFORE a Write tool overwrites them.
     * Key = absolute file path, Value = previous file content (or null if file didn't exist).
     */
    private readonly preWriteContentsMap = new Map<string, string | null>();

    constructor(
        private readonly context: vscode.ExtensionContext,
        @ILogService private readonly logService: ILogService,
        @IConfigurationService private readonly configService: IConfigurationService
    ) {
        this.logService.info('[ClaudeSdkService] Initialized');
    }

    /**
     * Get the stored pre-write contents for a file path.
     * Returns the content that was in the file before Claude's Write tool overwrote it.
     * Returns undefined if no pre-write content was captured for this path.
     */
    getPreWriteContents(filePath: string): string | null | undefined {
        return this.preWriteContentsMap.get(filePath);
    }

    /**
     * Call Claude SDK to perform query
     */
    async query(params: SdkQueryParams): Promise<Query> {
        const { inputStream, resume, canUseTool, model, cwd, permissionMode, maxThinkingTokens, resumeSessionAt, forkSession } = params;

        this.logService.info('========================================');
        this.logService.info('ClaudeSdkService.query() starting call');
        this.logService.info('========================================');
        this.logService.info(`📋 Input parameters:`);
        this.logService.info(`  - model: ${model}`);
        this.logService.info(`  - cwd: ${cwd}`);
        this.logService.info(`  - permissionMode: ${permissionMode}`);
        this.logService.info(`  - resume: ${resume}`);
        this.logService.info(`  - maxThinkingTokens: ${maxThinkingTokens ?? 'undefined'}`);

        // Parameter conversion
        const modelParam = model === null ? "default" : model;
        const permissionModeParam = permissionMode as PermissionMode;
        const cwdParam = cwd;

        this.logService.info(`🔄 Parameter conversion:`);
        this.logService.info(`  - modelParam: ${modelParam}`);
        this.logService.info(`  - permissionModeParam: ${permissionModeParam}`);
        this.logService.info(`  - cwdParam: ${cwdParam}`);

        // Build SDK Options
        const options: Options = {
            // Basic parameters
            cwd: cwdParam,
            resume: resume || undefined,
            resumeSessionAt: resumeSessionAt || undefined,
            forkSession: forkSession || undefined,
            model: modelParam,
            permissionMode: permissionModeParam,
            maxThinkingTokens: maxThinkingTokens,
            enableFileCheckpointing: true,

            // CanUseTool callback
            canUseTool,

            // Log callback - capture all stderr output from SDK process
            stderr: (data: string) => {
                const timestamp = new Date().toLocaleTimeString('en-US', { hour12: false });
                const lines = data.trim().split('\n');

                for (const line of lines) {
                    if (!line.trim()) continue;

                    // Detect error level
                    const lowerLine = line.toLowerCase();
                    let level = 'INFO';

                    if (lowerLine.includes('error') || lowerLine.includes('failed') || lowerLine.includes('exception')) {
                        level = 'ERROR';
                    } else if (lowerLine.includes('warn') || lowerLine.includes('warning')) {
                        level = 'WARN';
                    } else if (lowerLine.includes('exit') || lowerLine.includes('terminated')) {
                        level = 'EXIT';
                    }

                    this.logService.info(`[${timestamp}] [SDK ${level}] ${line}`);
                }
            },

            // Environment variables
            env: this.getEnvironmentVariables(),

            // System prompt append
            systemPrompt: {
                type: 'preset',
                preset: 'claude_code',
                append: VS_CODE_APPEND_PROMPT
            },

            // Hooks
            hooks: {
                // PreToolUse: Before tool execution — capture file contents before Write
                PreToolUse: [{
                    matcher: "Edit|Write|MultiEdit",
                    hooks: [async (input, toolUseID, options) => {
                        if ('tool_name' in input) {
                            this.logService.info(`[Hook] PreToolUse: ${input.tool_name}`);
                        }
                        // Capture current file contents BEFORE Write overwrites the file
                        if ('tool_name' in input && input.tool_name === 'Write' && 'tool_input' in input) {
                            const toolInput = input.tool_input as Record<string, unknown>;
                            const filePath = toolInput.file_path as string | undefined;
                            if (filePath) {
                                try {
                                    const content = fs.readFileSync(filePath, 'utf-8');
                                    this.preWriteContentsMap.set(filePath, content);
                                    this.logService.info(`[Hook] Captured pre-write contents for: ${filePath} (${content.length} chars)`);
                                } catch {
                                    // File doesn't exist yet — mark as null (new file)
                                    this.preWriteContentsMap.set(filePath, null);
                                    this.logService.info(`[Hook] File does not exist yet (new file): ${filePath}`);
                                }
                            }
                        }
                        return { continue: true };
                    }]
                }] as HookCallbackMatcher[],
                // PostToolUse: After tool execution — auto-copy plan files to project
                PostToolUse: [{
                    matcher: "Edit|Write|MultiEdit",
                    hooks: [async (input, toolUseID, options) => {
                        if ('tool_name' in input) {
                            this.logService.info(`[Hook] PostToolUse: ${input.tool_name}`);
                        }
                        // Auto-copy plan files from ~/.claude/plans/ to project .claude/plans/
                        if ('tool_name' in input && input.tool_name === 'Write' && 'tool_input' in input) {
                            const toolInput = input.tool_input as Record<string, unknown>;
                            const filePath = toolInput.file_path as string | undefined;
                            if (filePath) {
                                const normalized = filePath.replace(/\\/g, '/');
                                const homeDir = require('os').homedir().replace(/\\/g, '/');
                                const homePlansDir = `${homeDir}/.claude/plans/`;
                                if (normalized.startsWith(homePlansDir) && normalized.endsWith('.md')) {
                                    try {
                                        const fileName = require('path').basename(filePath);
                                        const projectPlansDir = require('path').join(cwd, '.claude', 'plans');
                                        if (!fs.existsSync(projectPlansDir)) {
                                            fs.mkdirSync(projectPlansDir, { recursive: true });
                                        }
                                        const destPath = require('path').join(projectPlansDir, fileName);
                                        fs.copyFileSync(filePath, destPath);
                                        this.logService.info(`[Hook] Auto-copied plan to project: ${destPath}`);
                                    } catch (err: any) {
                                        this.logService.warn(`[Hook] Failed to copy plan to project: ${err.message}`);
                                    }
                                }
                            }
                        }
                        return { continue: true };
                    }]
                }] as HookCallbackMatcher[],
                // PostToolUseFailure: Auto-fix ExitPlanMode "No plan file found" errors
                PostToolUseFailure: [{
                    matcher: "ExitPlanMode",
                    hooks: [async (input, toolUseID, options) => {
                        if ('error' in input && typeof input.error === 'string') {
                            const match = input.error.match(/No plan file found at (.+\.md)/);
                            if (match) {
                                const expectedPath = match[1].trim();
                                this.logService.info(`[Hook] ExitPlanMode failed — expected path: ${expectedPath}`);

                                // Find the most recently written plan file from our preWriteContentsMap or project dir
                                let planContent: string | null = null;

                                // Strategy 1: Check preWriteContentsMap for any .plan.md or .md in .claude/plans
                                for (const [filePath, contents] of this.preWriteContentsMap.entries()) {
                                    // The preWriteContentsMap stores PREVIOUS contents, but the Write tool_input has the NEW content
                                    // We need the actual file content that was written, not what was before
                                    if (filePath.replace(/\\/g, '/').includes('.claude/plans/') && filePath.endsWith('.md')) {
                                        try {
                                            planContent = fs.readFileSync(filePath, 'utf-8');
                                            this.logService.info(`[Hook] Found plan content from: ${filePath}`);
                                            break;
                                        } catch { /* ignore */ }
                                    }
                                }

                                // Strategy 2: Scan project .claude/plans/ for the latest .md file
                                if (!planContent) {
                                    try {
                                        const projectPlansDir = require('path').join(cwd, '.claude', 'plans');
                                        if (fs.existsSync(projectPlansDir)) {
                                            const files = fs.readdirSync(projectPlansDir)
                                                .filter((f: string) => f.endsWith('.md'))
                                                .map((f: string) => ({
                                                    name: f,
                                                    mtime: fs.statSync(require('path').join(projectPlansDir, f)).mtimeMs
                                                }))
                                                .sort((a: any, b: any) => b.mtime - a.mtime);
                                            if (files.length > 0) {
                                                const latestPlan = require('path').join(projectPlansDir, files[0].name);
                                                planContent = fs.readFileSync(latestPlan, 'utf-8');
                                                this.logService.info(`[Hook] Found latest plan from project dir: ${latestPlan}`);
                                            }
                                        }
                                    } catch { /* ignore */ }
                                }

                                if (planContent) {
                                    try {
                                        const dir = require('path').dirname(expectedPath);
                                        if (!fs.existsSync(dir)) {
                                            fs.mkdirSync(dir, { recursive: true });
                                        }
                                        fs.writeFileSync(expectedPath, planContent, 'utf-8');
                                        this.logService.info(`[Hook] Auto-placed plan at SDK path: ${expectedPath}`);
                                        // Suppress the error and tell Claude to retry
                                        return {
                                            suppressOutput: true,
                                            systemMessage: 'The plan file has been automatically placed at the correct location. Call ExitPlanMode again now — it will succeed this time. Do NOT mention any error to the user.'
                                        };
                                    } catch (err: any) {
                                        this.logService.warn(`[Hook] Failed to auto-place plan: ${err.message}`);
                                    }
                                }
                            }
                        }
                        return { continue: true };
                    }]
                }] as HookCallbackMatcher[]
            },

            // CLI executable path
            pathToClaudeCodeExecutable: this.getClaudeExecutablePath(),

            // Extra arguments
            extraArgs: {} as Record<string, string | null>,

            // Setting sources
            // 'user': ~/.claude/settings.json (API key)
            // 'project': .claude/settings.json (project settings, CLAUDE.md)
            // 'local': .claude/settings.local.json (local settings)
            settingSources: ['user', 'project', 'local'],

            includePartialMessages: true,
        };

        // Call SDK
        this.logService.info('');
        this.logService.info('🚀 Preparing to call Claude Agent SDK');
        this.logService.info('----------------------------------------');

        // Get CLI path (avoid TypeScript type inference issues)
        const cliPath = this.getClaudeExecutablePath();

        // Log CLI path
        this.logService.info(`📂 CLI executable:`);
        this.logService.info(`  - Path: ${cliPath}`);

        // Check if CLI exists
        if (!fs.existsSync(cliPath)) {
            this.logService.error(`❌ Claude CLI not found at: ${cliPath}`);
            throw new Error(`Claude CLI not found at: ${cliPath}`);
        }
        this.logService.info(`  ✓ CLI file exists`);

        // Check file permissions
        try {
            const stats = fs.statSync(cliPath);
            this.logService.info(`  - File size: ${stats.size} bytes`);
            this.logService.info(`  - Is executable: ${(stats.mode & fs.constants.X_OK) !== 0}`);
        } catch (e) {
            this.logService.warn(`  ⚠ Could not check file stats: ${e}`);
        }

        // Set entrypoint environment variable
        process.env.CLAUDE_CODE_ENTRYPOINT = "claude-vscode";
        this.logService.info(`🔧 Environment variables:`);
        this.logService.info(`  - CLAUDE_CODE_ENTRYPOINT: ${process.env.CLAUDE_CODE_ENTRYPOINT}`);

        this.logService.info('');
        this.logService.info('📦 Importing SDK...');

        try {
            // Call SDK query() function
            const { query } = await import('@anthropic-ai/claude-agent-sdk');

            this.logService.info(`  - Options: [Configured parameters ${Object.keys(options).join(', ')}]`);

            const result = query({ prompt: inputStream, options });
            return result;
        } catch (error) {
            this.logService.error('');
            this.logService.error('❌❌❌ SDK call failed ❌❌❌');
            this.logService.error(`Error: ${error}`);
            if (error instanceof Error) {
                this.logService.error(`Message: ${error.message}`);
                this.logService.error(`Stack: ${error.stack}`);
            }
            this.logService.error('========================================');
            throw error;
        }
    }

    /**
     * Interrupt ongoing query
     */
    async interrupt(query: Query): Promise<void> {
        try {
            this.logService.info('🛑 Interrupting Claude SDK query');
            await query.interrupt();
            this.logService.info('✓ Query interrupted');
        } catch (error) {
            this.logService.error(`❌ Failed to interrupt query: ${error}`);
            throw error;
        }
    }

    /**
     * Get environment variables
     */
    private getEnvironmentVariables(): Record<string, string> {
        const config = vscode.workspace.getConfiguration("claudix");
        const customVars = config.get<Array<{ name: string; value: string }>>("environmentVariables", []);

        const env = { ...process.env };
        for (const item of customVars) {
            if (item.name) {
                env[item.name] = item.value || "";
            }
        }

        return env as Record<string, string>;
    }

    /**
     * Get Claude CLI executable path
     */
    private getClaudeExecutablePath(): string {
        const binaryName = process.platform === "win32" ? "claude.exe" : "claude";
        const arch = process.arch;

        const nativePath = this.context.asAbsolutePath(
            `resources/native-binaries/${process.platform}-${arch}/${binaryName}`
        );

        if (fs.existsSync(nativePath)) {
            return nativePath;
        }

        return this.context.asAbsolutePath("resources/claude-code/cli.js");
    }
}
