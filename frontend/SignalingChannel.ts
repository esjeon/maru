import * as signaling from "../shared/signaling";

export class SignalingChannel extends signaling.GenericChannel<
  signaling.ServerMessage,
  signaling.ClientMessage
> {
  constructor(public id: string) {
    const ws = new WebSocket(window.location.origin + `/signaling?id=${id}`);
    super(ws, signaling.isServerMessage);
  }
}
