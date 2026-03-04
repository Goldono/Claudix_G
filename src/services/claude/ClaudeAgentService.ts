/**
 * ClaudeAgentService - Claude Agent
 * 1. Claude （channels）
 * 2. Transport
 * 3. Claude （launchClaude, interruptClaude）
 * 4. handlers
 * 5. RPC -
 * - IClaudeSdkService: SDK
 * - IClaudeSessionService:
 * - ILogService:
 * -
 */

import { createDecorator } from '../../di/instantiation';
import { ILogService } from '../logService';
import { IConfigurationService } from '../configurationService';
import { IWorkspaceService } from '../workspaceService';
import { IFileSystemService } from '../fileSystemService';
import { INotificationService } from '../notificationService';
import { ITerminalService } from '../terminalService';
import { ITabsAndEditorsService } from '../tabsAndEditorsService';
import { IClaudeSdkService } from './ClaudeSdkService';
import { IClaudeSessionService } from './ClaudeSessionService';
import { AsyncStream, ITransport } from './transport';
import { HandlerContext } from './handlers/types';
import { IWebViewService } from '../webViewService';

import type {
    WebViewToExtensionMessage,
    ExtensionToWebViewMessage,
    RequestMessage,
    ResponseMessage,
    ExtensionRequest,
    ToolPermissionRequest,
    ToolPermissionResponse,
} from '../../shared/messages';

// SDK
import type {
    SDKMessage,
    SDKUserMessage,
    Query,
    PermissionResult,
    PermissionUpdate,
    CanUseTool,
    PermissionMode,
} from '@anthropic-ai/claude-agent-sdk';

// Handlers
import {
    handleInit,
    handleGetClaudeState,
    handleGetMcpServers,
    handleGetAssetUris,
    handleOpenFile,
    handleGetCurrentSelection,
    handleShowNotification,
    handleNewConversationTab,
    handleRenameTab,
    handleOpenDiff,
    handleListSessions,
    handleGetSession,
    handleExec,
    handleListFiles,
    handleStatPath,
    handleOpenContent,
    handleOpenURL,
    handleOpenConfigFile,
    handleRevertFileEdit,
    handleGetUsageInfo,
    handleReadFileContents,
    handleShowEditDiff,
    // handleOpenClaudeInTerminal,
    // handleGetAuthStatus,
    // handleLogin,
    // handleSubmitOAuthCode,
} from './handlers/handlers';

export const IClaudeAgentService = createDecorator<IClaudeAgentService>('claudeAgentService');

// ============================================================================
// ============================================================================

/**
 * Channel ： Claude
 */
export interface Channel {
 in: AsyncStream<SDKUserMessage>; // ： SDK
 query: Query; // Query ： SDK
}

/**
 */
interface RequestHandler {
    resolve: (value: any) => void;
    reject: (error: Error) => void;
}

/**
 * Claude Agent
 */
export interface IClaudeAgentService {
    readonly _serviceBrand: undefined;

    /**
 * Transport
     */
    setTransport(transport: ITransport): void;

    /**
     */
    start(): void;

    /**
     */
    fromClient(message: WebViewToExtensionMessage): Promise<void>;

    /**
 * Claude
     */
    launchClaude(
        channelId: string,
        resume: string | null,
        cwd: string,
        model: string | null,
        permissionMode: string,
        thinkingLevel: string | null
    ): Promise<void>;

    /**
 * Claude
     */
    interruptClaude(channelId: string): Promise<void>;

    /**
     */
    closeChannel(channelId: string, sendNotification: boolean, error?: string): void;

    /**
     */
    closeAllChannels(): Promise<void>;

    /**
     */
    closeAllChannelsWithCredentialChange(): Promise<void>;

    /**
     */
    processRequest(request: RequestMessage, signal: AbortSignal): Promise<unknown>;

    /**
     */
    setPermissionMode(channelId: string, mode: PermissionMode): Promise<void>;

    /**
 * Thinking Level
     */
    setThinkingLevel(channelId: string, level: string): Promise<void>;

    /**
     */
    setModel(channelId: string, model: string): Promise<void>;

    /**
     */
    shutdown(): Promise<void>;
}

// ============================================================================
// ClaudeAgentService
// ============================================================================

/**
 * Claude Agent
 */
export class ClaudeAgentService implements IClaudeAgentService {
    readonly _serviceBrand: undefined;

 // Transport
    private transport?: ITransport;

    private channels = new Map<string, Channel>();

    private fromClientStream = new AsyncStream<WebViewToExtensionMessage>();

    private outstandingRequests = new Map<string, RequestHandler>();

    private abortControllers = new Map<string, AbortController>();

 // Handler （）
    private handlerContext: HandlerContext;

 // Thinking Level
    private thinkingLevel: string = 'default_on';

    constructor(
        @ILogService private readonly logService: ILogService,
        @IConfigurationService private readonly configService: IConfigurationService,
        @IWorkspaceService private readonly workspaceService: IWorkspaceService,
        @IFileSystemService private readonly fileSystemService: IFileSystemService,
        @INotificationService private readonly notificationService: INotificationService,
        @ITerminalService private readonly terminalService: ITerminalService,
        @ITabsAndEditorsService private readonly tabsAndEditorsService: ITabsAndEditorsService,
        @IClaudeSdkService private readonly sdkService: IClaudeSdkService,
        @IClaudeSessionService private readonly sessionService: IClaudeSessionService,
        @IWebViewService private readonly webViewService: IWebViewService
    ) {
 // Handler
        this.handlerContext = {
            logService: this.logService,
            configService: this.configService,
            workspaceService: this.workspaceService,
            fileSystemService: this.fileSystemService,
            notificationService: this.notificationService,
            terminalService: this.terminalService,
            tabsAndEditorsService: this.tabsAndEditorsService,
            sessionService: this.sessionService,
            sdkService: this.sdkService,
 agentService: this,
            webViewService: this.webViewService,
        };
    }

    /**
 * Transport
     */
    setTransport(transport: ITransport): void {
        this.transport = transport;

        transport.onMessage(async (message) => {
            await this.fromClient(message);
        });

 this.logService.info('[ClaudeAgentService] Transport ');
    }

    /**
     */
    start(): void {
        this.readFromClient();

 this.logService.info('[ClaudeAgentService] ');
    }

    /**
     */
    async fromClient(message: WebViewToExtensionMessage): Promise<void> {
        this.fromClientStream.enqueue(message);
    }

    /**
     */
    private async readFromClient(): Promise<void> {
        try {
            for await (const message of this.fromClientStream) {
                switch (message.type) {
                    case "launch_claude":
                        await this.launchClaude(
                            message.channelId,
                            message.resume || null,
                            message.cwd || this.getCwd(),
                            message.model || null,
                            message.permissionMode || "default",
                            message.thinkingLevel || null,
                            message.resumeSessionAt || undefined,
                            message.forkSession || undefined
                        );
                        break;

                    case "close_channel":
                        this.closeChannel(message.channelId, false);
                        break;

                    case "interrupt_claude":
                        await this.interruptClaude(message.channelId);
                        break;

                    case "io_message":
                        this.transportMessage(
                            message.channelId,
                            message.message,
                            message.done
                        );
                        break;

                    case "request":
                        this.handleRequest(message);
                        break;

                    case "response":
                        this.handleResponse(message);
                        break;

                    case "cancel_request":
                        this.handleCancellation(message.targetRequestId);
                        break;

                    default:
                        this.logService.error(`Unknown message type: ${(message as { type: string }).type}`);
                }
            }
        } catch (error) {
            this.logService.error(`[ClaudeAgentService] Error in readFromClient: ${error}`);
        }
    }

    /**
 * Claude
     */
    async launchClaude(
        channelId: string,
        resume: string | null,
        cwd: string,
        model: string | null,
        permissionMode: string,
        thinkingLevel: string | null,
        resumeSessionAt?: string,
        forkSession?: boolean
    ): Promise<void> {
 // thinkingLevel
        if (thinkingLevel) {
            this.thinkingLevel = thinkingLevel;
        }

 // maxThinkingTokens
        const maxThinkingTokens = this.getMaxThinkingTokens(this.thinkingLevel);

        this.logService.info('');
        this.logService.info('╔════════════════════════════════════════╗');
 this.logService.info('║ Claude ║');
        this.logService.info('╚════════════════════════════════════════╝');
        this.logService.info(`  Channel ID: ${channelId}`);
        this.logService.info(`  Resume: ${resume || 'null'}`);
        this.logService.info(`  CWD: ${cwd}`);
        this.logService.info(`  Model: ${model || 'null'}`);
        this.logService.info(`  Permission: ${permissionMode}`);
        this.logService.info(`  Thinking Level: ${this.thinkingLevel}`);
        this.logService.info(`  Max Thinking Tokens: ${maxThinkingTokens}`);
        this.logService.info('');

        if (this.channels.has(channelId)) {
 this.logService.error(`❌ Channel : ${channelId}`);
            throw new Error(`Channel already exists: ${channelId}`);
        }

        try {
 // 1.
 this.logService.info('📝 1: ');
            const inputStream = new AsyncStream<SDKUserMessage>();
 this.logService.info(' ✓ ');

 // 2. spawnClaude
            this.logService.info('');
 this.logService.info('📝 2: spawnClaude()');
            const query = await this.spawnClaude(
                inputStream,
                resume,
                async (toolName, input, options) => {
 // ： RPC WebView
 this.logService.info(`🔧 : ${toolName}`);
                    // Auto-approve plan mode tools — no permission dialog needed
                    if (toolName === 'EnterPlanMode') {
                        this.logService.info(`[Permission] Auto-approved: ${toolName}`);
                        return { behavior: 'allow' as const, updatedInput: input };
                    }
                    if (toolName === 'ExitPlanMode') {
                        this.logService.info(`[Permission] Auto-approved: ${toolName}`);
                        // CRITICAL: Force launchSwarm to false so the SDK never auto-executes a plan.
                        // Plan execution must ONLY happen when the user clicks "Execute Plan" or explicitly says so.
                        if (input && typeof input === 'object') {
                            (input as any).launchSwarm = false;
                            delete (input as any).teammateCount;
                        }
                        // Pre-copy: ensure plan file exists at ~/.claude/plans/ before SDK checks
                        try {
                            const os = require('os');
                            const fs = require('fs');
                            const path = require('path');
                            const homePlansDir = path.join(os.homedir(), '.claude', 'plans');
                            const projectPlansDir = path.join(cwd, '.claude', 'plans');
                            if (fs.existsSync(projectPlansDir)) {
                                // Find latest plan in project
                                const planFiles = fs.readdirSync(projectPlansDir)
                                    .filter((f: string) => f.endsWith('.md'))
                                    .map((f: string) => ({ name: f, mtime: fs.statSync(path.join(projectPlansDir, f)).mtimeMs }))
                                    .sort((a: any, b: any) => b.mtime - a.mtime);
                                if (planFiles.length > 0) {
                                    const latestPlan = path.join(projectPlansDir, planFiles[0].name);
                                    const planContent = fs.readFileSync(latestPlan, 'utf-8');
                                    // Copy to ALL .md files in ~/.claude/plans/ that are empty or don't exist
                                    if (fs.existsSync(homePlansDir)) {
                                        const homeFiles = fs.readdirSync(homePlansDir).filter((f: string) => f.endsWith('.md'));
                                        for (const hf of homeFiles) {
                                            const hp = path.join(homePlansDir, hf);
                                            try {
                                                const stat = fs.statSync(hp);
                                                // Overwrite files that are very small (likely empty placeholders)
                                                if (stat.size < 50) {
                                                    fs.writeFileSync(hp, planContent, 'utf-8');
                                                    this.logService.info(`[Permission] Pre-copied plan to: ${hp}`);
                                                }
                                            } catch { /* ignore */ }
                                        }
                                    }
                                    // Also write to ~/.claude/plans/ with same name as project file
                                    if (!fs.existsSync(homePlansDir)) {
                                        fs.mkdirSync(homePlansDir, { recursive: true });
                                    }
                                    const destPath = path.join(homePlansDir, planFiles[0].name);
                                    fs.writeFileSync(destPath, planContent, 'utf-8');
                                    this.logService.info(`[Permission] Pre-copied plan to home: ${destPath}`);
                                }
                            }
                        } catch (err: any) {
                            this.logService.warn(`[Permission] Pre-copy failed: ${err.message}`);
                        }
                        return { behavior: 'allow' as const, updatedInput: input };
                    }
                    return this.requestToolPermission(
                        channelId,
                        toolName,
                        input,
                        options.suggestions || []
                    );
                },
                model,
                cwd,
                permissionMode,
                maxThinkingTokens,
                resumeSessionAt,
                forkSession
            );
 this.logService.info(' ✓ spawnClaude() ，Query ');

 // 3. channels Map
            this.logService.info('');
 this.logService.info('📝 3: Channel');
            this.channels.set(channelId, {
                in: inputStream,
                query: query
            });
 this.logService.info(` ✓ Channel ， ${this.channels.size} `);

 // 4. ： SDK
            this.logService.info('');
 this.logService.info('📝 4: ');
            (async () => {
                try {
 this.logService.info(` → Query ...`);
                    let messageCount = 0;

                    for await (const message of query) {
                        messageCount++;

                        this.transport!.send({
                            type: "io_message",
                            channelId,
                            message,
                            done: false
                        });
                    }

 this.logService.info(` ✓ Query ， ${messageCount} messages`);
                    this.closeChannel(channelId, true);
                } catch (error) {
 this.logService.error(` ❌ Query : ${error}`);
                    if (error instanceof Error) {
                        this.logService.error(`     Stack: ${error.stack}`);
                    }
                    this.closeChannel(channelId, true, String(error));
                }
            })();

            this.logService.info('');
 this.logService.info('✓ Claude ');
            this.logService.info('════════════════════════════════════════');
            this.logService.info('');
        } catch (error) {
            this.logService.error('');
 this.logService.error('❌❌❌ Claude ❌❌❌');
            this.logService.error(`Channel: ${channelId}`);
            this.logService.error(`Error: ${error}`);
            if (error instanceof Error) {
                this.logService.error(`Stack: ${error.stack}`);
            }
            this.logService.error('════════════════════════════════════════');
            this.logService.error('');

            this.closeChannel(channelId, true, String(error));
            throw error;
        }
    }

    /**
 * Claude
     */
    async interruptClaude(channelId: string): Promise<void> {
        const channel = this.channels.get(channelId);
        if (!channel) {
 this.logService.warn(`[ClaudeAgentService] Channel : ${channelId}`);
            return;
        }

        try {
            await this.sdkService.interrupt(channel.query);
 this.logService.info(`[ClaudeAgentService] Channel: ${channelId}`);
        } catch (error) {
 this.logService.error(`[ClaudeAgentService] :`, error);
        }
    }

    /**
     */
    closeChannel(channelId: string, sendNotification: boolean, error?: string): void {
 this.logService.info(`[ClaudeAgentService] Channel: ${channelId}`);

 // 1.
        if (sendNotification && this.transport) {
            this.transport.send({
                type: "close_channel",
                channelId,
                error
            });
        }

 // 2. channel
        const channel = this.channels.get(channelId);
        if (channel) {
            channel.in.done();
            try {
                channel.query.return?.();
            } catch (e) {
                this.logService.warn(`Error cleaning up channel: ${e}`);
            }
            this.channels.delete(channelId);
        }

 this.logService.info(` ✓ Channel ， ${this.channels.size} `);
    }

    /**
 * Claude SDK
 * @param inputStream ，
 * @param resume ID
 * @param canUseTool
 * @param model
 * @param cwd
 * @param permissionMode
 * @param maxThinkingTokens tokens
 * @returns SDK Query
     */
    protected async spawnClaude(
        inputStream: AsyncStream<SDKUserMessage>,
        resume: string | null,
        canUseTool: CanUseTool,
        model: string | null,
        cwd: string,
        permissionMode: string,
        maxThinkingTokens: number,
        resumeSessionAt?: string,
        forkSession?: boolean
    ): Promise<Query> {
        return this.sdkService.query({
            inputStream,
            resume,
            canUseTool,
            model,
            cwd,
            permissionMode,
            maxThinkingTokens,
            resumeSessionAt,
            forkSession
        });
    }

    /**
     */
    async closeAllChannels(): Promise<void> {
        const promises = Array.from(this.channels.keys()).map(channelId =>
            this.closeChannel(channelId, false)
        );
        await Promise.all(promises);
        this.channels.clear();
    }

    /**
     */
    async closeAllChannelsWithCredentialChange(): Promise<void> {
        const promises = Array.from(this.channels.keys()).map(channelId =>
            this.closeChannel(channelId, true)
        );
        await Promise.all(promises);
        this.channels.clear();
    }

    /**
 * Channel
     */
    private transportMessage(
        channelId: string,
        message: SDKMessage | SDKUserMessage,
        done: boolean
    ): void {
        const channel = this.channels.get(channelId);
        if (!channel) {
            throw new Error(`Channel not found: ${channelId}`);
        }

        if (message.type === "user") {
            channel.in.enqueue(message as SDKUserMessage);
        }

        if (done) {
            channel.in.done();
        }
    }

    /**
     */
    private async handleRequest(message: RequestMessage): Promise<void> {
        const abortController = new AbortController();
        this.abortControllers.set(message.requestId, abortController);

        try {
            const response = await this.processRequest(message, abortController.signal);
            this.transport!.send({
                type: "response",
                requestId: message.requestId,
                response
            });
        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            this.transport!.send({
                type: "response",
                requestId: message.requestId,
                response: {
                    type: "error",
                    error: errorMsg
                }
            });
        } finally {
            this.abortControllers.delete(message.requestId);
        }
    }

    /**
     */
    async processRequest(message: RequestMessage, signal: AbortSignal): Promise<unknown> {
        const request = message.request;
        const channelId = message.channelId;

        if (!request || typeof request !== 'object' || !('type' in request)) {
            throw new Error('Invalid request format');
        }

 this.logService.info(`[ClaudeAgentService] : ${request.type}`);

 // ： handler
        switch (request.type) {
            case "init":
                return handleInit(request, this.handlerContext);

            case "get_claude_state":
                return handleGetClaudeState(request, this.handlerContext);

            case "get_mcp_servers":
                return handleGetMcpServers(request, this.handlerContext, channelId);

            case "get_asset_uris":
                return handleGetAssetUris(request, this.handlerContext);

            case "open_file":
                return handleOpenFile(request, this.handlerContext);

            case "get_current_selection":
                return handleGetCurrentSelection(this.handlerContext);

            case "open_diff":
                return handleOpenDiff(request, this.handlerContext, signal);

            case "open_content":
                return handleOpenContent(request, this.handlerContext, signal);

 // UI
            case "show_notification":
                return handleShowNotification(request, this.handlerContext);

            case "new_conversation_tab":
                return handleNewConversationTab(request, this.handlerContext);

            case "rename_tab":
                return handleRenameTab(request, this.handlerContext);

            case "open_url":
                return handleOpenURL(request, this.handlerContext);

            case "set_permission_mode": {
                if (!channelId) {
                    throw new Error('channelId is required for set_permission_mode');
                }
                const permReq = request as any;
                await this.setPermissionMode(channelId, permReq.mode);
                return {
                    type: "set_permission_mode_response",
                    success: true
                };
            }

            case "set_model": {
                if (!channelId) {
                    throw new Error('channelId is required for set_model');
                }
                const modelReq = request as any;
                const targetModel = modelReq.model?.value ?? "";
                if (!targetModel) {
                    throw new Error("Invalid model selection");
                }
                await this.setModel(channelId, targetModel);
                return {
                    type: "set_model_response",
                    success: true
                };
            }

            case "set_thinking_level": {
                if (!channelId) {
                    throw new Error('channelId is required for set_thinking_level');
                }
                const thinkReq = request as any;
                await this.setThinkingLevel(channelId, thinkReq.thinkingLevel);
                return {
                    type: "set_thinking_level_response"
                };
            }

            case "open_config_file":
                return handleOpenConfigFile(request, this.handlerContext);

            case "list_sessions_request":
                return handleListSessions(request, this.handlerContext);

            case "get_session_request":
                return handleGetSession(request, this.handlerContext);

        case "list_files_request":
            return handleListFiles(request, this.handlerContext);

        case "stat_path_request":
            return handleStatPath(request as any, this.handlerContext);

            case "exec":
                return handleExec(request, this.handlerContext);

            case "revert_file_edit":
                return handleRevertFileEdit(request as any, this.handlerContext);

            case "get_pre_write_contents": {
                const pwReq = request as any;
                const contents = this.sdkService.getPreWriteContents(pwReq.filePath);
                if (contents !== undefined) {
                    return { type: 'get_pre_write_contents_response', found: true, contents };
                }
                return { type: 'get_pre_write_contents_response', found: false };
            }

            case "write_restore_log": {
                const logReq = request as any;
                if (Array.isArray(logReq.lines)) {
                    for (const line of logReq.lines) {
                        this.logService.info(line);
                    }
                }
                if (logReq.show) {
                    this.logService.show();
                }
                return { type: 'write_restore_log_response', success: true };
            }

            case "show_output_channel":
                this.logService.show();
                return { type: 'show_output_channel_response', success: true };

            case "get_usage_info":
                return handleGetUsageInfo(request as any, this.handlerContext);

            case "read_file_contents_request":
                return handleReadFileContents(request as any, this.handlerContext);

            case "show_edit_diff":
                return handleShowEditDiff(request as any, this.handlerContext);

            // case "open_claude_in_terminal":
            //     return handleOpenClaudeInTerminal(request, this.handlerContext);

            // case "get_auth_status":
            //     return handleGetAuthStatus(request, this.handlerContext);

            // case "login":
            //     return handleLogin(request, this.handlerContext);

            // case "submit_oauth_code":
            //     return handleSubmitOAuthCode(request, this.handlerContext);

            default:
                throw new Error(`Unknown request type: ${request.type}`);
        }
    }

    /**
     */
    private handleResponse(message: ResponseMessage): void {
        const handler = this.outstandingRequests.get(message.requestId);
        if (handler) {
            const response = message.response;
            if (typeof response === 'object' && response !== null && 'type' in response && response.type === "error") {
                handler.reject(new Error((response as { error: string }).error));
            } else {
                handler.resolve(response);
            }
            this.outstandingRequests.delete(message.requestId);
        } else {
 this.logService.warn(`[ClaudeAgentService] : ${message.requestId}`);
        }
    }

    /**
     */
    private handleCancellation(requestId: string): void {
        const abortController = this.abortControllers.get(requestId);
        if (abortController) {
            abortController.abort();
            this.abortControllers.delete(requestId);
        }
    }

    /**
     */
    protected sendRequest<TRequest extends ExtensionRequest, TResponse>(
        channelId: string,
        request: TRequest
    ): Promise<TResponse> {
        const requestId = this.generateId();

        return new Promise<TResponse>((resolve, reject) => {
 // Promise handlers
            this.outstandingRequests.set(requestId, { resolve, reject });

            this.transport!.send({
                type: "request",
                channelId,
                requestId,
                request
            } as RequestMessage);
        }).finally(() => {
            this.outstandingRequests.delete(requestId);
        });
    }

    /**
     */
    protected async requestToolPermission(
        channelId: string,
        toolName: string,
        inputs: Record<string, unknown>,
        suggestions: PermissionUpdate[]
    ): Promise<PermissionResult> {
        const request: ToolPermissionRequest = {
            type: "tool_permission_request",
            toolName,
            inputs,
            suggestions
        };

        const response = await this.sendRequest<ToolPermissionRequest, ToolPermissionResponse>(
            channelId,
            request
        );

        return response.result;
    }

    /**
     */
    async shutdown(): Promise<void> {
        await this.closeAllChannels();
        this.fromClientStream.done();
    }

    // ========================================================================
    // ========================================================================

    /**
 * ID
     */
    private generateId(): string {
        return Math.random().toString(36).substring(2, 15);
    }

    /**
     */
    private getCwd(): string {
        return this.workspaceService.getDefaultWorkspaceFolder()?.uri.fsPath || process.cwd();
    }

    /**
 * maxThinkingTokens（ thinking level）
     */
    private getMaxThinkingTokens(level: string): number {
        return level === 'off' ? 0 : 31999;
    }

    /**
 * thinking level
     */
    async setThinkingLevel(channelId: string, level: string): Promise<void> {
        this.thinkingLevel = level;

 // channel
        const channel = this.channels.get(channelId);
        if (channel?.query) {
            const maxTokens = this.getMaxThinkingTokens(level);
            await channel.query.setMaxThinkingTokens(maxTokens);
            this.logService.info(`[setThinkingLevel] Updated channel ${channelId} to ${level} (${maxTokens} tokens)`);
        }
    }

    /**
     */
    async setPermissionMode(channelId: string, mode: PermissionMode): Promise<void> {
        const channel = this.channels.get(channelId);
        if (!channel) {
            this.logService.warn(`[setPermissionMode] Channel ${channelId} not found`);
            throw new Error(`Channel ${channelId} not found`);
        }

        await channel.query.setPermissionMode(mode);
        this.logService.info(`[setPermissionMode] Set channel ${channelId} to mode: ${mode}`);
    }

    /**
     */
    async setModel(channelId: string, model: string): Promise<void> {
        const channel = this.channels.get(channelId);
        if (!channel) {
            this.logService.warn(`[setModel] Channel ${channelId} not found`);
            throw new Error(`Channel ${channelId} not found`);
        }

 // channel
        await channel.query.setModel(model);

        await this.configService.updateValue('claudix.selectedModel', model);

        this.logService.info(`[setModel] Set channel ${channelId} to model: ${model}`);
    }
}
