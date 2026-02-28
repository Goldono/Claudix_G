<template>
  <div class="app-wrapper">
    <main class="app-main">
      <div class="page-container">
        <Motion
          :animate="pageAnimation"
          :transition="{ duration: 0.3, ease: 'easeOut' }"
          class="motion-wrapper"
        >
          <ChatPage
            v-if="currentPage === 'chat'"
            key="chat"
          />
          <SettingsPage
            v-else-if="currentPage === 'settings'"
            key="settings"
          />
          <!-- IconTestPage -->
          <!-- <IconTestPage
            v-else-if="currentPage === 'icontest'"
            key="icontest"
          /> -->
        </Motion>
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, provide } from 'vue';
import { Motion } from 'motion-v';
import ChatPage from './pages/ChatPage.vue';
import SettingsPage from './pages/SettingsPage.vue';
import './styles/claude-theme.css';
import { useRuntime } from './composables/useRuntime';
import { RuntimeKey } from './composables/runtimeContext';
// import IconTestPage from './pages/IconTestPage.vue';

type PageName = 'chat' | 'settings';

const bootstrap = window.CLAUDIX_BOOTSTRAP;
const initialPage = (bootstrap?.page as PageName | undefined) ?? 'chat';
const currentPage = ref<PageName>(initialPage);
const pageAnimation = ref({ opacity: 1, x: 0 });

const needsRuntime = initialPage === 'chat';
const runtime = needsRuntime ? useRuntime() : null;

if (runtime) {
  provide(RuntimeKey, runtime);
}

onMounted(() => {
  if (runtime) {
    console.log('[App] runtime initialized', runtime);
  } else {
    console.log('[App] runtime not initialized for page', initialPage);
  }
});

</script>

<style>
.app-wrapper {
  display: flex;
  flex-direction: column;
  height: 100vh;
  color: var(--vscode-editor-foreground);
}

.app-main {
  flex: 1;
  overflow: hidden;
}

.page-container {
  position: relative;
  height: 100%;
  width: 100%;
}

.motion-wrapper {
  height: 100%;
  width: 100%;
  display: flex;
  flex-direction: column;
}
</style>
