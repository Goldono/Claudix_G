<template>
  <div class="tool-message-wrapper">
    <template v-if="isCustomLayout">
      <slot name="custom"></slot>
    </template>

    <template v-else>
      <div
        class="main-line"
        :class="{ 'is-expandable': hasExpandableContent }"
        @click="toggleExpand"
        @mouseenter="isHovered = true"
        @mouseleave="isHovered = false"
      >
        <button class="tool-icon-btn" :title="toolName">
          <span
            v-if="!isHovered || !hasExpandableContent"
            class="codicon"
            :class="toolIcon"
          ></span>
          <span
            v-else-if="isExpanded"
            class="codicon codicon-fold"
          ></span>
          <span
            v-else
            class="codicon codicon-chevron-up-down"
          ></span>
        </button>

        <div class="main-content">
          <slot name="main"></slot>
        </div>

        <!-- Revert/Redo button — or blocked indicator -->
        <span
          v-if="showRevertButton && blockedState === 'conflict'"
          class="revert-btn is-conflict"
          title="Datei wurde in einer anderen Session weiter bearbeitet — Rückgängig nicht mehr möglich"
        >
          <span class="codicon codicon-close" />
        </span>
        <span
          v-else-if="showRevertButton && blockedState === 'locked'"
          class="revert-btn is-locked"
          title="Datei wurde in einer anderen Session bearbeitet — dort zuerst rückgängig machen"
        >
          <span class="codicon codicon-lock" />
        </span>
        <button
          v-else-if="showRevertButton"
          class="revert-btn"
          :class="{ 'is-reverted': isReverted }"
          :title="isReverted ? 'Re-apply' : 'Undo'"
          :disabled="revertLoading"
          @click.stop="$emit('toggle-revert')"
        >
          <span v-if="revertLoading" class="codicon codicon-loading codicon-modifier-spin" />
          <span v-else-if="isReverted" class="codicon codicon-redo" />
          <span v-else class="codicon codicon-discard" />
        </button>

        <ToolStatusIndicator
          v-if="indicatorState"
          :state="indicatorState"
          class="status-indicator-trailing"
        />
      </div>

      <div v-if="hasExpandableContent && isExpanded" class="expandable-content">
        <slot name="expandable"></slot>
      </div>
    </template>

    <div v-if="permissionState === 'pending'" class="permission-actions">
      <button @click.stop="$emit('deny')" class="btn-reject">
        <span>Reject</span>
      </button>
      <button @click.stop="$emit('allow')" class="btn-accept">
        <span>Accept</span>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, useSlots } from 'vue';
import ToolStatusIndicator from './ToolStatusIndicator.vue';

interface Props {
  toolIcon?: string;
  toolName?: string;
  toolResult?: any;
  permissionState?: string;
  defaultExpanded?: boolean;
  isCustomLayout?: boolean;
  showRevertButton?: boolean;
  isReverted?: boolean;
  revertLoading?: boolean;
  blockedState?: 'none' | 'locked' | 'conflict';
}

const props = withDefaults(defineProps<Props>(), {
  defaultExpanded: false,
  isCustomLayout: false,
  toolIcon: 'codicon-tools',
  toolName: 'Tool',
});

defineEmits<{
  allow: [];
  deny: [];
  'toggle-revert': [];
}>();

const slots = useSlots();

const hasExpandableContent = computed(() => {
  return !!slots.expandable || !!props.toolResult?.is_error;
});

const userToggled = ref(false);
const userToggledState = ref(false);

const isExpanded = computed({
  get: () => {
    if (userToggled.value) {
      return userToggledState.value;
    }
 // Only auto-expand on errors; everything else collapsed by default
    return !!props.toolResult?.is_error;
  },
  set: (value) => {
    userToggled.value = true;
    userToggledState.value = value;
  },
});

const isHovered = ref(false);

const indicatorState = computed<'success' | 'error' | 'pending' | null>(() => {
  if (props.toolResult?.is_error) return 'error';
  if (props.permissionState === 'pending') return 'pending';
  if (props.toolResult) return 'success';
  return null;
});

function toggleExpand() {
  if (hasExpandableContent.value) {
    isExpanded.value = !isExpanded.value;
  }
}
</script>

<style scoped>
.tool-message-wrapper {
  display: flex;
  flex-direction: column;
  padding: 0px 8px;
}

.main-line {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 3px 0;
  user-select: none;
}

.main-line.is-expandable {
  cursor: pointer;
}

.main-line.is-expandable:hover {
  background-color: color-mix(in srgb, var(--vscode-list-hoverBackground) 30%, transparent);
}

.tool-icon-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: none;
  border: none;
  padding: 2px;
  color: var(--vscode-foreground);
  width: 20px;
  height: 20px;
  flex-shrink: 0;
}

.tool-icon-btn .codicon {
  font-size: 16px;
}

.main-content {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.status-indicator-trailing {
  margin-left: auto;
}

.expandable-content {
  padding: 4px 0 0px 16px;
  margin-left: 10px;
  border-left: 1px solid var(--vscode-panel-border);
}

/* */
.permission-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 8px 0 4px;
  margin-left: 26px;
}

.btn-reject,
.btn-accept {
  padding: 4px 12px;
  border-radius: 4px;
  font-size: 0.9em;
  cursor: pointer;
  border: 1px solid var(--vscode-button-border);
}

.btn-reject {
  background: var(--vscode-button-secondaryBackground);
  color: var(--vscode-button-secondaryForeground);
}

.btn-reject:hover {
  background: var(--vscode-button-secondaryHoverBackground);
}

.btn-accept {
  background: var(--vscode-button-background);
  color: var(--vscode-button-foreground);
}

.btn-accept:hover {
  background: var(--vscode-button-hoverBackground);
}

/* Revert button */
.revert-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: none;
  border: none;
  padding: 2px;
  color: var(--vscode-foreground);
  opacity: 0;
  cursor: pointer;
  border-radius: 3px;
  transition: opacity 0.15s, background-color 0.15s;
  width: 22px;
  height: 22px;
  flex-shrink: 0;
}

.main-line:hover .revert-btn {
  opacity: 0.5;
}

.revert-btn:hover {
  opacity: 1 !important;
  background-color: color-mix(in srgb, var(--vscode-foreground) 10%, transparent);
}

.revert-btn.is-reverted {
  opacity: 0.7;
  color: #eab308;
}

.revert-btn.is-locked {
  opacity: 0.4;
  color: var(--vscode-foreground);
  cursor: not-allowed;
}

.main-line:hover .revert-btn.is-locked {
  opacity: 0.5;
}

.revert-btn.is-conflict {
  opacity: 0.6;
  color: #ef4444;
  cursor: not-allowed;
}

.main-line:hover .revert-btn.is-conflict {
  opacity: 0.8;
}

.revert-btn .codicon {
  font-size: 14px;
}

.revert-btn:disabled {
  cursor: wait;
  opacity: 0.3 !important;
}
</style>
