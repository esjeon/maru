export interface Message {
  /** Tell client its ID */
  identity?: string;

  /** Share the list of current peers */
  peers?: string[];

  addPeer?: string;
  delPeer?: string;

  rtcOffer?: any;
  rtcAnswer?: any;

  // TODO: client authentication
  //auth?: any;
}

export type ClientMessage = Pick<Message, "rtcOffer" | "rtcAnswer">;

export type ServerMessage = Pick<
  Message,
  "identity" | "peers" | "addPeer" | "delPeer" | "rtcOffer" | "rtcAnswer"
>;

export function isClientMessage(obj: any): obj is ClientMessage {
  // Must be an object and not null.
  if (typeof obj !== "object" || obj === null) return false;

  return true;
}

export function isServerMessage(obj: any): obj is ServerMessage {
  // Must be an object and not null.
  if (typeof obj !== "object" || obj === null) return false;

  // Check type of identity if present.
  if (obj.identity !== undefined && typeof obj.identity !== "string")
    return false;

  // Check type of peers if present.
  if (obj.peers !== undefined) {
    if (!Array.isArray(obj.peers)) return false;
    // Check that every element in the peers array is a string.
    for (let i = 0; i < obj.peers.length; i++) {
      if (typeof obj.peers[i] !== "string") return false;
    }
  }

  // Check type of addPeer if present.
  if (obj.addPeer !== undefined && typeof obj.addPeer !== "string")
    return false;

  // Check type of delPeer if present.
  if (obj.delPeer !== undefined && typeof obj.delPeer !== "string")
    return false;

  return true;
}
