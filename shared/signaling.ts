import * as messages from "./signaling_messages";

export type Message = messages.Message;
export type ClientMessage = messages.ClientMessage;
export type ServerMessage = messages.ServerMessage;
export const isClientMessage = messages.isClientMessage;
export const isServerMessage = messages.isServerMessage;

type StringKeys<T> = Extract<keyof T, string>;

// Define a unified WebSocket interface
export interface ICustomWebSocket extends EventTarget {
  send(data: string): void;
}

export class GenericChannel<
  IncomingMessage,
  OutgoingMessage,
> extends EventTarget {
  constructor(
    public socket: ICustomWebSocket,
    private isValidMessage: (obj: any) => obj is IncomingMessage,
  ) {
    super();
    this.registerWebSocketHandlers();
  }

  private registerWebSocketHandlers(): void {
    this.socket.addEventListener("open", () => {
      this.dispatchEvent(new CustomEvent("open"));
    });

    this.socket.addEventListener("error", (ev: Event) => {
      console.error("GenericChannel WebSocket error", ev);
      this.dispatchEvent(new CustomEvent("error"));
    });

    this.socket.addEventListener("close", (ev: Event) => {
      console.info("GenericChannel WebSocket close", ev);
      this.dispatchEvent(new CustomEvent("close"));
    });

    // For Node adapter, our adapter will forward data in ev.detail
    this.socket.addEventListener("message", (ev: any) => {
      try {
        this.dispatchRawMessage(ev.detail ?? ev.data);
      } catch (err) {
        console.error("GenericChannel message error", err);
      }
    });
  }

  private dispatchRawMessage(raw: any): void {
    const msg = JSON.parse(raw.toString());
    if (!this.isValidMessage(msg)) throw new Error("invalid message");

    for (const key in msg) {
      if (msg[key] !== undefined) {
        console.debug(`GenericChannel dispatch ${key}`, msg[key]);
        this.dispatchEvent(new CustomEvent(key, { detail: msg[key] }));
      }
    }
  }

  public addMessageHandler<T extends StringKeys<IncomingMessage>>(
    type: T,
    handler: (ev: CustomEvent<NonNullable<IncomingMessage[T]>>) => void,
  ): void {
    this.addEventListener(type, (ev) =>
      handler(ev as CustomEvent<NonNullable<IncomingMessage[T]>>),
    );
  }

  public sendMessage(message: OutgoingMessage): void {
    this.socket.send(JSON.stringify(message));
  }
}
