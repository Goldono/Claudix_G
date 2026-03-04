# Claude Code Optimo

![VS Code Extension](https://img.shields.io/badge/VS%20Code-Extension-blue?logo=visual-studio-code)
![Built with TypeScript](https://img.shields.io/badge/Built%20with-TypeScript-blue?logo=typescript)
![License](https://img.shields.io/badge/License-AGPL--3.0-blue)
![Powered by Claude Agent SDK](https://img.shields.io/badge/Powered%20by-Claude%20Agent%20SDK-orange)

> **Unofficial community project** — This extension is not made by or affiliated with Anthropic. It uses the official [Claude Agent SDK](https://www.npmjs.com/package/@anthropic-ai/claude-agent-sdk) to connect to Claude Code.

A VSCode extension that brings Claude Code directly into your editor with an enhanced user interface.

## Features

- Interactive chat interface with Claude Code inside VSCode
- Session management and conversation history
- Intelligent file operations and code analysis
- Terminal command execution
- Permission-based tool access
- Support for multiple Claude models
- Real-time streaming responses
- Syntax highlighting and markdown rendering
- Plan mode for complex tasks

## Prerequisites

**Claude Code must be installed on your system.** This extension does not bundle Claude Code — it connects to your existing installation.

```bash
npm install -g @anthropic-ai/claude-code
```

After installation, run `claude` in your terminal once to log in to your Anthropic account.

For more details, see the [official Claude Code documentation](https://docs.anthropic.com/en/docs/build-with-claude/claude-code/overview).

## Installation

### From Source

```bash
# Clone the repository
git clone https://github.com/Goldono/claude-code-optimo.git
cd claude-code-optimo

# Install dependencies
pnpm install

# Build the extension
pnpm build

# Package as VSIX
pnpm package
```

Install the generated `.vsix` file in VSCode through **Extensions > Install from VSIX**.

## Usage

1. Make sure Claude Code is installed and you are logged in (`claude` in terminal)
2. Open the Claude Code Optimo sidebar from the activity bar
3. Start a new conversation or continue from history
4. Ask questions, request code changes, or get help with your project
5. Review and approve tool operations when prompted

If you are not logged in, click the **"Log in to Claude Code"** button in the sidebar — it will open a terminal where you can authenticate.

## Development

### Running in Development Mode

```bash
pnpm dev
```

This will concurrently start:
- Vite dev server (port 5173) for the webview
- esbuild watcher for the extension

### Build Commands

```bash
# Build everything
pnpm build

# Build extension only
pnpm build:extension

# Build webview only
pnpm build:webview

# Run tests
pnpm test

# Type checking
pnpm typecheck:all
```

## Requirements

- VSCode >= 1.98.0
- Node.js >= 18.0.0
- Claude Code (installed globally via npm)

## Credits

This project is a fork of [Claudix](https://github.com/Haleclipse/Claudix) by Haleclipse, with significant modifications and improvements.

## Contributing

Contributions are welcome! Please open an issue first to discuss your ideas or proposed changes.

## License

[AGPL-3.0](LICENSE)

## Disclaimer

This is an independent community project. "Claude" and "Claude Code" are trademarks of Anthropic, PBC. This project is not endorsed by, affiliated with, or sponsored by Anthropic.
