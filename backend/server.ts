import { readFile } from "node:fs/promises";
import {
  IncomingMessage as HttpReq,
  ServerResponse as HttpResp,
  Server as HttpServer,
} from "node:http";
import * as path from "node:path";
import { WebSocket, WebSocketServer } from "ws";

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

class ChannelServer {
  public wsServer: WebSocketServer;
  public clients: Map<string, WebSocket>;

  constructor(server: Server) {
    this.wsServer = new WebSocketServer({ server: server.httpServer });
    this.wsServer.addListener("connection", this.onClientConnect);

    this.clients = new Map();
  }

  private onClientConnect = (ws: WebSocket, req: HttpReq): void => {
    const clientId = generateRandomID();
    this.clients.set(clientId, ws);
    console.log(clientId);

    ws.on("message", (rawData, isBinary) => {
      const msg = JSON.parse(rawData.toString());
      if (!isChannelMessage(msg)) return ws.close();

      const { type, target } = msg;
      if (type === "hello") {
        this.sendTo(clientId, {
          type: "setID",
          target: clientId,
          data: null,
        });
        this.sendTo(clientId, {
          type: "setPeers",
          target: clientId,
          data: Array.from(this.clients.keys()),
        });
      } else {
        if (target) this.sendTo(target, msg);
        else console.warn(`missing message target`);
      }
    });

    ws.on("close", () => {
      this.clients.delete(clientId);
    });
  };

  private sendTo(clientId: string, msg: ChannelMessage): void {
    const client = this.clients.get(clientId);
    if (!client) return console.warn(`target client not found: ${clientId}`);
    if (client.readyState !== WebSocket.OPEN)
      return console.warn(`target client is not ready: ${clientId}`);

    client.send(JSON.stringify(msg));
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
