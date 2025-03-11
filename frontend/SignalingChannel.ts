import * as signaling from "../shared/signaling";

export class SignalingChannel extends signaling.GenericChannel<
  signaling.ServerMessage,
  signaling.ClientMessage
> {
  constructor(
    ws: WebSocket,
    public id?: string,
  ) {
    super(ws, signaling.isServerMessage, id);
  }
}
