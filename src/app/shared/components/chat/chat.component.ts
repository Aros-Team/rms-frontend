import { Component, inject, signal, ChangeDetectionStrategy, OnDestroy, AfterViewChecked, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import { ChatService } from '@app/core/services/chat/chat-service';
import { ChatMessage, ChatRequest } from '@app/core/services/chat/chat.models';

@Component({
  selector: 'app-chat',
  imports: [CommonModule, FormsModule],
  templateUrl: './chat.component.html',
  styleUrl: './chat.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChatComponent implements OnDestroy, AfterViewChecked {
  @ViewChild('messagesContainer') messagesContainer!: ElementRef;
  private scrollInitialized = false;

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
    const panel = document.querySelector('.chat-panel') as HTMLElement;
    if (panel) {
      panel.addEventListener('transitionend', () => {
        const input = panel.querySelector('textarea') as HTMLTextAreaElement;
        input?.focus();
      }, { once: true });
    }
  }

  closeChat(): void {
    this.isOpen.set(false);
  }

  ngOnDestroy(): void {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
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
    setTimeout(() => this.scrollToBottom(), 50);
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

    console.log('>>> REQUEST:', JSON.stringify(request, null, 2));

    this.abortController = new AbortController();

    await this.chatService.streamMessage(request, {
      onChunk: (chunk: string) => {
        // console.log('chunk:', chunk.substring(0, 50));
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

        const filteredContent = this.filterDisplayContent(displayContent);
        this.messages.update(msgs => {
          const existing = msgs.find(m => m.id === assistantMessageId);
          if (existing) {
            return msgs.map(m =>
              m.id === assistantMessageId
                ? { ...m, content: filteredContent }
                : m
            );
          }
          return [
            ...msgs,
            {
              id: assistantMessageId,
              content: filteredContent,
              role: 'assistant' as const,
              timestamp: new Date(),
            },
          ];
        });
        this.scrollToBottom();
      },
      onDone: (sessionId?: string, requestId?: string) => {
        void requestId; // intentionally unused - kept for interface compliance
        console.log('>>> onDone sessionId:', sessionId, 'requestId:', requestId);
        console.log('>>> this.sessionId is now:', this.sessionId());
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

  ngAfterViewChecked(): void {
    if (!this.scrollInitialized && this.messagesContainer) {
      this.scrollToBottom();
      this.scrollInitialized = true;
    }
  }

  scrollToBottom(): void {
    const container = document.querySelector('.messages-container');
    if (container) {
      container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' });
    }
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
    const clean = DOMPurify.sanitize(html);
    return this.sanitizer.bypassSecurityTrustHtml(clean);
  }

  private preprocessMarkdown(text: string): string {
    return text.replace(/\\n/g, '\n');
  }

  private filterDisplayContent(text: string): string {
    return text
      .replace(/\[TOOL_CALL\]/gi, '')
      .replace(/\[TOOL_RESULT\]/gi, '')
      .replace(/\[PROCESS\]/gi, '')
      .replace(/\[DONE\]/gi, '')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  trackByMessageId(index: number, message: ChatMessage): string {
    return message.id;
  }
}
