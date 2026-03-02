/**
 * Claude Agent Handlers -
 * ： WebView
 * ： HandlerContext
 */

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { execFile } from 'child_process';
import type {
    InitRequest,
    InitResponse,
    GetClaudeStateRequest,
    GetClaudeStateResponse,
    GetMcpServersRequest,
    GetMcpServersResponse,
    GetAssetUrisRequest,
    GetAssetUrisResponse,
    OpenFileRequest,
    OpenFileResponse,
    GetCurrentSelectionResponse,
    ShowNotificationRequest,
    ShowNotificationResponse,
    NewConversationTabRequest,
    NewConversationTabResponse,
    RenameTabRequest,
    RenameTabResponse,
    OpenDiffRequest,
    OpenDiffResponse,
    ListSessionsRequest,
    ListSessionsResponse,
    GetSessionRequest,
    GetSessionResponse,
    ExecRequest,
    ExecResponse,
    ListFilesRequest,
    ListFilesResponse,
    StatPathRequest,
    StatPathResponse,
    OpenContentRequest,
    OpenContentResponse,
    OpenURLRequest,
    OpenURLResponse,
    // GetAuthStatusRequest,
    // GetAuthStatusResponse,
    // LoginRequest,
    // LoginResponse,
    // SubmitOAuthCodeRequest,
    // SubmitOAuthCodeResponse,
    OpenConfigFileRequest,
    OpenConfigFileResponse,
    OpenClaudeInTerminalRequest,
    OpenClaudeInTerminalResponse,
    RevertFileEditRequest,
    RevertFileEditResponse,
    GetUsageInfoRequest,
    GetUsageInfoResponse,
    ReadFileContentsRequest,
    ReadFileContentsResponse,
    ShowEditDiffRequest,
    ShowEditDiffResponse,
} from '../../../shared/messages';
import type { HandlerContext } from './types';
import type { PermissionMode, SDKUserMessage } from '@anthropic-ai/claude-agent-sdk';
import { AsyncStream } from '../transport/AsyncStream';
/**
 */
export async function handleInit(
    _request: InitRequest,
    context: HandlerContext
): Promise<InitResponse> {
    const { configService, workspaceService, logService, agentService } = context;

 logService.info('[handleInit] ');

 // TODO: AuthManager
    // const authStatus = null;

    const modelSetting = configService.getValue<string>('claudix.selectedModel') || 'default';

    const defaultCwd = workspaceService.getDefaultWorkspaceFolder()?.uri.fsPath || process.cwd();

 // TODO: openNewInTab
    const openNewInTab = false;

 // thinking level ()
    const thinkingLevel = 'default_on';

    return {
        type: "init_response",
        state: {
            defaultCwd,
            openNewInTab,
            // authStatus,
            modelSetting,
            platform: process.platform,
            thinkingLevel
        }
    };
}

/**
 * Claude
 */
export async function handleGetClaudeState(
    _request: GetClaudeStateRequest,
    context: HandlerContext
): Promise<GetClaudeStateResponse> {
    const { logService } = context;

 logService.info('[handleGetClaudeState] Claude ');

    const config = await loadConfig(context);

    return {
        type: "get_claude_state_response",
        config
    };
}

/**
 * MCP
 */
export async function handleGetMcpServers(
    _request: GetMcpServersRequest,
    context: HandlerContext,
    channelId?: string
): Promise<GetMcpServersResponse> {
    return await getMcpServers(context, channelId);
}

/**
 * URI
 */
export async function handleGetAssetUris(
    _request: GetAssetUrisRequest,
    context: HandlerContext
): Promise<GetAssetUrisResponse> {
    return {
        type: "asset_uris_response",
        assetUris: getAssetUris(context)
    };
}

/**
 */
export async function handleOpenFile(
    request: OpenFileRequest,
    context: HandlerContext
): Promise<OpenFileResponse> {
    const { logService, workspaceService, fileSystemService } = context;
    const cwd = workspaceService.getDefaultWorkspaceFolder()?.uri.fsPath || process.cwd();
    const { filePath, location } = request;

    try {
        const searchResults = await fileSystemService.findFiles(filePath, cwd);
        const resolvedPath = await fileSystemService.resolveExistingPath(filePath, cwd, searchResults);
        const stat = await fs.promises.stat(resolvedPath);
        const uri = vscode.Uri.file(resolvedPath);

        if (stat.isDirectory()) {
            await vscode.commands.executeCommand("revealInExplorer", uri);
            return { type: "open_file_response" };
        }

        const doc = await vscode.workspace.openTextDocument(uri);
        const editor = await vscode.window.showTextDocument(doc, { preview: false });

        if (location) {
            let startLine = Math.max((location.startLine ?? 1) - 1, 0);
            let endLine = Math.max((location.endLine ?? location.startLine ?? 1) - 1, startLine);

            if (location.searchText) {
                const text = doc.getText();
                const needle = location.searchText.replace(/\r\n/g, '\n');
                const haystack = text.replace(/\r\n/g, '\n');
                const idx = haystack.indexOf(needle);
                if (idx >= 0) {
                    const beforeMatch = haystack.substring(0, idx);
                    startLine = beforeMatch.split('\n').length - 1;
                    endLine = startLine + needle.split('\n').length - 1;
                }
            }

            const startColumn = Math.max(location.startColumn ?? 0, 0);
            const endColumn = Math.max(location.endColumn ?? startColumn, startColumn);

            const range = new vscode.Range(
                new vscode.Position(startLine, startColumn),
                new vscode.Position(endLine, endColumn)
            );

            editor.revealRange(range, vscode.TextEditorRevealType.InCenter);
            editor.selection = new vscode.Selection(range.start, range.end);
        }

        return { type: "open_file_response" };
    } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
 logService.error(`[handleOpenFile] : ${errorMsg}`);
        throw new Error(`Failed to open file: ${errorMsg}`);
    }
}

/**
 */
export async function handleGetCurrentSelection(
    context: HandlerContext
): Promise<GetCurrentSelectionResponse> {
    const editor = vscode.window.activeTextEditor;
    if (!editor || editor.selection.isEmpty || editor.document.uri.scheme !== "file") {
        return {
            type: "get_current_selection_response",
            selection: null
        };
    }

    const document = editor.document;
    const selection = editor.selection;

    return {
        type: "get_current_selection_response",
        selection: {
            filePath: document.uri.fsPath,
            startLine: selection.start.line + 1,
            endLine: selection.end.line + 1,
            startColumn: selection.start.character,
            endColumn: selection.end.character,
            selectedText: document.getText(selection)
        }
    };
}

/**
 */
export async function handleShowNotification(
    request: ShowNotificationRequest,
    context: HandlerContext
): Promise<ShowNotificationResponse> {
    const { message, severity, buttons = [] } = request;

    let result: string | undefined;
    switch (severity) {
        case "error":
            result = await vscode.window.showErrorMessage(message, ...buttons);
            break;
        case "warning":
            result = await vscode.window.showWarningMessage(message, ...buttons);
            break;
        case "info":
        default:
            result = await vscode.window.showInformationMessage(message, ...buttons);
            break;
    }

    return {
        type: "show_notification_response",
        buttonValue: result
    };
}

/**
 * （）
 */
export async function handleNewConversationTab(
    _request: NewConversationTabRequest,
    context: HandlerContext
): Promise<NewConversationTabResponse> {
    const { logService } = context;

    try {
        await vscode.commands.executeCommand("claudix.chatView.focus");
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        logService.warn(`Failed to focus chat view: ${message}`);
    }
    return {
        type: "new_conversation_tab_response"
    };
}

/**
 * （）
 */
export async function handleRenameTab(
    _request: RenameTabRequest,
    context: HandlerContext
): Promise<RenameTabResponse> {
    return {
        type: "rename_tab_response"
    };
}

/**
 * Diff
 */
export async function handleOpenDiff(
    request: OpenDiffRequest,
    context: HandlerContext,
    signal: AbortSignal
): Promise<OpenDiffResponse> {
    const { logService, workspaceService, fileSystemService } = context;
    const cwd = workspaceService.getDefaultWorkspaceFolder()?.uri.fsPath || process.cwd();

    logService.info(`Opening diff for: ${request.originalFilePath}`);

    const originalPath = fileSystemService.resolveFilePath(request.originalFilePath, cwd);
    const fallbackNewPath = request.newFilePath ? fileSystemService.resolveFilePath(request.newFilePath, cwd) : undefined;

    if (signal.aborted) {
        return {
            type: "open_diff_response",
            newEdits: request.edits
        };
    }

    const rightPath = await prepareDiffRightFile(originalPath, fallbackNewPath, request.edits, context);

    const leftExists = await fileSystemService.pathExists(originalPath);
    const leftPath = leftExists
        ? originalPath
        : await fileSystemService.createTempFile(path.basename(request.originalFilePath || request.newFilePath || "untitled"), "");

    const leftUri = vscode.Uri.file(leftPath);
    const rightUri = vscode.Uri.file(rightPath);

    const diffTitle = `${path.basename(request.originalFilePath || request.newFilePath || rightPath)} (Claude)`;

    await vscode.commands.executeCommand(
        "vscode.diff",
        leftUri,
        rightUri,
        diffTitle,
        { preview: true }
    );

    return {
        type: "open_diff_response",
        newEdits: request.edits
    };
}

/**
 */
export async function handleListSessions(
    _request: ListSessionsRequest,
    context: HandlerContext
): Promise<ListSessionsResponse> {
    const { logService, sessionService, workspaceService } = context;

    try {
        const cwd = workspaceService.getDefaultWorkspaceFolder()?.uri.fsPath || process.cwd();
        const sessions = await sessionService.listSessions(cwd);

 // worktree isCurrentWorkspace
        const sessionsWithMeta = sessions.map(session => ({
            ...session,
            worktree: undefined,
            isCurrentWorkspace: true
        }));

        return {
            type: "list_sessions_response",
            sessions: sessionsWithMeta
        };
    } catch (error) {
        logService.error(`Failed to list sessions: ${error}`);
        return {
            type: "list_sessions_response",
            sessions: []
        };
    }
}

/**
 */
export async function handleGetSession(
    request: GetSessionRequest,
    context: HandlerContext
): Promise<GetSessionResponse> {
    const { logService, sessionService, workspaceService } = context;

    try {
        const cwd = workspaceService.getDefaultWorkspaceFolder()?.uri.fsPath || process.cwd();
        const messages = await sessionService.getSession(request.sessionId, cwd);

        return {
            type: "get_session_response",
            messages
        };
    } catch (error) {
        logService.error(`Failed to get session: ${error}`);
        return {
            type: "get_session_response",
            messages: []
        };
    }
}

/**
 */
export async function handleExec(
    request: ExecRequest,
    context: HandlerContext
): Promise<ExecResponse> {
    const { workspaceService } = context;
    const cwd = workspaceService.getDefaultWorkspaceFolder()?.uri.fsPath || process.cwd();
    const { command, params } = request;

    return new Promise<ExecResponse>((resolve) => {
        const { spawn } = require('child_process');
        let stdout = "";
        let stderr = "";

        const proc = spawn(command, params, {
            cwd,
            shell: false
        });

        proc.stdout?.on("data", (data: Buffer) => {
            stdout += data.toString();
        });

        proc.stderr?.on("data", (data: Buffer) => {
            stderr += data.toString();
        });

        proc.on("close", (code: number) => {
            resolve({
                type: "exec_response",
                stdout,
                stderr,
                exitCode: code || 0
            });
        });

        proc.on("error", (error: Error) => {
            resolve({
                type: "exec_response",
                stdout: "",
                stderr: error.message,
                exitCode: 1
            });
        });
    });
}

/**
 */
export async function handleListFiles(
    request: ListFilesRequest,
    context: HandlerContext
): Promise<ListFilesResponse> {
    const { workspaceService, fileSystemService } = context;
    const cwd = workspaceService.getDefaultWorkspaceFolder()?.uri.fsPath || process.cwd();

    return {
        type: "list_files_response",
        files: await fileSystemService.findFiles(request.pattern, cwd)
    };
}

/**
 * （ / / ）
 */
export async function handleStatPath(
    request: StatPathRequest,
    context: HandlerContext
): Promise<StatPathResponse> {
    const { workspaceService, fileSystemService } = context;
    const cwd = workspaceService.getDefaultWorkspaceFolder()?.uri.fsPath || process.cwd();
    const paths = Array.isArray(request.paths) ? request.paths : [];

    const entries: StatPathResponse["entries"] = [];

    for (const raw of paths) {
        if (!raw || typeof raw !== "string") {
            continue;
        }

        const absolute = fileSystemService.normalizeAbsolutePath(raw, cwd);

        try {
            const stat = await fs.promises.stat(absolute);
            let type: StatPathResponse["entries"][number]["type"] = "other";

            if (stat.isFile()) type = "file";
            else if (stat.isDirectory()) type = "directory";

            entries.push({ path: raw, type });
        } catch {
            entries.push({ path: raw, type: "not_found" });
        }
    }

    return {
        type: "stat_path_response",
        entries
    };
}

/**
 * Read file contents for fulltext injection
 */
export async function handleReadFileContents(
    request: ReadFileContentsRequest,
    context: HandlerContext
): Promise<ReadFileContentsResponse> {
    const { workspaceService, fileSystemService } = context;
    const cwd = workspaceService.getDefaultWorkspaceFolder()?.uri.fsPath || process.cwd();
    const paths = Array.isArray(request.paths) ? request.paths : [];
    const files: ReadFileContentsResponse["files"] = [];
    for (const raw of paths) {
        if (!raw || typeof raw !== "string") continue;
        const absolute = fileSystemService.normalizeAbsolutePath(raw, cwd);
        const fileName = path.basename(absolute);
        try {
            const uri = vscode.Uri.file(absolute);
            const data = await fileSystemService.readFile(uri);
            const content = Buffer.from(data).toString("utf-8");
            files.push({ path: raw, fileName, content });
        } catch (err: any) {
            files.push({ path: raw, fileName, content: "", error: err?.message || "Failed to read file" });
        }
    }
    return { type: "read_file_contents_response", files };
}

/**
 * Show edit diff: LEFT = before, RIGHT = current file
 */
export async function handleShowEditDiff(
    request: ShowEditDiffRequest,
    context: HandlerContext
): Promise<ShowEditDiffResponse> {
    const { workspaceService, fileSystemService } = context;
    const cwd = workspaceService.getDefaultWorkspaceFolder()?.uri.fsPath || process.cwd();
    const absolutePath = fileSystemService.normalizeAbsolutePath(request.filePath, cwd);
    try {
        const currentContent = await fs.promises.readFile(absolutePath, 'utf-8');
        let beforeContent = currentContent;
        for (const edit of request.edits) {
            const search = edit.newString.replace(/\r\n/g, '\n');
            const replace = edit.oldString.replace(/\r\n/g, '\n');
            const normalized = beforeContent.replace(/\r\n/g, '\n');
            if (edit.replaceAll) {
                beforeContent = normalized.split(search).join(replace);
            } else {
                const idx = normalized.indexOf(search);
                if (idx >= 0) {
                    beforeContent = normalized.slice(0, idx) + replace + normalized.slice(idx + search.length);
                }
            }
        }
        const baseName = path.basename(absolutePath);
        const tempPath = await fileSystemService.createTempFile(`${baseName}.before`, beforeContent);
        await vscode.commands.executeCommand("vscode.diff", vscode.Uri.file(tempPath), vscode.Uri.file(absolutePath), `${baseName} (Edit)`, { preview: false });
        return { type: "show_edit_diff_response", success: true };
    } catch {
        return { type: "show_edit_diff_response", success: false };
    }
}

/**
 * （）
 */
export async function handleOpenContent(
    request: OpenContentRequest,
    context: HandlerContext,
    signal: AbortSignal
): Promise<OpenContentResponse> {
    const { logService, fileSystemService } = context;
    const { content, fileName, editable } = request;

    logService.info(`Opening content as: ${fileName} (editable: ${editable})`);

    if (!editable) {
        const document = await vscode.workspace.openTextDocument({
            content,
            language: detectLanguage(fileName)
        });
        await vscode.window.showTextDocument(document, { preview: true });

        return {
            type: "open_content_response"
        };
    }

    const tempPath = await fileSystemService.createTempFile(fileName || "claude.txt", content);
    const tempUri = vscode.Uri.file(tempPath);
    const document = await vscode.workspace.openTextDocument(tempUri);
    await vscode.window.showTextDocument(document, { preview: false });

    const updatedContent = await waitForDocumentEdits(document, signal);

    return {
        type: "open_content_response",
        updatedContent
    };
}

/**
 * URL
 */
export async function handleOpenURL(
    request: OpenURLRequest,
    context: HandlerContext
): Promise<OpenURLResponse> {
    const { url } = request;

    try {
        await vscode.env.openExternal(vscode.Uri.parse(url));
        return { type: "open_url_response" };
    } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        throw new Error(`Failed to open URL: ${errorMsg}`);
    }
}

/**
 */
// export async function handleGetAuthStatus(
//     _request: GetAuthStatusRequest,
//     context: HandlerContext
// ): Promise<GetAuthStatusResponse> {
// // TODO:
//     // const status = authManager?.getAuthStatus();

//     return {
//         type: "get_auth_status_response",
//         status: null
//     };
// }

/**
 */
// export async function handleLogin(
//     request: LoginRequest,
//     context: HandlerContext
// ): Promise<LoginResponse> {
//     const { logService, agentService } = context;
//     const { method } = request;

// // TODO:
//     logService.info(`Login requested with method: ${method}`);

//
//     await agentService.closeAllChannelsWithCredentialChange();

//     return {
//         type: "login_response",
//         auth: {
//             authenticated: false
//         }
//     };
// }

/**
 * OAuth
 */
// export async function handleSubmitOAuthCode(
//     request: SubmitOAuthCodeRequest,
//     context: HandlerContext
// ): Promise<SubmitOAuthCodeResponse> {
//     const { logService } = context;
//     const { code } = request;

// // TODO: OAuth
//     logService.info(`OAuth code submitted: ${code.substring(0, 10)}...`);

//     return {
//         type: "submit_oauth_code_response"
//     };
// }

/**
 */
export async function handleOpenConfigFile(
    request: OpenConfigFileRequest,
    context: HandlerContext
): Promise<OpenConfigFileResponse> {
    const { configType } = request;

    try {
 // VS Code
        if (configType === "vscode") {
            await vscode.commands.executeCommand('workbench.action.openSettings', 'claudix');
        }
        else {
            const configPath = getConfigFilePath(configType);
            const uri = vscode.Uri.file(configPath);
            await vscode.window.showTextDocument(uri);
        }

        return { type: "open_config_file_response" };
    } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        throw new Error(`Failed to open config file: ${errorMsg}`);
    }
}

/**
 * Claude
 */
export async function handleOpenClaudeInTerminal(
    _request: OpenClaudeInTerminalRequest,
    context: HandlerContext
): Promise<OpenClaudeInTerminalResponse> {
    const { workspaceService } = context;
    const cwd = workspaceService.getDefaultWorkspaceFolder()?.uri.fsPath || process.cwd();

    try {
        const terminal = vscode.window.createTerminal({
            name: "Claude Code",
            cwd
        });

        terminal.show();
        terminal.sendText("claude --help");

        return { type: "open_claude_in_terminal_response" };
    } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        throw new Error(`Failed to open terminal: ${errorMsg}`);
    }
}

// ============================================================================
// ============================================================================

/**
 */
async function loadConfig(context: HandlerContext): Promise<any> {
    const { logService, sdkService, workspaceService } = context;

    logService.info("Loading config cache by launching Claude...");

    const inputStream = new AsyncStream<SDKUserMessage>();
    const cwd = workspaceService.getDefaultWorkspaceFolder()?.uri.fsPath || process.cwd();

    const query = await sdkService.query({
        inputStream,
        resume: null,
        canUseTool: async () => ({
            behavior: "deny" as const,
            message: "Config loading only"
        }),
        model: "default",
        cwd,
        permissionMode: "default"
    });

    inputStream.done();

    const config = {
        slashCommands: await (query as any).supportedCommands?.() || [],
        models: await (query as any).supportedModels?.() || [],
        accountInfo: await (query as any).accountInfo?.() || null
    };

    logService.info(`  - Config: [${JSON.stringify(config)}]`);
    await query.return?.();

    return config;
}

/**
 * MCP
 */
async function getMcpServers(
    context: HandlerContext,
    channelId?: string
): Promise<GetMcpServersResponse> {
    const { logService, agentService } = context;

    if (!channelId) {
        throw new Error('Channel ID is required');
    }

 // TODO: agentService channel
    // const channel = agentService.getChannel(channelId);

    try {
        return {
            type: "get_mcp_servers_response",
            // mcpServers: await channel.query.mcpServerStatus?.() || []
            mcpServers: []
        };
    } catch (error) {
        logService.error(`Error fetching MCP servers: ${error}`);
        return {
            type: "get_mcp_servers_response",
            mcpServers: []
        };
    }
}

/**
 * URI
 */
function getAssetUris(context: HandlerContext): Record<string, { light: string; dark: string }> {
    const { webViewService } = context;
    const webview = webViewService.getWebView();

    if (!webview) {
        return {};
    }

    const assets = {
        clawd: {
            light: path.join("resources", "clawd.svg"),
            dark: path.join("resources", "clawd.svg")
        },
        "welcome-art": {
            light: path.join("resources", "welcome-art-light.svg"),
            dark: path.join("resources", "welcome-art-dark.svg")
        }
    } as const;

 // TODO: extensionPath
    const extensionPath = process.cwd();

    const toWebviewUri = (relativePath: string) =>
        webview.asWebviewUri(
            vscode.Uri.file(path.join(extensionPath, relativePath))
        ).toString();

    return Object.fromEntries(
        Object.entries(assets).map(([key, value]) => [
            key,
            {
                light: toWebviewUri(value.light),
                dark: toWebviewUri(value.dark)
            }
        ])
    );
}

// ============================================================================
// ============================================================================

async function prepareDiffRightFile(
    originalPath: string,
    fallbackPath: string | undefined,
    edits: OpenDiffRequest["edits"],
    context: HandlerContext
): Promise<string> {
    let baseContent = "";

    if (await context.fileSystemService.pathExists(originalPath)) {
        baseContent = await fs.promises.readFile(originalPath, "utf8");
    } else if (fallbackPath && await context.fileSystemService.pathExists(fallbackPath)) {
        baseContent = await fs.promises.readFile(fallbackPath, "utf8");
    }

    let modified = baseContent;

    for (const edit of edits) {
        const oldString = edit.oldString ?? "";
        const newString = edit.newString ?? "";

        if (!oldString) {
            modified += newString;
            continue;
        }

        if (edit.replaceAll) {
            modified = modified.split(oldString).join(newString);
        } else {
            const index = modified.indexOf(oldString);
            if (index >= 0) {
                modified = `${modified.slice(0, index)}${newString}${modified.slice(index + oldString.length)}`;
            } else {
                modified += newString;
            }
        }
    }

    const baseName = path.basename(fallbackPath || originalPath || "claude.diff");
    const outputName = baseName.endsWith(".claude") ? baseName : `${baseName}.claude`;

    return context.fileSystemService.createTempFile(outputName, modified);
}

async function waitForDocumentEdits(
    document: vscode.TextDocument,
    signal: AbortSignal
): Promise<string> {
    let currentText = document.getText();
    let resolved = false;

    return new Promise<string>((resolve) => {
        const disposables: vscode.Disposable[] = [];

        const cleanup = () => {
            if (!resolved) {
                resolved = true;
                disposables.forEach(d => d.dispose());
            }
        };

        disposables.push(
            vscode.workspace.onDidChangeTextDocument(event => {
                if (event.document.uri.toString() === document.uri.toString()) {
                    currentText = event.document.getText();
                }
            })
        );

        disposables.push(
            vscode.workspace.onDidSaveTextDocument(event => {
                if (event.uri.toString() === document.uri.toString()) {
                    currentText = event.getText();
                    cleanup();
                    resolve(currentText);
                }
            })
        );

        disposables.push(
            vscode.workspace.onDidCloseTextDocument(event => {
                if (event.uri.toString() === document.uri.toString()) {
                    cleanup();
                    resolve(currentText);
                }
            })
        );

        if (signal.aborted) {
            cleanup();
            resolve(currentText);
            return;
        }

        signal.addEventListener("abort", () => {
            cleanup();
            resolve(currentText);
        }, { once: true });
    });
}

function detectLanguage(fileName?: string): string {
    if (!fileName) {
        return "plaintext";
    }

    const ext = path.extname(fileName).toLowerCase();
    switch (ext) {
        case ".ts":
        case ".tsx":
            return "typescript";
        case ".js":
        case ".jsx":
            return "javascript";
        case ".json":
            return "json";
        case ".py":
            return "python";
        case ".java":
            return "java";
        case ".go":
            return "go";
        case ".rs":
            return "rust";
        case ".md":
            return "markdown";
        case ".sh":
            return "shellscript";
        case ".css":
            return "css";
        case ".html":
        case ".htm":
            return "html";
        default:
            return "plaintext";
    }
}

function getConfigFilePath(configType: string): string {
    const homeDir = os.homedir();

    switch (configType) {
        case "settings":
            return path.join(homeDir, ".claude", "settings.json");
        case "config":
            return path.join(homeDir, ".claude", "config.json");
        default:
            return path.join(homeDir, ".claude", `${configType}.json`);
    }
}

// ============================================================================
// File Revert/Re-apply
// ============================================================================

export async function handleRevertFileEdit(
    request: RevertFileEditRequest,
    context: HandlerContext
): Promise<RevertFileEditResponse> {
    const { logService, workspaceService } = context;
    const { action, filePath, editType, oldString, newString, fileContents, previousContents } = request;

    const shortPath = filePath.replace(/\\/g, '/').split('/').slice(-3).join('/');
    logService.info(`[Restore] ${action} ${editType} → ${shortPath}`);

    try {
        const cwd = workspaceService.getDefaultWorkspaceFolder()?.uri.fsPath || process.cwd();
        const absolutePath = path.isAbsolute(filePath) ? filePath : path.join(cwd, filePath);

        if (editType === 'edit') {
            const searchStr = action === 'revert' ? newString : oldString;
            const replaceStr = action === 'revert' ? oldString : newString;

            if (!searchStr || !replaceStr) {
                logService.warn(`[Restore] FAIL ${shortPath}: missing old/new string data`);
                return { type: 'revert_file_edit_response', success: false, error: `missing old/new string data for ${shortPath}` };
            }

            let content: string;
            try {
                content = await fs.promises.readFile(absolutePath, 'utf-8');
            } catch {
                logService.warn(`[Restore] FAIL ${shortPath}: file not found`);
                return { type: 'revert_file_edit_response', success: false, error: `file not found: ${shortPath}` };
            }

            let actualSearch = searchStr;
            let actualReplace = replaceStr;
            let fileContent = content;

            if (!content.includes(searchStr)) {
                // Try line-ending normalization
                const normalizedContent = content.replace(/\r\n/g, '\n');
                const normalizedSearch = searchStr.replace(/\r\n/g, '\n');
                if (!normalizedContent.includes(normalizedSearch)) {
                    // Try trailing whitespace normalization
                    const trimmedContent = normalizedContent.replace(/[ \t]+\n/g, '\n');
                    const trimmedSearch = normalizedSearch.replace(/[ \t]+\n/g, '\n');
                    if (!trimmedContent.includes(trimmedSearch)) {
                        const snippet = searchStr.substring(0, 80).replace(/\n/g, '\\n');
                        logService.warn(`[Restore] FAIL ${shortPath}: text not found after normalization — snippet: "${snippet}..."`);
                        return { type: 'revert_file_edit_response', success: false, error: `conflict in ${shortPath}: text not found (may have been modified by another edit)` };
                    }
                }
                fileContent = normalizedContent;
                actualSearch = searchStr.replace(/\r\n/g, '\n');
                actualReplace = replaceStr.replace(/\r\n/g, '\n');
            }

            const updated = fileContent.replace(actualSearch, actualReplace);
            await fs.promises.writeFile(absolutePath, updated, 'utf-8');
            logService.info(`[Restore] OK   ${shortPath}`);
            return { type: 'revert_file_edit_response', success: true };

        } else if (editType === 'write') {
            if (action === 'revert') {
                if (previousContents !== undefined && previousContents !== null) {
                    // Explicit previous contents provided — use them
                    await fs.promises.writeFile(absolutePath, previousContents, 'utf-8');
                    logService.info(`[Restore] OK   ${shortPath} (restored from previousContents)`);
                } else {
                    // No previous contents — try git to restore original state
                    const gitRestored = await tryGitRestore(absolutePath, cwd, logService);
                    if (gitRestored === 'restored') {
                        logService.info(`[Restore] OK   ${shortPath} (restored via git)`);
                    } else if (gitRestored === 'untracked') {
                        // File was new (not in git) → delete it
                        try {
                            await fs.promises.unlink(absolutePath);
                            logService.info(`[Restore] OK   ${shortPath} (deleted — was new file)`);
                        } catch {
                            logService.warn(`[Restore] FAIL ${shortPath}: could not delete new file`);
                            return { type: 'revert_file_edit_response', success: false, error: `could not delete ${shortPath}` };
                        }
                    } else {
                        logService.warn(`[Restore] FAIL ${shortPath}: git restore failed`);
                        return { type: 'revert_file_edit_response', success: false, error: `git restore failed for ${shortPath}` };
                    }
                }
            } else {
                // Re-apply: write the file contents back
                if (fileContents) {
                    await fs.promises.writeFile(absolutePath, fileContents, 'utf-8');
                    logService.info(`[Restore] OK   ${shortPath} (re-applied)`);
                }
            }
            return { type: 'revert_file_edit_response', success: true };
        }

        return { type: 'revert_file_edit_response', success: false, error: 'Unknown edit type' };

    } catch (err: any) {
        logService.error(`[Restore] FAIL ${shortPath}: ${err.message}`);
        return { type: 'revert_file_edit_response', success: false, error: `${shortPath}: ${err.message}` };
    }
}

/**
 * Try to restore a file to its git HEAD state.
 * Returns 'restored' | 'untracked' | 'error'
 */
async function tryGitRestore(
    absolutePath: string,
    cwd: string,
    logService: { info: (m: string) => void; warn: (m: string) => void }
): Promise<'restored' | 'untracked' | 'error'> {
    const { execFileSync } = require('child_process') as typeof import('child_process');
    try {
        // Check if the file is tracked by git
        const relPath = path.relative(cwd, absolutePath).replace(/\\/g, '/');
        const lsResult = execFileSync('git', ['ls-files', '--error-unmatch', relPath], {
            cwd,
            encoding: 'utf-8',
            stdio: ['pipe', 'pipe', 'pipe'],
        });
        // File is tracked → restore from HEAD
        execFileSync('git', ['checkout', 'HEAD', '--', relPath], {
            cwd,
            encoding: 'utf-8',
            stdio: ['pipe', 'pipe', 'pipe'],
        });
        return 'restored';
    } catch (err: any) {
        // git ls-files --error-unmatch exits with 1 if file is untracked
        if (err.status === 1 || (err.stderr && err.stderr.includes('not in'))) {
            return 'untracked';
        }
        logService.warn(`[Restore] git error: ${err.message}`);
        return 'error';
    }
}

// ============================================================================
// Usage Info (Rate Limits)
// ============================================================================

export async function handleGetUsageInfo(
    _request: GetUsageInfoRequest,
    context: HandlerContext
): Promise<GetUsageInfoResponse> {
    const { logService } = context;

    logService.info('[GetUsageInfo] Fetching usage info...');

    try {
        // Read credentials
        const homeDir = os.homedir();
        const credPath = path.join(homeDir, '.claude', '.credentials.json');
        if (!fs.existsSync(credPath)) {
            return { type: 'get_usage_info_response', success: false, error: 'No credentials found' };
        }

        const credRaw = fs.readFileSync(credPath, 'utf-8');
        const cred = JSON.parse(credRaw);
        const oauth = cred.claudeAiOauth;

        if (!oauth?.accessToken) {
            return { type: 'get_usage_info_response', success: false, error: 'No OAuth token' };
        }

        // Fetch usage data from Anthropic's OAuth usage endpoint
        const resp = await fetch('https://api.anthropic.com/api/oauth/usage', {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${oauth.accessToken}`,
                'anthropic-beta': 'oauth-2025-04-20',
                'Content-Type': 'application/json',
            },
        });

        if (!resp.ok) {
            logService.error(`[GetUsageInfo] API error: ${resp.status}`);
            return { type: 'get_usage_info_response', success: false, error: `API error ${resp.status}` };
        }

        const data = await resp.json() as any;
        logService.info(`[GetUsageInfo] Got usage data: 5h=${data.five_hour?.utilization}%, 7d=${data.seven_day?.utilization}%`);

        const parseReset = (s: string | null): number | null => {
            if (!s) return null;
            return Math.floor(new Date(s).getTime() / 1000);
        };

        return {
            type: 'get_usage_info_response',
            success: true,
            email: oauth.email || cred.email,
            subscriptionType: oauth.subscriptionType,
            rateLimitTier: oauth.rateLimitTier,
            fiveHour: {
                utilization: data.five_hour?.utilization != null ? data.five_hour.utilization / 100 : null,
                resetsAt: parseReset(data.five_hour?.resets_at),
            },
            sevenDay: {
                utilization: data.seven_day?.utilization != null ? data.seven_day.utilization / 100 : null,
                resetsAt: parseReset(data.seven_day?.resets_at),
            },
        };

    } catch (err: any) {
        logService.error(`[GetUsageInfo] Error: ${err.message}`);
        return { type: 'get_usage_info_response', success: false, error: err.message };
    }
}
