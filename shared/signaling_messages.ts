export interface Message {
  /** Share the list of current peers */
  peers?: string[];

  addPeer?: string;
  delPeer?: string;

  rtc?: {
    from: string;
    to: string;
    offer?: NonNullable<any>;
    answer?: NonNullable<any>;
    iceCandidate?: NonNullable<any>;
  };

  // TODO: client authentication
  //auth?: any;
}

export type ClientMessage = Pick<Message, "rtc">;

export type ServerMessage = Pick<
  Message,
  "peers" | "addPeer" | "delPeer" | "rtc"
>;

export function isClientMessage(obj: any): obj is ClientMessage {
  // Must be a non-null object
  if (typeof obj !== "object" || obj === null) return false;

  // Ensure the rtc property exists and is a non-null object
  if (!("rtc" in obj) || typeof obj.rtc !== "object" || obj.rtc === null)
    return false;

  // Check required rtc fields
  if (typeof obj.rtc.from !== "string") return false;
  if (typeof obj.rtc.to !== "string") return false;

  // If present, check that optional rtc fields are not null or undefined.
  if (
    "offer" in obj.rtc &&
    (obj.rtc.offer === null || obj.rtc.offer === undefined)
  )
    return false;
  if (
    "answer" in obj.rtc &&
    (obj.rtc.answer === null || obj.rtc.answer === undefined)
  )
    return false;
  if (
    "iceCandidate" in obj.rtc &&
    (obj.rtc.iceCandidate === null || obj.rtc.iceCandidate === undefined)
  )
    return false;

  return true;
}

export function isServerMessage(obj: any): obj is ServerMessage {
  // Must be a non-null object
  if (typeof obj !== "object" || obj === null) return false;

  // If peers is present, it must be an array of strings.
  if ("peers" in obj) {
    if (!Array.isArray(obj.peers)) return false;
    if (!obj.peers.every((peer: any) => typeof peer === "string")) return false;
  }

  // If addPeer is present, it must be a string.
  if ("addPeer" in obj && typeof obj.addPeer !== "string") return false;

  // If delPeer is present, it must be a string.
  if ("delPeer" in obj && typeof obj.delPeer !== "string") return false;

  // If rtc is present, it must be a non-null object with required fields.
  if ("rtc" in obj) {
    if (typeof obj.rtc !== "object" || obj.rtc === null) return false;
    if (typeof obj.rtc.from !== "string") return false;
    if (typeof obj.rtc.to !== "string") return false;
    if (
      "offer" in obj.rtc &&
      (obj.rtc.offer === null || obj.rtc.offer === undefined)
    )
      return false;
    if (
      "answer" in obj.rtc &&
      (obj.rtc.answer === null || obj.rtc.answer === undefined)
    )
      return false;
    if (
      "iceCandidate" in obj.rtc &&
      (obj.rtc.iceCandidate === null || obj.rtc.iceCandidate === undefined)
    )
      return false;
  }

  return true;
}
