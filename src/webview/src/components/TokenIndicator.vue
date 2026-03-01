<template>
  <div class="token-indicator-wrapper">
    <div
      class="progress-container"
      @click="handleClick"
    >
      <span class="progress-text">{{ formattedPercentage }}</span>
      <div class="progress-circle">
        <svg width="14" height="14" class="progress-svg">
          <circle
            cx="7"
            cy="7"
            r="5.25"
            :stroke="strokeColor"
            stroke-width="1.5"
            fill="none"
            opacity="0.25"
          />
          <circle
            cx="7"
            cy="7"
            r="5.25"
            :stroke="strokeColor"
            stroke-width="1.5"
            fill="none"
            stroke-linecap="round"
            opacity="0.9"
            :stroke-dasharray="circumference"
            :stroke-dashoffset="strokeOffset"
            transform="rotate(-90 7 7)"
            class="progress-arc"
          />
        </svg>
      </div>
    </div>

    <!-- Details Popup — teleported to body so it's never clipped -->
    <Teleport to="body">
      <div v-if="showDetails" ref="popupEl" class="token-popup" :style="popupStyle">
        <!-- Account + Usage Section -->
        <template v-if="usageInfo">
          <div class="token-popup-header">Account</div>
          <div v-if="usageInfo.subscriptionType" class="token-row">
            <span class="token-label">Plan</span>
            <span class="token-value plan-badge">{{ formatPlan(usageInfo.subscriptionType) }}</span>
          </div>

          <template v-if="usageInfo.fiveHour?.utilization !== null || usageInfo.sevenDay?.utilization !== null">
            <div class="token-divider" />
            <div class="token-popup-header">Usage Limits</div>

            <div v-if="usageInfo.fiveHour?.utilization !== null" class="usage-limit-row">
              <div class="usage-limit-header">
                <span class="token-label">Session (5hr)</span>
                <span class="token-value">{{ formatPercent(usageInfo.fiveHour.utilization) }}</span>
              </div>
              <div class="usage-bar">
                <div class="usage-bar-fill" :style="{ width: formatPercent(usageInfo.fiveHour.utilization) }" :class="usageBarColor(usageInfo.fiveHour.utilization)" />
              </div>
              <div v-if="usageInfo.fiveHour.resetsAt" class="usage-reset">Resets {{ formatResetTime(usageInfo.fiveHour.resetsAt) }}</div>
            </div>

            <div v-if="usageInfo.sevenDay?.utilization !== null" class="usage-limit-row">
              <div class="usage-limit-header">
                <span class="token-label">Weekly (7 day)</span>
                <span class="token-value">{{ formatPercent(usageInfo.sevenDay.utilization) }}</span>
              </div>
              <div class="usage-bar">
                <div class="usage-bar-fill" :style="{ width: formatPercent(usageInfo.sevenDay.utilization) }" :class="usageBarColor(usageInfo.sevenDay.utilization)" />
              </div>
              <div v-if="usageInfo.sevenDay.resetsAt" class="usage-reset">Resets {{ formatResetTime(usageInfo.sevenDay.resetsAt) }}</div>
            </div>
          </template>

          <div class="token-divider" />
        </template>

        <template v-else-if="usageLoading">
          <div class="token-popup-header">Account</div>
          <div class="token-row"><span class="token-label" style="opacity:0.4">Loading...</span></div>
          <div class="token-divider" />
        </template>

        <!-- Token Usage Section -->
        <div class="token-popup-header">Token Usage</div>
        <div class="token-row">
          <span class="token-label">Input</span>
          <span class="token-value">{{ formatNumber(inputTokens) }}</span>
        </div>
        <div class="token-row">
          <span class="token-label">Output</span>
          <span class="token-value">{{ formatNumber(outputTokens) }}</span>
        </div>
        <div v-if="cacheCreationTokens > 0" class="token-row">
          <span class="token-label">Cache Write</span>
          <span class="token-value">{{ formatNumber(cacheCreationTokens) }}</span>
        </div>
        <div v-if="cacheReadTokens > 0" class="token-row">
          <span class="token-label">Cache Read</span>
          <span class="token-value">{{ formatNumber(cacheReadTokens) }}</span>
        </div>
        <div class="token-divider" />
        <div class="token-row token-row-total">
          <span class="token-label">Total</span>
          <span class="token-value">{{ formatNumber(totalTokens) }}</span>
        </div>
        <div class="token-row">
          <span class="token-label">Context</span>
          <span class="token-value">{{ formatNumber(contextWindow) }}</span>
        </div>
        <div v-if="totalCost > 0" class="token-divider" />
        <div v-if="totalCost > 0" class="token-row token-row-total">
          <span class="token-label">Cost</span>
          <span class="token-value cost-value">${{ totalCost.toFixed(4) }}</span>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, inject, onMounted, onUnmounted, nextTick } from 'vue'
import { RuntimeKey } from '../composables/runtimeContext'

interface Props {
  percentage: number
  size?: number
  inputTokens?: number
  outputTokens?: number
  cacheCreationTokens?: number
  cacheReadTokens?: number
  totalTokens?: number
  contextWindow?: number
  totalCost?: number
}

const props = withDefaults(defineProps<Props>(), {
  percentage: 0,
  size: 14,
  inputTokens: 0,
  outputTokens: 0,
  cacheCreationTokens: 0,
  cacheReadTokens: 0,
  totalTokens: 0,
  contextWindow: 200000,
  totalCost: 0,
})

const runtime = inject(RuntimeKey)
const showDetails = ref(false)
const usageLoading = ref(false)
const usageInfo = ref<any>(null)

const circumference = computed(() => 2 * Math.PI * 5.25)

const strokeOffset = computed(() => {
  const progress = Math.max(0, Math.min(100, props.percentage))
  return circumference.value - (progress / 100) * circumference.value
})

const formattedPercentage = computed(() => {
  const value = props.percentage
  return `${value % 1 === 0 ? Math.round(value) : value.toFixed(1)}%`
})

const strokeColor = 'color-mix(in srgb,var(--vscode-foreground) 92%,transparent)'

function formatNumber(n: number): string {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`
  return String(n)
}

function formatPlan(type: string): string {
  const map: Record<string, string> = { max: 'Claude Max', pro: 'Claude Pro', team: 'Claude Team', free: 'Free' }
  return map[type] || type
}

function formatTier(tier: string): string {
  if (!tier) return '—'
  return tier.replace(/_/g, ' ').replace(/^default /, '')
}

function formatPercent(util: number | null): string {
  if (util === null) return '—'
  return `${Math.floor(util * 100)}%`
}

function formatResetTime(timestamp: number): string {
  const now = Date.now() / 1000
  const diff = timestamp - now
  if (diff <= 0) return 'now'
  if (diff < 3600) return `in ${Math.ceil(diff / 60)}m`
  if (diff < 86400) return `in ${Math.floor(diff / 3600)}h ${Math.ceil((diff % 3600) / 60)}m`
  return `in ${Math.floor(diff / 86400)}d`
}

function usageBarColor(util: number | null): string {
  if (util === null) return ''
  if (util >= 0.9) return 'bar-red'
  if (util >= 0.5) return 'bar-yellow'
  return 'bar-green'
}

async function fetchUsageInfo() {
  if (!runtime || usageLoading.value) return
  usageLoading.value = true
  try {
    const connection = await runtime.sessionStore.getConnection()
    const result = await connection.getUsageInfo()
    if (result.success) {
      usageInfo.value = result
    }
  } catch (e) {
    console.error('[TokenIndicator] Failed to fetch usage info', e)
  } finally {
    usageLoading.value = false
  }
}

const popupEl = ref<HTMLElement | null>(null)
const popupStyle = ref<Record<string, string>>({})

function handleClick(e: MouseEvent) {
  showDetails.value = !showDetails.value
  if (showDetails.value) {
    if (!usageInfo.value) fetchUsageInfo()
    // Position popup above the button, constrained to webview viewport
    nextTick(() => {
      const btn = (e.currentTarget as HTMLElement)
      if (!btn) return
      const rect = btn.getBoundingClientRect()
      const spaceAbove = rect.top - 8
      popupStyle.value = {
        bottom: `${window.innerHeight - rect.top + 8}px`,
        right: `${window.innerWidth - rect.right}px`,
        maxHeight: `${spaceAbove}px`,
      }
    })
  }
}

function handleClickOutside(e: MouseEvent) {
  const el = (e.target as HTMLElement)?.closest('.token-indicator-wrapper')
  if (!el) showDetails.value = false
}

onMounted(() => document.addEventListener('click', handleClickOutside))
onUnmounted(() => document.removeEventListener('click', handleClickOutside))
</script>

<style scoped>
/* Scoped styles for the trigger button */

.token-indicator-wrapper {
  position: relative;
  z-index: 100;
}

.progress-container {
  display: flex;
  align-items: center;
  gap: 4px;
  cursor: pointer;
}

.progress-container:hover .progress-text {
  color: var(--vscode-foreground);
}

.progress-text {
  font-size: 12px;
  color: color-mix(in srgb,var(--vscode-foreground) 48%,transparent);
  line-height: 1;
  transition: color 0.15s;
}

.progress-circle {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 14px;
  height: 14px;
}

.progress-svg {
  position: absolute;
}

.progress-arc {
  transition: stroke-dashoffset 0.3s ease;
}


</style>

<!-- Unscoped styles for the teleported popup -->
<style>
.token-popup {
  position: fixed;
  min-width: 220px;
  max-width: 280px;
  background: var(--vscode-menu-background, var(--vscode-editor-background));
  border: 1px solid var(--vscode-menu-border, var(--vscode-panel-border));
  border-radius: 6px;
  padding: 8px 0;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.25);
  font-size: 11px;
  color: var(--vscode-menu-foreground, var(--vscode-foreground));
  z-index: 10000;
  overflow-y: auto;
}

.token-popup-header {
  padding: 2px 12px 6px;
  font-weight: 600;
  font-size: 11px;
  opacity: 0.6;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.token-row {
  display: flex;
  justify-content: space-between;
  padding: 2px 12px;
  gap: 8px;
}

.token-label {
  opacity: 0.7;
  flex-shrink: 0;
}

.token-value {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-weight: 500;
  text-align: right;
}

.token-value-small {
  font-size: 10px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 160px;
}

.plan-badge {
  color: #a78bfa;
  font-weight: 600;
}

.token-row-total {
  font-weight: 600;
}

.cost-value {
  color: #22c55e;
}

.token-divider {
  height: 1px;
  background: var(--vscode-menu-separatorBackground, var(--vscode-panel-border));
  margin: 4px 8px;
}

.usage-limit-row {
  padding: 3px 12px;
}

.usage-limit-header {
  display: flex;
  justify-content: space-between;
  margin-bottom: 3px;
}

.usage-bar {
  height: 4px;
  border-radius: 2px;
  background: color-mix(in srgb, var(--vscode-foreground) 15%, transparent);
  overflow: hidden;
}

.usage-bar-fill {
  height: 100%;
  border-radius: 2px;
  transition: width 0.3s ease;
}

.bar-green { background: #22c55e; }
.bar-yellow { background: #eab308; }
.bar-red { background: #ef4444; }

.usage-reset {
  font-size: 10px;
  opacity: 0.5;
  margin-top: 2px;
}
</style>
