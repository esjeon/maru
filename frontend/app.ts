import { generateRandomID } from "../shared/utils";
import { Mesh } from "./Mesh";
import { StreamListUI } from "./ui";

declare global {
  interface Set<T> {
    difference(other: Set<T>): Set<T>;
  }
}

export class App {
  public mesh: Mesh;

  public streams: Set<MediaStream>;
  public streamList: StreamListUI;

  constructor() {
    this.mesh = new Mesh(generateRandomID("app"), {
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
    });

    this.streams = new Set();
    this.streamList = new StreamListUI(this);

    this.mesh.addEventListener("track", (ev) => {
      const { track } = ev.detail;

      const stream = new MediaStream();
      stream.addTrack(track);
      this.addStream(stream);
    });
  }

  public addStream(stream: MediaStream): void {
    this.streams.add(stream);
    this.streamList.render();

    stream.addEventListener("inactive", () => {
      this.streams.delete(stream);
      this.streamList.render();
    });
  }
}
