import { Injectable, inject } from '@angular/core';
import { ChatRequest, ChatStreamCallbacks } from './chat.models';
import { Logging } from '../logging/logging';
import { environment } from '@environments/environment';

@Injectable({
  providedIn: 'root',
})
export class ChatService {
  private logger = inject(Logging);

  async streamMessage(request: ChatRequest, callbacks: ChatStreamCallbacks): Promise<void> {
    const controller = new AbortController();

    const chatUrl = environment.agentHost
      ? `${environment.agentHost}/chat/stream`
      : `${environment.apiUrl}/chat/stream`;

    try {
      const response = await fetch(chatUrl, {
        method: 'POST',
        body: JSON.stringify(request),
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${String(response.status)}`);
      }

      const requestId = response.headers.get('X-Request-ID');
      this.logger.info(`Chat stream started`, { requestId });
      this.logger.info(`Chat stream request`, {
        url: `${environment.agentHost}/chat/stream`,
        session_id: request.session_id,
      });

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('Response body is not readable');
      }

      const decoder = new TextDecoder();
      let buffer = '';

      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split('\n\n');
        buffer = events.pop() ?? '';
        for (const event of events) {
          const lines = event.split('\n');
          for (const line of lines) {
            // Check for [DONE] WITHOUT "data: " prefix first
            if (line.startsWith('[DONE]')) {
              const sessionId = line.slice(6).trim() || undefined;
              this.logger.info('Chat stream completed', { sessionId });
              callbacks.onDone(sessionId, sessionId);
              return;
            }
            // Then handle data: lines
            if (line.startsWith('data: ')) {
              const data = line.slice(6);
              callbacks.onChunk(data);
            }
          }
        }
      }

      callbacks.onDone();
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        this.logger.info('Chat stream cancelled by user');
        callbacks.onDone(undefined);
        return;
      }
      this.logger.error('Chat stream error', error as Error);
      callbacks.onError(error as Error);
    }
  }
}