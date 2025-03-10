export type ClientMessage = IDMessage | ListPeersMessage;

export interface IDMessage {
  type: "id";
}

export interface ListPeersMessage {
  type: "ls-peers";
}

export type ServerMessage =
  | SetIDMessage
  | SetPeersMessage
  | AddPeerMessage
  | DeletePeerMessage;

export interface SetIDMessage {
  type: "set-id";
  id: string;
}

export interface SetPeersMessage {
  type: "set-peers";
  peers: string[];
}

export interface AddPeerMessage {
  type: "add-peer";
  peer: string;
}

export interface DeletePeerMessage {
  type: "delete-peer";
  peer: string;
}

function isChannelResponse(obj: any): obj is ServerMessage {
  return (
    obj !== null &&
    typeof obj === "object" &&
    ((obj.type === "set-id" && typeof obj.id === "string") ||
      (obj.type === "set-peers" &&
        Array.isArray(obj.peers) &&
        obj.peers.every((peer: any) => typeof peer === "string")) ||
      (obj.type === "add-peer" && typeof obj.peer === "string") ||
      (obj.type === "delete-peer" && typeof obj.peer === "string"))
  );
}

export class ChannelClient extends EventTarget {
  public ws: WebSocket;
  public id?: string;

  constructor() {
    super();

    this.ws = new WebSocket(window.location.origin + "/socket");
    this.registerWebSocketHandlers();

    this.addResponseHandler("set-id", (ev) => {
      this.id = ev.detail.id;
    });
  }

  private registerWebSocketHandlers(): void {
    this.ws.addEventListener("open", (ev) => {
      this.dispatchEvent(new CustomEvent("open"));
    });

    this.ws.addEventListener("error", (ev) => {
      console.error("Channel WebSocket error", ev);
      this.dispatchEvent(new CustomEvent("error"));
    });

    this.ws.addEventListener("close", (ev) => {
      console.info("Channel WebSocket close", ev);
      this.dispatchEvent(new CustomEvent("close"));
    });

    this.ws.addEventListener("message", (ev: MessageEvent) =>
      this.dispatchRawMessage(ev.data),
    );
  }

  private dispatchRawMessage(raw: any): void {
    if (typeof raw !== "string") return;

    const msg = JSON.parse(raw);
    if (!msg || !isChannelResponse(msg)) throw new Error("got invalid message");

    if (!this.id && msg.type !== "set-id") {
      console.warn("ignored message", msg);
      return;
    }

    this.dispatchEvent(new CustomEvent(msg.type, { detail: msg }));
  }

  public addResponseHandler<T extends ServerMessage["type"]>(
    type: T,
    handler: (ev: CustomEvent<Extract<ServerMessage, { type: T }>>) => void,
  ): void {
    this.addEventListener(type, (ev) =>
      handler(ev as CustomEvent<Extract<ServerMessage, { type: T }>>),
    );
  }

  public sendRequest(object: ClientMessage): void {
    this.ws.send(JSON.stringify(object));
  }
}
