export * as messages from "./channel_messages";

interface Typed {
  type: string;
}

// Define a unified WebSocket interface
export interface ICustomWebSocket extends EventTarget {
  send(data: string): void;
}

export class GenericChannel<
  TIncoming extends Typed,
  TOutgoing extends Typed,
> extends EventTarget {
  constructor(
    public socket: ICustomWebSocket,
    private isValidMessage: (obj: any) => obj is TIncoming,
    public id?: string,
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
      this.dispatchRawMessage(ev.detail ?? ev.data);
    });
  }

  private dispatchRawMessage(raw: any): void {
    const msg = JSON.parse(raw.toString());
    if (!this.isValidMessage(msg)) throw new Error("Received invalid message");

    this.dispatchEvent(new CustomEvent(msg.type, { detail: msg }));
  }

  public addMessageHandler<T extends TIncoming["type"]>(
    type: T,
    handler: (ev: CustomEvent<Extract<TIncoming, { type: T }>>) => void,
  ): void {
    this.addEventListener(type, (ev) =>
      handler(ev as CustomEvent<Extract<TIncoming, { type: T }>>),
    );
  }

  public sendMessage(message: TOutgoing): void {
    this.socket.send(JSON.stringify(message));
  }
}
