import { Injectable, inject } from '@angular/core';
import { ChatNavigation, ChatRequest, ChatStreamCallbacks } from './chat.models';
import { Logging } from '../logging/logging';
import { environment } from '@environments/environment';

@Injectable({
  providedIn: 'root',
})
export class Chat {
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
            if (line.startsWith('[DONE]')) {
              const sessionId = line.slice(6).trim() || undefined;
              this.logger.info('Chat stream completed', { sessionId });
              callbacks.onDone(sessionId, sessionId);
              return;
            }
            if (line.startsWith('[ERROR]')) {
              const message = line.slice(7).trim() || 'Error al conectar con el asistente';
              this.logger.error('Chat stream error event', new Error(message));
              callbacks.onError(new Error(message));
              return;
            }
            if (line.startsWith('[NAVIGATE]')) {
              this.emitNavigation(line.slice(10), callbacks);
              continue;
            }
            if (line.startsWith('[PROCESS]') || line.startsWith('[TOOL_CALL]')) {
              callbacks.onChunk(line);
              continue;
            }
            if (line.startsWith('data: ')) {
              const data = line.slice(6);
              if (data.startsWith('[DONE]')) {
                const sessionId = data.slice(6).trim() || undefined;
                this.logger.info('Chat stream completed', { sessionId });
                callbacks.onDone(sessionId, sessionId);
                return;
              }
              if (data.startsWith('[ERROR]')) {
                const message = data.slice(7).trim() || 'Error al conectar con el asistente';
                this.logger.error('Chat stream error event', new Error(message));
                callbacks.onError(new Error(message));
                return;
              }
              if (data.startsWith('[NAVIGATE]')) {
                this.emitNavigation(data.slice(10), callbacks);
                continue;
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

  /** Parses a `[NAVIGATE] {json}` payload and forwards it to the caller. */
  private emitNavigation(payload: string, callbacks: ChatStreamCallbacks): void {
    let action: Partial<ChatNavigation> | null;
    try {
      action = JSON.parse(payload.trim()) as Partial<ChatNavigation> | null;
    } catch {
      this.logger.warn('Chat stream: malformed navigation payload', { payload });
      return;
    }
    if (!action || typeof action.screen !== 'string' || !action.screen) {
      this.logger.warn('Chat stream: navigation without screen', { action });
      return;
    }
    const navigation: ChatNavigation = {
      screen: action.screen,
      query: action.query,
      entity_id: action.entity_id,
      tab: action.tab,
    };
    this.logger.info('Chat stream navigation', { screen: navigation.screen });
    callbacks.onNavigate?.(navigation);
  }
}