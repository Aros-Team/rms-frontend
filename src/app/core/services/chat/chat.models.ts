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
}

export interface ChatStreamCallbacks {
  onChunk: (chunk: string) => void;
  onDone: () => void;
  onError: (error: Error) => void;
}
