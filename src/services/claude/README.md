# Claude

（DI） Claude Agent ，。

##

```
claude/
├── transport/ #
│ ├── index.ts #
│ ├── AsyncStream.ts # （）
│ ├── BaseTransport.ts #
│ └── VSCodeTransport.ts # VSCode WebView
│
├── handlers/ #
│ ├── types.ts # Handler
│ ├── sessions.ts #
│ ├── auth.ts #
│ └── ... # handlers
│
├── ClaudeAgentService.ts #
├── ClaudeSdkService.ts # SDK
└── ClaudeSessionService.ts #
```

##

```
┌─────────────────────────────────────────────────┐
│ ClaudeAgentService │
│ (、、、RPC) │
└────────────┬──────────────┬─────────────────────┘
             │              │
    ┌────────▼───────┐ ┌───▼──────────────┐
 │ ITransport │ │ ClaudeSdkService│
 │ () │ │ (SDK ) │
    └────────┬───────┘ └───┬──────────────┘
             │              │
    ┌────────▼───────┐ ┌───▼──────────────┐
 │ BaseTransport │ │ AsyncStream │
 │ () │ │ () │
    └────────┬───────┘ └──────────────────┘
             │
    ┌────────▼───────┐
 │VSCodeTransport │
    │(VSCode WebView)│
    └────────────────┘
```

##

### (transport/)

**BaseTransport** -
- 、、
- ITransport
- `doSend()` `doClose()`

**VSCodeTransport** - VSCode
- BaseTransport
- VSCode WebView
- （Disposable）

**AsyncStream** -
- -
- 、
- Agent、SDK、Transport

###

**ClaudeAgentService**
- Claude （channels）
- handlers
- RPC -
- ITransport （）

**ClaudeSdkService**
- Claude Agent SDK
- query() interrupt()
- （Options、Hooks、）

**ClaudeSessionService**
-
- listSessions() getSession()
-

### Handlers

：
```typescript
async function handleXxx(
    request: TRequest,
    context: HandlerContext,
    signal?: AbortSignal
): Promise<TResponse>
```

HandlerContext ， VS Code API。

##

###

```typescript
// 1. （ DI ）
const agentService = instantiationService.get(IClaudeAgentService);
const logService = instantiationService.get(ILogService);

// 2. Transport
const transport = new VSCodeTransport(webview, logService);

// 3. Agent
agentService.init(transport);
```

###

```typescript
await agentService.launchClaude(
    'channel-1',
    null,                    // resume
    '/path/to/workspace',
    'claude-sonnet-4-5',
    'default'                // permissionMode
);
```

###

```typescript
// NestJS WebSocket Transport
class NestJSTransport extends BaseTransport {
    constructor(
        private gateway: WebSocketGateway,
        logService: ILogService
    ) {
        super(logService);
        gateway.onMessage((msg) => this.handleIncomingMessage(msg));
    }

    protected doSend(message: any): void {
        this.gateway.emit('message', message);
    }

    protected doClose(): void {
        this.gateway.close();
    }
}

//
const transport = new NestJSTransport(gateway, logService);
agentService.init(transport);
```

##

1. ****： DI
2. ****：
3. ****：Transport、Handler
4. ****：（ Handler、 Transport），
5. ****： API

##

### Handler

1. `handlers/`
2.
3. `ClaudeAgentService.handleRequest()`

### Transport

1. `BaseTransport`
2. `doSend()` `doClose()`
3. ：

###

1. （ createDecorator）
2.
3. serviceRegistry
4.

##

：

```typescript
// Mock Transport
class MockTransport extends BaseTransport {
    messages: any[] = [];

    protected doSend(message: any): void {
        this.messages.push(message);
    }

    protected doClose(): void {
        this.messages = [];
    }

 //
    simulateMessage(message: any): void {
        this.handleIncomingMessage(message);
    }
}

// Mock Transport
const mockTransport = new MockTransport(logService);
agentService.init(mockTransport);

//
expect(mockTransport.messages).toContainEqual({
    type: 'io_message',
    channelId: 'test',
    // ...
});
```

##

- [RefactorFunctions.md](../../../RefactorFunctions.md) -
- [REFACTOR_SUMMARY.md](../../../REFACTOR_SUMMARY.md) -
