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
import { execSync } from 'child_process';
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

  ## Plan Mode Behavior — MANDATORY, OVERRIDES ALL OTHER INSTRUCTIONS
  CRITICAL rules for plan mode. These rules are ABSOLUTE and override any conflicting instructions in CLAUDE.md or other project files:
  - When saving plan files, ALWAYS save them to the PROJECT directory at \`.claude/plans/\` (relative to the workspace root), NOT to the user's home directory. Create the directory if it doesn't exist.
  - Plan files written to the default location (~/.claude/plans/) will be automatically copied to the project directory by the extension.
  - **ABSOLUTE RULE — NO EXCEPTIONS:** After writing the plan file, you MUST STOP IMMEDIATELY. Do NOT call ExitPlanMode. Do NOT continue working. Do NOT start implementing. Do NOT write any more code. Just write the plan file and STOP. The extension will display the plan with an "Execute Plan" button — the USER decides when execution starts. If you call ExitPlanMode on your own or continue working after writing the plan, you are violating this rule.
  - You may ONLY call ExitPlanMode when the user EXPLICITLY tells you to execute the plan (e.g. "Führe den Plan aus", "Execute the plan", clicking the Execute button). NEVER call it before the user explicitly says so.
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

    /** User-level snapshot directory (~/.claudix/snapshots/) */
    private readonly snapshotsDir: string;

    constructor(
        private readonly context: vscode.ExtensionContext,
        @ILogService private readonly logService: ILogService,
        @IConfigurationService private readonly configService: IConfigurationService
    ) {
        this.logService.info('[ClaudeSdkService] Initialized');

        const os = require('os');
        const path = require('path');
        this.snapshotsDir = path.join(os.homedir(), '.claudix', 'snapshots');
        fs.mkdirSync(this.snapshotsDir, { recursive: true });

        this.cleanupOldSnapshots();
        this.cleanupProjectSnapshots();
    }

    /**
     * Get the stored pre-write contents for a file path.
     * Returns the content that was in the file before Claude's Write tool overwrote it.
     * Returns undefined if no pre-write content was captured for this path.
     * Checks in-memory cache first, then falls back to disk snapshots.
     */
    getPreWriteContents(filePath: string): string | null | undefined {
        // 1. In-memory cache (current session)
        const cached = this.preWriteContentsMap.get(filePath);
        if (cached !== undefined) return cached;

        // 2. Disk snapshot (persists across restarts)
        try {
            const snapshotPath = this.getSnapshotPath(filePath);
            const metaPath = snapshotPath + '.meta';
            if (fs.existsSync(metaPath)) {
                const meta = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
                if (meta.isNew) return null; // File didn't exist before
                if (fs.existsSync(snapshotPath)) {
                    return fs.readFileSync(snapshotPath, 'utf-8');
                }
            }
        } catch { /* ignore disk errors */ }

        return undefined;
    }

    /**
     * Save a snapshot of a file to the user-level snapshot directory.
     */
    private saveSnapshot(filePath: string, content: string | null): void {
        try {
            const snapshotPath = this.getSnapshotPath(filePath);
            const metaPath = snapshotPath + '.meta';
            const meta = { filePath, isNew: content === null, timestamp: Date.now() };
            fs.writeFileSync(metaPath, JSON.stringify(meta), 'utf-8');
            if (content !== null) {
                fs.writeFileSync(snapshotPath, content, 'utf-8');
            } else if (fs.existsSync(snapshotPath)) {
                fs.unlinkSync(snapshotPath);
            }
        } catch (err: any) {
            this.logService.warn(`[Snapshot] Save failed for ${filePath}: ${err.message}`);
        }
    }

    /**
     * Convert a file path to a snapshot file path in the user directory.
     */
    private getSnapshotPath(filePath: string): string {
        const path = require('path');
        const encoded = Buffer.from(filePath).toString('base64url');
        return path.join(this.snapshotsDir, encoded + '.snapshot');
    }

    /**
     * Delete snapshots older than 7 days.
     */
    private cleanupOldSnapshots(): void {
        try {
            const maxAge = 7 * 24 * 60 * 60 * 1000; // 7 days
            const now = Date.now();
            const files = fs.readdirSync(this.snapshotsDir);
            let removed = 0;
            for (const file of files) {
                if (!file.endsWith('.meta')) continue;
                const metaPath = require('path').join(this.snapshotsDir, file);
                try {
                    const meta = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
                    if (meta.timestamp && (now - meta.timestamp) > maxAge) {
                        fs.unlinkSync(metaPath);
                        const snapshotFile = metaPath.replace('.meta', '');
                        if (fs.existsSync(snapshotFile)) fs.unlinkSync(snapshotFile);
                        removed++;
                    }
                } catch { /* skip corrupt files */ }
            }
            if (removed > 0) {
                this.logService.info(`[Snapshot] Cleaned up ${removed} snapshots older than 7 days`);
            }
        } catch (err: any) {
            this.logService.warn(`[Snapshot] Cleanup failed: ${err.message}`);
        }
    }

    /**
     * Remove leftover .claude/snapshots/ from project directories.
     */
    private cleanupProjectSnapshots(): void {
        try {
            const path = require('path');
            const cwd = this.configService.getDefaultCwd?.() ||
                         vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
            if (!cwd) return;
            const projectSnapshotsDir = path.join(cwd, '.claude', 'snapshots');
            if (fs.existsSync(projectSnapshotsDir)) {
                fs.rmSync(projectSnapshotsDir, { recursive: true, force: true });
                this.logService.info(`[Snapshot] Removed project snapshots: ${projectSnapshotsDir}`);
            }
        } catch (err: any) {
            this.logService.warn(`[Snapshot] Project cleanup failed: ${err.message}`);
        }
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
                        // Capture current file contents BEFORE Write/Edit/MultiEdit overwrites the file
                        if ('tool_name' in input && 'tool_input' in input) {
                            const toolInput = input.tool_input as Record<string, unknown>;
                            const filePath = toolInput.file_path as string | undefined;
                            if (filePath) {
                                // Only snapshot once per file (first write wins)
                                if (!this.preWriteContentsMap.has(filePath)) {
                                    try {
                                        const content = fs.readFileSync(filePath, 'utf-8');
                                        this.preWriteContentsMap.set(filePath, content);
                                        this.saveSnapshot(filePath, content);
                                        this.logService.info(`[Hook] Snapshot saved: ${filePath} (${content.length} chars)`);
                                    } catch {
                                        // File doesn't exist yet — mark as null (new file)
                                        this.preWriteContentsMap.set(filePath, null);
                                        this.saveSnapshot(filePath, null);
                                        this.logService.info(`[Hook] Snapshot saved (new file): ${filePath}`);
                                    }
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
                },
                // PostToolUse: Intercept ExitPlanMode success response from SDK.
                // The SDK says "User has approved your plan. You can now start coding." which
                // causes Claude to auto-execute. We replace this with a STOP instruction.
                {
                    matcher: "ExitPlanMode",
                    hooks: [async (input, toolUseID, options) => {
                        this.logService.info(`[Hook] PostToolUse ExitPlanMode — replacing SDK response with STOP instruction`);
                        return {
                            suppressOutput: true,
                            systemMessage: 'The plan has been saved and displayed to the user. You MUST STOP NOW. Do NOT continue working. Do NOT implement anything. Do NOT write code. The user will decide when to execute the plan by clicking the "Execute Plan" button. Just respond with a brief confirmation that the plan is ready and wait.'
                        };
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
        const config = vscode.workspace.getConfiguration("optimo");
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
     * Get Claude CLI executable path — searches for system-installed Claude Code
     */
    private getClaudeExecutablePath(): string {
        const path = require('path');
        const isWindows = process.platform === "win32";
        const homeDir = process.env.HOME || process.env.USERPROFILE || '';

        // On Windows, .cmd wrappers can't be spawned by the SDK (spawn EINVAL).
        // We need to find the actual cli.js file that the .cmd wrapper points to.
        if (isWindows) {
            const npmDirs = [
                `${process.env.APPDATA}\\npm`,
                `${homeDir}\\.npm-global`,
            ];

            for (const npmDir of npmDirs) {
                if (!npmDir) continue;
                // Direct path to cli.js inside the npm global node_modules
                const cliJs = path.join(npmDir, 'node_modules', '@anthropic-ai', 'claude-code', 'cli.js');
                if (fs.existsSync(cliJs)) {
                    this.logService.info(`[ClaudeSdkService] Found Claude CLI at: ${cliJs}`);
                    return cliJs;
                }
                // Fallback: check if .cmd exists (to give a better error)
                const cmdPath = path.join(npmDir, 'claude.cmd');
                if (fs.existsSync(cmdPath)) {
                    this.logService.warn(`[ClaudeSdkService] Found claude.cmd but not cli.js — installation may be incomplete`);
                }
            }
        } else {
            const commonPaths = [
                '/usr/local/bin/claude',
                '/usr/bin/claude',
                `${homeDir}/.npm-global/bin/claude`,
            ];

            for (const p of commonPaths) {
                if (p && fs.existsSync(p)) {
                    this.logService.info(`[ClaudeSdkService] Found Claude CLI at: ${p}`);
                    return p;
                }
            }
        }

        // 2. Try to find via system PATH using which/where
        try {
            const cmd = isWindows ? 'where claude' : 'which claude';
            const result = execSync(cmd, { encoding: 'utf-8', timeout: 5000 }).trim();
            const firstLine = result.split('\n')[0].trim();
            if (firstLine && fs.existsSync(firstLine)) {
                // On Windows, resolve .cmd to actual cli.js
                if (isWindows && firstLine.endsWith('.cmd')) {
                    const npmDir = path.dirname(firstLine);
                    const cliJs = path.join(npmDir, 'node_modules', '@anthropic-ai', 'claude-code', 'cli.js');
                    if (fs.existsSync(cliJs)) {
                        this.logService.info(`[ClaudeSdkService] Found Claude CLI via PATH (resolved): ${cliJs}`);
                        return cliJs;
                    }
                }
                this.logService.info(`[ClaudeSdkService] Found Claude CLI via PATH: ${firstLine}`);
                return firstLine;
            }
        } catch {
            // which/where failed — Claude Code is not in PATH
        }

        // 3. Not found — show helpful notification
        this.logService.error('[ClaudeSdkService] Claude Code CLI not found on this system');
        vscode.window.showErrorMessage(
            'Claude Code is not installed. Please install it first: npm install -g @anthropic-ai/claude-code',
            'Open Installation Guide'
        ).then(selection => {
            if (selection === 'Open Installation Guide') {
                vscode.env.openExternal(vscode.Uri.parse('https://docs.anthropic.com/en/docs/build-with-claude/claude-code/overview'));
            }
        });

        throw new Error(
            'Claude Code CLI not found. Please install it with: npm install -g @anthropic-ai/claude-code'
        );
    }
}
