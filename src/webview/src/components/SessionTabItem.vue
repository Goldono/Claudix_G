<template>
  <button
    :class="[
      'session-tab',
      {
        'session-tab--active': isActive,
        'session-tab--busy': busy,
        'session-tab--permission': hasPermission,
        'session-tab--idle': !busy && !hasPermission,
      },
    ]"
    :title="fullSummary"
    @click="$emit('select')"
    @contextmenu.prevent="showContextMenu"
  >
    <span class="tab-dot" />
    <span class="tab-label">{{ label }}</span>
    <span
      class="tab-close"
      title="Schließen"
      @click.stop="$emit('close')"
    >
      <span class="codicon codicon-close" />
    </span>

    <!-- Context Menu -->
    <div v-if="contextMenuVisible" class="tab-context-menu" @click.stop>
      <button class="context-menu-item" @click.stop="closeOthers">
        <span class="codicon codicon-close-all"></span>
        <span>Andere Tabs schließen</span>
      </button>
      <button class="context-menu-item" @click.stop="emitClose">
        <span class="codicon codicon-close"></span>
        <span>Diesen Tab schließen</span>
      </button>
    </div>
  </button>
</template>

<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted } from 'vue';
import { useSignal } from '@gn8/alien-signals-vue';
import type { Session } from '../core/Session';

const props = defineProps<{
  session: Session;
  isActive: boolean;
}>();

const emit = defineEmits<{
  (e: 'select'): void;
  (e: 'close'): void;
  (e: 'closeOthers'): void;
}>();

// Context menu
const contextMenuVisible = ref(false);

function showContextMenu() {
  contextMenuVisible.value = true;
  // Close on next click anywhere
  setTimeout(() => document.addEventListener('click', hideContextMenu, { once: true }), 0);
}

function hideContextMenu() {
  contextMenuVisible.value = false;
}

function closeOthers() {
  contextMenuVisible.value = false;
  emit('closeOthers');
}

function emitClose() {
  contextMenuVisible.value = false;
  emit('close');
}

onUnmounted(() => {
  document.removeEventListener('click', hideContextMenu);
});

// Bridge alien-signals to Vue refs for reactivity
const busy = useSignal(props.session.busy);
const summary = useSignal(props.session.summary);
const permissionRequests = useSignal(props.session.permissionRequests);

const hasPermission = computed(() => (permissionRequests.value?.length ?? 0) > 0);
const fullSummary = computed(() => summary.value || 'New Conversation');
const label = computed(() => {
  const s = summary.value;
  if (!s) return 'New Conversation';
  return s.length > 20 ? s.slice(0, 19) + '…' : s;
});
</script>

<style scoped>
.session-tab {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 3px 8px;
  border: none;
  border-radius: 4px 4px 0 0;
  background: transparent;
  color: var(--vscode-foreground);
  font-size: 11px;
  font-family: inherit;
  cursor: pointer;
  white-space: nowrap;
  max-width: 160px;
  min-width: 40px;
  transition: background-color 0.2s, color 0.2s, opacity 0.2s;
  opacity: 0.7;
  position: relative;
}

.session-tab:hover {
  opacity: 1;
  background: var(--vscode-toolbar-hoverBackground);
}

/* Active tab */
.session-tab--active {
  opacity: 1;
  background: var(--vscode-editor-background);
  border-bottom: 2px solid var(--vscode-focusBorder);
}

/* Status: Busy (yellow background) */
.session-tab--busy {
  background: rgba(234, 179, 8, 0.2);
  color: #eab308;
}
.session-tab--busy.session-tab--active {
  background: rgba(234, 179, 8, 0.25);
  border-bottom-color: #eab308;
}

/* Status: Permission request (red) */
.session-tab--permission {
  color: #ef4444;
}
.session-tab--permission.session-tab--active {
  border-bottom-color: #ef4444;
}

/* Status: Idle/Done (green) */
.session-tab--idle {
  color: #22c55e;
}
.session-tab--idle.session-tab--active {
  border-bottom-color: #22c55e;
}

/* Status dot */
.tab-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  flex-shrink: 0;
}

.session-tab--busy .tab-dot {
  background: #eab308;
}

.session-tab--permission .tab-dot {
  background: #ef4444;
  animation: pulse-dot 1.5s ease-in-out infinite;
}

.session-tab--idle .tab-dot {
  background: #22c55e;
}

@keyframes pulse-dot {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.3; }
}

/* Label */
.tab-label {
  overflow: hidden;
  text-overflow: ellipsis;
  flex: 1;
  min-width: 0;
}

/* Close button */
.tab-close {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  border-radius: 3px;
  flex-shrink: 0;
  opacity: 0;
  transition: opacity 0.15s, background-color 0.15s;
}

.session-tab:hover .tab-close {
  opacity: 0.6;
}

.tab-close:hover {
  opacity: 1 !important;
  background: var(--vscode-toolbar-hoverBackground);
}

.tab-close .codicon {
  font-size: 10px;
}

/* Context Menu */
.tab-context-menu {
  position: absolute;
  top: 100%;
  left: 0;
  z-index: 1000;
  min-width: 180px;
  padding: 4px 0;
  background-color: var(--vscode-menu-background);
  border: 1px solid var(--vscode-menu-border, var(--vscode-panel-border));
  border-radius: 4px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
}

.context-menu-item {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 4px 12px;
  background: transparent;
  border: none;
  color: var(--vscode-menu-foreground);
  font-size: 12px;
  font-family: inherit;
  cursor: pointer;
  text-align: left;
}

.context-menu-item:hover {
  background-color: var(--vscode-menu-selectionBackground, var(--vscode-list-hoverBackground));
  color: var(--vscode-menu-selectionForeground, var(--vscode-foreground));
}

.context-menu-item .codicon {
  font-size: 12px;
  opacity: 0.8;
}
</style>
