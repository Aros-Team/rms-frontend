declare module '@stomp/stompjs' {
  export class Client {
    brokerURL?: string;
    connectHeaders?: Record<string, string>;
    reconnectDelay?: number;
    heartbeatIncoming?: number;
    heartbeatOutgoing?: number;
    connectionTimeout?: number;
    active: boolean;
    onConnect?: (frame: Frame) => void;
    onStompError?: (frame: Frame) => void;
    onWebSocketError?: (event: Event) => void;
    onWebSocketClose?: (event: CloseEvent) => void;
    onDisconnect?: () => void;
    debug?: (str: string) => void;
    activate(): void;
    deactivate(): void;
    subscribe(destination: string, callback: (message: Message) => void): StompSubscription;
  }

  export interface Frame {
    headers: Record<string, string>;
    body: string;
  }

  export interface Message {
    body: string;
    headers?: Record<string, string>;
  }

  export interface StompSubscription {
    id: string;
    unsubscribe(): void;
  }
}
