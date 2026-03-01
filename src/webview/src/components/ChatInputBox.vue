<template>
  <!-- - -->
  <div class="full-input-box" style="position: relative;">
    <!-- （） -->
    <div v-if="attachments && attachments.length > 0" class="attachments-list">
      <div
        v-for="attachment in attachments"
        :key="attachment.id"
        class="attachment-item"
      >
        <div class="icon-wrapper">
          <div class="attachment-icon">
            <FileIcon :file-name="attachment.fileName" :size="16" />
          </div>
          <button
            class="remove-button"
            @click.stop="handleRemoveAttachment(attachment.id)"
            :aria-label="`Remove ${attachment.fileName}`"
          >
            <span class="codicon codicon-close" />
          </button>
        </div>
        <span class="attachment-name">{{ attachment.fileName }}</span>
      </div>
    </div>

    <!-- ： -->
    <div
      ref="textareaRef"
      contenteditable="plaintext-only"
      class="aislash-editor-input custom-scroll-container"
      :data-placeholder="placeholder"
      style="min-height: 34px; max-height: 240px; resize: none; overflow-y: hidden; word-wrap: break-word; overflow-wrap: break-word; word-break: break-word; white-space: pre-wrap; width: 100%; max-width: 100%; height: 34px;"
      @input="handleInput"
      @keydown="handleKeydown"
      @paste="handlePaste"
      @dragover="handleDragOver"
      @drop="handleDrop"
    />

    <!-- ：ButtonArea + TokenIndicator -->
    <ButtonArea
      :disabled="isSubmitDisabled"
      :loading="isLoading"
      :selected-model="selectedModel"
      :conversation-working="conversationWorking"
      :has-input-content="!!content.trim()"
      :show-progress="showProgress"
      :progress-percentage="progressPercentage"
      :usage-data="usageData"
      :thinking-level="thinkingLevel"
      :permission-mode="permissionMode"
      :full-text-mode="fullTextMode"
      @submit="handleSubmit"
      @stop="handleStop"
      @add-attachment="handleAddFiles"
      @thinking-toggle="() => emit('thinkingToggle')"
      @full-text-toggle="() => emit('fullTextToggle')"
      @mode-select="(mode) => emit('modeSelect', mode)"
      @model-select="(modelId) => emit('modelSelect', modelId)"
    />

    <!-- Slash Command Dropdown -->
    <Dropdown
      v-if="slashCompletion.isOpen.value"
      :is-visible="slashCompletion.isOpen.value"
      :position="slashCompletion.position.value"
      :width="240"
      :should-auto-focus="false"
      :close-on-click-outside="false"
      :data-nav="slashCompletion.navigationMode.value"
      :selected-index="slashCompletion.activeIndex.value"
      :offset-y="-8"
      :offset-x="-8"
      :prefer-placement="'above'"
      @close="slashCompletion.close"
    >
      <template #content>
        <div @mouseleave="slashCompletion.handleMouseLeave">
          <template v-if="slashCompletion.items.value.length > 0">
            <template v-for="(item, index) in slashCompletion.items.value" :key="item.id">
              <DropdownItem
                :item="item"
                :index="index"
                :is-selected="index === slashCompletion.activeIndex.value"
                @click="slashCompletion.selectActive()"
                @mouseenter="slashCompletion.handleMouseEnter(index)"
              />
            </template>
          </template>
          <div v-else class="px-2 py-1 text-xs opacity-60">No matches</div>
        </div>
      </template>
    </Dropdown>

    <!-- @ Dropdown -->
    <Dropdown
      v-if="fileCompletion.isOpen.value"
      :is-visible="fileCompletion.isOpen.value"
      :position="fileCompletion.position.value"
      :width="320"
      :should-auto-focus="false"
      :close-on-click-outside="false"
      :data-nav="fileCompletion.navigationMode.value"
      :selected-index="fileCompletion.activeIndex.value"
      :offset-y="-8"
      :offset-x="-8"
      :prefer-placement="'above'"
      @close="fileCompletion.close"
    >
      <template #content>
        <div @mouseleave="fileCompletion.handleMouseLeave">
          <template v-if="fileCompletion.items.value.length > 0">
            <template v-for="(item, index) in fileCompletion.items.value" :key="item.id">
              <DropdownItem
                :item="item"
                :index="index"
                :is-selected="index === fileCompletion.activeIndex.value"
                @click="fileCompletion.selectActive()"
                @mouseenter="fileCompletion.handleMouseEnter(index)"
              >
                <template #icon v-if="'data' in item && item.data?.file">
                  <FileIcon
                    :file-name="item.data.file.name"
                    :is-directory="item.data.file.type === 'directory'"
                    :folder-path="item.data.file.path"
                    :size="16"
                  />
                </template>
              </DropdownItem>
            </template>
          </template>
          <div v-else class="px-2 py-1 text-xs opacity-60">No matches</div>
        </div>
      </template>
    </Dropdown>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, nextTick, inject, onMounted, onUnmounted } from 'vue'
import type { PermissionMode } from '@anthropic-ai/claude-agent-sdk'
import FileIcon from './FileIcon.vue'
import ButtonArea from './ButtonArea.vue'
import type { AttachmentItem } from '../types/attachment'
import { Dropdown, DropdownItem } from './Dropdown'
import { RuntimeKey } from '../composables/runtimeContext'
import { useCompletionDropdown } from '../composables/useCompletionDropdown'
import { getSlashCommands, commandToDropdownItem } from '../providers/slashCommandProvider'
import { getFileReferences, fileToDropdownItem } from '../providers/fileReferenceProvider'

interface Props {
  showProgress?: boolean
  progressPercentage?: number
  usageData?: { inputTokens: number; outputTokens: number; cacheCreationTokens: number; cacheReadTokens: number; totalTokens: number; contextWindow: number } | null
  placeholder?: string
  readonly?: boolean
  showSearch?: boolean
  selectedModel?: string
  conversationWorking?: boolean
  attachments?: AttachmentItem[]
  thinkingLevel?: string
  permissionMode?: PermissionMode
  fullTextMode?: boolean
}

interface Emits {
  (e: 'submit', content: string): void
  (e: 'queueMessage', content: string): void
  (e: 'stop'): void
  (e: 'input', content: string): void
  (e: 'attach'): void
  (e: 'addAttachment', files: FileList): void
  (e: 'addFileRef', paths: string[]): void
  (e: 'removeAttachment', id: string): void
  (e: 'thinkingToggle'): void
  (e: 'fullTextToggle'): void
  (e: 'modeSelect', mode: PermissionMode): void
  (e: 'modelSelect', modelId: string): void
  (e: 'setAttachments', attachments: AttachmentItem[]): void
}

const props = withDefaults(defineProps<Props>(), {
  showProgress: true,
  progressPercentage: 48.7,
  placeholder: 'Plan, @ for context, / for commands...',
  readonly: false,
  showSearch: false,
  selectedModel: 'claude-sonnet-4-6',
  conversationWorking: false,
  attachments: () => [],
  thinkingLevel: 'default_on',
  permissionMode: 'default'
})

const emit = defineEmits<Emits>()

const runtime = inject(RuntimeKey)

const content = ref('')
const isLoading = ref(false)
const textareaRef = ref<HTMLDivElement | null>(null)

// Unified undo/redo history (tracks text + attachments together)
interface EditorSnapshot {
  text: string
  attachments: AttachmentItem[]
}
const undoStack = ref<EditorSnapshot[]>([])
const redoStack = ref<EditorSnapshot[]>([])
let inputDebounceTimer: ReturnType<typeof setTimeout> | null = null
let lastSavedText = ''

function currentSnapshot(): EditorSnapshot {
  return {
    text: textareaRef.value?.textContent || '',
    attachments: [...(props.attachments || [])],
  }
}

function pushUndo(snapshot?: EditorSnapshot) {
  const snap = snapshot || currentSnapshot()
  undoStack.value = [...undoStack.value, snap]
  redoStack.value = []
}

function pushUndoDebounced() {
  // Batch rapid keystrokes into one undo entry
  if (inputDebounceTimer) clearTimeout(inputDebounceTimer)
  const curText = textareaRef.value?.textContent || ''
  if (lastSavedText === curText) return
  inputDebounceTimer = setTimeout(() => {
    // Save the state BEFORE this batch of typing started
    if (undoStack.value.length === 0 || undoStack.value[undoStack.value.length - 1].text !== lastSavedText) {
      undoStack.value = [...undoStack.value, { text: lastSavedText, attachments: [...(props.attachments || [])] }]
      redoStack.value = []
    }
    lastSavedText = curText
  }, 400)
}

function restoreSnapshot(snap: EditorSnapshot) {
  // Restore text
  if (textareaRef.value) {
    textareaRef.value.textContent = snap.text
    // Move cursor to end
    const sel = window.getSelection()
    if (sel && textareaRef.value.childNodes.length > 0) {
      const range = document.createRange()
      range.selectNodeContents(textareaRef.value)
      range.collapse(false)
      sel.removeAllRanges()
      sel.addRange(range)
    }
  }
  content.value = snap.text
  lastSavedText = snap.text
  // Restore attachments
  emit('setAttachments', [...snap.attachments])
  autoResizeTextarea()
}

const isSubmitDisabled = computed(() => {
  return !content.value.trim() || isLoading.value
})

// === Completion Dropdown Composable ===

// Slash Command
const slashCompletion = useCompletionDropdown({
  mode: 'inline',
  trigger: '/',
  provider: (query, signal) => getSlashCommands(query, runtime, signal),
  toDropdownItem: commandToDropdownItem,
  onSelect: (command, query) => {
    if (query) {
      const updated = slashCompletion.replaceText(content.value, `${command.label} `)
      content.value = updated

 // DOM
      if (textareaRef.value) {
        textareaRef.value.textContent = updated
        placeCaretAtEnd(textareaRef.value)
      }

      emit('input', updated)
    }
  },
  anchorElement: textareaRef
})

// @
const fileCompletion = useCompletionDropdown({
  mode: 'inline',
  trigger: '@',
  provider: (query, signal) => getFileReferences(query, runtime, signal),
  toDropdownItem: fileToDropdownItem,
  onSelect: (file, query) => {
    if (query) {
      const updated = fileCompletion.replaceText(content.value, `@${file.path} `)
      content.value = updated

 // DOM
      if (textareaRef.value) {
        textareaRef.value.textContent = updated
        placeCaretAtEnd(textareaRef.value)
      }

      emit('input', updated)
    }
  },
  anchorElement: textareaRef
})

function placeCaretAtEnd(node: HTMLElement) {
  const range = document.createRange()
  range.selectNodeContents(node)
  range.collapse(false)
  const selection = window.getSelection()
  selection?.removeAllRanges()
  selection?.addRange(range)
}

function getCaretClientRect(editable: HTMLElement | null): DOMRect | undefined {
  if (!editable) return undefined

  const sel = window.getSelection()
  if (!sel || sel.rangeCount === 0) return undefined

  const range = sel.getRangeAt(0).cloneRange()
  if (!editable.contains(range.startContainer)) return undefined

 // collapsed range 0 ，； getClientRects
  const rects = range.getClientRects()
  const rect = rects[0] || range.getBoundingClientRect()
  if (!rect) return undefined

 // ， 0 Dropdown
  const lh = parseFloat(getComputedStyle(editable).lineHeight || '0') || 16
  const height = rect.height || lh

  return new DOMRect(rect.left, rect.top, rect.width, height)
}

// （）
function getRectAtCharOffset(editable: HTMLElement, charOffset: number): DOMRect | undefined {
  const walker = document.createTreeWalker(editable, NodeFilter.SHOW_TEXT)
  let remaining = charOffset
  let node: Text | null = null

  while ((node = walker.nextNode() as Text | null)) {
    const len = node.textContent?.length ?? 0
    if (remaining <= len) {
      const range = document.createRange()
      range.setStart(node, Math.max(0, remaining))
      range.collapse(true)
      const rects = range.getClientRects()
      const rect = rects[0] || range.getBoundingClientRect()
      const lh = parseFloat(getComputedStyle(editable).lineHeight || '0') || 16
      const height = rect.height || lh
      return new DOMRect(rect.left, rect.top, rect.width, height)
    }
    remaining -= len
  }

  return undefined
}

// dropdown
function updateDropdownPosition(
  completion: typeof slashCompletion | typeof fileCompletion,
  anchor: 'caret' | 'queryStart' = 'queryStart'
) {
  const el = textareaRef.value
  if (!el) return

  let rect: DOMRect | undefined

  if (anchor === 'queryStart' && completion.triggerQuery.value) {
    rect = getRectAtCharOffset(el, completion.triggerQuery.value.start)
  }

  if (!rect && anchor === 'caret') {
    rect = getCaretClientRect(el)
  }

  if (!rect) {
    const r = el.getBoundingClientRect()
    rect = new DOMRect(r.left, r.top, r.width, r.height)
  }

  completion.updatePosition({
    top: rect.top,
    left: rect.left,
    width: rect.width,
    height: rect.height
  })
}

function handleInput(event: Event) {
  const target = event.target as HTMLDivElement
  const textContent = target.textContent || ''

 // div
  if (textContent.length === 0) {
    target.innerHTML = ''
  }

  content.value = textContent
  emit('input', textContent)

  // Track text changes for unified undo
  pushUndoDebounced()

 // （slash @）
  slashCompletion.evaluateQuery(textContent)
  fileCompletion.evaluateQuery(textContent)

 // dropdown （）
  if (slashCompletion.isOpen.value) {
    nextTick(() => {
      updateDropdownPosition(slashCompletion, 'queryStart')
    })
  }
  if (fileCompletion.isOpen.value) {
    nextTick(() => {
      updateDropdownPosition(fileCompletion, 'queryStart')
    })
  }

  autoResizeTextarea()
}

function autoResizeTextarea() {
  if (!textareaRef.value) return

  nextTick(() => {
    const divElement = textareaRef.value!

 // scrollHeight
    divElement.style.height = '20px'

    const scrollHeight = divElement.scrollHeight
    const minHeight = 20
    const maxHeight = 240

    if (scrollHeight <= maxHeight) {
      divElement.style.height = Math.max(scrollHeight, minHeight) + 'px'
      divElement.style.overflowY = 'hidden'
    } else {
      divElement.style.height = maxHeight + 'px'
      divElement.style.overflowY = 'auto'
    }
  })
}

function handleKeydown(event: KeyboardEvent) {
  const ctrlOrMeta = event.ctrlKey || event.metaKey

  // Ctrl+Z: unified undo (text + attachments)
  if (ctrlOrMeta && event.key === 'z' && !event.shiftKey) {
    if (undoStack.value.length > 0) {
      event.preventDefault()
      // Flush any pending debounced save
      if (inputDebounceTimer) { clearTimeout(inputDebounceTimer); inputDebounceTimer = null }
      // Push current state to redo
      redoStack.value = [...redoStack.value, currentSnapshot()]
      // Pop and restore
      const prev = undoStack.value[undoStack.value.length - 1]
      undoStack.value = undoStack.value.slice(0, -1)
      restoreSnapshot(prev)
    }
    return
  }

  // Ctrl+Y or Ctrl+Shift+Z: unified redo
  if (ctrlOrMeta && (event.key === 'y' || (event.key === 'z' && event.shiftKey))) {
    if (redoStack.value.length > 0) {
      event.preventDefault()
      if (inputDebounceTimer) { clearTimeout(inputDebounceTimer); inputDebounceTimer = null }
      // Push current state to undo
      undoStack.value = [...undoStack.value, currentSnapshot()]
      // Pop and restore
      const next = redoStack.value[redoStack.value.length - 1]
      redoStack.value = redoStack.value.slice(0, -1)
      restoreSnapshot(next)
    }
    return
  }

  if (slashCompletion.isOpen.value) {
    slashCompletion.handleKeydown(event)
    return
  }

  if (fileCompletion.isOpen.value) {
    fileCompletion.handleKeydown(event)
    return
  }

  if (event.key === 'Enter' && !event.shiftKey) {
 // ()
    if (event.isComposing) {
      return
    }
    event.preventDefault()
    handleSubmit()
  }

 // （）
  if (event.key === 'Backspace' || event.key === 'Delete') {
    setTimeout(() => {
      const target = event.target as HTMLDivElement
      const textContent = target.textContent || ''
      if (textContent.length === 0) {
        target.innerHTML = ''
        content.value = ''
      }
    }, 0)
  }
}

function handlePaste(event: ClipboardEvent) {
  const clipboard = event.clipboardData
  if (!clipboard) {
    return
  }

  const items = clipboard.items
  if (!items || items.length === 0) {
    return
  }

  const files: File[] = []
  for (const item of Array.from(items)) {
    if (item.kind === 'file') {
      const file = item.getAsFile()
      if (file) {
        files.push(file)
      }
    }
  }

  if (files.length > 0) {
    event.preventDefault()
 // FileList-like
    const dataTransfer = new DataTransfer()
    for (const file of files) {
      dataTransfer.items.add(file)
    }
    handleAddFiles(dataTransfer.files)
    return
  }

  // Text paste: save snapshot before the native paste happens,
  // then sync after. contenteditable="plaintext-only" strips formatting.
  if (inputDebounceTimer) { clearTimeout(inputDebounceTimer); inputDebounceTimer = null }
  pushUndo()
  // After browser inserts the text, sync our state
  setTimeout(() => {
    const curText = textareaRef.value?.textContent || ''
    content.value = curText
    lastSavedText = curText
    autoResizeTextarea()
  }, 0)
}

function getWorkspaceRoot(): string | undefined {
  const r = runtime as any
  if (!r) return undefined

  try {
    const sessionStore = r.sessionStore
    const activeSession = sessionStore?.activeSession?.()
    const cwdFromSession = activeSession?.cwd?.()
    if (typeof cwdFromSession === 'string' && cwdFromSession) {
      return cwdFromSession
    }
  } catch {
    // ignore
  }

  try {
    const connection = r.connectionManager?.connection?.()
    const config = connection?.config?.()
    if (config?.defaultCwd && typeof config.defaultCwd === 'string') {
      return config.defaultCwd
    }
  } catch {
    // ignore
  }

  return undefined
}

function toWorkspaceRelativePath(absoluteOrMixedPath: string): string {
  const root = getWorkspaceRoot()
  if (!root) return absoluteOrMixedPath

  const normRoot = root.replace(/\\/g, '/').replace(/\/+$/, '')
  let normPath = absoluteOrMixedPath.replace(/\\/g, '/')

 // Windows file:// URI /C:/
  if (normPath.startsWith('/') && /^[A-Za-z]:\//.test(normPath.slice(1))) {
    normPath = normPath.slice(1)
  }

  if (normPath === normRoot) {
    return ''
  }

  if (normPath.startsWith(normRoot + '/')) {
    return normPath.slice(normRoot.length + 1)
  }

  return absoluteOrMixedPath
}

function isFileDrop(event: DragEvent): boolean {
  const dataTransfer = event.dataTransfer
  if (!dataTransfer) return false

  const types = Array.from(dataTransfer.types || [])
  if (types.includes('Files')) return true
  if (types.includes('text/uri-list')) return true

  return false
}

function extractFilePathsFromDataTransfer(dataTransfer: DataTransfer): string[] {
  const seen = new Set<string>()
  const paths: string[] = []

  function addPath(raw: string) {
    const p = toWorkspaceRelativePath(raw)
    if (p && !seen.has(p)) { seen.add(p); paths.push(p) }
  }

  function parseUri(uri: string) {
    try {
      const url = new URL(uri)
      if (url.protocol === 'file:') addPath(decodeURIComponent(url.pathname))
      else addPath(uri)
    } catch { addPath(uri) }
  }

  const uriList = dataTransfer.getData('text/uri-list')
  if (uriList) {
    uriList.split(/\r?\n/).map(l => l.trim()).filter(l => l && !l.startsWith('#')).forEach(parseUri)
  }

  for (const mimeType of ['application/vnd.code.uri-list', 'text/x-vscode-uri-list']) {
    const v = dataTransfer.getData(mimeType)
    if (v) v.split(/\r?\n/).map((l: string) => l.trim()).filter((l: string) => l && !l.startsWith('#')).forEach(parseUri)
  }

  if (dataTransfer.items) {
    for (const item of Array.from(dataTransfer.items)) {
      if (item.kind === 'file') {
        const file = item.getAsFile()
        if (file) { const f = file as File & { path?: string }; if (f.path) addPath(f.path) }
      }
    }
  }

  if (paths.length === 0) {
    const plainText = dataTransfer.getData('text/plain')
    if (plainText) plainText.split(/\r?\n/).map(l => l.trim()).filter(l => l && (l.includes('/') || l.includes('\\'))).forEach(parseUri)
  }

  if (paths.length === 0 && dataTransfer.files && dataTransfer.files.length > 0) {
    for (const file of Array.from(dataTransfer.files)) {
      const f = file as File & { path?: string }
      if (f.path) addPath(f.path); else addPath(file.name)
    }
  }

  return paths
}

async function statPaths(
  paths: string[]
): Promise<Record<string, 'file' | 'directory' | 'other' | 'not_found'>> {
  const result: Record<string, 'file' | 'directory' | 'other' | 'not_found'> = {}
  if (!paths.length) return result

  const r = runtime as any
  if (!r) return result

  try {
    const connection = await r.connectionManager.get()
    const response = await connection.statPaths(paths)
    const entries = (response?.entries ?? []) as Array<{ path: string; type: any }>
    for (const entry of entries) {
      if (!entry || typeof entry.path !== 'string') continue
      const t = entry.type
      if (t === 'file' || t === 'directory' || t === 'other' || t === 'not_found') {
        result[entry.path] = t
      }
    }
  } catch (error) {
    console.warn('[ChatInputBox] statPaths failed:', error)
  }

  return result
}

function handleDragOver(event: DragEvent) {
  if (!isFileDrop(event)) return
  event.preventDefault()
}

async function handleDrop(event: DragEvent) {
  const dataTransfer = event.dataTransfer
  if (!dataTransfer) return

  if (!isFileDrop(event)) return

  event.preventDefault()

  const paths = extractFilePathsFromDataTransfer(dataTransfer)
  if (paths.length === 0) return

  // Emit file references to parent → shown as pill chips, not inserted as text
  if (inputDebounceTimer) { clearTimeout(inputDebounceTimer); inputDebounceTimer = null }
  pushUndo()
  lastSavedText = textareaRef.value?.textContent || ''
  emit('addFileRef', paths)

  nextTick(() => {
    textareaRef.value?.focus()
  })
}

function handleSubmit() {
  if (!content.value.trim()) return

  if (props.conversationWorking) {
    emit('queueMessage', content.value)
  } else {
    emit('submit', content.value)
  }

  content.value = ''
  if (textareaRef.value) {
    textareaRef.value.textContent = ''
  }

 // DOM
  nextTick(() => {
    autoResizeTextarea()
  })
}

function handleStop() {
  emit('stop')
}

function handleMention(filePath?: string) {
  if (!filePath) return

 // @
  const updatedContent = content.value + `@${filePath} `
  content.value = updatedContent

 // DOM
  if (textareaRef.value) {
    textareaRef.value.textContent = updatedContent
    placeCaretAtEnd(textareaRef.value)
  }

  emit('input', updatedContent)

  nextTick(() => {
    textareaRef.value?.focus()
  })
}

function handleAddFiles(files: FileList) {
  // Flush any pending text debounce, then save current state
  if (inputDebounceTimer) { clearTimeout(inputDebounceTimer); inputDebounceTimer = null }
  pushUndo()
  lastSavedText = textareaRef.value?.textContent || ''
  emit('addAttachment', files)
}

function handleRemoveAttachment(id: string) {
  if (inputDebounceTimer) { clearTimeout(inputDebounceTimer); inputDebounceTimer = null }
  pushUndo()
  lastSavedText = textareaRef.value?.textContent || ''
  emit('removeAttachment', id)
}

// （，）
function handleSelectionChange() {
  if (!content.value || !textareaRef.value) return

 // evaluateQuery（ handleInput ）
  if (slashCompletion.isOpen.value) {
    nextTick(() => {
      updateDropdownPosition(slashCompletion, 'queryStart')
    })
  }
  if (fileCompletion.isOpen.value) {
    nextTick(() => {
      updateDropdownPosition(fileCompletion, 'queryStart')
    })
  }
}

// / selectionchange
onMounted(() => {
  document.addEventListener('selectionchange', handleSelectionChange)
})

onUnmounted(() => {
  document.removeEventListener('selectionchange', handleSelectionChange)
})

defineExpose({
 /** */
  setContent(text: string) {
    content.value = text || ''
    if (textareaRef.value) {
      textareaRef.value.textContent = content.value
    }
    autoResizeTextarea()
  },
 /** */
  focus() {
    nextTick(() => textareaRef.value?.focus())
  }
})

</script>

<style scoped>
/* - caret */
.aislash-editor-input {
  line-height: 18px;
  overflow-x: hidden;
}

/* Prevent pasted or child elements from breaking the layout */
.aislash-editor-input :deep(*) {
  max-width: 100% !important;
  white-space: pre-wrap !important;
  word-break: break-word !important;
  overflow-wrap: break-word !important;
}

/* */
.aislash-editor-input:focus {
  outline: none !important;
  border: none !important;
}

/* */
.full-input-box:focus-within {
  border-color: var(--vscode-input-border) !important;
  outline: none !important;
}

/* Placeholder */
.aislash-editor-input:empty::before {
  content: attr(data-placeholder);
  color: var(--vscode-input-placeholderForeground);
  pointer-events: none;
  position: absolute;
}

.aislash-editor-input:focus:empty::before {
  content: attr(data-placeholder);
  color: var(--vscode-input-placeholderForeground);
  pointer-events: none;
}

/* - pills */
.attachments-list {
  display: flex;
  flex-direction: row;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px;
  width: 100%;
  box-sizing: border-box;
  min-height: 20px;
  /* max-height: 44px; */
  overflow: hidden;
}

.attachment-item {
  display: inline-flex;
  align-items: center;
  padding-right: 4px;
  border: 1px solid var(--vscode-editorWidget-border);
  border-radius: 4px;
  font-size: 12px;
  flex-shrink: 0;
  max-width: 200px;
  cursor: pointer;
  transition: all 0.15s;
  position: relative;
  outline: none;
  line-height: 16px;
  height: 20px;
}

.attachment-item:hover {
  background-color: var(--vscode-list-hoverBackground);
  border-color: var(--vscode-focusBorder);
}

/* */
.icon-wrapper {
  position: relative;
  width: 16px;
  height: 16px;
  flex-shrink: 0;
}

.attachment-icon {
  position: absolute;
  top: 0;
  left: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  opacity: 1;
  transition: opacity 0.15s ease;
  scale: 0.8;
}

/* （ :deep FileIcon ） */
.attachment-item .attachment-icon :deep(.mdi),
.attachment-item .attachment-icon :deep(.codicon) {
  color: var(--vscode-foreground);
  opacity: 0.8;
}

.attachment-name {
  flex-shrink: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--vscode-foreground);
  opacity: 1;
  max-width: 140px;
}

.attachment-size {
 display: none; /* ， */
}

.remove-button {
  position: absolute;
  top: 0;
  left: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  padding: 0;
  background: none;
  border: none;
  border-radius: 2px;
  cursor: pointer;
  color: var(--vscode-foreground);
  opacity: 0;
  transition: opacity 0.15s ease;
}

.remove-button .codicon {
  font-size: 14px;
}

/* hover attachment-item */
.attachment-item:hover .attachment-icon {
  opacity: 0;
}

.attachment-item:hover .remove-button {
  opacity: 0.8;
}

.remove-button:hover {
  opacity: 1 !important;
}

</style>
