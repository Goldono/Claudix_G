/**
 * WebView / WebView Service
 * 1. vscode.WebviewViewProvider
 * 2. WebView
 * 3. WebView HTML
 * 4.
 */

import * as vscode from 'vscode';
import * as path from 'path';
import { createDecorator } from '../di/instantiation';
import { ILogService } from './logService';

export const IWebViewService = createDecorator<IWebViewService>('webViewService');

export type WebviewHost = 'sidebar' | 'editor';

export interface WebviewBootstrapConfig {
	host: WebviewHost;
	page?: string;
	id?: string;
}

export interface IWebViewService extends vscode.WebviewViewProvider {
	readonly _serviceBrand: undefined;

	/**
	 * WebView （ webviewUri ）
	 */
	getWebView(): vscode.Webview | undefined;

	/**
	 * WebView
	 */
	postMessage(message: any): void;

	/**
	 * ， WebView
	 */
	setMessageHandler(handler: (message: any) => void): void;

	/**
	 * （）
	 * @param page ， 'settings'、'diff'
	 * @param title VSCode
	 * @param instanceId ID，（ page，）
	 */
	openEditorPage(page: string, title: string, instanceId?: string): void;
}

/**
 * WebView
 */
export class WebViewService implements IWebViewService {
	readonly _serviceBrand: undefined;

	private readonly webviews = new Set<vscode.Webview>();
	private readonly webviewConfigs = new Map<vscode.Webview, WebviewBootstrapConfig>();
	private messageHandler?: (message: any) => void;
	private readonly editorPanels = new Map<string, vscode.WebviewPanel>();

	constructor(
		private readonly context: vscode.ExtensionContext,
		@ILogService private readonly logService: ILogService
	) {}

	/**
	 * WebviewViewProvider.resolveWebviewView（）
	 */
	public resolveWebviewView(
		webviewView: vscode.WebviewView,
		_context: vscode.WebviewViewResolveContext,
		_token: vscode.CancellationToken
	): void | Thenable<void> {
		this.logService.info(' WebView ');

		this.registerWebview(webviewView.webview, {
			host: 'sidebar',
			page: 'chat'
		});

		// WebviewView VSCode ，
		webviewView.onDidDispose(
			() => {
				this.logService.info(' WebView ');
			},
			undefined,
			this.context.subscriptions
		);

		this.logService.info(' WebView ');
	}

	/**
	 * WebView
	 * WebView ，（ URI）
	 */
	getWebView(): vscode.Webview | undefined {
		for (const webview of this.webviews) {
			return webview;
		}
		return undefined;
	}

	/**
	 * WebView
	 */
	postMessage(message: any): void {
		// ClaudeAgentService
		// host === 'sidebar' page === 'chat' WebView
		if (this.webviews.size === 0) {
			this.logService.warn('[WebViewService] WebView ，');
			return;
		}

		const payload = {
			type: 'from-extension',
			message
		};

		const toRemove: vscode.Webview[] = [];

		for (const webview of this.webviews) {
			const config = this.webviewConfigs.get(webview);
			if (!config || config.host !== 'sidebar' || (config.page && config.page !== 'chat')) {
				continue;
			}

			try {
				webview.postMessage(payload);
			} catch (error) {
				this.logService.warn('[WebViewService] WebView ，', error as Error);
				toRemove.push(webview);
			}
		}

		for (const webview of toRemove) {
			this.webviews.delete(webview);
			this.webviewConfigs.delete(webview);
		}
	}

	/**
	 */
	setMessageHandler(handler: (message: any) => void): void {
		this.messageHandler = handler;
	}

	/**
	 * （）
	 */
	openEditorPage(page: string, title: string, instanceId?: string): void {
		const key = instanceId || page;
		const existing = this.editorPanels.get(key);
		if (existing) {
			try {
				existing.reveal(vscode.ViewColumn.Active);
				this.logService.info(`[WebViewService] : page=${page}, id=${key}`);
				return;
			} catch (error) {
				this.logService.warn(
					`[WebViewService] ，: page=${page}, id=${key}`,
					error as Error
				);
				this.editorPanels.delete(key);
			}
		}

		this.logService.info(`[WebViewService] WebView : page=${page}, id=${key}`);

		const panel = vscode.window.createWebviewPanel(
			'optimo.pageView',
			title,
			vscode.ViewColumn.Active,
			{
				enableScripts: true,
				retainContextWhenHidden: true,
				localResourceRoots: [
					vscode.Uri.file(path.join(this.context.extensionPath, 'dist')),
					vscode.Uri.file(path.join(this.context.extensionPath, 'resources'))
				]
			}
		);

		this.registerWebview(panel.webview, {
			host: 'editor',
			page,
			id: key
		});

		panel.onDidDispose(
			() => {
				this.webviews.delete(panel.webview);
				this.webviewConfigs.delete(panel.webview);
				this.editorPanels.delete(key);
				this.logService.info(`[WebViewService] WebView : page=${page}, id=${key}`);
			},
			undefined,
			this.context.subscriptions
		);

		this.editorPanels.set(key, panel);
	}

	/**
	 * WebView 、 HTML
	 */
	private registerWebview(webview: vscode.Webview, bootstrap: WebviewBootstrapConfig): void {
		// WebView
		webview.options = {
			enableScripts: true,
			localResourceRoots: [
				vscode.Uri.file(path.join(this.context.extensionPath, 'dist')),
				vscode.Uri.file(path.join(this.context.extensionPath, 'resources'))
			]
		};

		this.webviews.add(webview);
		this.webviewConfigs.set(webview, bootstrap);

		webview.onDidReceiveMessage(
			message => {
				this.logService.info(`[WebView → Extension] : ${message.type}`);
				if (this.messageHandler) {
					this.messageHandler(message);
				}
			},
			undefined,
			this.context.subscriptions
		);

		// WebView HTML（/）
		webview.html = this.getHtmlForWebview(webview, bootstrap);
	}

	/**
	 * WebView HTML
	 */
	private getHtmlForWebview(webview: vscode.Webview, bootstrap: WebviewBootstrapConfig): string {
		const isDev = this.context.extensionMode === vscode.ExtensionMode.Development;
		const nonce = this.getNonce();

		if (isDev) {
			return this.getDevHtml(webview, nonce, bootstrap);
		}

		const extensionUri = vscode.Uri.file(this.context.extensionPath);
		const scriptUri = webview.asWebviewUri(
			vscode.Uri.joinPath(extensionUri, 'dist', 'media', 'main.js')
		);
		const styleUri = webview.asWebviewUri(
			vscode.Uri.joinPath(extensionUri, 'dist', 'media', 'style.css')
		);

		const csp = [
			`default-src 'none';`,
			`img-src ${webview.cspSource} https: data:;`,
			`style-src ${webview.cspSource} 'unsafe-inline' https://*.vscode-cdn.net;`,
			`font-src ${webview.cspSource} data:;`,
			`script-src ${webview.cspSource} 'nonce-${nonce}';`,
			`connect-src ${webview.cspSource} https:;`,
			`worker-src ${webview.cspSource} blob:;`,
		].join(' ');

		const bootstrapScript = `
    <script nonce="${nonce}">
      window.OPTIMO_BOOTSTRAP = ${JSON.stringify(bootstrap)};
    </script>`;

		return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8" />
    <meta http-equiv="Content-Security-Policy" content="${csp}" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Claudex Chat</title>
    <link href="${styleUri}" rel="stylesheet" />
    ${bootstrapScript}
</head>
<body>
    <div id="app"></div>
    <script type="module" nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
	}

	private getDevHtml(webview: vscode.Webview, nonce: string, bootstrap: WebviewBootstrapConfig): string {
		// dev server （）
		const devServer = process.env.VITE_DEV_SERVER_URL
			|| process.env.WEBVIEW_DEV_SERVER_URL
			|| `http://localhost:${process.env.VITE_DEV_PORT || 5173}`;

		let origin = '';
		let wsUrl = '';
		try {
			const u = new URL(devServer);
			origin = `${u.protocol}//${u.hostname}${u.port ? `:${u.port}` : ''}`;
			const wsProtocol = u.protocol === 'https:' ? 'wss:' : 'ws:';
			wsUrl = `${wsProtocol}//${u.hostname}${u.port ? `:${u.port}` : ''}`;
		} catch {
			origin = devServer; // （）
			wsUrl = 'ws://localhost:5173';
		}

		// Vite CSP： devServer HMR ws
		const csp = [
			`default-src 'none';`,
			`img-src ${webview.cspSource} https: data:;`,
			`style-src ${webview.cspSource} 'unsafe-inline' ${origin} https://*.vscode-cdn.net;`,
			`font-src ${webview.cspSource} data: ${origin};`,
			`script-src ${webview.cspSource} 'nonce-${nonce}' 'unsafe-eval' ${origin};`,
			`connect-src ${webview.cspSource} ${origin} ${wsUrl} https:;`,
			`worker-src ${webview.cspSource} blob:;`,
		].join(' ');

		const client = `${origin}/@vite/client`;
		const entry = `${origin}/src/main.ts`;

		const bootstrapScript = `
    <script nonce="${nonce}">
      window.OPTIMO_BOOTSTRAP = ${JSON.stringify(bootstrap)};
    </script>`;

		return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8" />
    <meta http-equiv="Content-Security-Policy" content="${csp}" />
    <base href="${origin}/" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Claudex Chat (Dev)</title>
    ${bootstrapScript}
</head>
<body>
    <div id="app"></div>
    <script type="module" nonce="${nonce}" src="${client}"></script>
    <script type="module" nonce="${nonce}" src="${entry}"></script>
</body>
</html>`;
	}

	/**
	 * nonce
	 */
	private getNonce(): string {
		let text = '';
		const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
		for (let i = 0; i < 32; i++) {
			text += possible.charAt(Math.floor(Math.random() * possible.length));
		}
		return text;
	}
}
