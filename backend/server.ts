import { readFile } from "node:fs/promises";
import {
  IncomingMessage as HttpReq,
  ServerResponse as HttpResp,
  Server as HttpServer,
} from "node:http";
import * as path from "node:path";
import { WebSocket, WebSocketServer } from "ws";

import {
  ClientMessage,
  isClientMessage,
  ServerMessage,
} from "../shared/channel_message.js";

const MAIN_HTML_PATH = "../static/main.html";

function generateRandomID(): string {
  const timestamp = Date.now().toString(36);
  const randomPart = Math.random().toString(36).substring(2, 8);
  return `${timestamp}-${randomPart}`;
}

async function handleMainRequest(req: HttpReq, resp: HttpResp): Promise<void> {
  if (req.method === "GET") {
    const html = await readFile(path.join(import.meta.dirname, MAIN_HTML_PATH));
    resp.writeHead(200, { "Content-Type": "text/html" }).end(html);
  } else {
    resp.writeHead(405, { "Content-Type": "text/plain" });
    resp.end("Method Not Allowed");
  }
}

class ChannelConnection extends EventTarget {
  constructor(
    public socket: WebSocket,
    public id?: string,
  ) {
    super();
    this.registerWebSocketHandlers();
  }

  private registerWebSocketHandlers(): void {
    this.socket.addEventListener("open", (ev) => {
      this.dispatchEvent(new CustomEvent("open"));
    });

    this.socket.addEventListener("error", (ev) => {
      console.error("Channel WebSocket error", ev);
      this.dispatchEvent(new CustomEvent("error"));
    });

    this.socket.addEventListener("close", (ev) => {
      console.info("Channel WebSocket close", ev);
      this.dispatchEvent(new CustomEvent("close"));
    });

    this.socket.addEventListener("message", (ev) => {
      this.dispatchRawMessage(ev.data);
    });
  }

  private dispatchRawMessage(raw: any): void {
    if (typeof raw !== "string") return;

    const msg = JSON.parse(raw);
    if (!msg || !isClientMessage(msg)) throw new Error("got invalid message");

    this.dispatchEvent(new CustomEvent(msg.type, { detail: msg }));
  }

  public addMessageHandler<T extends ClientMessage["type"]>(
    type: T,
    handler: (ev: CustomEvent<Extract<ClientMessage, { type: T }>>) => void,
  ): void {
    this.addEventListener(type, (ev) =>
      handler(ev as CustomEvent<Extract<ClientMessage, { type: T }>>),
    );
  }

  public sendMessage(object: ServerMessage): void {
    this.socket.send(JSON.stringify(object));
  }
}

class ChannelServer extends EventTarget {
  public wsServer: WebSocketServer;
  public connections: Map<string, ChannelConnection>;

  constructor(server: Server) {
    super();

    this.wsServer = new WebSocketServer({ server: server.httpServer });
    this.wsServer.addListener("connection", (ws, req) => {
      this.onClientConnect(ws, req);
    });

    this.connections = new Map();
  }

  private onClientConnect(ws: WebSocket, req: HttpReq): void {
    const connId = generateRandomID();
    const conn = new ChannelConnection(ws, connId);
    this.connections.set(connId, conn);
    console.info(`client connected: ${connId}`);

    // boadcast the peer connection
    this.broadcast(
      {
        type: "add-peer",
        peer: connId,
      },
      connId,
    );

    conn.addMessageHandler("id", (ev) => {
      conn.sendMessage({
        type: "set-id",
        id: connId,
      });
    });

    conn.addMessageHandler("ls-peers", (ev) => {
      conn.sendMessage({
        type: "set-peers",
        peers: Array.from(this.connections.keys()),
      });
    });

    conn.addEventListener("close", () => {
      this.connections.delete(connId);
      this.broadcast(
        {
          type: "delete-peer",
          peer: connId,
        },
        connId,
      );
    });
  }

  private broadcast(msg: ServerMessage, exceptId?: string): void {
    for (const [id, conn] of this.connections) {
      if (id == exceptId) continue;
      conn.sendMessage(msg);
    }
  }
}

export class Server {
  public httpServer: HttpServer;
  public channelServer: ChannelServer;

  constructor() {
    this.httpServer = new HttpServer(this.onRequest.bind(this));
    this.channelServer = new ChannelServer(this);
  }

  private async onRequest(req: HttpReq, resp: HttpResp): Promise<void> {
    try {
      if (req.url === "/") return handleMainRequest(req, resp);
      resp.writeHead(404, { "Content-Type": "text/plain" });
      resp.end("Not Found");
    } catch (e) {
      console.error(e);
      resp.writeHead(500, { "Content-Type": "text/plain" });
      resp.end("Interal Server Error");
    }
  }
}
