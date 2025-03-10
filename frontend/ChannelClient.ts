import { JSONWebSocket } from "./JSONWebSocket";

interface ChannelMessage {
  type: string;
  target: string | null;
  data: any;
}

function isChannelMessage(obj: any): obj is ChannelMessage {
  return (
    obj.type &&
    typeof obj.type === "string" &&
    (obj.target === null || typeof obj.target === "string")
  );
}

export class ChannelClient {
  public ws: JSONWebSocket;
  public id: string | null;
  public peerIds: string[];

  constructor() {
    const ws = new JSONWebSocket(window.location.origin + "/socket");
    this.ws = ws;
    this.id = null;
    this.peerIds = [];

    ws.addEventListener("open", (ev) => {
      this.ws.sendJSON({ type: "hello", target: null });
    });

    ws.addEventListener("jsonMessage", (ev) => {
      const msg = ev.object as ChannelMessage;
      if (!isChannelMessage(msg)) return console.warn(`invalid message`, msg);

      // if my ID is not set, accept only `setID` message.
      if (this.id === null) {
        if (msg.type === "setID") {
          console.assert(msg.target !== null);
          this.id = msg.target as string;
        }
        return;
      }

      // ignore message not for me.
      if (msg.target !== this.id) return;

      if (msg.type === "setPeers") {
        this.peerIds = msg.data;
      } else {
        console.warn(`unknown message type: ${msg.type}`, msg);
      }
    });
  }
}
