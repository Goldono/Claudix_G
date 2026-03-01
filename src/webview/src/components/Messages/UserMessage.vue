<template>
  <div class="user-message">
    <div class="message-wrapper">
      <div
        ref="containerRef"
        class="message-content"
        :class="{ editing: isEditing }"
      >
        <div
          v-if="!isEditing"
          class="message-view"
          role="button"
          tabindex="0"
          @click.stop="startEditing"
          @keydown.enter.prevent="startEditing"
          @keydown.space.prevent="startEditing"
        >
          <div class="message-text">
            <div>{{ displayContent }}</div>
            <div class="message-actions">
              <button
                class="action-btn"
                :class="{ 'copied': justCopied }"
                @click.stop="handleCopy"
                :title="justCopied ? 'Copied!' : 'Copy message'"
              >
                <span v-if="justCopied" class="codicon codicon-check" />
                <span v-else class="codicon codicon-copy" />
              </button>
              <button
                class="action-btn"
                :class="{ 'is-restored': isRestored }"
                @click.stop="handleRestore"
                :title="isRestored ? 'Undo restore' : 'Restore checkpoint'"
              >
                <span v-if="isRestored" class="codicon codicon-redo" />
                <span v-else class="codicon codicon-restore" />
              </button>
            </div>
          </div>
        </div>

        <div v-else class="edit-mode">
          <ChatInputBox
            :show-progress="false"
            :conversation-working="false"
            :attachments="attachments"
            ref="chatInputRef"
            @submit="handleSaveEdit"
            @stop="cancelEdit"
            @remove-attachment="handleRemoveAttachment"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, nextTick, onMounted, onUnmounted } from 'vue';
import type { Message } from '../../models/Message';
import type { ToolContext } from '../../types/tool';
import type { AttachmentItem } from '../../types/attachment';
import ChatInputBox from '../ChatInputBox.vue';
import FileIcon from '../FileIcon.vue';

interface Props {
  message: Message;
  messageIndex: number;
  context: ToolContext;
}

const props = defineProps<Props>();

const isEditing = ref(false);
const chatInputRef = ref<InstanceType<typeof ChatInputBox>>();
const containerRef = ref<HTMLElement>();
const attachments = ref<AttachmentItem[]>([]);

const isRestored = computed(() => {
  return props.context?.restoredAtIndex === props.messageIndex;
});

// （）
const displayContent = computed(() => {
  if (typeof props.message.message.content === 'string') {
    return props.message.message.content;
  }
 // content blocks，
  if (Array.isArray(props.message.message.content)) {
    return props.message.message.content
      .map(wrapper => {
        const block = wrapper.content;
        if (block.type === 'text') {
          return block.text;
        }
        return '';
      })
      .join(' ');
  }
  return '';
});

// （image document blocks）
function extractAttachments(): AttachmentItem[] {
  if (typeof props.message.message.content === 'string') {
    return [];
  }

  if (!Array.isArray(props.message.message.content)) {
    return [];
  }

  const extracted: AttachmentItem[] = [];
  let index = 0;

  for (const wrapper of props.message.message.content) {
    const block = wrapper.content;

    if (block.type === 'image' && block.source?.type === 'base64') {
      const ext = block.source.media_type?.split('/')[1] || 'png';
      extracted.push({
        id: `image-${index++}`,
        fileName: `image.${ext}`,
        mediaType: block.source.media_type || 'image/png',
        data: block.source.data,
 fileSize: 0,
      });
    } else if (block.type === 'document' && block.source) {
      const title = block.title || 'document';
      extracted.push({
        id: `document-${index++}`,
        fileName: title,
        mediaType: block.source.media_type || 'application/octet-stream',
        data: block.source.data,
        fileSize: 0,
      });
    }
  }

  return extracted;
}

async function startEditing() {
  isEditing.value = true;

  attachments.value = extractAttachments();

 // DOM
  await nextTick();
  if (chatInputRef.value) {
    chatInputRef.value.setContent?.(displayContent.value || '');
    chatInputRef.value.focus?.();
  }
}

function handleRemoveAttachment(id: string) {
  attachments.value = attachments.value.filter(a => a.id !== id);
}

function cancelEdit() {
  isEditing.value = false;
 attachments.value = [];
}

async function handleSaveEdit(content?: string) {
  const finalContent = content || displayContent.value;

  if (finalContent.trim()) {
    // If checkpoint is restored, use editAndRestart to truncate + resend
    if (isRestored.value && props.context?.editAndRestart) {
      cancelEdit();
      await props.context.editAndRestart(props.messageIndex, finalContent.trim());
      return;
    }
    // Normal edit (not yet implemented for non-restored state)
    console.log('[UserMessage] Save edit:', finalContent.trim());
  }

  cancelEdit();
}

const justCopied = ref(false);

async function handleCopy() {
  try {
    await navigator.clipboard.writeText(displayContent.value);
    justCopied.value = true;
    setTimeout(() => { justCopied.value = false; }, 1500);
  } catch {
    console.error('[UserMessage] Copy failed');
  }
}

async function handleRestore() {
  if (!props.context?.restoreCheckpoint) return;
  await props.context.restoreCheckpoint(props.messageIndex);
}

function handleKeydown(event: KeyboardEvent) {
  if (isEditing.value && event.key === 'Escape') {
    event.preventDefault();
    cancelEdit();
  }
}

function handleClickOutside(event: MouseEvent) {
  if (!isEditing.value) return;

  const target = event.target as HTMLElement;

  if (containerRef.value?.contains(target)) return;

  cancelEdit();
}

onMounted(() => {
  document.addEventListener('keydown', handleKeydown);
  document.addEventListener('click', handleClickOutside);
});

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeydown);
  document.removeEventListener('click', handleClickOutside);
});
</script>

<style scoped>
.user-message {
  display: block;
  outline: none;
  padding: 1px 12px 8px;
  background-color: var(--vscode-sideBar-background);
  opacity: 1;
}

.message-wrapper {
  background-color: transparent;
}

/* - */
.message-content {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  width: 100%;
  background-color: color-mix(
    in srgb,
    var(--vscode-sideBar-background) 60%,
    transparent
  );
  outline: none;
  border: 1px solid var(--vscode-editorWidget-border);
  border-radius: 6px;
  position: relative;
  transition: all 0.2s ease;
}

.message-content.editing {
  z-index: 200;
  border: none;
  background-color: transparent;
}

/* */
.message-view {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  width: 100%;
  cursor: pointer;
  transition: all 0.2s ease;
}

.message-view .message-text {
  cursor: pointer;
  background-color: color-mix(
    in srgb,
    var(--vscode-input-background) 60%,
    transparent
  );
  outline: none;
  border-radius: 6px;
  width: 100%;
  padding: 6px 8px;
  box-sizing: border-box;
  min-width: 0;
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.message-view .message-text:hover {
  background-color: color-mix(
    in srgb,
    var(--vscode-input-background) 70%,
    transparent
  );
}

.message-text > div:first-child {
  min-width: 0;
  height: min-content;
  max-height: 72px;
  overflow: hidden;
  line-height: 1.5;
  font-family: inherit;
  font-size: 13px;
  color: var(--vscode-input-foreground);
  background-color: transparent;
  outline: none;
  border: none;
  overflow-wrap: break-word;
  word-break: break-word;
  padding: 0;
  user-select: text;
  white-space: pre-wrap;
  flex: 1;
}

/* Message action buttons */
.message-actions {
  display: flex;
  gap: 2px;
  flex-shrink: 0;
}

.action-btn {
  background: transparent;
  border: none;
  color: var(--vscode-foreground);
  display: flex;
  width: 22px;
  align-items: center;
  justify-content: center;
  height: 22px;
  box-sizing: border-box;
  flex-shrink: 0;
  cursor: pointer;
  border-radius: 3px;
  transition: background-color 0.1s ease, opacity 0.15s;
  opacity: 0.4;
}

.message-text:hover .action-btn {
  opacity: 0.7;
}

.action-btn:hover {
  opacity: 1 !important;
  background-color: color-mix(in srgb, var(--vscode-foreground) 10%, transparent);
}

.action-btn.copied {
  opacity: 1;
  color: #22c55e;
}

.action-btn.is-restored {
  opacity: 1;
  color: var(--vscode-charts-orange);
}

.action-btn .codicon {
  font-size: 12px;
}

/* */
.edit-mode {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  justify-content: center;
  position: relative;
  width: 100%;
  box-sizing: border-box;
}

/* */
.edit-mode :deep(.full-input-box) {
  background: var(--vscode-input-background);
}

.edit-mode :deep(.full-input-box:focus-within) {
  box-shadow: 0 0 8px 2px
    color-mix(in srgb, var(--vscode-input-background) 30%, transparent);
}
</style>
