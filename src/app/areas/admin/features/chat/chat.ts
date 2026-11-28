import {
  Component,
  ElementRef,
  inject,
  signal,
  afterNextRender,
  effect,
  ChangeDetectionStrategy,
  OnDestroy,
  AfterViewChecked,
  AfterViewInit,
  Output,
  EventEmitter,
  ViewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import { Chat as ChatApi } from '@app/core/services/chat/chat';
import { ChatMessage, ChatNavigation, ChatRequest } from '@app/core/services/chat/chat.models';
import { AgentNavigation, resolveAgentNavigation } from '@app/core/services/chat/chat-navigation';
import { Logging } from '@app/core/services/logging/logging';
import { RmsButton } from '@app/shared/ui/button/button';
import { RmsIconButton } from '@app/shared/ui/icon-button/icon-button';
import { DialogModule } from 'primeng/dialog';

@Component({
  selector: 'app-chat',
  imports: [CommonModule, FormsModule, RmsButton, RmsIconButton, DialogModule],
  templateUrl: './chat.html',
  styleUrl: './chat.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Chat implements OnDestroy, AfterViewChecked, AfterViewInit {
  @Output() closed = new EventEmitter<void>();
  @ViewChild('messagesContainer') messagesContainer?: ElementRef<HTMLElement>;
  @ViewChild('messageInput') messageInput?: ElementRef<HTMLTextAreaElement>;
  private scrollInitialized = false;
  /** How close to the bottom (px) still counts as "following the stream". */
  private static readonly AUTO_SCROLL_THRESHOLD = 48;
  private scrollFrame: number | null = null;
  private overflowFrame: number | null = null;
  private resizeObserver?: ResizeObserver;

  private chatService = inject(ChatApi);
  private sanitizer = inject(DomSanitizer);
  private logger = inject(Logging);
  private agentNavigation = inject(AgentNavigation);

  messages = signal<ChatMessage[]>([]);
  currentMessage = signal('');
  loading = signal(false);
  error = signal<string | null>(null);
  sessionId = signal<string | null>(null);
  copySuccess = signal(false);
  isToolCallActive = signal(false);
  processMessage = signal('');
  /** True once the first text chunk arrived (distinguishes "thinking" from "writing"). */
  hasStartedStreaming = signal(false);
  /** User asked to reveal the rest of the answer without pacing. */
  revealAll = signal(false);
  /** The assistant message currently being streamed, if any. */
  streamingMessageId = signal<string | null>(null);
  /** Last answer that finished generating, for the "Completa" marker. */
  lastCompletedId = signal<string | null>(null);
  /** Last user message, kept so the failed stream can be retried with one click. */
  lastUserMessage = signal<string | null>(null);
  /** True while the user is reading at the bottom; false once they scroll up. */
  autoScroll = signal(true);
  /** Assistant message opened in the full-size reader. */
  expandedMessage = signal<ChatMessage | null>(null);
  /** Messages whose content overflows horizontally, so they offer expansion. */
  overflowingMessageIds = signal<ReadonlySet<string>>(new Set());
  /** False during the panel open transition; content is revealed afterwards. */
  contentReady = signal(false);

  private abortController: AbortController | null = null;
  /** Flushes the buffered stream immediately ("Mostrar todo"). */
  private flushStreamNow: (() => void) | null = null;
  /** Reveal cadence: batching tokens into ~16 readable updates per second. */
  private static readonly STREAM_FLUSH_MS = 60;
  /** Matches the sidebar width transition so content appears after it settles. */
  private static readonly PANEL_TRANSITION_MS = 300;
  /** Conversation persistence: survives a reload and resumes the ABI session. */
  private static readonly STORAGE_KEY = 'rms.assistant.conversation.v1';
  private static readonly MAX_STORED_MESSAGES = 80;
  private persistTimer: ReturnType<typeof setTimeout> | null = null;
  private revealTimer: ReturnType<typeof setTimeout> | null = null;
  private observedContainer: HTMLElement | null = null;

  constructor() {
    marked.setOptions({
      gfm: true,
      breaks: true,
    });

    this.restoreConversation();

    // Persist on every content or session change, debounced so streaming does
    // not hit localStorage once per flush.
    effect(() => {
      this.messages();
      this.sessionId();
      this.schedulePersist();
    });

    // The assistant is lazily created when the panel opens. The content waits
    // for the 300 ms rail transition so tables and widths settle before the
    // first render, instead of reflowing while the panel grows.
    afterNextRender(() => {
      const reduceMotion =
        typeof window !== 'undefined' &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      this.revealTimer = setTimeout(
        () => {
          this.revealTimer = null;
          this.contentReady.set(true);
        },
        reduceMotion ? 0 : Chat.PANEL_TRANSITION_MS,
      );
    });
  }

  closeChat(): void {
    this.closed.emit();
  }

  ngOnDestroy(): void {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
    if (this.scrollFrame !== null) {
      cancelAnimationFrame(this.scrollFrame);
      this.scrollFrame = null;
    }
    if (this.overflowFrame !== null) {
      cancelAnimationFrame(this.overflowFrame);
      this.overflowFrame = null;
    }
    if (this.revealTimer !== null) {
      clearTimeout(this.revealTimer);
      this.revealTimer = null;
    }
    if (this.persistTimer !== null) {
      clearTimeout(this.persistTimer);
      this.persistTimer = null;
      this.persistConversation();
    }
    this.resizeObserver?.disconnect();
  }

  ngAfterViewInit(): void {
    this.tryAttachObserver();
    this.scheduleOverflowMeasure();
  }

  handleKeydown(event: Event): void {
    const keyEvent = event as KeyboardEvent;
    if (keyEvent.key === 'Enter' && !keyEvent.shiftKey) {
      event.preventDefault();
      void this.sendMessage();
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

    this.messages.update((msgs) => [...msgs, userMessage]);
    this.lastUserMessage.set(content);
    setTimeout(() => {
      this.scrollToBottom(true);
    }, 50);
    this.currentMessage.set('');
    this.loading.set(true);
    this.error.set(null);
    this.processMessage.set('');
    this.hasStartedStreaming.set(false);
    this.revealAll.set(false);
    this.lastCompletedId.set(null);

    const assistantMessageId = crypto.randomUUID();
    this.streamingMessageId.set(assistantMessageId);
    let assistantContent = '';
    let flushTimer: number | null = null;

    const applyContent = (): void => {
      const filteredContent = this.filterDisplayContent(assistantContent);
      this.messages.update((msgs) => {
        const existing = msgs.find((m) => m.id === assistantMessageId);
        if (existing) {
          return msgs.map((m) =>
            m.id === assistantMessageId ? { ...m, content: filteredContent } : m,
          );
        }
        if (!filteredContent) {
          return msgs;
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
    };

    const clearFlush = (): void => {
      if (flushTimer !== null) {
        clearTimeout(flushTimer);
        flushTimer = null;
      }
    };

    const flushNow = (): void => {
      clearFlush();
      applyContent();
      this.scrollToBottom();
    };

    // Pacing: the model streams tokens, but the UI commits grouped updates at a
    // readable cadence instead of re-rendering on every token.
    const scheduleFlush = (): void => {
      if (this.revealAll()) {
        flushNow();
        return;
      }
      if (flushTimer !== null) {
        return;
      }
      flushTimer = window.setTimeout(() => {
        flushTimer = null;
        applyContent();
        this.scrollToBottom();
      }, Chat.STREAM_FLUSH_MS);
    };

    this.flushStreamNow = flushNow;

    const request: ChatRequest = {
      message: content,
      session_id: this.sessionId() ?? undefined,
    };

    this.logger.debug('Chat: Sending request', request);

    this.abortController = new AbortController();

    await this.chatService.streamMessage(request, {
      onChunk: (chunk: string) => {
        if (chunk.startsWith('[PROCESS]')) {
          this.processMessage.set(chunk.slice(9).trim());
          return;
        }
        if (chunk.startsWith('[TOOL_CALL]')) {
          this.isToolCallActive.set(true);
          return;
        }
        if (chunk.startsWith('[TOOL_RESULT]')) {
          return;
        }
        if (chunk.startsWith('[NAVIGATE]') || chunk.startsWith('[DONE]')) {
          // Navigation is parsed by the stream service; nothing to render.
          return;
        }
        if (chunk.startsWith('[ERROR]')) {
          clearFlush();
          this.error.set(chunk.slice(7).trim() || 'Error al conectar con el asistente');
          this.loading.set(false);
          this.isToolCallActive.set(false);
          this.processMessage.set('');
          this.streamingMessageId.set(null);
          this.flushStreamNow = null;
          this.abortController = null;
          return;
        }

        if (!this.hasStartedStreaming()) {
          this.hasStartedStreaming.set(true);
          this.isToolCallActive.set(false);
          this.processMessage.set('');
        }
        assistantContent += chunk;
        scheduleFlush();
      },
      onDone: (sessionId?: string, requestId?: string) => {
        void requestId; // intentionally unused - kept for interface compliance
        this.logger.debug('Chat: Stream done', { sessionId, requestId });
        flushNow();
        this.loading.set(false);
        this.isToolCallActive.set(false);
        this.processMessage.set('');
        this.streamingMessageId.set(null);
        this.flushStreamNow = null;
        this.abortController = null;
        if (assistantContent.trim()) {
          this.lastCompletedId.set(assistantMessageId);
        }
        if (sessionId) {
          this.sessionId.set(sessionId);
        }
      },
      onError: (err: Error) => {
        clearFlush();
        this.error.set(err.message || 'Error al conectar con el asistente');
        this.loading.set(false);
        this.isToolCallActive.set(false);
        this.processMessage.set('');
        this.streamingMessageId.set(null);
        this.flushStreamNow = null;
        this.abortController = null;
      },
      onNavigate: (action: ChatNavigation) => {
        void this.goToScreen(action);
      },
    });
  }

  /** Reveals the buffered answer immediately and disables pacing for this turn. */
  showAll(): void {
    this.revealAll.set(true);
    this.flushStreamNow?.();
  }

  /** Human-readable state shown next to the typing indicator. */
  statusLabel(): string {
    if (this.processMessage()) {
      return this.processMessage();
    }
    if (this.isToolCallActive()) {
      return 'Ejecutando acción...';
    }
    if (this.hasStartedStreaming()) {
      return 'Generando respuesta...';
    }
    return 'Pensando...';
  }

  /**
   * Moves the interface to the screen requested by the assistant.
   *
   * The navigation happens immediately (that is the point of the feature) and
   * records an inline card in the conversation so the user can jump back.
   */
  async goToScreen(action: ChatNavigation): Promise<void> {
    const label = resolveAgentNavigation(action)?.label;
    if (!label) {
      this.logger.warn('Chat: unknown assistant screen', { screen: action.screen });
      return;
    }
    const navigated = await this.agentNavigation.navigate(action);
    if (navigated) {
      this.appendNavigationMessage(navigated, action);
    }
  }

  /** Adds the inline "Abriendo X" card, avoiding duplicates in a row. */
  private appendNavigationMessage(label: string, action: ChatNavigation): void {
    this.messages.update((messages) => {
      if (messages.length > 0) {
        const last = messages[messages.length - 1];
        if (last.kind === 'navigation' && last.navigationLabel === label) {
          return messages;
        }
      }
      return [
        ...messages,
        {
          id: crypto.randomUUID(),
          content: '',
          role: 'assistant',
          kind: 'navigation',
          navigation: action,
          navigationLabel: label,
          timestamp: new Date(),
        },
      ];
    });
    this.scrollToBottom();
  }

  navigateAgain(action: ChatNavigation): void {
    void this.goToScreen(action);
  }

  expandMessage(message: ChatMessage): void {
    this.expandedMessage.set(message);
  }

  closeExpandedMessage(): void {
    this.expandedMessage.set(null);
  }

  cancelStream(): void {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
    this.loading.set(false);
  }

  /**
   * Re-sends the last user message after a stream failure.
   *
   * Removes the failed turn (and any empty assistant placeholder) first, so the
   * conversation does not keep duplicated bubbles.
   */
  retryMessage(): void {
    const message = this.lastUserMessage();
    if (!message || this.loading()) {
      return;
    }
    this.messages.update((messages) => {
      const copy = [...messages];
      if (copy.length > 0) {
        const last = copy[copy.length - 1];
        if (last.role === 'assistant' && !last.content.trim()) {
          copy.pop();
        }
      }
      if (copy.length > 0) {
        const previous = copy[copy.length - 1];
        if (previous.role === 'user' && previous.content === message) {
          copy.pop();
        }
      }
      return copy;
    });
    this.error.set(null);
    this.currentMessage.set(message);
    void this.sendMessage();
  }

  ngAfterViewChecked(): void {
    if (this.contentReady() && !this.scrollInitialized && this.messagesContainer) {
      this.scrollToBottom(true);
      this.scrollInitialized = true;
      // Composer now exists: focus it so the user can type right away.
      this.messageInput?.nativeElement.focus({ preventScroll: true });
    }
    this.tryAttachObserver();
    this.scheduleOverflowMeasure();
  }

  /** Observes the message container once it is mounted (after the reveal delay). */
  private tryAttachObserver(): void {
    const element = this.messagesContainer?.nativeElement;
    if (!element || element === this.observedContainer) {
      return;
    }
    this.observedContainer = element;
    this.resizeObserver?.disconnect();
    if (typeof ResizeObserver === 'undefined') {
      return;
    }
    this.resizeObserver = new ResizeObserver(() => {
      this.scheduleOverflowMeasure();
    });
    this.resizeObserver.observe(element);
  }

  /** True only when the message has content wider than the bubble. */
  isExpandable(message: ChatMessage): boolean {
    return this.overflowingMessageIds().has(message.id);
  }

  /**
   * Measures the rendered messages after paint and records which ones overflow.
   *
   * Expand is offered only for those: a normal answer that fits the bubble does
   * not need a full-size reader. Coalesced with `requestAnimationFrame` so
   * streaming does not trigger one measurement per token.
   */
  private scheduleOverflowMeasure(): void {
    if (this.overflowFrame !== null) {
      return;
    }
    this.overflowFrame = requestAnimationFrame(() => {
      this.overflowFrame = null;
      this.measureOverflow();
    });
  }

  private measureOverflow(): void {
    const container = this.messagesContainer?.nativeElement;
    if (!container) {
      return;
    }
    const next = new Set<string>();
    for (const bubble of Array.from(container.querySelectorAll<HTMLElement>('[data-message-id]'))) {
      const id = bubble.dataset['messageId'];
      if (!id) {
        continue;
      }
      const overflows = Array.from(bubble.querySelectorAll<HTMLElement>('.chat-table, pre')).some(
        (node) => node.scrollWidth > node.clientWidth + 1,
      );
      if (overflows) {
        next.add(id);
      }
    }

    const current = this.overflowingMessageIds();
    const changed = next.size !== current.size || [...next].some((id) => !current.has(id));
    if (changed) {
      this.overflowingMessageIds.set(next);
    }
  }

  /**
   * Keeps track of whether the user is following the stream.
   *
   * Scrolling up pauses auto-scroll so the answer does not run away while the
   * user is reading; coming back to the bottom resumes it.
   */
  onMessagesScroll(): void {
    const element = this.messagesContainer?.nativeElement;
    if (!element) {
      return;
    }
    const distanceToBottom = element.scrollHeight - element.scrollTop - element.clientHeight;
    this.autoScroll.set(distanceToBottom <= Chat.AUTO_SCROLL_THRESHOLD);
  }

  /**
   * Scrolls to the latest message.
   *
   * @param force jump even if the user scrolled up (own message, "Ir al final").
   */
  scrollToBottom(force = false): void {
    if (!force && !this.autoScroll()) {
      return;
    }
    if (force) {
      this.autoScroll.set(true);
    }
    if (this.scrollFrame !== null) {
      return;
    }
    // Instant scroll (no `smooth`): animated scrolling restarts on every token
    // and makes the answer impossible to read.
    this.scrollFrame = requestAnimationFrame(() => {
      this.scrollFrame = null;
      const element = this.messagesContainer?.nativeElement;
      if (element) {
        element.scrollTop = element.scrollHeight;
      }
    });
  }

  jumpToBottom(): void {
    this.scrollToBottom(true);
  }

  clearChat(): void {
    this.messages.set([]);
    this.sessionId.set(null);
    this.error.set(null);
    this.lastUserMessage.set(null);
    this.lastCompletedId.set(null);
    this.streamingMessageId.set(null);
    this.hasStartedStreaming.set(false);
    this.revealAll.set(false);
    this.processMessage.set('');
    this.isToolCallActive.set(false);
    this.clearStoredConversation();
  }

  /** Restores the persisted conversation so a reload continues where it was. */
  private restoreConversation(): void {
    if (typeof localStorage === 'undefined') {
      return;
    }
    try {
      const raw = localStorage.getItem(Chat.STORAGE_KEY);
      if (!raw) {
        return;
      }
      const parsed: unknown = JSON.parse(raw);
      if (typeof parsed !== 'object' || parsed === null) {
        return;
      }
      const record = parsed as Record<string, unknown>;
      const storedMessages = Array.isArray(record['messages']) ? record['messages'] : [];
      const messages: ChatMessage[] = [];
      for (const item of storedMessages) {
        const message = this.toChatMessage(item);
        if (message) {
          messages.push(message);
        }
      }
      if (messages.length > 0) {
        this.messages.set(messages);
        this.autoScroll.set(true);
      }
      const storedSession = record['sessionId'];
      if (typeof storedSession === 'string' && storedSession) {
        this.sessionId.set(storedSession);
      }

      for (let index = messages.length - 1; index >= 0; index--) {
        const message = messages[index];
        if (message.kind === 'navigation') {
          continue;
        }
        this.lastCompletedId.set(message.id);
        break;
      }
      for (let index = messages.length - 1; index >= 0; index--) {
        const message = messages[index];
        if (message.role === 'user') {
          this.lastUserMessage.set(message.content);
          break;
        }
      }
    } catch {
      this.clearStoredConversation();
    }
  }

  /** Validates one persisted entry; older or corrupted shapes are dropped. */
  private toChatMessage(value: unknown): ChatMessage | null {
    if (typeof value !== 'object' || value === null) {
      return null;
    }
    const raw = value as Record<string, unknown>;
    const role = raw['role'];
    if (
      typeof raw['id'] !== 'string' ||
      typeof raw['content'] !== 'string' ||
      (role !== 'user' && role !== 'assistant')
    ) {
      return null;
    }
    const parsedDate =
      typeof raw['timestamp'] === 'string' ? new Date(raw['timestamp']) : new Date();
    const timestamp = Number.isNaN(parsedDate.getTime()) ? new Date() : parsedDate;
    const message: ChatMessage = {
      id: raw['id'],
      content: raw['content'],
      role,
      timestamp,
    };
    if (raw['kind'] === 'navigation') {
      message.kind = 'navigation';
    }
    if (raw['navigation'] && typeof raw['navigation'] === 'object') {
      message.navigation = raw['navigation'] as ChatNavigation;
    }
    if (typeof raw['navigationLabel'] === 'string') {
      message.navigationLabel = raw['navigationLabel'];
    }
    return message;
  }

  private schedulePersist(): void {
    if (this.persistTimer !== null) {
      return;
    }
    this.persistTimer = setTimeout(() => {
      this.persistTimer = null;
      this.persistConversation();
    }, 300);
  }

  private persistConversation(): void {
    if (typeof localStorage === 'undefined') {
      return;
    }
    try {
      const messages = this.messages()
        .slice(-Chat.MAX_STORED_MESSAGES)
        .map((message) => ({ ...message, timestamp: message.timestamp.toISOString() }));
      localStorage.setItem(
        Chat.STORAGE_KEY,
        JSON.stringify({ messages, sessionId: this.sessionId() }),
      );
    } catch {
      // Storage disabled or full: the in-memory conversation still works.
    }
  }

  private clearStoredConversation(): void {
    if (typeof localStorage === 'undefined') {
      return;
    }
    try {
      localStorage.removeItem(Chat.STORAGE_KEY);
    } catch {
      // Storage disabled: nothing to clear.
    }
  }

  copyMessage(content: string): void {
    void navigator.clipboard.writeText(content).then(() => {
      this.copySuccess.set(true);
      setTimeout(() => {
        this.copySuccess.set(false);
      }, 2000);
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
    return this.sanitizer.bypassSecurityTrustHtml(this.wrapTables(clean));
  }

  /**
   * Wraps every markdown table in a scroll container.
   *
   * The wrapper is what allows the bubble to stay readable while the table
   * scrolls horizontally; the full-size reader shows it without scrolling.
   */
  private wrapTables(html: string): string {
    if (typeof DOMParser === 'undefined') {
      return html;
    }
    const doc = new DOMParser().parseFromString(html, 'text/html');
    for (const table of Array.from(doc.querySelectorAll('table'))) {
      const wrapper = doc.createElement('div');
      wrapper.className = 'chat-table';
      table.parentNode?.insertBefore(wrapper, table);
      wrapper.appendChild(table);
    }
    return doc.body.innerHTML;
  }

  private preprocessMarkdown(text: string): string {
    return text.replace(/\\n/g, '\n');
  }

  private filterDisplayContent(text: string): string {
    return text
      .replace(/\[TOOL_CALL\]/gi, '')
      .replace(/\[TOOL_RESULT\]/gi, '')
      .replace(/\[PROCESS\]/gi, '')
      .replace(/\[NAVIGATE\]/gi, '')
      .replace(/\[DONE\]/gi, '')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  trackByMessageId(index: number, message: ChatMessage): string {
    return message.id;
  }
}
