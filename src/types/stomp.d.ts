declare module '@stomp/stompjs' {
  export type debugFnType = (msg: string) => void;
  export type messageCallbackType = (message: IMessage) => void;
  export type frameCallbackType = ((frame: IFrame) => void) | (() => void);
  export type closeEventCallbackType<T = any> = (evt: T) => void;
  export type wsErrorCallbackType<T = any> = (evt: T) => void;
  export type emptyCallbackType = () => void;

  export interface IMessage {
    body: string;
    headers?: Record<string, string>;
  }

  export interface IFrame {
    headers: Record<string, string>;
    body: string;
  }

  export interface StompConfig {
    brokerURL?: string;
    connectHeaders?: Record<string, string>;
    reconnectDelay?: number;
    heartbeatIncoming?: number;
    heartbeatOutgoing?: number;
    connectionTimeout?: number;
    debug?: debugFnType;
    onConnect?: frameCallbackType;
    onStompError?: frameCallbackType;
    onWebSocketError?: wsErrorCallbackType;
    onWebSocketClose?: closeEventCallbackType;
    onDisconnect?: frameCallbackType;
    [key: string]: any;
  }

  export class Client {
    brokerURL?: string;
    connectHeaders?: Record<string, string>;
    reconnectDelay?: number;
    heartbeatIncoming?: number;
    heartbeatOutgoing?: number;
    connectionTimeout?: number;
    active: boolean;
    onConnect?: frameCallbackType;
    onStompError?: frameCallbackType;
    onWebSocketError?: wsErrorCallbackType;
    onWebSocketClose?: closeEventCallbackType;
    onDisconnect?: frameCallbackType;
    debug?: debugFnType;
    constructor(conf?: StompConfig);
    activate(): void;
    deactivate(): void;
    subscribe(destination: string, callback: messageCallbackType): StompSubscription;
  }

  export interface StompSubscription {
    id: string;
    unsubscribe(): void;
  }
}
