interface Typed {
  type: string;
}

export class GenericChannel<
  TIncoming extends Typed,
  TOutgoing extends Typed,
> extends EventTarget {
  constructor(
    public socket: WebSocket,
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

    this.socket.addEventListener("error", (ev) => {
      console.error("GenericChannel WebSocket error", ev);
      this.dispatchEvent(new CustomEvent("error"));
    });

    this.socket.addEventListener("close", (ev) => {
      console.info("GenericChannel WebSocket close", ev);
      this.dispatchEvent(new CustomEvent("close"));
    });

    this.socket.addEventListener("message", (ev) => {
      this.dispatchRawMessage(ev.data);
    });
  }

  private dispatchRawMessage(raw: any): void {
    if (typeof raw !== "string") return;

    const msg = JSON.parse(raw);
    if (!this.isValidMessage(msg)) throw new Error("Received invalid message");

    // If you need additional logic (for example, ignoring messages until an ID is set), you can add it here.
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
