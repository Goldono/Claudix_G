<template>
  <div v-if="filesEdited.length > 0" class="file-edited-section">
    <!-- Header -->
    <div class="file-edited-header" @click="toggleExpanded">
      <div class="header-left">
        <span
          class="codicon"
          :class="expanded ? 'codicon-chevron-down' : 'codicon-chevron-right'"
          style="color: var(--vscode-foreground); opacity: 0.6; font-size: 12px;"
        />
        <span class="header-label">{{ filesEdited.length }} {{ filesEdited.length === 1 ? 'File' : 'Files' }} Edited</span>
      </div>
      <button
        class="copy-btn"
        title="Dateipfade kopieren (@Pfad-Format)"
        @click.stop="copyPaths"
      >
        <span v-if="copied" class="codicon codicon-check" style="color: var(--vscode-gitDecoration-addedResourceForeground);" />
        <span v-else class="codicon codicon-copy" />
      </button>
    </div>

    <!-- File List -->
    <div v-if="expanded" class="file-list">
      <div
        v-for="(file, index) in filesEdited"
        :key="index"
        class="file-item"
        :title="file.filePath"
        @click="handleFileClick(file)"
      >
        <span
          class="codicon"
          :class="file.diffEdits?.length ? 'codicon-diff' : 'codicon-file'"
          style="font-size: 11px; opacity: 0.6; flex-shrink: 0;"
        />
        <span class="file-name">{{ file.name }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import type { FileEdit, DiffEdit } from '../types/toolbar'

interface Props {
  filesEdited?: FileEdit[]
  cwd?: string
  onOpenFile?: (filePath: string) => void
  onOpenDiff?: (filePath: string, edits: DiffEdit[]) => void
}

const props = withDefaults(defineProps<Props>(), {
  filesEdited: () => [],
  cwd: '',
  onOpenFile: undefined,
  onOpenDiff: undefined,
})

const expanded = ref(false)
const copied = ref(false)

function toggleExpanded() {
  expanded.value = !expanded.value
}

function toRelativePath(absPath: string): string {
  const norm = absPath.replace(/\\/g, '/')
  const base = props.cwd.replace(/\\/g, '/').replace(/\/?$/, '/')
  return norm.startsWith(base) ? norm.slice(base.length) : norm
}

function copyPaths() {
  const text = props.filesEdited
    .map(f => `@${toRelativePath(f.filePath)}`)
    .join(' ')
  navigator.clipboard.writeText(text).then(() => {
    copied.value = true
    setTimeout(() => { copied.value = false }, 2000)
  })
}

function openFile(filePath: string) {
  props.onOpenFile?.(filePath)
}

function handleFileClick(file: FileEdit) {
  // If the file has accumulated edits → open the diff view (original vs. current)
  if (file.diffEdits && file.diffEdits.length > 0 && props.onOpenDiff) {
    // Reverse order: backend inverts edits to reconstruct the original,
    // so the last edit must be undone first
    props.onOpenDiff(file.filePath, [...file.diffEdits].reverse())
    return
  }
  // Otherwise (new file via Write, or no edits available) → just open the file
  openFile(file.filePath)
}
</script>

<style scoped>
.file-edited-section {
  border-bottom: 1px solid var(--vscode-panel-border);
  background: var(--vscode-sideBar-background);
  flex-shrink: 0;
}

.file-edited-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  height: 24px;
  padding: 0 8px 0 4px;
  cursor: pointer;
  user-select: none;
}

.file-edited-header:hover {
  background: var(--vscode-toolbar-hoverBackground);
}

.header-left {
  display: flex;
  align-items: center;
  gap: 4px;
  flex: 1;
  min-width: 0;
}

.header-label {
  font-size: 12px;
  color: var(--vscode-input-placeholderForeground);
  opacity: 0.8;
}

.copy-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  border: none;
  background: transparent;
  color: var(--vscode-foreground);
  opacity: 0.6;
  border-radius: 3px;
  cursor: pointer;
  font-size: 12px;
  flex-shrink: 0;
}

.copy-btn:hover {
  background: var(--vscode-toolbar-hoverBackground);
  opacity: 1;
}

.file-list {
  padding: 2px 0 4px;
}

.file-item {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 2px 8px 2px 20px;
  font-size: 12px;
  border-radius: 3px;
  cursor: pointer;
  transition: background-color 0.1s ease;
}

.file-item:hover {
  background-color: var(--vscode-toolbar-hoverBackground);
}

.file-name {
  color: var(--vscode-foreground);
  opacity: 0.85;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
