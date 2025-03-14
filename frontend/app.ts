import { Mesh } from "./Mesh";
import { SignalingChannel } from "./SignalingChannel";
import { generateRandomID } from "../shared/utils";
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
    this.streamList = new StreamListUI();

    this.mesh.addEventListener("track", (ev) => {
      const { track } = ev.detail;

      const stream = new MediaStream();
      stream.addTrack(track);
      this.addStream(stream);
    });
  }

  public addStream(stream: MediaStream): void {
    this.streams.add(stream);
    this.streamList.render(this.streams);

    stream.addEventListener("inactive", () => {
      this.streams.delete(stream);
      this.streamList.render(this.streams);
    });
  }

  public async throwStreamDemo(): Promise<void> {
    const mediaStream = this.streams.values().next().value!;
    const videoTrack = mediaStream.getVideoTracks()[0];
    const audioTrack = mediaStream.getAudioTracks()[0];
    console.log(mediaStream.getAudioTracks());

    this.mesh.connections.forEach((conn, peerId) => {
      conn.rtcConnection.addTrack(videoTrack, mediaStream);
      if (audioTrack) conn.rtcConnection.addTrack(audioTrack, mediaStream);
    });
  }
}
