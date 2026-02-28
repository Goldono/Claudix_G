/**
 * / FileSystem Service
 * + Search
 */

import * as vscode from 'vscode';
import * as path from 'path';
import { execFile } from 'child_process';
import Fuse from 'fuse.js';
import { createDecorator } from '../di/instantiation';

export const IFileSystemService = createDecorator<IFileSystemService>('fileSystemService');

/**
 * Search
 */
export interface FileSearchResult {
	path: string;
	name: string;
	type: 'file' | 'directory';
}

/**
 * Ripgrep
 */
interface RipgrepResult {
	absolute: string;
	relative: string;
}

export interface IFileSystemService {
	readonly _serviceBrand: undefined;

	readFile(uri: vscode.Uri): Thenable<Uint8Array>;
	writeFile(uri: vscode.Uri, content: Uint8Array): Thenable<void>;
	delete(uri: vscode.Uri, options?: { recursive?: boolean; useTrash?: boolean }): Thenable<void>;
	rename(source: vscode.Uri, target: vscode.Uri, options?: { overwrite?: boolean }): Thenable<void>;
	createDirectory(uri: vscode.Uri): Thenable<void>;
	readDirectory(uri: vscode.Uri): Thenable<[string, vscode.FileType][]>;
	stat(uri: vscode.Uri): Thenable<vscode.FileStat>;

	/**
	 * Ripgrep （Search,）
	 * @param cwd
	 * @returns （）
	 */
	listFilesWithRipgrep(cwd: string): Promise<string[]>;

	/**
	 * Search（：Ripgrep + + Fuse.js）
	 * @param pattern Search
	 * @param cwd
	 * @returns Search
	 */
	searchFiles(pattern: string, cwd: string): Promise<FileSearchResult[]>;

	/**
	 * VSCode API Search（Ripgrep ）
	 * @param pattern Search
	 * @param cwd
	 * @returns Search
	 */
	searchFilesWithWorkspace(pattern: string, cwd: string): Promise<FileSearchResult[]>;

	/**
	 * （）
	 * @param filePaths （）
	 * @returns （, / ）
	 */
	extractParentDirectories(filePaths: string[]): string[];

	/**
	 * （）
	 * @param cwd
	 * @returns
	 */
	getTopLevelDirectories(cwd: string): Promise<FileSearchResult[]>;

	/**
	 * @param filePath （）
	 * @param cwd
	 * @returns
	 */
	normalizeAbsolutePath(filePath: string, cwd: string): string;

	/**
	 * @param absolutePath
	 * @param cwd
	 * @returns
	 */
	toWorkspaceRelative(absolutePath: string, cwd: string): string;

	/**
	 * （ ~ ）
	 * @param filePath
	 * @param cwd
	 * @returns
	 */
	resolveFilePath(filePath: string, cwd: string): string;

	/**
	 * @param target
	 * @returns
	 */
	pathExists(target: string): Promise<boolean>;

	/**
	 * （）
	 * @param fileName
	 * @returns
	 */
	sanitizeFileName(fileName: string): string;

	/**
	 * @param fileName
	 * @param content
	 * @returns
	 */
	createTempFile(fileName: string, content: string): Promise<string>;

	/**
	 * （Search）
	 * @param filePath
	 * @param cwd
	 * @param searchResults Search（,）
	 * @returns
	 */
	resolveExistingPath(filePath: string, cwd: string, searchResults?: FileSearchResult[]): Promise<string>;

	/**
	 * （）
	 * - （ + ）
	 * - : Ripgrep + + Fuse.js
	 * - VSCode API
	 * @param pattern Search（,）
	 * @param cwd
	 * @returns Search
	 */
	findFiles(pattern: string | undefined, cwd: string): Promise<FileSearchResult[]>;
}

export class FileSystemService implements IFileSystemService {
	readonly _serviceBrand: undefined;

	// Ripgrep
	private ripgrepCommandCache: { command: string; args: string[] } | null = null;

	// ===== =====

	readFile(uri: vscode.Uri): Thenable<Uint8Array> {
		return vscode.workspace.fs.readFile(uri);
	}

	writeFile(uri: vscode.Uri, content: Uint8Array): Thenable<void> {
		return vscode.workspace.fs.writeFile(uri, content);
	}

	delete(uri: vscode.Uri, options?: { recursive?: boolean; useTrash?: boolean }): Thenable<void> {
		return vscode.workspace.fs.delete(uri, options);
	}

	rename(source: vscode.Uri, target: vscode.Uri, options?: { overwrite?: boolean }): Thenable<void> {
		return vscode.workspace.fs.rename(source, target, options);
	}

	createDirectory(uri: vscode.Uri): Thenable<void> {
		return vscode.workspace.fs.createDirectory(uri);
	}

	readDirectory(uri: vscode.Uri): Thenable<[string, vscode.FileType][]> {
		return vscode.workspace.fs.readDirectory(uri);
	}

	stat(uri: vscode.Uri): Thenable<vscode.FileStat> {
		return vscode.workspace.fs.stat(uri);
	}

	// ===== Search（）=====

	/**
	 * Ripgrep （Search,）
	 */
	async listFilesWithRipgrep(cwd: string): Promise<string[]> {
		// 1. ripgrep
		const args = ['--files', '--follow', '--hidden'];

		// 2.
		const excludeGlobs = this.buildExcludePatterns();
		for (const glob of excludeGlobs) {
			args.push('--glob', `!${glob}`);
		}

		// 3. ripgrep,
		const rawPaths = await this.execRipgrep(args, cwd);

		// 4.
		return rawPaths.map(rawPath => {
			const absolute = this.normalizeAbsolutePath(rawPath.replace(/^\.\//, ''), cwd);
			return this.toWorkspaceRelative(absolute, cwd);
		});
	}

	/**
	 * Search（：）
	 * 1. Ripgrep
	 * 2.
	 * 3. [, ]
	 * 4. Fuse.js Search
	 */
	async searchFiles(pattern: string, cwd: string): Promise<FileSearchResult[]> {
		// 1. Ripgrep
		const files = await this.listFilesWithRipgrep(cwd);

		// 2. （ / ）
		const directories = this.extractParentDirectories(files);

		// 3. : [, ]
		const allPaths = [...directories, ...files];

		// 4. Fuse.js Search（）
		return this.fuseSearchPaths(allPaths, pattern);
	}

	/**
	 * VSCode API Search（）
	 */
	async searchFilesWithWorkspace(pattern: string, cwd: string): Promise<FileSearchResult[]> {
		const include = pattern.includes('*') || pattern.includes('?')
			? pattern
			: `**/*${pattern}*`;

		const excludePatterns = this.buildExcludePatterns();
		const excludeGlob = this.toExcludeGlob(excludePatterns);

		const uris = await vscode.workspace.findFiles(include, excludeGlob, 100);

		return uris.map(uri => {
			const fsPath = uri.fsPath;
			const relative = this.toWorkspaceRelative(fsPath, cwd);
			return {
				path: relative,
				name: path.basename(fsPath),
				type: 'file' as const // VSCode findFiles
			};
		});
	}

	/**
	 * （）
	 */
	extractParentDirectories(filePaths: string[]): string[] {
		const dirSet = new Set<string>();

		filePaths.forEach(filePath => {
			let current = path.dirname(filePath);

			while (current !== '.' && current !== path.parse(current).root) {
				dirSet.add(current);
				current = path.dirname(current);
			}
		});

		// , /
		return Array.from(dirSet).map(dir => dir + path.sep);
	}

	/**
	 * （）
	 */
	async getTopLevelDirectories(cwd: string): Promise<FileSearchResult[]> {
		const workspaceUri = vscode.Uri.file(cwd);

		try {
			const entries = await vscode.workspace.fs.readDirectory(workspaceUri);
			const results: FileSearchResult[] = [];

			for (const [name, type] of entries) {
				if (type === vscode.FileType.Directory) {
					results.push({
						path: name,
						name: name,
						type: 'directory'
					});
				}
			}

			return results.sort((a, b) => a.name.localeCompare(b.name));
		} catch {
			return [];
		}
	}

	/**
	 * （ + ,）
	 */
	async getTopLevelContents(cwd: string): Promise<FileSearchResult[]> {
		try {
			const files = await this.listFilesWithRipgrep(cwd);
			const directories = this.extractParentDirectories(files);
			const allPaths = [...directories, ...files];

			return this.extractTopLevelItems(allPaths);

		} catch (error) {
			// Ripgrep , VSCode API
			console.warn('[FileSystemService] Ripgrep failed in getTopLevelContents, falling back to readDirectory:', error);

			try {
				const workspaceUri = vscode.Uri.file(cwd);
				const entries = await vscode.workspace.fs.readDirectory(workspaceUri);
				const results: FileSearchResult[] = [];

				for (const [name, type] of entries) {
					if (type === vscode.FileType.Directory) {
						results.push({ path: name, name: name, type: 'directory' });
					} else if (type === vscode.FileType.File) {
						results.push({ path: name, name: name, type: 'file' });
					}
				}

				return results.sort((a, b) => {
					if (a.type === 'directory' && b.type === 'file') return -1;
					if (a.type === 'file' && b.type === 'directory') return 1;
					return a.name.localeCompare(b.name);
				});
			} catch (fallbackError) {
				console.error('[FileSystemService] getTopLevelContents fallback also failed:', fallbackError);
				return [];
			}
		}
	}

	/**
	 */
	extractTopLevelItems(allPaths: string[]): FileSearchResult[] {
		const topLevelSet = new Set<string>();
		const maxItems = 200;

		for (const filePath of allPaths) {
			const firstLevel = filePath.split(path.sep)[0];
			if (firstLevel) {
				topLevelSet.add(firstLevel);
				if (topLevelSet.size >= maxItems) break;
			}
		}

		return Array.from(topLevelSet).sort().map(topLevel => {
			const hasChildren = allPaths.some(p => p.startsWith(topLevel + path.sep));

			return {
				path: hasChildren ? topLevel + path.sep : topLevel,
				name: path.basename(topLevel),
				type: hasChildren ? 'directory' as const : 'file' as const
			};
		});
	}

	// ===== =====

	/**
	 * Ripgrep （）
	 */
	private execRipgrep(args: string[], cwd: string): Promise<string[]> {
		const { command, args: defaultArgs } = this.getRipgrepCommand();

		return new Promise((resolve, reject) => {
			execFile(command, [...defaultArgs, ...args], {
				cwd,
				maxBuffer: 20 * 1024 * 1024, // 20MB（）
				timeout: 10_000 // 10（）
			}, (error, stdout) => {
				if (!error) {
					resolve(stdout.split(/\r?\n/).filter(Boolean));
					return;
				}

				// code === 1 ,
				const code = (error as any)?.code;
				if (code === 1) {
					resolve([]);
					return;
				}

				const signal = (error as any)?.signal;
				const hasOutput = stdout && stdout.trim().length > 0;

				if ((signal === 'SIGTERM' || code === 'ERR_CHILD_PROCESS_STDIO_MAXBUFFER') && hasOutput) {
					const lines = stdout.split(/\r?\n/).filter(Boolean);
					resolve(lines.length > 0 ? lines.slice(0, -1) : []);
					return;
				}

				reject(error);
			});
		});
	}

	/**
	 * Ripgrep （,）
	 */
	private getRipgrepCommand(): { command: string; args: string[] } {
		if (this.ripgrepCommandCache) {
			return this.ripgrepCommandCache;
		}

		// ripgrep（）
		const rootDir = path.resolve(__dirname, '..', '..', '..');
		const vendorDir = path.join(rootDir, 'vendor', 'ripgrep');

		let command: string;
		if (process.platform === 'win32') {
			command = path.join(vendorDir, 'x64-win32', 'rg.exe');
		} else {
			const platformKey = `${process.arch}-${process.platform}`;
			command = path.join(vendorDir, platformKey, 'rg');
		}

		// ripgrep , ripgrep
		try {
			require('fs').accessSync(command, require('fs').constants.X_OK);
		} catch {
			command = 'rg';
		}

		this.ripgrepCommandCache = { command, args: [] };
		return this.ripgrepCommandCache;
	}

	/**
	 * Fuse.js Search（）
	 * @param paths （, / ）
	 * @param pattern Search
	 * @returns Search
	 */
	private fuseSearchPaths(paths: string[], pattern: string): FileSearchResult[] {
		// 1.
		const items = paths.map(filePath => {
			const isDirectory = filePath.endsWith(path.sep);
			const cleanPath = isDirectory ? filePath.slice(0, -1) : filePath;

			return {
				path: filePath,
				filename: path.basename(cleanPath),
				testPenalty: cleanPath.includes('test') || cleanPath.includes('spec') ? 1 : 0,
				isDirectory
			};
		});

		// 2. Search,
		const lastSep = pattern.lastIndexOf(path.sep);
		let filteredItems = items;

		if (lastSep > 2) {
			const dirPrefix = pattern.substring(0, lastSep);
			filteredItems = items.filter(item =>
				item.path.substring(0, lastSep).startsWith(dirPrefix)
			);
		}

		// 3. Fuse.js Search（）
		const fuse = new Fuse(filteredItems, {
			includeScore: true,
			threshold: 0.5,
			keys: [
				{ name: 'path', weight: 1 },
				{ name: 'filename', weight: 2 }
			]
		});

		const results = fuse.search(pattern, { limit: 100 });

		// 4. ： > 0.05 ,
		const sorted = results.sort((a, b) => {
			const scoreA = a.score ?? 0;
			const scoreB = b.score ?? 0;

			if (Math.abs(scoreA - scoreB) > 0.05) {
				return scoreA - scoreB;
			}
			return a.item.testPenalty - b.item.testPenalty;
		});

		// 5. （ 100 ）
		return sorted.slice(0, 100).map(r => {
			const cleanPath = r.item.isDirectory ? r.item.path.slice(0, -1) : r.item.path;

			return {
				path: cleanPath,
				name: r.item.filename,
				type: r.item.isDirectory ? 'directory' : 'file'
			};
		});
	}

	/**
	 * （, handlers ）
	 */
	normalizeAbsolutePath(filePath: string, cwd: string): string {
		return path.isAbsolute(filePath)
			? path.normalize(filePath)
			: path.normalize(path.join(cwd, filePath));
	}

	/**
	 * （, handlers ）
	 */
	toWorkspaceRelative(absolutePath: string, cwd: string): string {
		const normalized = path.normalize(absolutePath);
		const normalizedCwd = path.normalize(cwd);

		if (normalized.startsWith(normalizedCwd)) {
			return normalized.substring(normalizedCwd.length + 1);
		}

		return normalized;
	}

	/**
	 * （ ~ ）
	 */
	resolveFilePath(filePath: string, cwd: string): string {
		if (!filePath) {
			return cwd;
		}

		// ~
		const expanded = filePath.startsWith('~')
			? path.join(require('os').homedir(), filePath.slice(1))
			: filePath;

		const absolute = path.isAbsolute(expanded)
			? expanded
			: path.join(cwd, expanded);

		return path.normalize(absolute);
	}

	/**
	 */
	async pathExists(target: string): Promise<boolean> {
		try {
			await require('fs').promises.access(target, require('fs').constants.F_OK);
			return true;
		} catch {
			return false;
		}
	}

	/**
	 * （）
	 */
	sanitizeFileName(fileName: string): string {
		const fallback = fileName && fileName.trim() ? fileName.trim() : 'claude.txt';
		return fallback.replace(/[<>:"\\/|?*\x00-\x1F]/g, '_');
	}

	/**
	 */
	async createTempFile(fileName: string, content: string): Promise<string> {
		const tempDir = await require('fs').promises.mkdtemp(
			path.join(require('os').tmpdir(), 'claude-')
		);
		const sanitized = this.sanitizeFileName(fileName);
		const filePath = path.join(tempDir, sanitized);
		await require('fs').promises.writeFile(filePath, content, 'utf8');
		return filePath;
	}

	/**
	 * （Search）
	 */
	async resolveExistingPath(filePath: string, cwd: string, searchResults?: FileSearchResult[]): Promise<string> {
		// 1.
		const absoluteCandidate = this.resolveFilePath(filePath, cwd);
		if (await this.pathExists(absoluteCandidate)) {
			return absoluteCandidate;
		}

		// 2. Search,
		if (searchResults && searchResults.length > 0) {
			const candidate = searchResults[0].path;
			const absolute = this.resolveFilePath(candidate, cwd);
			if (await this.pathExists(absolute)) {
				return absolute;
			}
		}

		// 3. （）
		return absoluteCandidate;
	}

	/**
	 * （）
	 */
	async findFiles(pattern: string | undefined, cwd: string): Promise<FileSearchResult[]> {
		// （ + ）
		if (!pattern || !pattern.trim()) {
			return await this.getTopLevelContents(cwd);
		}

		// Search（Ripgrep + + Fuse.js）
		try {
			return await this.searchFiles(pattern, cwd);
		} catch (error) {
			// Ripgrep , VSCode API
			console.warn(`[FileSystemService] Ripgrep search failed, falling back to VSCode API:`, error);

			try {
				return await this.searchFilesWithWorkspace(pattern, cwd);
			} catch (fallbackError) {
				console.error(`[FileSystemService] Fallback search also failed:`, fallbackError);
				return [];
			}
		}
	}

	/**
	 * （ VSCode .gitignore ）
	 * , searchFilesWithRipgrep
	 */
	private buildExcludePatterns(): string[] {
		const patterns = new Set<string>([
			'**/node_modules/**',
			'**/.git/**',
			'**/dist/**',
			'**/build/**',
			'**/.next/**',
			'**/.nuxt/**',
			'**/.DS_Store',
			'**/Thumbs.db',
			'**/*.log',
			'**/.env',
			'**/.env.*'
		]);

		try {
			const searchConfig = vscode.workspace.getConfiguration('search');
			const filesConfig = vscode.workspace.getConfiguration('files');
			const searchExclude = searchConfig.get<Record<string, boolean>>('exclude') ?? {};
			const filesExclude = filesConfig.get<Record<string, boolean>>('exclude') ?? {};

			for (const [glob, enabled] of Object.entries(searchExclude)) {
				if (enabled && typeof glob === 'string' && glob.length > 0) {
					patterns.add(glob);
				}
			}

			for (const [glob, enabled] of Object.entries(filesExclude)) {
				if (enabled && typeof glob === 'string' && glob.length > 0) {
					patterns.add(glob);
				}
			}

			const useIgnoreFiles = searchConfig.get<boolean>('useIgnoreFiles', true);
			if (useIgnoreFiles) {
				const folders = vscode.workspace.workspaceFolders;
				if (folders) {
					for (const folder of folders) {
						const gitignorePatterns = this.readGitignorePatterns(folder.uri.fsPath);
						gitignorePatterns.forEach(p => patterns.add(p));
					}
				}
				const globalPatterns = this.readGlobalGitignorePatterns();
				globalPatterns.forEach(p => patterns.add(p));
			}
		} catch {
			// ignore errors
		}

		return Array.from(patterns);
	}

	/**
	 * .gitignore
	 */
	private readGitignorePatterns(root: string): string[] {
		const entries: string[] = [];
		const localGitignore = path.join(root, '.gitignore');

		try {
			if (require('fs').existsSync(localGitignore)) {
				const content = require('fs').readFileSync(localGitignore, 'utf8');
				entries.push(...this.parseGitignore(content));
			}
		} catch {
			// ignore errors
		}

		return entries;
	}

	/**
	 * .gitignore
	 */
	private readGlobalGitignorePatterns(): string[] {
		const entries: string[] = [];
		const globalGitIgnore = path.join(require('os').homedir(), '.config', 'git', 'ignore');

		try {
			if (require('fs').existsSync(globalGitIgnore)) {
				const content = require('fs').readFileSync(globalGitIgnore, 'utf8');
				entries.push(...this.parseGitignore(content));
			}
		} catch {
			// ignore errors
		}

		return entries;
	}

	/**
	 * .gitignore
	 */
	private parseGitignore(content: string): string[] {
		const results: string[] = [];

		for (const rawLine of content.split(/\r?\n/)) {
			const line = rawLine.trim();
			if (!line || line.startsWith('#') || line.startsWith('!')) {
				continue;
			}

			let transformed = line;
			if (transformed.endsWith('/')) {
				transformed = `${transformed.slice(0, -1)}/**`;
			}
			if (transformed.startsWith('/')) {
				transformed = transformed.slice(1);
			} else {
				transformed = `**/${transformed}`;
			}
			results.push(transformed);
		}

		return results;
	}

	/**
	 * glob
	 * , searchFilesWithWorkspace
	 */
	private toExcludeGlob(patterns: string[]): string | undefined {
		if (patterns.length === 0) {
			return undefined;
		}
		if (patterns.length === 1) {
			return patterns[0];
		}
		return `{${patterns.join(',')}}`;
	}
}
