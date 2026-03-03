<template>
  <div class="session-tab-bar">
    <div class="tabs-scroll-container" ref="scrollRef">
      <div class="tabs-track">
        <SessionTabItem
          v-for="session in sortedSessions"
          :key="session.sessionId() ?? session.lastModifiedTime()"
          :session="session"
          :is-active="session === activeSession"
          @select="$emit('select', session)"
          @close="$emit('close', session)"
          @close-others="$emit('closeOthers', session)"
        />
      </div>
    </div>

    <!-- Dropdown for hidden sessions -->
    <div v-if="hiddenSessions.length > 0" class="hidden-sessions-trigger">
      <button
        ref="triggerBtnRef"
        class="hidden-sessions-btn"
        title="Geschlossene Sessions"
        @click="toggleDropdown"
      >
        <span class="codicon codicon-chevron-down" />
      </button>
    </div>

    <Teleport to="body">
      <div v-if="showDropdown" class="hidden-sessions-dropdown" :style="dropdownStyle">
        <div class="hidden-dropdown-header">Geschlossene Sessions</div>
        <button
          v-for="session in sortedHidden"
          :key="session.sessionId()"
          class="hidden-session-item"
          :title="sessionLabel(session)"
          @click="restoreSession(session)"
        >
          <span class="hidden-item-dot" />
          <span class="hidden-item-label">{{ sessionLabel(session) }}</span>
        </button>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted } from 'vue';
import type { Session } from '../core/Session';
import SessionTabItem from './SessionTabItem.vue';

const props = defineProps<{
  sessions: Session[];
  hiddenSessions: Session[];
  activeSession: Session | undefined;
}>();

const emit = defineEmits<{
  (e: 'select', session: Session): void;
  (e: 'close', session: Session): void;
  (e: 'closeOthers', session: Session): void;
  (e: 'restore', session: Session): void;
}>();

const scrollRef = ref<HTMLElement | null>(null);
const triggerBtnRef = ref<HTMLElement | null>(null);
const showDropdown = ref(false);
const dropdownStyle = ref<Record<string, string>>({});

const sortedSessions = computed(() =>
  [...props.sessions].sort((a, b) => b.lastModifiedTime() - a.lastModifiedTime())
);

const sortedHidden = computed(() =>
  [...props.hiddenSessions].sort((a, b) => b.lastModifiedTime() - a.lastModifiedTime())
);

function toggleDropdown() {
  if (showDropdown.value) { showDropdown.value = false; return; }
  const btn = triggerBtnRef.value;
  if (btn) {
    const rect = btn.getBoundingClientRect();
    dropdownStyle.value = { position: 'fixed', top: `${rect.bottom + 4}px`, right: `${window.innerWidth - rect.right}px`, zIndex: '9999' };
  }
  showDropdown.value = true;
}

function sessionLabel(session: Session): string {
  const s = session.summary();
  if (!s) return 'New Conversation';
  return s.length > 30 ? s.slice(0, 29) + '…' : s;
}

function restoreSession(session: Session) {
  showDropdown.value = false;
  emit('restore', session);
}

function handleClickOutside(e: MouseEvent) {
  const el = (e.target as HTMLElement)?.closest('.hidden-sessions-trigger');
  if (!el) showDropdown.value = false;
}

function handleWheel(e: WheelEvent) {
  const el = scrollRef.value;
  if (!el) return;
  if (e.deltaY !== 0) { e.preventDefault(); el.scrollLeft += e.deltaY; }
}

onMounted(() => {
  scrollRef.value?.addEventListener('wheel', handleWheel, { passive: false });
  document.addEventListener('click', handleClickOutside);
});

onUnmounted(() => {
  scrollRef.value?.removeEventListener('wheel', handleWheel);
  document.removeEventListener('click', handleClickOutside);
});
</script>

<style scoped>
.session-tab-bar {
  display: flex;
  align-items: center;
  border-bottom: 1px solid var(--vscode-panel-border);
  background: var(--vscode-sideBar-background);
  min-height: 30px;
  max-height: 30px;
  position: relative;
  z-index: 100;
}
.tabs-scroll-container { flex: 1; overflow-x: auto; overflow-y: hidden; scrollbar-width: none; }
.tabs-scroll-container::-webkit-scrollbar { display: none; }
.tabs-track { display: flex; align-items: center; gap: 1px; padding: 0 4px; min-width: min-content; }
.hidden-sessions-trigger { position: relative; flex-shrink: 0; padding-right: 4px; }
.hidden-sessions-btn { display: flex; align-items: center; justify-content: center; width: 22px; height: 22px; border: none; background: transparent; color: var(--vscode-foreground); border-radius: 3px; cursor: pointer; opacity: 0.5; transition: opacity 0.15s, background-color 0.15s; }
.hidden-sessions-btn:hover { opacity: 1; background: var(--vscode-toolbar-hoverBackground); }
.hidden-sessions-btn .codicon { font-size: 12px; }
</style>

<!-- Unscoped styles for teleported dropdown -->
<style>
.hidden-sessions-dropdown { min-width: 200px; max-width: 300px; max-height: 300px; overflow-y: auto; background: var(--vscode-menu-background, var(--vscode-editor-background)); border: 1px solid var(--vscode-menu-border, var(--vscode-panel-border)); border-radius: 6px; padding: 4px 0; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.25); }
.hidden-dropdown-header { padding: 4px 12px 6px; font-size: 10px; font-weight: 600; opacity: 0.5; text-transform: uppercase; letter-spacing: 0.5px; color: var(--vscode-foreground); }
.hidden-session-item { display: flex; align-items: center; gap: 6px; width: 100%; padding: 5px 12px; border: none; background: transparent; color: var(--vscode-foreground); font-size: 11px; font-family: inherit; cursor: pointer; text-align: left; transition: background-color 0.15s; }
.hidden-session-item:hover { background: var(--vscode-list-hoverBackground, var(--vscode-toolbar-hoverBackground)); }
.hidden-item-dot { width: 5px; height: 5px; border-radius: 50%; background: var(--vscode-foreground); opacity: 0.3; flex-shrink: 0; }
.hidden-item-label { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex: 1; min-width: 0; }
</style>
