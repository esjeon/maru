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

export function isServerMessage(obj: any): obj is ServerMessage {
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
