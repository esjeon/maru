export class JSONErrorEvent extends CustomEvent<Error> {
  constructor(
    public base: MessageEvent,
    public error: Error,
  ) {
    super("jsonError", {
      bubbles: base.bubbles,
      cancelable: base.cancelable,
      composed: base.composed,
    });
  }
}

export class JSONMessageEvent extends CustomEvent<any> {
  constructor(
    public base: MessageEvent,
    public object: any,
  ) {
    super("jsonMessage", {
      bubbles: base.bubbles,
      cancelable: base.cancelable,
      composed: base.composed,
    });
  }
}

export interface JSONWebSocketEventMap extends WebSocketEventMap {
  jsonMessage: JSONMessageEvent;
  jsonError: JSONErrorEvent;
}

export class JSONWebSocket extends WebSocket {
  constructor(url: string | URL, protocols?: string | string[]) {
    super(url, protocols);

    this.addEventListener("message", (ev: MessageEvent<string>) => {
      let object;
      try {
        object = JSON.parse(ev.data);
      } catch (err) {
        const surelyErr =
          err instanceof Error ? err : new Error(`unknown error: ${err}`);
        this.dispatchEvent(new JSONErrorEvent(ev, surelyErr));
        return;
      }

      this.dispatchEvent(new JSONMessageEvent(ev, object));
    });
  }

  public sendJSON(object: any) {
    this.send(JSON.stringify(object));
  }

  //#region Overloading type signatures
  // XXX: The following definitions are necessary to inject extra overloading type signatures.

  addEventListener<K extends keyof JSONWebSocketEventMap>(
    type: K,
    listener: (this: JSONWebSocket, ev: JSONWebSocketEventMap[K]) => any,
    options?: boolean | AddEventListenerOptions,
  ): void;
  addEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject,
    options?: boolean | AddEventListenerOptions,
  ): void {
    return super.addEventListener(type, listener, options);
  }

  removeEventListener<K extends keyof JSONWebSocketEventMap>(
    type: K,
    listener: (this: JSONWebSocket, ev: JSONWebSocketEventMap[K]) => any,
    options?: boolean | EventListenerOptions,
  ): void;
  removeEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject,
    options?: boolean | EventListenerOptions,
  ): void {
    return super.removeEventListener(type, listener, options);
  }

  //#endregion
}
