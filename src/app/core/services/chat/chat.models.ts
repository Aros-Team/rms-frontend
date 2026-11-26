export interface ChatRequest {
  message: string;
  session_id?: string;
}

export interface ChatResponse {
  answer: string;
  session_id: string;
}

export interface ChatMessage {
  id: string;
  content: string;
  role: 'user' | 'assistant';
  timestamp: Date;
  /**
   * `navigation` messages are inline system cards that record where the
   * assistant moved the UI. They are part of the conversation flow, not a
   * fixed banner.
   */
  kind?: 'text' | 'navigation';
  navigation?: ChatNavigation;
  navigationLabel?: string;
}

/**
 * Navigation intent emitted by the agent as `[NAVIGATE] {json}`.
 * `screen` is a stable key shared with the ABI tool catalog.
 */
export interface ChatNavigation {
  screen: string;
  query?: string | null;
  entity_id?: number | null;
  tab?: string | null;
}

export interface ChatStreamCallbacks {
  onChunk: (chunk: string) => void;
  onDone: (sessionId?: string, requestId?: string) => void;
  onError: (error: Error) => void;
  /** Fired when the agent asks the UI to move to a screen. */
  onNavigate?: (action: ChatNavigation) => void;
}
