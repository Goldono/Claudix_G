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
  </button>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useSignal } from '@gn8/alien-signals-vue';
import type { Session } from '../core/Session';

const props = defineProps<{
  session: Session;
  isActive: boolean;
}>();

defineEmits<{
  (e: 'select'): void;
  (e: 'close'): void;
}>();

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
</style>
