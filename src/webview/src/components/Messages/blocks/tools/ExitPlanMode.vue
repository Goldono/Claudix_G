<template>
  <ToolMessageWrapper
    :tool-result="toolResult"
    :is-custom-layout="true"
  >
    <template #custom>
      <!-- ExitPlanMode tool: hidden — plan badge deactivation is handled automatically by ChatPage watcher -->
      <template v-if="!isWriteRouted" />


      <!-- Full plan card for Write-routed plan files -->
      <div v-else class="plan-card">
        <!-- Header -->
        <div class="plan-header">
          <span class="codicon codicon-tasklist plan-icon"></span>
          <span v-if="filePath" class="plan-title plan-title-link" @click.stop="openFile">Plan</span>
          <span v-else class="plan-title" @click.stop="toggleExpand">Plan</span>
          <button v-if="filePath && !isEditing" class="plan-action-btn" title="Im Chat bearbeiten" @click.stop="startEditing">
            <span class="codicon codicon-edit"></span>
          </button>
          <template v-if="isEditing">
            <button class="edit-save-btn" @click.stop="saveEdit" :disabled="saving">
              <span v-if="saving" class="codicon codicon-loading codicon-modifier-spin"></span>
              <span v-else class="codicon codicon-check"></span>
              <span>Speichern</span>
            </button>
            <button class="edit-cancel-btn" @click.stop="cancelEdit">
              <span class="codicon codicon-close"></span>
              <span>Abbrechen</span>
            </button>
          </template>
          <span class="plan-toggle" @click.stop="toggleExpand">
            <span class="codicon" :class="isExpanded ? 'codicon-chevron-up' : 'codicon-chevron-down'"></span>
          </span>
        </div>

        <!-- Plan body: rendered markdown, optionally contenteditable -->
        <div v-if="plan" class="plan-body" :class="{ 'is-expanded': isExpanded }">
          <div
            ref="contentEl"
            class="plan-content"
            :class="{ 'is-editing': isEditing }"
            :contenteditable="isEditing"
            v-html="renderedPlan"
            @input="onContentInput"
          ></div>
        </div>

        <!-- Fade overlay when collapsed and not editing -->
        <div v-if="plan && !isExpanded && !isEditing" class="plan-fade"></div>

        <!-- Footer: Execute buttons (hidden during edit) -->
        <div v-if="plan && !isEditing && !toolResult?.is_error" class="plan-footer">
          <button
            v-if="!executed && !startedNewSession"
            class="execute-button"
            @click.stop="executePlan"
          >
            <span class="codicon codicon-play"></span>
            <span>Plan ausf&#xFC;hren</span>
          </button>
          <button
            v-if="!executed && !startedNewSession"
            class="execute-button new-session-button"
            @click.stop="startInNewSession"
          >
            <span class="codicon codicon-window"></span>
            <span>In neuer Session starten</span>
          </button>
          <span v-if="executed" class="executed-label">
            <span class="codicon codicon-check"></span>
            <span>Plan gestartet</span>
          </span>
          <span v-if="startedNewSession" class="executed-label">
            <span class="codicon codicon-check"></span>
            <span>Neue Session gestartet</span>
          </span>
        </div>

        <ToolError v-if="toolResult?.is_error" :tool-result="toolResult" />
      </div>
    </template>
  </ToolMessageWrapper>
</template>

<script setup lang="ts">
import { computed, ref, nextTick } from 'vue';
import { marked } from 'marked';
import type { ToolContext } from '@/types/tool';
import ToolMessageWrapper from './common/ToolMessageWrapper.vue';
import ToolError from './common/ToolError.vue';

interface Props {
  toolUse?: any;
  toolResult?: any;
  toolUseResult?: any;
  context?: ToolContext;
}

const props = defineProps<Props>();

// State
const isExpanded = ref(true);
const executed = ref(false);
const startedNewSession = ref(false);
const isEditing = ref(false);
const saving = ref(false);
const contentEl = ref<HTMLElement>();

// Detect if this is a Write-routed plan card (full display) or actual ExitPlanMode (minimal)
const isWriteRouted = computed(() => !!props.toolUse?.input?.file_path);

// File path (available when routed from Write tool)
const filePath = computed(() => {
  return props.toolUse?.input?.file_path || '';
});

// Plan content — use saved version if edited, otherwise original
const savedContent = ref('');
const plan = computed(() => {
  if (savedContent.value) return savedContent.value;
  return props.toolUse?.input?.plan || props.toolUse?.input?.content || props.toolUseResult?.plan;
});

// Render markdown
const renderedPlan = computed(() => {
  if (!plan.value) return '';
  return marked(plan.value);
});

// Open the plan file in VS Code editor
const openFile = () => {
  if (filePath.value && props.context?.fileOpener) {
    props.context.fileOpener.open(filePath.value);
  }
};

const toggleExpand = () => {
  isExpanded.value = !isExpanded.value;
};

const executePlan = () => {
  if (executed.value) return;
  executed.value = true;
  props.context?.sendUserMessage?.('Führe den Plan aus.');
};

const startInNewSession = () => {
  if (startedNewSession.value || !plan.value) return;
  startedNewSession.value = true;
  props.context?.startPlanInNewSession?.(plan.value);
};

// --- Inline editing (contenteditable) ---

// Store the edited HTML as the user types
let editedHtml = '';
const onContentInput = () => {
  if (contentEl.value) {
    editedHtml = contentEl.value.innerHTML;
  }
};

const startEditing = () => {
  isExpanded.value = true;
  isEditing.value = true;
  editedHtml = '';
  nextTick(() => contentEl.value?.focus());
};

const cancelEdit = () => {
  isEditing.value = false;
  // Re-render original markdown (revert any edits in the DOM)
  if (contentEl.value) {
    contentEl.value.innerHTML = renderedPlan.value;
  }
};

const saveEdit = async () => {
  if (saving.value || !filePath.value || !props.context?.writeFile || !contentEl.value) return;
  saving.value = true;
  try {
    const html = editedHtml || contentEl.value.innerHTML;
    const md = htmlToMarkdown(html);
    const result = await props.context.writeFile(filePath.value, md);
    if (result.success) {
      savedContent.value = md;
      isEditing.value = false;
    }
  } finally {
    saving.value = false;
  }
};

// --- Simple HTML → Markdown converter ---
function htmlToMarkdown(html: string): string {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  return nodeToMd(doc.body).replace(/\n{3,}/g, '\n\n').trim() + '\n';
}

function nodeToMd(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) {
    return node.textContent || '';
  }
  if (node.nodeType !== Node.ELEMENT_NODE) return '';

  const el = node as HTMLElement;
  const tag = el.tagName.toLowerCase();
  const children = () => Array.from(el.childNodes).map(nodeToMd).join('');

  switch (tag) {
    case 'h1': return `# ${children().trim()}\n\n`;
    case 'h2': return `## ${children().trim()}\n\n`;
    case 'h3': return `### ${children().trim()}\n\n`;
    case 'h4': return `#### ${children().trim()}\n\n`;
    case 'p': return `${children().trim()}\n\n`;
    case 'br': return '\n';
    case 'strong': case 'b': return `**${children()}**`;
    case 'em': case 'i': return `*${children()}*`;
    case 'code':
      if (el.parentElement?.tagName.toLowerCase() === 'pre') return children();
      return `\`${children()}\``;
    case 'pre': return `\`\`\`\n${children().trim()}\n\`\`\`\n\n`;
    case 'ul': return Array.from(el.children).map(li => `- ${nodeToMd(li).trim()}`).join('\n') + '\n\n';
    case 'ol': return Array.from(el.children).map((li, i) => `${i + 1}. ${nodeToMd(li).trim()}`).join('\n') + '\n\n';
    case 'li': {
      const checkbox = el.querySelector('input[type="checkbox"]');
      if (checkbox) {
        const checked = (checkbox as HTMLInputElement).checked;
        const text = children().replace(/^\s*/, '');
        return `[${checked ? 'x' : ' '}] ${text}`;
      }
      return children();
    }
    case 'a': {
      const href = el.getAttribute('href') || '';
      return `[${children()}](${href})`;
    }
    case 'hr': return '---\n\n';
    case 'table': return tableToMd(el) + '\n\n';
    case 'blockquote': return children().trim().split('\n').map(l => `> ${l}`).join('\n') + '\n\n';
    case 'div': case 'span': case 'body': case 'section': return children();
    case 'input': {
      if (el.getAttribute('type') === 'checkbox') {
        return (el as HTMLInputElement).checked ? '[x] ' : '[ ] ';
      }
      return '';
    }
    default: return children();
  }
}

function tableToMd(table: HTMLElement): string {
  const rows = Array.from(table.querySelectorAll('tr'));
  if (rows.length === 0) return '';
  const result: string[] = [];
  rows.forEach((row, ri) => {
    const cells = Array.from(row.querySelectorAll('th, td'));
    const line = '| ' + cells.map(c => nodeToMd(c).trim()).join(' | ') + ' |';
    result.push(line);
    if (ri === 0) {
      result.push('| ' + cells.map(() => '---').join(' | ') + ' |');
    }
  });
  return result.join('\n');
}
</script>

<style scoped>
/* Minimal exit badge (shown for actual ExitPlanMode tool) */
.plan-exit-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  background-color: color-mix(in srgb, var(--vscode-gitDecoration-addedResourceForeground) 10%, transparent);
  border: 1px solid color-mix(in srgb, var(--vscode-gitDecoration-addedResourceForeground) 25%, transparent);
  border-radius: 4px;
  font-size: 0.8em;
  color: var(--vscode-gitDecoration-addedResourceForeground);
}

.plan-exit-icon {
  font-size: 12px;
}

.plan-exit-label {
  font-weight: 500;
}

/* Full plan card (shown for Write-routed plan files) */
.plan-card {
  display: flex;
  flex-direction: column;
  background-color: var(--vscode-editor-background);
  border: 1px solid var(--vscode-panel-border);
  border-radius: 6px;
  overflow: hidden;
}

.plan-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  background-color: color-mix(in srgb, var(--vscode-editor-background) 95%, transparent);
  border-bottom: 1px solid var(--vscode-panel-border);
  user-select: none;
}

.plan-icon {
  font-size: 16px;
  color: var(--vscode-textLink-foreground);
}

.plan-title {
  font-size: 1em;
  font-weight: 600;
  color: var(--vscode-foreground);
  flex: 1;
}

.plan-title-link {
  cursor: pointer;
  transition: color 0.15s ease;
}

.plan-title-link:hover {
  color: var(--vscode-textLink-foreground);
}

.plan-action-btn {
  display: flex;
  align-items: center;
  padding: 2px 4px;
  background: transparent;
  border: none;
  color: var(--vscode-descriptionForeground);
  cursor: pointer;
  border-radius: 3px;
  transition: color 0.15s ease, background-color 0.15s ease;
}

.plan-action-btn:hover {
  color: var(--vscode-foreground);
  background-color: color-mix(in srgb, var(--vscode-foreground) 10%, transparent);
}

.plan-action-btn .codicon {
  font-size: 14px;
}

.plan-toggle {
  font-size: 12px;
  color: var(--vscode-descriptionForeground);
  cursor: pointer;
  padding: 2px 4px;
  border-radius: 3px;
  transition: color 0.15s ease;
}

.plan-toggle:hover {
  color: var(--vscode-foreground);
}

.plan-body {
  padding: 16px;
  max-height: 150px;
  overflow: hidden;
  position: relative;
}

.plan-body.is-expanded {
  max-height: none;
  overflow: visible;
}

.plan-fade {
  height: 40px;
  margin-top: -40px;
  position: relative;
  background: linear-gradient(to bottom, transparent, var(--vscode-editor-background));
  pointer-events: none;
}

.plan-content {
  font-family: var(--vscode-editor-font-family);
  font-size: 0.9em;
  line-height: 1.6;
  color: var(--vscode-editor-foreground);
}

/* Editing state: subtle border to show it's editable */
.plan-content.is-editing {
  outline: 1px dashed color-mix(in srgb, var(--vscode-focusBorder) 50%, transparent);
  outline-offset: 4px;
  border-radius: 4px;
  min-height: 100px;
  cursor: text;
}

.plan-content.is-editing:focus {
  outline: 1px solid var(--vscode-focusBorder);
}

/* Markdown styles */
.plan-content :deep(h1) {
  font-size: 1.4em;
  font-weight: 600;
  margin-bottom: 12px;
  margin-top: 16px;
  color: var(--vscode-foreground);
}

.plan-content :deep(h1:first-child) {
  margin-top: 0;
}

.plan-content :deep(h2) {
  font-size: 1.2em;
  font-weight: 600;
  margin-bottom: 10px;
  margin-top: 16px;
  color: var(--vscode-foreground);
}

.plan-content :deep(h3) {
  font-size: 1.1em;
  font-weight: 600;
  margin-bottom: 8px;
  margin-top: 12px;
  color: var(--vscode-foreground);
}

.plan-content :deep(p) {
  margin-bottom: 8px;
  line-height: 1.6;
}

.plan-content :deep(ul),
.plan-content :deep(ol) {
  margin-bottom: 8px;
  padding-left: 24px;
}

.plan-content :deep(li) {
  margin-bottom: 4px;
}

.plan-content :deep(code) {
  background-color: color-mix(in srgb, var(--vscode-textCodeBlock-background) 50%, transparent);
  padding: 2px 4px;
  border-radius: 3px;
  font-family: var(--vscode-editor-font-family);
}

.plan-content :deep(pre) {
  background-color: var(--vscode-textCodeBlock-background);
  border: 1px solid var(--vscode-panel-border);
  border-radius: 4px;
  padding: 8px;
  overflow-x: auto;
  margin-bottom: 8px;
}

.plan-content :deep(pre code) {
  background: none;
  padding: 0;
}

.plan-content :deep(table) {
  width: 100%;
  border-collapse: collapse;
  margin-bottom: 8px;
  font-size: 0.9em;
}

.plan-content :deep(th),
.plan-content :deep(td) {
  border: 1px solid var(--vscode-panel-border);
  padding: 4px 8px;
  text-align: left;
}

.plan-content :deep(th) {
  background-color: color-mix(in srgb, var(--vscode-editor-background) 90%, transparent);
  font-weight: 600;
}

.plan-content :deep(strong) {
  font-weight: 600;
}

.plan-content :deep(hr) {
  border: none;
  border-top: 1px solid var(--vscode-panel-border);
  margin: 12px 0;
}

.plan-content :deep(li input[type="checkbox"]) {
  margin-right: 6px;
}

/* Footer */
.plan-footer {
  display: flex;
  justify-content: center;
  gap: 8px;
  padding: 8px 12px;
  border-top: 1px solid var(--vscode-panel-border);
  background-color: color-mix(in srgb, var(--vscode-editor-background) 95%, transparent);
}

.execute-button {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 16px;
  background-color: var(--vscode-button-background);
  color: var(--vscode-button-foreground);
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.85em;
  font-weight: 500;
  transition: background-color 0.15s ease;
}

.execute-button:hover {
  background-color: var(--vscode-button-hoverBackground);
}

.execute-button .codicon {
  font-size: 14px;
}

.new-session-button {
  background-color: var(--vscode-button-secondaryBackground);
  color: var(--vscode-button-secondaryForeground);
}

.new-session-button:hover {
  background-color: var(--vscode-button-secondaryHoverBackground);
}

.executed-label {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 16px;
  color: var(--vscode-gitDecoration-addedResourceForeground);
  font-size: 0.85em;
  font-weight: 500;
}

.executed-label .codicon {
  font-size: 14px;
}

/* Header edit buttons */
.edit-save-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 3px 10px;
  background-color: var(--vscode-button-background);
  color: var(--vscode-button-foreground);
  border: none;
  border-radius: 3px;
  cursor: pointer;
  font-size: 0.78em;
  transition: background-color 0.15s ease;
}

.edit-save-btn:hover {
  background-color: var(--vscode-button-hoverBackground);
}

.edit-save-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.edit-cancel-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 3px 10px;
  background: transparent;
  color: var(--vscode-descriptionForeground);
  border: 1px solid var(--vscode-panel-border);
  border-radius: 3px;
  cursor: pointer;
  font-size: 0.78em;
  transition: color 0.15s ease;
}

.edit-cancel-btn:hover {
  color: var(--vscode-foreground);
  border-color: var(--vscode-foreground);
}
</style>
