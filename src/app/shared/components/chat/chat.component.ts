import { Component, inject, signal, ChangeDetectionStrategy, SecurityContext } from '@angular/core';
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
  styles: [`
    :host {
      display: contents;
    }

    .chat-panel {
      box-shadow: -4px 0 24px rgba(0, 0, 0, 0.15);
    }

    .message-content {
      white-space: pre-wrap;
      word-break: break-all;
      overflow-wrap: break-word;
    }

    .message-content h1, .message-content h2, .message-content h3 {
      font-weight: 600;
      margin: 0.5rem 0;
    }

    .message-content h1 { font-size: 1.1rem; }
    .message-content h2 { font-size: 1rem; }
    .message-content h3 { font-size: 0.9rem; }

    .message-content p { margin: 0.25rem 0; }

    .message-content ul, .message-content ol {
      padding-left: 1.25rem;
      margin: 0.25rem 0;
    }

    .message-content li { margin: 0.125rem 0; }

    .message-content code {
      background: rgba(0,0,0,0.1);
      padding: 0.125rem 0.375rem;
      border-radius: 0.25rem;
      font-size: 0.85em;
    }

    .message-content pre {
      background: rgba(0,0,0,0.1);
      padding: 0.5rem;
      border-radius: 0.5rem;
      overflow-x: auto;
      margin: 0.5rem 0;
    }

    .message-content pre code {
      background: none;
      padding: 0;
    }

    .message-content strong { font-weight: 600; }

    .message-content a {
      color: var(--primary-500);
      text-decoration: underline;
    }

    .typing-indicator span {
      animation: typing 1.4s infinite;
      animation-fill-mode: both;
    }

    .typing-indicator span:nth-child(2) {
      animation-delay: 0.2s;
    }

    .typing-indicator span:nth-child(3) {
      animation-delay: 0.4s;
    }

    @keyframes typing {
      0%, 60%, 100% {
        transform: translateY(0);
      }
      30% {
        transform: translateY(-4px);
      }
    }

    .messages-container {
      scrollbar-width: thin;
      scrollbar-color: var(--primary-300) transparent;
    }

    .messages-container::-webkit-scrollbar {
      width: 6px;
    }

    .messages-container::-webkit-scrollbar-track {
      background: transparent;
    }

    .messages-container::-webkit-scrollbar-thumb {
      background-color: var(--primary-300);
      border-radius: 3px;
    }

    textarea {
      field-sizing: content;
      min-height: 40px;
      max-height: 120px;
      resize: none;
    }

    .glow-effect {
      animation: glow 2s ease-in-out infinite alternate;
    }

    @keyframes glow {
      from {
        box-shadow: 0 0 5px var(--primary-400), 0 0 10px var(--primary-300);
      }
      to {
        box-shadow: 0 0 10px var(--primary-500), 0 0 20px var(--primary-400);
      }
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
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

  private abortController: AbortController | null = null;

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

    const assistantMessageId = crypto.randomUUID();
    let assistantContent = '';

    const request: ChatRequest = {
      message: content,
      session_id: this.sessionId() || undefined,
    };

    this.abortController = new AbortController();

    await this.chatService.streamMessage(request, {
      onChunk: (chunk: string) => {
        assistantContent += chunk;
        this.messages.update(msgs => {
          const existing = msgs.find(m => m.id === assistantMessageId);
          if (existing) {
            return msgs.map(m =>
              m.id === assistantMessageId
                ? { ...m, content: assistantContent }
                : m
            );
          }
          return [
            ...msgs,
            {
              id: assistantMessageId,
              content: assistantContent,
              role: 'assistant' as const,
              timestamp: new Date(),
            },
          ];
        });
      },
      onDone: () => {
        this.loading.set(false);
        this.abortController = null;
      },
      onError: (err: Error) => {
        this.error.set(err.message || 'Error al conectar con el asistente');
        this.loading.set(false);
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
    const html = marked.parse(content) as string;
    return this.sanitizer.bypassSecurityTrustHtml(html);
  }

  trackByMessageId(index: number, message: ChatMessage): string {
    return message.id;
  }
}
