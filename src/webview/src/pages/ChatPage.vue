<template>
  <div class="chat-page">
    <!-- Session Tabs -->
    <SessionTabBar
      :sessions="allSessions"
      :hidden-sessions="hiddenSessionsList"
      :active-session="activeSessionRawValue"
      @select="handleTabSelect"
      @close="handleTabClose"
      @restore="handleRestoreSession"
    />

    <div class="chat-header">
      <div class="header-left">
        <h2 class="chat-title">{{ title }}</h2>
      </div>
      <div class="header-right">
        <button class="new-chat-btn" title="New conversation" @click="createNew">
          <span class="codicon codicon-plus"></span>
        </button>
      </div>
    </div>

    <!-- ： -->
    <div class="main">
      <!-- <div class="chatContainer"> -->
        <FileEditedList
          :files-edited="editedFiles"
          :cwd="session?.cwd.value ?? ''"
          :on-open-file="(p) => toolContext.fileOpener.open(p)"
          :on-open-diff="(p, edits) => toolContext.fileOpener.openDiff(p, edits)"
        />
        <div
          ref="containerEl"
          :class="['messagesContainer', 'custom-scroll-container', { dimmed: permissionRequestsLen > 0 }]"
          @scroll="handleMessagesScroll"
        >
          <template v-if="messages.length === 0">
            <div v-if="isBusy" class="emptyState">
              <div class="emptyWordmark">
                <ClaudeWordmark class="emptyWordmarkSvg" />
              </div>
            </div>
            <div v-else class="emptyState">
              <div class="emptyWordmark">
                <ClaudeWordmark class="emptyWordmarkSvg" />
              </div>
              <RandomTip :platform="platform" />
            </div>
          </template>
          <template v-else>
            <!-- <div class="msg-list"> -->
              <MessageRenderer
                v-for="(m, i) in messages"
                :key="m?.id ?? i"
                :message="m"
                :message-index="i"
                :context="toolContext"
              />
            <!-- </div> -->
            <div v-if="isBusy" class="spinnerRow">
              <Spinner :size="16" :permission-mode="permissionMode" />
            </div>
            <div ref="endEl" />
          </template>
        </div>

        <div class="inputContainer">
          <!-- Queued message banner -->
          <div v-if="queuedMessage" class="queued-message-banner">
            <div class="queued-message-content">
              <span class="queued-message-label">Queued</span>
              <span class="queued-message-text">{{ queuedMessage }}</span>
            </div>
            <div class="queued-message-actions">
              <button class="queued-message-btn send-now" @click="flushQueuedMessage" title="Interrupt & send now">
                <span class="codicon codicon-debug-continue" />
              </button>
              <button class="queued-message-btn dismiss" @click="dismissQueuedMessage" title="Dismiss">
                <span class="codicon codicon-close" />
              </button>
            </div>
          </div>
          <PermissionRequestModal
            v-if="pendingPermission && toolContext"
            :request="pendingPermission"
            :context="toolContext"
            :on-resolve="handleResolvePermission"
            data-permission-panel="1"
          />
          <ChatInputBox
            :show-progress="true"
            :progress-percentage="progressPercentage"
            :usage-data="session?.usageData.value"
            :conversation-working="isBusy"
            :attachments="attachments"
            :thinking-level="session?.thinkingLevel.value"
            :permission-mode="session?.permissionMode.value"
            :selected-model="session?.modelSelection.value"
            :full-text-mode="fullTextMode"
            @submit="handleSubmit"
            @queue-message="(msg: string) => { queuedMessage = msg }"
            @stop="handleStop"
            @add-attachment="handleAddAttachment"
            @add-file-ref="handleAddFileRef"
            @remove-attachment="handleRemoveAttachment"
            @set-attachments="(a) => { attachments = a }"
            @thinking-toggle="handleToggleThinking"
            @full-text-toggle="fullTextMode = !fullTextMode"
            @mode-select="handleModeSelect"
            @model-select="handleModelSelect"
          />
        </div>
      <!-- </div> -->
    </div>
  </div>
</template>

<script setup lang="ts">
  import { ref, computed, inject, onMounted, onUnmounted, nextTick, watch } from 'vue';
  import { RuntimeKey } from '../composables/runtimeContext';
  import { useSession } from '../composables/useSession';
  import { useSessionStore } from '../composables/useSessionStore';
  import type { Session } from '../core/Session';
  import type { PermissionRequest } from '../core/PermissionRequest';
  import type { ToolContext } from '../types/tool';
  import type { AttachmentItem } from '../types/attachment';
  import { convertFileToAttachment } from '../types/attachment';
  import SessionTabBar from '../components/SessionTabBar.vue';
  import ChatInputBox from '../components/ChatInputBox.vue';
  import PermissionRequestModal from '../components/PermissionRequestModal.vue';
  import Spinner from '../components/Messages/WaitingIndicator.vue';
  import ClaudeWordmark from '../components/ClaudeWordmark.vue';
  import RandomTip from '../components/RandomTip.vue';
  import MessageRenderer from '../components/Messages/MessageRenderer.vue';
  import FileEditedList from '../components/FileEditedList.vue';
  import type { FileEdit } from '../types/toolbar';
  import { useKeybinding } from '../utils/useKeybinding';
  import { useSignal } from '@gn8/alien-signals-vue';
  import type { PermissionMode } from '@anthropic-ai/claude-agent-sdk';

  const runtime = inject(RuntimeKey);
  if (!runtime) throw new Error('[ChatPage] runtime not provided');

  // Store reverted edits per message index for undo-restore toggle
  type EditEntry = { filePath: string; editType: 'edit' | 'write'; oldString?: string; newString?: string; fileContents?: string };
  type RestoreState = { atIndex: number | null; checkpoints: Map<number, EditEntry[]> };
  const restoredCheckpoints = ref<Map<number, EditEntry[]>>(new Map());
  // Track which index messages are dimmed from (null = nothing dimmed)
  const restoredAtIndex = ref<number | null>(null);

  // Track whether a revert is active — triggers fresh session on next submit
  const hasActiveRevert = ref(false);

  // Queued message: shown when user submits while AI is busy
  const queuedMessage = ref<string | null>(null);

  // Per-session save/restore of checkpoint state (so switching tabs preserves gray)
  const savedRestoreStates = new Map<any, RestoreState>();
  let previousRawSession: any = null;

  const toolContext = computed<ToolContext>(() => ({
    fileOpener: {
      open: (filePath: string, location?: any) => {
        void runtime.appContext.fileOpener.open(filePath, location);
      },
      openContent: (content: string, fileName: string, editable: boolean) => {
        return runtime.appContext.fileOpener.openContent(
          content,
          fileName,
          editable
        );
      },
      openDiff: async (filePath: string, edits: Array<{ oldString: string; newString: string; replaceAll?: boolean }>) => {
        const connection = await runtime.sessionStore.getConnection();
        await connection.showEditDiff(filePath, edits);
      },
    },
    revertFileEdit: async (action, filePath, editType, options) => {
      const connection = await runtime.sessionStore.getConnection();
      const result = await connection.revertFileEdit(action, filePath, editType, options);
      if (result.success) {
        hasActiveRevert.value = action === 'revert';
      }
      return result;
    },
    restoreCheckpoint: async (messageIndex: number) => {
      const allMsgs = messages.value;
      if (messageIndex < 0 || messageIndex >= allMsgs.length) return;

      // --- UNDO MODE: if already restored, re-apply the saved edits ---
      const savedEdits = restoredCheckpoints.value.get(messageIndex);
      if (savedEdits && savedEdits.length > 0) {
        let reapplied = 0;
        let reapplyFailed = 0;
        const conn = await runtime.sessionStore.getConnection();

        for (const edit of savedEdits) {
          try {
            const result = await conn.revertFileEdit('reapply', edit.filePath, edit.editType, {
              oldString: edit.oldString,
              newString: edit.newString,
              fileContents: edit.fileContents,
              previousContents: null,
            });
            if (result.success) reapplied++;
            else reapplyFailed++;
          } catch {
            reapplyFailed++;
          }
        }

        // Clear the restored state + remove dimming
        const newMap = new Map(restoredCheckpoints.value);
        newMap.delete(messageIndex);
        restoredCheckpoints.value = newMap;
        restoredAtIndex.value = null;
        hasActiveRevert.value = false;

        const redoMsg = reapplyFailed > 0
          ? `${reapplied} Änderungen wiederhergestellt, ${reapplyFailed} fehlgeschlagen.`
          : `${reapplied} Änderungen wiederhergestellt.`;
        await runtime.appContext.showNotification?.(redoMsg, reapplyFailed > 0 ? 'warning' : 'info');
        return;
      }

      // --- RESTORE MODE ---

      // Auto-stop if chat is running
      const s = session.value;
      if (isBusy.value && s) {
        void s.interrupt();
        // Brief wait for interrupt to take effect
        await new Promise(r => setTimeout(r, 300));
      }

      // Collect edits after this message
      const editsToRevert: EditEntry[] = [];

      for (let i = messageIndex + 1; i < allMsgs.length; i++) {
        const msg = allMsgs[i];
        const content = msg?.message?.content;
        if (!Array.isArray(content)) continue;

        for (const wrapper of content) {
          const block = wrapper?.content;
          if (!block || block.type !== 'tool_use') continue;
          const name = block.name;
          const input = block.input;
          if (!input?.file_path) continue;

          if (name === 'Edit' || name === 'MultiEdit') {
            editsToRevert.push({
              filePath: input.file_path,
              editType: 'edit',
              oldString: input.old_string,
              newString: input.new_string,
            });
          } else if (name === 'Write') {
            editsToRevert.push({
              filePath: input.file_path,
              editType: 'write',
              fileContents: input.content,
            });
          }
        }
      }

      // Revert in reverse order (most recent first)
      const connection = await runtime.sessionStore.getConnection();
      let reverted = 0;
      let failed = 0;
      const successfulReverts: EditEntry[] = [];

      for (let i = editsToRevert.length - 1; i >= 0; i--) {
        const edit = editsToRevert[i];
        try {
          const result = await connection.revertFileEdit('revert', edit.filePath, edit.editType, {
            oldString: edit.oldString,
            newString: edit.newString,
            fileContents: edit.fileContents,
            previousContents: null,
          });
          if (result.success) {
            reverted++;
            successfulReverts.unshift(edit);
          } else {
            failed++;
          }
        } catch {
          failed++;
        }
      }

      // Save for undo toggle + set dimming
      if (successfulReverts.length > 0) {
        const newMap = new Map(restoredCheckpoints.value);
        newMap.set(messageIndex, successfulReverts);
        restoredCheckpoints.value = newMap;
        hasActiveRevert.value = true;
      }
      restoredAtIndex.value = messageIndex;

      if (reverted > 0 || failed > 0) {
        const msg = failed > 0
          ? `${reverted} Änderungen rückgängig gemacht, ${failed} fehlgeschlagen.`
          : `${reverted} Änderungen rückgängig gemacht.`;
        await runtime.appContext.showNotification?.(msg, failed > 0 ? 'warning' : 'info');
      }
    },
    isCheckpointRestored: (messageIndex: number) => {
      return restoredAtIndex.value === messageIndex;
    },
    restoredAtIndex: restoredAtIndex.value,
    editAndRestart: async (messageIndex: number, newContent: string) => {
      // Use raw Session object directly (has truncateMessagesAfter + send)
      const rawSession = activeSessionRaw.value;
      if (!rawSession) return;

      // Stop chat if running
      if (isBusy.value) {
        await rawSession.interrupt();
        await new Promise(r => setTimeout(r, 300));
      }

      // Truncate: keep messages 0..messageIndex-1 (remove clicked message + everything after)
      rawSession.truncateMessagesAfter(messageIndex > 0 ? messageIndex - 1 : 0);

      // Clear restore state
      restoredAtIndex.value = null;
      restoredCheckpoints.value = new Map();

      // Send the edited message as new
      try {
        userScrolledUp = false;
        await rawSession.send(newContent);
        scrollToBottom(true);
      } catch (e) {
        console.error('[ChatPage] editAndRestart send failed', e);
      }
    },
    showNotification: async (message, severity) => {
      return runtime.appContext.showNotification?.(message, severity);
    },
  }));

 // useSessionStore（bewährtes Pattern aus der alten Sessions-Seite）
  const store = useSessionStore(runtime.sessionStore);

  // Sessions-Liste für die Tab-Leiste (nur sichtbare)
  const allSessions = computed(() => {
    const sessions = useSignal(runtime.sessionStore.visibleSessions).value || [];
    return sessions.filter(Boolean) as Session[];
  });

  const hiddenSessionsList = computed(() => {
    const sessions = useSignal(runtime.sessionStore.hiddenSessions).value || [];
    return sessions.filter(Boolean) as Session[];
  });

 // activeSession（alien-signal → Vue ref）
  const activeSessionRaw = useSignal<Session | undefined>(
    runtime.sessionStore.activeSession
  );
  const activeSessionRawValue = computed(() => activeSessionRaw.value);

 // useSession alien-signals Vue Refs
  const session = computed(() => {
    const raw = activeSessionRaw.value;
    return raw ? useSession(raw) : null;
  });

 // Vue Ref（.value）
  const title = computed(() => session.value?.summary.value || 'New Conversation');
  const messages = computed<any[]>(() => session.value?.messages.value ?? []);

  const editedFiles = computed<FileEdit[]>(() => {
    const allMsgs = messages.value;
    const fileMap = new Map<string, FileEdit>();
    for (const msg of allMsgs) {
      const content = msg?.message?.content;
      if (!Array.isArray(content)) continue;
      for (const wrapper of content) {
        const block = wrapper?.content || wrapper;
        if (block?.type !== 'tool_use') continue;
        const { name, input } = block;
        if (!input?.file_path) continue;
        if (!['Edit', 'Write', 'MultiEdit', 'NotebookEdit'].includes(name)) continue;

        let entry = fileMap.get(input.file_path);
        if (!entry) {
          const normalized = input.file_path.replace(/\\/g, '/');
          entry = {
            name: normalized.split('/').pop() || input.file_path,
            filePath: input.file_path,
            diffEdits: [],
            isNewFile: false,
          };
          fileMap.set(input.file_path, entry);
        }

        // Collect edits that have old_string/new_string (Edit, MultiEdit)
        if ((name === 'Edit' || name === 'MultiEdit') && input.old_string != null && input.new_string != null) {
          entry.diffEdits!.push({
            oldString: input.old_string,
            newString: input.new_string,
            replaceAll: input.replace_all ?? false,
          });
        }

        // Mark as new file if the first operation on this file is a Write
        if (name === 'Write' && entry.diffEdits!.length === 0) {
          entry.isNewFile = true;
        }
      }
    }
    return Array.from(fileMap.values());
  });

  const isBusy = computed(() => session.value?.busy.value ?? false);
  const permissionMode = computed(
    () => session.value?.permissionMode.value ?? 'default'
  );
  const permissionRequests = computed(
    () => session.value?.permissionRequests.value ?? []
  );
  const permissionRequestsLen = computed(() => permissionRequests.value.length);
  const pendingPermission = computed(() => permissionRequests.value[0] as any);
  const platform = computed(() => runtime.appContext.platform);

 // ：permissionMode.toggle（）

 // Token （ usageData）
  const progressPercentage = computed(() => {
    const s = session.value;
    if (!s) return 0;

    const usage = s.usageData.value;
    const total = usage.totalTokens;
    const windowSize = usage.contextWindow || 200000;

    if (typeof total === 'number' && total > 0) {
      return Math.max(0, Math.min(100, (total / windowSize) * 100));
    }

    return 0;
  });

  // DOM refs
  const containerEl = ref<HTMLDivElement | null>(null);
  const endEl = ref<HTMLDivElement | null>(null);

  const attachments = ref<AttachmentItem[]>([]);
  const fullTextMode = ref(false);

  let prevCount = 0;
  // Track whether user has scrolled up — if so, don't auto-scroll
  let userScrolledUp = false;

  function stringify(m: any): string {
    try {
      return JSON.stringify(m ?? {}, null, 2);
    } catch {
      return String(m);
    }
  }

  function isNearBottom(): boolean {
    const el = containerEl.value;
    if (!el) return true;
    // Consider "near bottom" if within 80px of the end
    return el.scrollHeight - el.scrollTop - el.clientHeight < 80;
  }

  function handleMessagesScroll(): void {
    userScrolledUp = !isNearBottom();
  }

  function scrollToBottom(force = false): void {
    if (!force && userScrolledUp) return;
    const end = endEl.value;
    if (!end) return;
    requestAnimationFrame(() => {
      try {
        end.scrollIntoView({ block: 'end' });
        userScrolledUp = false;
      } catch {}
    });
  }

  // Save/restore checkpoint state per session so gray persists across tab switches
  watch(() => activeSessionRaw.value, (newRaw) => {
    // Save current state for the session we're leaving
    if (previousRawSession) {
      savedRestoreStates.set(previousRawSession, {
        atIndex: restoredAtIndex.value,
        checkpoints: new Map(restoredCheckpoints.value),
      });
    }
    // Restore saved state for the session we're entering
    const saved = newRaw ? savedRestoreStates.get(newRaw) : null;
    if (saved) {
      restoredAtIndex.value = saved.atIndex;
      restoredCheckpoints.value = saved.checkpoints;
    } else {
      restoredAtIndex.value = null;
      restoredCheckpoints.value = new Map();
    }
    previousRawSession = newRaw;
  });

  watch(session, async () => {
    prevCount = 0;
    userScrolledUp = false;
    await nextTick();
    scrollToBottom(true);
  });

  // moved above

  watch(
    () => messages.value.length,
    async len => {
      const increased = len > prevCount;
      prevCount = len;
      if (increased) {
        await nextTick();
        scrollToBottom(); // respects userScrolledUp
      }
    }
  );

  watch(permissionRequestsLen, async () => {
    await nextTick();
    scrollToBottom(); // respects userScrolledUp
  });

  // Auto-send queued message when AI finishes
  watch(() => isBusy.value, (busy) => {
    if (!busy && queuedMessage.value) {
      const msg = queuedMessage.value;
      queuedMessage.value = null;
      void handleSubmit(msg);
    }
  });

  function flushQueuedMessage() {
    const s = session.value;
    const msg = queuedMessage.value;
    if (!s || !msg) return;
    queuedMessage.value = null;
    void s.interrupt();
    setTimeout(() => void handleSubmit(msg), 300);
  }

  function dismissQueuedMessage() {
    queuedMessage.value = null;
  }

  onMounted(async () => {
    prevCount = messages.value.length;
    await nextTick();
    scrollToBottom(true);
  });

  onUnmounted(() => {
    try { unregisterToggle?.(); } catch {}
  });

  async function createNew(): Promise<void> {
    if (!runtime) return;

 // 1. appContext.startNewConversationTab （）
    if (runtime.appContext.startNewConversationTab()) {
      return;
    }

 // 2. ，
    const currentMessages = messages.value;
    if (currentMessages.length === 0) {
      return;
    }

 // 3. ，
    await runtime.sessionStore.createSession({ isExplicit: true });
  }

  // Session Tab Handlers
  function handleTabSelect(targetSession: Session) {
    runtime.sessionStore.setActiveSession(targetSession);
  }

  function handleTabClose(targetSession: Session) {
    const sessionId = targetSession.sessionId();
    if (sessionId) {
      runtime.sessionStore.hideSession(sessionId);
    }
    if (runtime.sessionStore.activeSession() === targetSession) {
      const visible = runtime.sessionStore.visibleSessions();
      runtime.sessionStore.setActiveSession(visible[0] ?? undefined);
    }
  }

  function handleRestoreSession(targetSession: Session) {
    const sessionId = targetSession.sessionId();
    if (sessionId) {
      runtime.sessionStore.unhideSession(sessionId);
      runtime.sessionStore.setActiveSession(targetSession);
    }
  }

 // ChatInput
  async function handleSubmit(content: string) {
    const s = session.value;
    let trimmed = (content || '').trim();
    if (!s || (!trimmed && attachments.value.length === 0)) return;

    // If chat is busy, queue the message instead of sending
    if (isBusy.value) {
      queuedMessage.value = trimmed;
      return;
    }

    // Separate file-reference pills from binary attachments
    const fileRefs = attachments.value.filter(a => a.isFileRef);
    const binaryAttachments = attachments.value.filter(a => !a.isFileRef);

    // Fulltext mode: read file contents and convert refs to text/plain attachments
    if (fullTextMode.value && fileRefs.length > 0) {
      try {
        const connection = await runtime.sessionStore.getConnection();
        const paths = fileRefs.map(f => f.filePath!).filter(Boolean);
        const result = await connection.readFileContents(paths);
        if (result?.files) {
          for (const file of result.files) {
            if (file.error || !file.content) continue;
            const encoded = typeof globalThis.btoa === 'function' ? globalThis.btoa(unescape(encodeURIComponent(file.content))) : '';
            binaryAttachments.push({ id: `fulltext-${Date.now()}-${Math.random().toString(36).slice(2)}`, fileName: file.fileName, mediaType: 'text/plain', data: encoded, fileSize: file.content.length });
          }
        }
      } catch (e) { console.error('[ChatPage] fulltext read failed', e); }
    } else if (fileRefs.length > 0) {
      const paths = fileRefs.map(f => `@${f.filePath}`).join(' ');
      trimmed = trimmed ? `${paths} ${trimmed}` : paths;
    }

    // If a revert is active, create a fresh session so the model starts clean
    if (hasActiveRevert.value) {
      hasActiveRevert.value = false;
      restoredAtIndex.value = null;
      restoredCheckpoints.value = new Map();
      try {
        const newSession = await runtime.sessionStore.createSession({ isExplicit: true });
        userScrolledUp = false;
        await newSession.send(trimmed || ' ', binaryAttachments);
        attachments.value = [];
        scrollToBottom(true);
      } catch (e) {
        console.error('[ChatPage] revert-restart send failed', e);
      }
      return;
    }

    try {
      userScrolledUp = false;
      await s.send(trimmed || ' ', binaryAttachments);
      attachments.value = [];
      scrollToBottom(true);
    } catch (e) {
      console.error('[ChatPage] send failed', e);
    }
  }

  async function handleToggleThinking() {
    const s = session.value;
    if (!s) return;

    const currentLevel = s.thinkingLevel.value;
    const newLevel = currentLevel === 'off' ? 'default_on' : 'off';

    await s.setThinkingLevel(newLevel);
  }

  async function handleModeSelect(mode: PermissionMode) {
    const s = session.value;
    if (!s) return;

    await s.setPermissionMode(mode);
  }

 // permissionMode.toggle：
  const togglePermissionMode = () => {
    const s = session.value;
    if (!s) return;
    const order: PermissionMode[] = ['default', 'acceptEdits', 'plan'];
    const cur = (s.permissionMode.value as PermissionMode) ?? 'default';
    const idx = Math.max(0, order.indexOf(cur));
    const next = order[(idx + 1) % order.length];
    void s.setPermissionMode(next);
  };

 // （toggle ）
  const unregisterToggle = runtime.appContext.commandRegistry.registerAction(
    {
      id: 'permissionMode.toggle',
      label: 'Toggle Permission Mode',
      description: 'Cycle permission mode in fixed order'
    },
    'App Shortcuts',
    () => {
      togglePermissionMode();
    }
  );

 // ：shift+tab → permissionMode.toggle（）
  useKeybinding({
    keys: 'shift+tab',
    handler: togglePermissionMode,
    allowInEditable: true,
    priority: 100,
  });

  async function handleModelSelect(modelId: string) {
    const s = session.value;
    if (!s) return;

    await s.setModel({ value: modelId });
  }

  function handleStop() {
    const s = session.value;
    if (s) {
 // useSession ，
      void s.interrupt();
    }
  }

  async function handleAddAttachment(files: FileList) {
    if (!files || files.length === 0) return;

    try {
 // AttachmentItem
      const conversions = await Promise.all(
        Array.from(files).map(convertFileToAttachment)
      );

      attachments.value = [...attachments.value, ...conversions];

      console.log('[ChatPage] Added attachments:', conversions.map(a => a.fileName));
    } catch (e) {
      console.error('[ChatPage] Failed to convert files:', e);
    }
  }

  function handleAddFileRef(paths: string[]) {
    const newRefs = paths
      .filter(p => p && p.trim())
      .map(p => {
        const fileName = p.replace(/\\/g, '/').split('/').pop() || p;
        return {
          id: `fileref-${Date.now()}-${Math.random().toString(36).slice(2)}`,
          fileName,
          filePath: p,
          isFileRef: true,
          mediaType: 'application/vnd.file-reference',
          data: '',
          fileSize: 0,
        };
      });
    attachments.value = [...attachments.value, ...newRefs];
  }

  function handleRemoveAttachment(id: string) {
    attachments.value = attachments.value.filter(a => a.id !== id);
  }

  // Permission modal handler
  function handleResolvePermission(request: PermissionRequest, allow: boolean) {
    try {
      if (allow) {
        request.accept(request.inputs);
      } else {
        request.reject('User denied', true);
      }
    } catch (e) {
      console.error('[ChatPage] permission resolve failed', e);
    }
  }
</script>

<style scoped>
  .chat-page {
    display: flex;
    flex-direction: column;
    height: 100%;
  }

  .chat-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-bottom: 1px solid var(--vscode-panel-border);
    min-height: 32px;
    padding: 0 12px;
  }

  .header-left {
    display: flex;
    align-items: center;
    overflow: hidden;
    flex: 1;
  }

  .chat-title {
    margin: 0;
    font-size: 12px;
    font-weight: 600;
    color: var(--vscode-titleBar-activeForeground);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .header-right {
    display: flex;
    gap: 4px;
  }

  .new-chat-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    border: none;
    background: transparent;
    color: var(--vscode-titleBar-activeForeground);
    border-radius: 3px;
    cursor: pointer;
    transition: background-color 0.2s;
    opacity: 0.7;
  }

  .new-chat-btn .codicon {
    font-size: 12px;
  }

  .new-chat-btn:hover {
    background: var(--vscode-toolbar-hoverBackground);
    opacity: 1;
  }

  .main {
    flex: 1;
    display: flex;
    flex-direction: column;
    position: relative;
    overflow: hidden;
  }

 /* Chat （ React） */
  .chatContainer {
    position: relative;
    height: 100%;
    display: flex;
    flex-direction: column;
  }
  .messagesContainer {
    flex: 1;
    overflow-y: auto;
    overflow-x: hidden;
    padding: 8px 0 12px;
    position: relative;
  }
  .messagesContainer.dimmed {
    filter: blur(1px);
    opacity: 0.5;
    pointer-events: none;
  }

  .msg-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 0 12px;
  }

  .msg-item {
    background: var(--vscode-editor-background);
    border: 1px solid var(--vscode-panel-border);
    border-radius: 6px;
    padding: 8px;
  }

  .json-block {
    margin: 0;
    white-space: pre-wrap;
    word-break: break-word;
    font-family: var(
      --app-monospace-font-family,
      ui-monospace,
      SFMono-Regular,
      Menlo,
      Monaco,
      Consolas,
      'Liberation Mono',
      'Courier New',
      monospace
    );
    font-size: var(--app-monospace-font-size, 12px);
    line-height: 1.5;
    color: var(--vscode-editor-foreground);
  }

 /* */

 /* */
  .inputContainer {
    padding: 8px 12px 12px;
  }

  .queued-message-banner {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    padding: 6px 10px;
    margin-bottom: 6px;
    border-radius: 8px;
    border: 1px solid color-mix(in srgb, var(--vscode-foreground) 15%, transparent);
    background: color-mix(in srgb, var(--vscode-foreground) 6%, transparent);
  }

  .queued-message-content {
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 0;
    flex: 1;
  }

  .queued-message-label {
    font-size: 10px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: #a78bfa;
    flex-shrink: 0;
  }

  .queued-message-text {
    font-size: 12px;
    color: var(--vscode-foreground);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    opacity: 0.8;
  }

  .queued-message-actions {
    display: flex;
    gap: 2px;
    flex-shrink: 0;
  }

  .queued-message-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 22px;
    height: 22px;
    border: none;
    border-radius: 4px;
    background: transparent;
    color: var(--vscode-foreground);
    cursor: pointer;
    opacity: 0.6;
    transition: opacity 0.15s, background 0.15s;
  }

  .queued-message-btn:hover {
    opacity: 1;
    background: color-mix(in srgb, var(--vscode-foreground) 12%, transparent);
  }

  .queued-message-btn.send-now:hover {
    color: #22c55e;
  }

  .queued-message-btn.dismiss:hover {
    color: #ef4444;
  }

 /* */
  .main > :last-child {
    flex-shrink: 0;
    background-color: var(--vscode-sideBar-background);
    /* border-top: 1px solid var(--vscode-panel-border); */
    max-width: 1200px;
    width: 100%;
    align-self: center;
  }

 /* */
  .emptyState {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    padding: 32px 16px;
  }

  .emptyWordmark {
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 24px;
  }
</style>
