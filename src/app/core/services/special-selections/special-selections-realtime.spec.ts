import { TestBed } from '@angular/core/testing';
import { Observable, Subject } from 'rxjs';

import { Auth } from '@app/core/services/auth/auth';
import { WebSocket } from '@app/core/services/websocket/websocket';
import { SpecialSelectionWsPayload } from '@app/shared/models/dto/special-selections/special-selection-ws-payload';
import { environment } from '@environments/environment';

import { SpecialSelectionsRealtime } from './special-selections-realtime';

describe('SpecialSelectionsRealtime', () => {
  let source: Subject<SpecialSelectionWsPayload>;
  let sourceSubscriptions: number;
  let sourceUnsubscriptions: number;
  let connect: ReturnType<typeof vi.fn>;
  let subscribeToTopic: ReturnType<typeof vi.fn>;

  function configure(token: string | undefined): SpecialSelectionsRealtime {
    source = new Subject<SpecialSelectionWsPayload>();
    sourceSubscriptions = 0;
    sourceUnsubscriptions = 0;
    connect = vi.fn();
    subscribeToTopic = vi.fn().mockReturnValue(
      new Observable<SpecialSelectionWsPayload>((subscriber) => {
        sourceSubscriptions += 1;
        const subscription = source.subscribe(subscriber);
        return () => {
          sourceUnsubscriptions += 1;
          subscription.unsubscribe();
        };
      }),
    );

    TestBed.configureTestingModule({
      providers: [
        SpecialSelectionsRealtime,
        { provide: Auth, useValue: { getToken: vi.fn().mockReturnValue(token) } },
        {
          provide: WebSocket,
          useValue: { connect, subscribeToTopic },
        },
      ],
    });

    return TestBed.inject(SpecialSelectionsRealtime);
  }

  it('starts the singleton WebSocket connection and registers the special-selection topic', () => {
    configure('access-token');

    expect(connect).toHaveBeenCalledTimes(1);
    expect(connect).toHaveBeenCalledWith(environment.wsUrl, 'access-token');
    expect(subscribeToTopic).toHaveBeenCalledTimes(1);
    expect(subscribeToTopic).toHaveBeenCalledWith('/topic/special-selections/updated');
  });

  it('does not start an unauthenticated WebSocket connection', () => {
    configure(undefined);

    expect(connect).not.toHaveBeenCalled();
    expect(subscribeToTopic).toHaveBeenCalledTimes(1);
  });

  it('owns one connection request for repeated root injections', () => {
    const first = configure('access-token');
    const second = TestBed.inject(SpecialSelectionsRealtime);

    expect(second).toBe(first);
    expect(connect).toHaveBeenCalledTimes(1);
    expect(subscribeToTopic).toHaveBeenCalledTimes(1);
  });

  it('keeps one hot source subscription for multiple and later consumers', () => {
    const service = configure('access-token');
    const firstEvents: SpecialSelectionWsPayload[] = [];
    const secondEvents: SpecialSelectionWsPayload[] = [];
    const laterEvents: SpecialSelectionWsPayload[] = [];
    const event: SpecialSelectionWsPayload = {
      changeType: 'UPDATE',
      productId: 42,
      active: true,
      selection: null,
    };

    const first = service.updates$.subscribe((value) => { firstEvents.push(value); });
    const second = service.updates$.subscribe((value) => { secondEvents.push(value); });

    source.next(event);

    expect(sourceSubscriptions).toBe(1);
    expect(firstEvents).toEqual([event]);
    expect(secondEvents).toEqual([event]);

    first.unsubscribe();
    second.unsubscribe();

    expect(sourceUnsubscriptions).toBe(0);

    const later = service.updates$.subscribe((value) => { laterEvents.push(value); });
    source.next(event);

    expect(sourceSubscriptions).toBe(1);
    expect(laterEvents).toEqual([event]);

    later.unsubscribe();
  });
});
