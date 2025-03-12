import * as signaling from "../shared/signaling";

export class SignalingChannel extends signaling.GenericChannel<
  signaling.ServerMessage,
  signaling.ClientMessage
> {
  constructor(id: string) {
    const url = new URL(`/signaling`, window.location.origin);
    url.protocol = "ws";
    url.searchParams.set("id", id);

    const ws = new WebSocket(url);
    super(ws, signaling.isServerMessage);
  }
}
