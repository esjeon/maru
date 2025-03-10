import WebSocket from "ws";
import { ICustomWebSocket } from "../shared/GenericChannel.js";

/** Adapts WebSocket from `ws` packages to internal `GenericChannel` class
 *
 * This class adapts EventEmitter-based `ws` WebSocket to EventTarget-based DOM WebSocket.
 */
export class NodeWebSocketAdapter
  extends EventTarget
  implements ICustomWebSocket
{
  constructor(public ws: WebSocket) {
    super();

    ws.on("open", () => {
      this.dispatchEvent(new CustomEvent("open"));
    });

    ws.on("error", (err: any) =>
      this.dispatchEvent(new CustomEvent("error", { detail: err })),
    );

    ws.on("close", (code: number, reason: Buffer) => {
      const detail = { code, reason: reason.toString() };
      this.dispatchEvent(new CustomEvent("close", { detail }));
    });

    ws.on("message", (data: WebSocket.Data) =>
      this.dispatchEvent(new CustomEvent("message", { detail: data })),
    );
  }

  send(data: string): void {
    this.ws.send(data);
  }
}
