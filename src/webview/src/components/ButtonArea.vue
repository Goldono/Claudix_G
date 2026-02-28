<template>
  <div class="button-area-container">
    <div class="button-row">
      <!-- Left Section: Dropdowns -->
      <div class="controls-section">
        <!-- Mode Select -->
        <ModeSelect
          :permission-mode="permissionMode"
          @mode-select="(mode) => emit('modeSelect', mode)"
        />

        <!-- Model Select -->
        <ModelSelect
          :selected-model="selectedModel"
          @model-select="(modelId) => emit('modelSelect', modelId)"
        />
      </div>

      <!-- Right Section: Token Indicator + Action Buttons -->
      <div class="actions-section">
        <!-- Token Indicator -->
        <TokenIndicator
          v-if="showProgress"
          :percentage="progressPercentage"
          :input-tokens="usageData?.inputTokens ?? 0"
          :output-tokens="usageData?.outputTokens ?? 0"
          :cache-creation-tokens="usageData?.cacheCreationTokens ?? 0"
          :cache-read-tokens="usageData?.cacheReadTokens ?? 0"
          :total-tokens="usageData?.totalTokens ?? 0"
          :context-window="usageData?.contextWindow ?? 200000"
        />

        <!-- Thinking Toggle Button -->
        <button
          class="action-button think-button"
          :class="{ 'thinking-active': isThinkingOn }"
          @click="handleThinkingToggle"
          :aria-label="isThinkingOn ? 'Thinking on' : 'Thinking off'"
          :title="isThinkingOn ? 'Thinking on' : 'Thinking off'"
        >
          <span class="codicon codicon-brain text-[16px]!" />
        </button>

        <!-- Fulltext Toggle Button -->
        <button
          class="action-button fulltext-button"
          :class="{ 'fulltext-active': fullTextMode }"
          @click="emit('fullTextToggle')"
          :aria-label="fullTextMode ? 'Fulltext injection on' : 'Fulltext injection off'"
          :title="fullTextMode ? 'Dateien als Volltext senden (AN)' : 'Dateien als Volltext senden (AUS)'"
        >
          <span class="codicon codicon-file-code text-[16px]!" />
        </button>

        <!-- Command Button with Dropdown -->
        <DropdownTrigger
          ref="commandDropdownRef"
          :show-search="true"
          search-placeholder="Filter commands..."
          align="left"
          :selected-index="commandCompletion.activeIndex.value"
          :data-nav="commandCompletion.navigationMode.value"
          @open="handleDropdownOpen"
          @close="handleDropdownClose"
          @search="handleSearch"
        >
          <template #trigger>
            <button
              class="action-button"
              aria-label="Slash Commands"
            >
              <span class="codicon codicon-italic text-[16px]!" />
            </button>
          </template>

          <template #content="{ close }">
            <div @mouseleave="commandCompletion.handleMouseLeave">
              <template v-for="(item, index) in commandCompletion.items.value" :key="item.id">
                <DropdownSeparator v-if="item.type === 'separator'" />
                <DropdownSectionHeader v-else-if="item.type === 'section-header'" :text="item.text" />
                <DropdownItem
                  v-else
                  :item="item"
                  :index="index"
                  :is-selected="index === commandCompletion.activeIndex.value"
                  @click="(item) => handleCommandClick(item, close)"
                  @mouseenter="commandCompletion.handleMouseEnter(index)"
                />
              </template>
            </div>
          </template>
        </DropdownTrigger>

        <!-- Attach File Button -->
        <button
          class="action-button"
          @click="handleAttachClick"
          aria-label="Attach File"
        >
          <span class="codicon codicon-attach text-[16px]!" />
          <input
            ref="fileInputRef"
            type="file"
            multiple
            style="display: none;"
            @change="handleFileUpload"
          >
        </button>

        <!-- Submit Button -->
        <button
          class="submit-button"
          @click="handleSubmit"
          :disabled="submitVariant === 'disabled'"
          :data-variant="submitVariant"
          :aria-label="submitVariant === 'stop' ? 'Stop Conversation' : 'Send Message'"
        >
          <span
            v-if="submitVariant === 'stop'"
            class="codicon codicon-debug-stop text-[12px]! bg-(--vscode-editor-background)e-[0.6] rounded-[1px]"
          />
          <span
            v-else
            class="codicon codicon-arrow-up-two text-[12px]!"
          />
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { PermissionMode } from '@anthropic-ai/claude-agent-sdk'
import { ref, computed, inject } from 'vue'
import TokenIndicator from './TokenIndicator.vue'
import ModeSelect from './ModeSelect.vue'
import ModelSelect from './ModelSelect.vue'
import { DropdownTrigger, DropdownItem, DropdownSeparator, DropdownSectionHeader } from './Dropdown'
import { RuntimeKey } from '../composables/runtimeContext'
import { useCompletionDropdown } from '../composables/useCompletionDropdown'
import { getSlashCommands, commandToDropdownItem } from '../providers/slashCommandProvider'

interface Props {
  disabled?: boolean
  loading?: boolean
  selectedModel?: string
  conversationWorking?: boolean
  hasInputContent?: boolean
  showProgress?: boolean
  progressPercentage?: number
  usageData?: { inputTokens: number; outputTokens: number; cacheCreationTokens: number; cacheReadTokens: number; totalTokens: number; contextWindow: number } | null
  thinkingLevel?: string
  permissionMode?: PermissionMode
  fullTextMode?: boolean
}

interface Emits {
  (e: 'submit'): void
  (e: 'stop'): void
  (e: 'attach'): void
  (e: 'addAttachment', files: FileList): void
  (e: 'thinkingToggle'): void
  (e: 'fullTextToggle'): void
  (e: 'modeSelect', mode: PermissionMode): void
  (e: 'modelSelect', modelId: string): void
}

const props = withDefaults(defineProps<Props>(), {
  disabled: false,
  loading: false,
  selectedModel: 'claude-sonnet-4-6',
  conversationWorking: false,
  hasInputContent: false,
  showProgress: true,
  progressPercentage: 48.7,
  thinkingLevel: 'default_on',
  permissionMode: 'default',
  fullTextMode: false
})

const emit = defineEmits<Emits>()

const fileInputRef = ref<HTMLInputElement>()
const commandDropdownRef = ref<InstanceType<typeof DropdownTrigger>>()

// runtime CommandRegistry
const runtime = inject(RuntimeKey)

// === Completion Dropdown Composable ===

// Slash Command
const commandCompletion = useCompletionDropdown({
  mode: 'manual',
  provider: (query) => getSlashCommands(query, runtime),
  toDropdownItem: commandToDropdownItem,
  onSelect: (command) => {
    if (runtime) {
      runtime.appContext.commandRegistry.executeCommand(command.id)
    }
    commandCompletion.close()
  },
 showSectionHeaders: false,
  searchFields: ['label', 'description']
})


const isThinkingOn = computed(() => props.thinkingLevel !== 'off')

const submitVariant = computed(() => {
 // React：busy
  if (props.conversationWorking) {
    return 'stop'
  }

 // busy ->
  if (!props.hasInputContent) {
    return 'disabled'
  }

 // ->
  return 'enabled'
})

function handleSubmit() {
  if (submitVariant.value === 'stop') {
    emit('stop')
  } else if (submitVariant.value === 'enabled') {
    emit('submit')
  }
}

// Command dropdown handlers
function handleCommandClick(item: any, close: () => void) {
  console.log('Command clicked:', item)

 // commandCompletion
  if (item.data?.command) {
    const index = commandCompletion.items.value.findIndex(i => i.id === item.id)
    if (index !== -1) {
      commandCompletion.selectIndex(index)
    }
  }

  close()
}

function handleThinkingToggle() {
  emit('thinkingToggle')
}

function handleAttachClick() {
  fileInputRef.value?.click()
}

function handleFileUpload(event: Event) {
  const target = event.target as HTMLInputElement
  if (target.files && target.files.length > 0) {
    emit('addAttachment', target.files)
 // input，
    target.value = ''
  }
}

// Command dropdown -
function handleDropdownOpen() {
  commandCompletion.open()
  document.addEventListener('keydown', handleCommandKeydown)
}

// Command dropdown -
function handleDropdownClose() {
  commandCompletion.close()
  document.removeEventListener('keydown', handleCommandKeydown)
}

// Command dropdown - Search
function handleSearch(term: string) {
  commandCompletion.handleSearch(term)
}

// Command dropdown -
function handleCommandKeydown(event: KeyboardEvent) {
  commandCompletion.handleKeydown(event)
}


</script>

<style scoped>
.button-area-container {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.25rem;
  flex-shrink: 0;
  cursor: auto;
  width: 100%;
}

.button-row {
  display: grid;
  grid-template-columns: 4fr 1fr;
  align-items: center;
  height: 28px;
  padding-right: 2px;
  box-sizing: border-box;
  flex: 1 1 0%;
  justify-content: space-between;
  width: 100%;
}

.controls-section {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-right: 6px;
  flex-shrink: 1;
  flex-grow: 0;
  min-width: 0;
  height: 20px;
  max-width: 100%;
}

.actions-section {
  display: flex;
  align-items: center;
  gap: 4px;
  justify-content: flex-end;
}

.action-button,
.submit-button {
  opacity: 0.5;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 17px;
  height: 17px;
  border: none;
  background: transparent;
  border-radius: 50%;
  cursor: pointer;
  transition: background-color 0.2s ease, opacity 0.2s ease;
  color: var(--vscode-foreground);
  position: relative;
}


.action-button:hover:not(:disabled) {
  opacity: 1;
}

.action-button:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.action-button.thinking-active {
  color: var(--vscode-button-secondaryForeground);
  opacity: 1;
}

/* Think ： hover opacity ， off */
.action-button.think-button:hover:not(.thinking-active) {
 opacity: 0.5; /* opacity， 1 */
}

/* hover */
.action-button.think-button.thinking-active:hover {
  opacity: 1;
}

.action-button.fulltext-active {
  color: var(--vscode-button-secondaryForeground);
  opacity: 1;
}

.action-button.fulltext-button:hover:not(.fulltext-active) {
  opacity: 0.5;
}

.action-button.fulltext-button.fulltext-active:hover {
  opacity: 1;
}

.submit-button {
  scale: 1.1;
}

.submit-button[data-variant="enabled"] {
  background-color: color-mix(in srgb, var(--vscode-editor-foreground) 80%, transparent);
  color: var(--vscode-editor-background);
  opacity: 1;
  outline: 1.5px solid color-mix(in srgb, var(--vscode-editor-foreground) 60%, transparent);
  outline-offset: 1px;
}

.submit-button[data-variant="disabled"] {
  background-color: color-mix(in srgb, var(--vscode-editor-foreground) 80%, transparent);
  color: var(--vscode-editor-background);
  opacity: 0.5;
  cursor: not-allowed;
}

.submit-button[data-variant="stop"] {
  background-color: color-mix(in srgb, var(--vscode-editor-foreground) 80%, transparent);
  color: var(--vscode-editor-background);
  opacity: 1;
  outline: 1.5px solid color-mix(in srgb, var(--vscode-editor-foreground) 60%, transparent);
  outline-offset: 1px;
}


.codicon-modifier-spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
</style>
