import { Injectable, inject } from '@angular/core';
import { ChatRequest, ChatStreamCallbacks } from './chat.models';
import { LoggingService } from '../logging/logging-service';
import { environment } from '@environments/environment';

@Injectable({
  providedIn: 'root',
})
export class ChatService {
  private logger = inject(LoggingService);

  async streamMessage(request: ChatRequest, callbacks: ChatStreamCallbacks): Promise<void> {
    const controller = new AbortController();

    try {
      const response = await fetch(`${environment.agentHost}/chat/stream`, {
        method: 'POST',
        body: JSON.stringify(request),
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const requestId = response.headers.get('X-Request-ID');
      this.logger.info(`Chat stream started`, { requestId });

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('Response body is not readable');
      }

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split('\n\n');
        buffer = events.pop() || '';

        for (const event of events) {
          const lines = event.split('\n');
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6);
              if (data.startsWith('[DONE]')) {
                const requestId = response.headers.get('X-Request-ID') || undefined;
                this.logger.info('Chat stream completed', { requestId });
                callbacks.onDone(requestId, requestId);
                return;
              }
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
