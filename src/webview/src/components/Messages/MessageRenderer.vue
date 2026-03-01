<template>
  <component
    class="message"
    :class="{ 'dimmed-restored': isDimmed }"
    v-if="!message.isEmpty"
    :is="messageComponent"
    :message="message"
    :message-index="messageIndex"
    :context="context"
  />
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { Message } from '../../models/Message';
import type { ToolContext } from '../../types/tool';
import UserMessage from './UserMessage.vue';
import AssistantMessage from './AssistantMessage.vue';
import SystemMessage from './SystemMessage.vue';
import ResultMessage from './ResultMessage.vue';
import TipMessage from './TipMessage.vue';
import SlashCommandResultMessage from './SlashCommandResultMessage.vue';

interface Props {
  message: Message;
  messageIndex: number;
  context: ToolContext;
}

const props = defineProps<Props>();

const messageComponent = computed(() => {
  switch (props.message.type) {
    case 'user':
      return UserMessage;
    case 'assistant':
      return AssistantMessage;
    case 'tip':
      return TipMessage;
    case 'slash_command_result':
      return SlashCommandResultMessage;
    case 'system':
      return SystemMessage;
    case 'result':
      return ResultMessage;
    default:
      return null;
  }
});

const isDimmed = computed(() => {
  const restored = props.context?.restoredAtIndex;
  if (restored == null) return false;
  return props.messageIndex > restored;
});
</script>

<style scoped>
  .message {
    margin-bottom: 4px;
  }

  .dimmed-restored {
    opacity: 0.3;
    pointer-events: none;
    filter: grayscale(0.6);
    transition: opacity 0.3s ease, filter 0.3s ease;
  }
</style>
