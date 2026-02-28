<template>
  <DropdownTrigger
    align="left"
    :close-on-click-outside="true"
  >
    <template #trigger>
      <div class="model-dropdown">
        <div class="dropdown-content">
          <div class="dropdown-text">
            <span class="dropdown-label">{{ selectedModelLabel }}</span>
          </div>
        </div>
        <div class="codicon codicon-chevron-up chevron-icon text-[12px]!" />
      </div>
    </template>

    <template #content="{ close }">
      <DropdownItem
        :item="{
          id: 'claude-opus-4-6[1m]',
          label: 'Opus 4.6 (1M)',
          checked: selectedModel === 'claude-opus-4-6[1m]',
          type: 'model'
        }"
        :is-selected="selectedModel === 'claude-opus-4-6[1m]'"
        :index="0"
        @click="(item) => handleModelSelect(item, close)"
      />
      <DropdownItem
        :item="{
          id: 'claude-opus-4-6',
          label: 'Opus 4.6',
          checked: selectedModel === 'claude-opus-4-6',
          type: 'model'
        }"
        :is-selected="selectedModel === 'claude-opus-4-6'"
        :index="1"
        @click="(item) => handleModelSelect(item, close)"
      />
      <DropdownItem
        :item="{
          id: 'claude-sonnet-4-6[1m]',
          label: 'Sonnet 4.6 (1M)',
          checked: selectedModel === 'claude-sonnet-4-6[1m]',
          type: 'model'
        }"
        :is-selected="selectedModel === 'claude-sonnet-4-6[1m]'"
        :index="2"
        @click="(item) => handleModelSelect(item, close)"
      />
      <DropdownItem
        :item="{
          id: 'claude-sonnet-4-6',
          label: 'Sonnet 4.6',
          checked: selectedModel === 'claude-sonnet-4-6',
          type: 'model'
        }"
        :is-selected="selectedModel === 'claude-sonnet-4-6'"
        :index="3"
        @click="(item) => handleModelSelect(item, close)"
      />
      <DropdownItem
        :item="{
          id: 'claude-haiku-4-5',
          label: 'Haiku 4.5',
          checked: selectedModel === 'claude-haiku-4-5',
          type: 'model'
        }"
        :is-selected="selectedModel === 'claude-haiku-4-5'"
        :index="4"
        @click="(item) => handleModelSelect(item, close)"
      />
    </template>
  </DropdownTrigger>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { DropdownTrigger, DropdownItem, type DropdownItemData } from './Dropdown'

interface Props {
  selectedModel?: string
}

interface Emits {
  (e: 'modelSelect', modelId: string): void
}

const props = withDefaults(defineProps<Props>(), {
  selectedModel: 'claude-sonnet-4-6'
})

const emit = defineEmits<Emits>()

const selectedModelLabel = computed(() => {
  switch (props.selectedModel) {
    case 'claude-opus-4-6[1m]':
      return 'Opus 4.6 (1M)'
    case 'claude-opus-4-6':
      return 'Opus 4.6'
    case 'claude-sonnet-4-6[1m]':
      return 'Sonnet 4.6 (1M)'
    case 'claude-sonnet-4-6':
      return 'Sonnet 4.6'
    case 'claude-haiku-4-5':
      return 'Haiku 4.5'
    default:
      return 'Sonnet 4.6'
  }
})

function handleModelSelect(item: DropdownItemData, close: () => void) {
  console.log('Selected model:', item)
  close()

  emit('modelSelect', item.id)
}
</script>

<style scoped>
/* Model - */
.model-dropdown {
  display: flex;
  gap: 4px;
  font-size: 12px;
  align-items: center;
  line-height: 24px;
  min-width: 0;
  max-width: 100%;
  padding: 2.5px 6px;
  border-radius: 23px;
  flex-shrink: 1;
  cursor: pointer;
  border: none;
  background: transparent;
  overflow: hidden;
  transition: background-color 0.2s ease;
}

.model-dropdown:hover {
  background-color: var(--vscode-inputOption-hoverBackground);
}

/* Dropdown */
.dropdown-content {
  display: flex;
  align-items: center;
  gap: 3px;
  min-width: 0;
  max-width: 100%;
  overflow: hidden;
}

.dropdown-text {
  min-width: 0;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  line-height: 12px;
  display: flex;
  align-items: baseline;
  gap: 3px;
  height: 13px;
  font-weight: 400;
}

.dropdown-label {
  opacity: 0.8;
  max-width: 120px;
  overflow: hidden;
  height: 13px;
  text-overflow: ellipsis;
  white-space: nowrap;
  min-width: 0;
}

.chevron-icon {
  font-size: 9px;
  flex-shrink: 0;
  opacity: 0.5;
  color: var(--vscode-foreground);
}
</style>
