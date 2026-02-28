
export interface QueuedMessage {
  id: string
  content: string
  timestamp: number
}

export interface MessageQueueState {
  queuedMessages: QueuedMessage[]
}