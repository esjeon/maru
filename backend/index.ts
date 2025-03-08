import { Server } from "./server.js";
import { AddressInfo } from "node:net";

const server = new Server();
await server.httpServer.listen({ host: '0.0.0.0', port: 3000 }, () => {
  const addr = server.httpServer.address() as AddressInfo;
  console.log(`Listening at http://localhost:${addr.port}`);
});