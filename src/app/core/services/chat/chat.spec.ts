import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { Logging } from '../logging/logging';
import { Chat } from './chat';
import { ChatStreamCallbacks } from './chat.models';

function sseResponse(chunks: readonly string[]): Response {
  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(encoder.encode(chunk));
      }
      controller.close();
    },
  });
  return new Response(body, {
    status: 200,
    headers: { 'X-Request-ID': 'session-1' },
  });
}

describe('Chat stream parser', () => {
  function setup(): Chat {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [{ provide: Logging, useValue: { info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn() } }],
    });
    return TestBed.inject(Chat);
  }

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('forwards navigation events to onNavigate and keeps them out of the text', async () => {
    const chat = setup();
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve(
          sseResponse([
            'data: Te muestro\n\n',
            '[NAVIGATE] {"screen":"products","query":"Pizza","entity_id":null,"tab":null}\n\n',
            'data: los productos.\n\n',
            '[DONE] session-1\n\n',
          ]),
        ),
      ),
    );

    const chunks: string[] = [];
    const navigations: unknown[] = [];
    let doneSession: string | undefined;

    const callbacks: ChatStreamCallbacks = {
      onChunk: (chunk) => chunks.push(chunk),
      onNavigate: (action) => navigations.push(action),
      onError: (error) => {
        throw error;
      },
      onDone: (sessionId) => {
        doneSession = sessionId;
      },
    };

    await chat.streamMessage({ message: 'muéstrame productos' }, callbacks);

    expect(navigations).toEqual([
      { screen: 'products', query: 'Pizza', entity_id: null, tab: null },
    ]);
    expect(chunks).toEqual(['Te muestro', 'los productos.']);
    expect(doneSession).toBe('session-1');
  });

  it('ignores malformed navigation payloads', async () => {
    const chat = setup();
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(sseResponse(['[NAVIGATE] not-json\n\n', '[DONE]\n\n']))),
    );

    const onNavigate = vi.fn();
    const callbacks: ChatStreamCallbacks = {
      onChunk: vi.fn(),
      onNavigate,
      onError: (error) => {
        throw error;
      },
      onDone: vi.fn(),
    };

    await chat.streamMessage({ message: 'hola' }, callbacks);

    expect(onNavigate).not.toHaveBeenCalled();
  });

  it('forwards [PROCESS] events so the typing indicator can show them', async () => {
    const chat = setup();
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve(
          sseResponse(['[PROCESS] Consultando datos...\n\n', 'data: Listo\n\n', '[DONE]\n\n']),
        ),
      ),
    );

    const chunks: string[] = [];
    await chat.streamMessage(
      { message: 'ventas' },
      {
        onChunk: (chunk) => chunks.push(chunk),
        onError: (error) => {
          throw error;
        },
        onDone: vi.fn(),
      },
    );

    expect(chunks).toEqual(['[PROCESS] Consultando datos...', 'Listo']);
  });
});
