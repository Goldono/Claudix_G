<template>
  <!-- - -->
  <div class="full-input-box" style="position: relative;">
    <!-- Editor: contenteditable div with inline file chips -->
    <div
      ref="textareaRef"
      contenteditable="true"
      class="aislash-editor-input custom-scroll-container"
      :data-placeholder="placeholder"
      style="min-height: 34px; max-height: 240px; resize: none; overflow-y: hidden; word-wrap: break-word; overflow-wrap: break-word; word-break: break-word; white-space: pre-wrap; width: 100%; max-width: 100%; height: 34px;"
      @input="handleInput"
      @keydown="handleKeydown"
      @paste="handlePaste"
      @dragover="handleDragOver"
      @drop="handleDrop"
    />

    <!-- ButtonArea + TokenIndicator -->
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
      :is-in-plan-mode="isInPlanMode"
      @submit="handleSubmit"
      @stop="handleStop"
      @add-attachment="handleAddFiles"
      @thinking-toggle="() => emit('thinkingToggle')"
      @full-text-toggle="() => emit('fullTextToggle')"
      @mode-select="(mode) => emit('modeSelect', mode)"
      @model-select="(modelId) => emit('modelSelect', modelId)"
      @exit-plan-mode="() => emit('exitPlanMode')"
      @enter-plan-mode="() => emit('enterPlanMode')"
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
  isInPlanMode?: boolean
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
  (e: 'exitPlanMode'): void
  (e: 'enterPlanMode'): void
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
  permissionMode: 'default',
  isInPlanMode: false
})

const emit = defineEmits<Emits>()

const runtime = inject(RuntimeKey)

const content = ref('')
const isLoading = ref(false)
const textareaRef = ref<HTMLDivElement | null>(null)

// ============================================================
// Inline file chip helpers
// ============================================================

const FILE_CHIP_ATTR = 'data-file-chip'
const FILE_CHIP_PATH_ATTR = 'data-file-path'

/** Create an inline file chip DOM element */
function createFileChip(filePath: string): HTMLSpanElement {
  const chip = document.createElement('span')
  chip.setAttribute(FILE_CHIP_ATTR, '1')
  chip.setAttribute(FILE_CHIP_PATH_ATTR, filePath)
  chip.setAttribute('contenteditable', 'false')
  chip.className = 'inline-file-chip'

  // File name (last segment)
  const fileName = filePath.replace(/\\/g, '/').split('/').pop() || filePath
  const nameSpan = document.createElement('span')
  nameSpan.className = 'chip-name'
  nameSpan.textContent = `@${fileName}`
  nameSpan.title = filePath

  // Remove button
  const removeBtn = document.createElement('span')
  removeBtn.className = 'chip-remove codicon codicon-close'
  removeBtn.addEventListener('mousedown', (e) => {
    e.preventDefault()
    e.stopPropagation()
    chip.remove()
    syncContentFromEditor()
    autoResizeTextarea()
  })

  chip.appendChild(nameSpan)
  chip.appendChild(removeBtn)

  return chip
}

/** Insert a file chip at the current caret position (or end if no selection) */
function insertChipAtCaret(filePath: string) {
  const el = textareaRef.value
  if (!el) return

  el.focus()
  const chip = createFileChip(filePath)

  const sel = window.getSelection()
  if (sel && sel.rangeCount > 0 && el.contains(sel.anchorNode)) {
    const range = sel.getRangeAt(0)
    range.deleteContents()
    range.insertNode(chip)
    // Add a zero-width space after the chip so the caret has somewhere to go
    const spacer = document.createTextNode('\u00A0')
    range.setStartAfter(chip)
    range.insertNode(spacer)
    range.setStartAfter(spacer)
    range.collapse(true)
    sel.removeAllRanges()
    sel.addRange(range)
  } else {
    // No selection inside editor — append at end
    el.appendChild(chip)
    const spacer = document.createTextNode('\u00A0')
    el.appendChild(spacer)
    placeCaretAtEnd(el)
  }

  syncContentFromEditor()
  autoResizeTextarea()
}

/** Insert a file chip at a specific drop point (x, y coordinates) */
function insertChipAtPoint(filePath: string, x: number, y: number) {
  const el = textareaRef.value
  if (!el) return

  const chip = createFileChip(filePath)

  // Try to find the caret position at drop coordinates
  let range: Range | null = null
  if (document.caretRangeFromPoint) {
    range = document.caretRangeFromPoint(x, y)
  } else if ((document as any).caretPositionFromPoint) {
    const pos = (document as any).caretPositionFromPoint(x, y)
    if (pos) {
      range = document.createRange()
      range.setStart(pos.offsetNode, pos.offset)
      range.collapse(true)
    }
  }

  if (range && el.contains(range.startContainer)) {
    range.insertNode(chip)
    const spacer = document.createTextNode('\u00A0')
    range.setStartAfter(chip)
    range.insertNode(spacer)
    range.setStartAfter(spacer)
    range.collapse(true)
    const sel = window.getSelection()
    sel?.removeAllRanges()
    sel?.addRange(range)
  } else {
    // Fallback: append at end
    el.appendChild(chip)
    const spacer = document.createTextNode('\u00A0')
    el.appendChild(spacer)
    placeCaretAtEnd(el)
  }

  syncContentFromEditor()
  autoResizeTextarea()
}

/** Extract plain text from editor, replacing file chips with @path references */
function getEditorTextWithRefs(): string {
  const el = textareaRef.value
  if (!el) return ''
  return nodeToText(el)
}

function nodeToText(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) {
    return node.textContent || ''
  }
  if (node.nodeType !== Node.ELEMENT_NODE) return ''

  const el = node as HTMLElement

  // File chip → @path
  if (el.hasAttribute(FILE_CHIP_ATTR)) {
    const path = el.getAttribute(FILE_CHIP_PATH_ATTR) || ''
    return `@${path}`
  }

  // <br> → newline
  if (el.tagName === 'BR') return '\n'

  // Block-level elements get newlines
  const tag = el.tagName.toLowerCase()
  const isBlock = tag === 'div' || tag === 'p' || tag === 'li'
  let text = ''
  for (const child of Array.from(el.childNodes)) {
    text += nodeToText(child)
  }
  // Add newline before block elements (except the first child)
  if (isBlock && el.previousSibling) {
    text = '\n' + text
  }
  return text
}

/** Collect all file paths from chips in the editor */
function getChipPaths(): string[] {
  const el = textareaRef.value
  if (!el) return []
  const chips = el.querySelectorAll(`[${FILE_CHIP_ATTR}]`)
  const paths: string[] = []
  const seen = new Set<string>()
  for (const chip of Array.from(chips)) {
    const p = chip.getAttribute(FILE_CHIP_PATH_ATTR)
    if (p && !seen.has(p)) {
      seen.add(p)
      paths.push(p)
    }
  }
  return paths
}

/** Sync content ref from editor DOM (for isEmpty checks etc.) */
function syncContentFromEditor() {
  const el = textareaRef.value
  if (!el) return
  const text = el.textContent || ''
  content.value = text

  // If truly empty, clear innerHTML to show placeholder
  if (text.trim().length === 0 && el.querySelectorAll(`[${FILE_CHIP_ATTR}]`).length === 0) {
    el.innerHTML = ''
    content.value = ''
  }
}

// ============================================================
// Unified undo/redo history (tracks innerHTML)
// ============================================================

interface EditorSnapshot {
  html: string
}
const undoStack = ref<EditorSnapshot[]>([])
const redoStack = ref<EditorSnapshot[]>([])
let inputDebounceTimer: ReturnType<typeof setTimeout> | null = null
let lastSavedHtml = ''

function currentSnapshot(): EditorSnapshot {
  return {
    html: textareaRef.value?.innerHTML || '',
  }
}

function pushUndo(snapshot?: EditorSnapshot) {
  const snap = snapshot || currentSnapshot()
  undoStack.value = [...undoStack.value, snap]
  redoStack.value = []
}

function pushUndoDebounced() {
  if (inputDebounceTimer) clearTimeout(inputDebounceTimer)
  const curHtml = textareaRef.value?.innerHTML || ''
  if (lastSavedHtml === curHtml) return
  inputDebounceTimer = setTimeout(() => {
    if (undoStack.value.length === 0 || undoStack.value[undoStack.value.length - 1].html !== lastSavedHtml) {
      undoStack.value = [...undoStack.value, { html: lastSavedHtml }]
      redoStack.value = []
    }
    lastSavedHtml = curHtml
  }, 400)
}

function restoreSnapshot(snap: EditorSnapshot) {
  if (textareaRef.value) {
    textareaRef.value.innerHTML = snap.html
    // Re-attach chip remove listeners
    reattachChipListeners(textareaRef.value)
    // Move cursor to end
    placeCaretAtEnd(textareaRef.value)
  }
  syncContentFromEditor()
  lastSavedHtml = snap.html
  autoResizeTextarea()
}

/** After setting innerHTML, re-attach event listeners on chip remove buttons */
function reattachChipListeners(container: HTMLElement) {
  const chips = container.querySelectorAll(`[${FILE_CHIP_ATTR}]`)
  for (const chip of Array.from(chips)) {
    const removeBtn = chip.querySelector('.chip-remove')
    if (removeBtn) {
      // Remove old listeners by cloning
      const newBtn = removeBtn.cloneNode(true) as HTMLElement
      removeBtn.replaceWith(newBtn)
      newBtn.addEventListener('mousedown', (e) => {
        e.preventDefault()
        e.stopPropagation()
        chip.remove()
        syncContentFromEditor()
        autoResizeTextarea()
      })
    }
  }
}

const isSubmitDisabled = computed(() => {
  // Allow submit if there's text OR file chips
  const hasText = !!content.value.trim()
  const hasChips = (textareaRef.value?.querySelectorAll(`[${FILE_CHIP_ATTR}]`).length ?? 0) > 0
  return (!hasText && !hasChips) || isLoading.value
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
      const textContent = textareaRef.value?.textContent || ''
      const updated = slashCompletion.replaceText(textContent, `${command.label} `)
      content.value = updated

      // Update DOM — for slash commands we just set text (no chips involved)
      if (textareaRef.value) {
        // Preserve existing chips by only replacing the text portion
        textareaRef.value.textContent = updated
        placeCaretAtEnd(textareaRef.value)
      }

      emit('input', updated)
    }
  },
  anchorElement: textareaRef
})

// @ file completion — now inserts chips instead of text
const fileCompletion = useCompletionDropdown({
  mode: 'inline',
  trigger: '@',
  provider: (query, signal) => getFileReferences(query, runtime, signal),
  toDropdownItem: fileToDropdownItem,
  onSelect: (file, query) => {
    if (query && textareaRef.value) {
      // Remove the @query text from the editor
      const triggerInfo = fileCompletion.triggerQuery.value
      if (triggerInfo) {
        // Find and remove the @query text in the DOM
        removeTextRange(textareaRef.value, triggerInfo.start, triggerInfo.start + triggerInfo.query.length + 1)
      }
      // Insert chip at current caret position
      insertChipAtCaret(file.path)
    }
  },
  anchorElement: textareaRef
})

/** Remove a range of text characters from a contenteditable element */
function removeTextRange(container: HTMLElement, startOffset: number, endOffset: number) {
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT)
  let charCount = 0
  let startNode: Text | null = null
  let startNodeOffset = 0
  let endNode: Text | null = null
  let endNodeOffset = 0
  let node: Text | null = null

  while ((node = walker.nextNode() as Text | null)) {
    const len = node.textContent?.length ?? 0
    if (!startNode && charCount + len > startOffset) {
      startNode = node
      startNodeOffset = startOffset - charCount
    }
    if (charCount + len >= endOffset) {
      endNode = node
      endNodeOffset = endOffset - charCount
      break
    }
    charCount += len
  }

  if (startNode && endNode) {
    const range = document.createRange()
    range.setStart(startNode, startNodeOffset)
    range.setEnd(endNode, Math.min(endNodeOffset, endNode.textContent?.length ?? 0))
    range.deleteContents()
    const sel = window.getSelection()
    sel?.removeAllRanges()
    sel?.addRange(range)
  }
}

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

  const rects = range.getClientRects()
  const rect = rects[0] || range.getBoundingClientRect()
  if (!rect) return undefined

  const lh = parseFloat(getComputedStyle(editable).lineHeight || '0') || 16
  const height = rect.height || lh

  return new DOMRect(rect.left, rect.top, rect.width, height)
}

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

  // Sanitize: remove any pasted HTML elements that are NOT file chips
  sanitizeEditorContent(target)

  const textContent = target.textContent || ''

  // If completely empty, clear innerHTML to show placeholder
  if (textContent.trim().length === 0 && target.querySelectorAll(`[${FILE_CHIP_ATTR}]`).length === 0) {
    target.innerHTML = ''
  }

  content.value = textContent
  emit('input', textContent)

  // Track text changes for unified undo
  pushUndoDebounced()

  // Completion dropdowns
  slashCompletion.evaluateQuery(textContent)
  fileCompletion.evaluateQuery(textContent)

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

/** Remove any HTML elements that aren't file chips, keeping only text and chips */
function sanitizeEditorContent(container: HTMLElement) {
  const children = Array.from(container.childNodes)
  for (const child of children) {
    if (child.nodeType === Node.TEXT_NODE) continue
    if (child.nodeType === Node.ELEMENT_NODE) {
      const el = child as HTMLElement
      // Keep file chips
      if (el.hasAttribute(FILE_CHIP_ATTR)) continue
      // Allow <br> tags
      if (el.tagName === 'BR') continue
      // For div/p/span that may be created by contenteditable:
      // Extract text and replace with text node + <br>
      if (el.tagName === 'DIV' || el.tagName === 'P' || el.tagName === 'SPAN') {
        // If it contains chips, keep the structure but unwrap the wrapper
        const hasChips = el.querySelector(`[${FILE_CHIP_ATTR}]`)
        if (hasChips) {
          // Unwrap: move children to parent, then remove wrapper
          const br = document.createElement('br')
          container.insertBefore(br, el)
          while (el.firstChild) {
            container.insertBefore(el.firstChild, el)
          }
          el.remove()
        } else {
          // Pure text wrapper — extract text
          const text = el.textContent || ''
          if (text) {
            const br = document.createElement('br')
            container.insertBefore(br, el)
            container.insertBefore(document.createTextNode(text), el)
          }
          el.remove()
        }
        continue
      }
      // Remove any other HTML elements (bold, italic, etc.)
      const text = el.textContent || ''
      if (text) {
        container.insertBefore(document.createTextNode(text), el)
      }
      el.remove()
    }
  }
}

function autoResizeTextarea() {
  if (!textareaRef.value) return

  nextTick(() => {
    const divElement = textareaRef.value!

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

  // Ctrl+Z: unified undo
  if (ctrlOrMeta && event.key === 'z' && !event.shiftKey) {
    if (undoStack.value.length > 0) {
      event.preventDefault()
      if (inputDebounceTimer) { clearTimeout(inputDebounceTimer); inputDebounceTimer = null }
      redoStack.value = [...redoStack.value, currentSnapshot()]
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
      undoStack.value = [...undoStack.value, currentSnapshot()]
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
    if (event.isComposing) {
      return
    }
    event.preventDefault()
    handleSubmit()
  }

  if (event.key === 'Backspace' || event.key === 'Delete') {
    setTimeout(() => {
      syncContentFromEditor()
      autoResizeTextarea()
    }, 0)
  }
}

function handlePaste(event: ClipboardEvent) {
  const clipboard = event.clipboardData
  if (!clipboard) return

  const items = clipboard.items
  if (!items || items.length === 0) return

  // Check for file items
  const files: File[] = []
  for (const item of Array.from(items)) {
    if (item.kind === 'file') {
      const file = item.getAsFile()
      if (file) files.push(file)
    }
  }

  if (files.length > 0) {
    event.preventDefault()
    if (inputDebounceTimer) { clearTimeout(inputDebounceTimer); inputDebounceTimer = null }
    pushUndo()

    // For pasted files, try to get file paths and insert as chips
    for (const file of files) {
      const f = file as File & { path?: string }
      const path = f.path ? toWorkspaceRelativePath(f.path) : file.name
      insertChipAtCaret(path)
    }
    return
  }

  // Text paste: intercept and insert as plain text only
  event.preventDefault()
  if (inputDebounceTimer) { clearTimeout(inputDebounceTimer); inputDebounceTimer = null }
  pushUndo()

  const text = clipboard.getData('text/plain')
  if (text) {
    document.execCommand('insertText', false, text)
  }

  setTimeout(() => {
    syncContentFromEditor()
    lastSavedHtml = textareaRef.value?.innerHTML || ''
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

  if (inputDebounceTimer) { clearTimeout(inputDebounceTimer); inputDebounceTimer = null }
  pushUndo()

  // Insert chips at the drop position
  for (let i = 0; i < paths.length; i++) {
    if (i === 0) {
      // First chip at the exact drop point
      insertChipAtPoint(paths[i], event.clientX, event.clientY)
    } else {
      // Subsequent chips at current caret (which is after the previous chip)
      insertChipAtCaret(paths[i])
    }
  }

  lastSavedHtml = textareaRef.value?.innerHTML || ''

  nextTick(() => {
    textareaRef.value?.focus()
  })
}

function handleSubmit() {
  const textWithRefs = getEditorTextWithRefs()
  const hasChips = (textareaRef.value?.querySelectorAll(`[${FILE_CHIP_ATTR}]`).length ?? 0) > 0

  if (!textWithRefs.trim() && !hasChips) return

  if (props.conversationWorking) {
    emit('queueMessage', textWithRefs)
  } else {
    emit('submit', textWithRefs)
  }

  content.value = ''
  if (textareaRef.value) {
    textareaRef.value.innerHTML = ''
  }

  nextTick(() => {
    autoResizeTextarea()
  })
}

function handleStop() {
  emit('stop')
}

function handleAddFiles(files: FileList) {
  if (inputDebounceTimer) { clearTimeout(inputDebounceTimer); inputDebounceTimer = null }
  pushUndo()

  // Convert files to chips at cursor position
  for (const file of Array.from(files)) {
    const f = file as File & { path?: string }
    const path = f.path ? toWorkspaceRelativePath(f.path) : file.name
    insertChipAtCaret(path)
  }

  lastSavedHtml = textareaRef.value?.innerHTML || ''
}

// Selection change handler (for dropdown positioning)
function handleSelectionChange() {
  if (!content.value || !textareaRef.value) return

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

onMounted(() => {
  document.addEventListener('selectionchange', handleSelectionChange)
})

onUnmounted(() => {
  document.removeEventListener('selectionchange', handleSelectionChange)
})

defineExpose({
  setContent(text: string) {
    content.value = text || ''
    if (textareaRef.value) {
      textareaRef.value.textContent = content.value
    }
    autoResizeTextarea()
  },
  focus() {
    nextTick(() => textareaRef.value?.focus())
  },
  /** Insert a file chip at the current cursor position */
  insertFileChip(filePath: string) {
    insertChipAtCaret(filePath)
  },
  /** Get all file paths from chips in the editor */
  getChipPaths,
  /** Get the full text content including @path references for chips */
  getEditorTextWithRefs,
})

</script>

<style scoped>
/* Editor input */
.aislash-editor-input {
  line-height: 18px;
  overflow-x: hidden;
}

/* Prevent pasted or child elements from breaking the layout — but exclude file chips */
.aislash-editor-input :deep(*:not(.inline-file-chip):not(.inline-file-chip *)) {
  max-width: 100% !important;
  white-space: pre-wrap !important;
  word-break: break-word !important;
  overflow-wrap: break-word !important;
}

.aislash-editor-input:focus {
  outline: none !important;
  border: none !important;
}

.full-input-box:focus-within {
  border-color: var(--vscode-input-border) !important;
  outline: none !important;
}

/* Placeholder — show when empty AND no chips */
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

/* ============================================================
   Inline file chips — styled as small tags inline in text
   ============================================================ */
.aislash-editor-input :deep(.inline-file-chip) {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  padding: 0 4px 0 5px;
  margin: 0 1px;
  background-color: color-mix(in srgb, var(--vscode-textLink-foreground) 12%, transparent);
  border: 1px solid color-mix(in srgb, var(--vscode-textLink-foreground) 25%, transparent);
  border-radius: 3px;
  font-size: 11px;
  line-height: 18px;
  height: 18px;
  vertical-align: baseline;
  cursor: default;
  user-select: none;
  white-space: nowrap !important;
  max-width: 200px;
}

.aislash-editor-input :deep(.inline-file-chip .chip-name) {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--vscode-textLink-foreground);
  font-weight: 500;
  max-width: 160px;
}

.aislash-editor-input :deep(.inline-file-chip .chip-remove) {
  font-size: 10px;
  cursor: pointer;
  opacity: 0.5;
  color: var(--vscode-foreground);
  flex-shrink: 0;
  transition: opacity 0.15s;
}

.aislash-editor-input :deep(.inline-file-chip .chip-remove:hover) {
  opacity: 1;
  color: var(--vscode-errorForeground, #f44);
}

.aislash-editor-input :deep(.inline-file-chip:hover) {
  background-color: color-mix(in srgb, var(--vscode-textLink-foreground) 18%, transparent);
  border-color: color-mix(in srgb, var(--vscode-textLink-foreground) 40%, transparent);
}
</style>
