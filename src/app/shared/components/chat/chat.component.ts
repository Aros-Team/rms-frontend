import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { marked } from 'marked';
import { ChatService } from '@app/core/services/chat/chat-service';
import { ChatMessage, ChatRequest } from '@app/core/services/chat/chat.models';

@Component({
  selector: 'app-chat',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './chat.component.html',
  styleUrl: './chat.component.css',
})
export class ChatComponent {
  private chatService = inject(ChatService);
  private sanitizer = inject(DomSanitizer);

  messages = signal<ChatMessage[]>([]);
  currentMessage = signal('');
  loading = signal(false);
  error = signal<string | null>(null);
  isOpen = signal(false);
  sessionId = signal<string | null>(null);
  copySuccess = signal(false);
  isToolCallActive = signal(false);
  pendingMessage = signal('');
  processMessage = signal('');

  private abortController: AbortController | null = null;

  constructor() {
    marked.setOptions({
      gfm: true,
      breaks: true,
    });
  }

  openChat(): void {
    this.isOpen.set(true);
  }

  closeChat(): void {
    this.isOpen.set(false);
  }

  toggleChat(): void {
    this.isOpen.set(!this.isOpen());
  }

  handleKeydown(event: Event): void {
    const keyEvent = event as KeyboardEvent;
    if (keyEvent.key === 'Enter' && !keyEvent.shiftKey) {
      event.preventDefault();
      this.sendMessage();
    }
  }

  async sendMessage(): Promise<void> {
    const content = this.currentMessage().trim();
    if (!content || this.loading()) return;

    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      content,
      role: 'user',
      timestamp: new Date(),
    };

    this.messages.update(msgs => [...msgs, userMessage]);
    this.currentMessage.set('');
    this.loading.set(true);
    this.error.set(null);
    this.processMessage.set('');

    const assistantMessageId = crypto.randomUUID();
    let assistantContent = '';
    let displayContent = '';
    let inToolCall = false;

    const request: ChatRequest = {
      message: content,
      session_id: this.sessionId() || undefined,
    };

    this.abortController = new AbortController();

    await this.chatService.streamMessage(request, {
      onChunk: (chunk: string) => {
        if (chunk.startsWith('[PROCESS]')) {
          this.processMessage.set(chunk.slice(9).trim());
        } else if (chunk.startsWith('[TOOL_CALL]')) {
          this.isToolCallActive.set(true);
          inToolCall = true;
          displayContent = assistantContent;
          this.pendingMessage.set(assistantContent);
        } else if (chunk.startsWith('[TOOL_RESULT]')) {
          // Tool result - ignore for final text
        } else if (chunk.startsWith('[DONE]')) {
          // Handled in onDone
        } else {
          assistantContent += chunk;
          if (!inToolCall) {
            displayContent = assistantContent;
          }
        }

        this.messages.update(msgs => {
          const existing = msgs.find(m => m.id === assistantMessageId);
          if (existing) {
            return msgs.map(m =>
              m.id === assistantMessageId
                ? { ...m, content: displayContent }
                : m
            );
          }
          return [
            ...msgs,
            {
              id: assistantMessageId,
              content: displayContent,
              role: 'assistant' as const,
              timestamp: new Date(),
            },
          ];
        });
      },
      onDone: (sessionId?: string) => {
        this.loading.set(false);
        this.isToolCallActive.set(false);
        this.pendingMessage.set('');
        this.processMessage.set('');
        this.abortController = null;
        if (sessionId) {
          this.sessionId.set(sessionId);
        }
      },
      onError: (err: Error) => {
        this.error.set(err.message || 'Error al conectar con el asistente');
        this.loading.set(false);
        this.isToolCallActive.set(false);
        this.pendingMessage.set('');
        this.processMessage.set('');
        this.abortController = null;
      },
    });
  }

  cancelStream(): void {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
    this.loading.set(false);
  }

  clearChat(): void {
    this.messages.set([]);
    this.sessionId.set(null);
    this.error.set(null);
  }

  copyMessage(content: string): void {
    navigator.clipboard.writeText(content).then(() => {
      this.copySuccess.set(true);
      setTimeout(() => this.copySuccess.set(false), 2000);
    });
  }

  formatTime(date: Date): string {
    return new Intl.DateTimeFormat('es-ES', {
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  }

  parseMarkdown(content: string): SafeHtml {
    const processed = this.preprocessMarkdown(content);
    const html = marked.parse(processed) as string;
    return this.sanitizer.bypassSecurityTrustHtml(html);
  }

  private preprocessMarkdown(text: string): string {
    return text.replace(/\\n/g, '\n');
  }

  trackByMessageId(index: number, message: ChatMessage): string {
    return message.id;
  }
}
