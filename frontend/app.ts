import { Mesh } from "./Mesh";
import { SignalingChannel } from "./SignalingChannel";
import { generateRandomID } from "../shared/utils";
import { StreamListUI } from "./ui";

declare global {
  interface Set<T> {
    difference(other: Set<T>): Set<T>;
  }
}

interface SystemAudioField {
  systemAudio: "include" | "exclude";
}

const displayMediaOptions: DisplayMediaStreamOptions & SystemAudioField = {
  video: {
    displaySurface: ["browser", "window"],
  },
  audio: true,
  systemAudio: "include",
};

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
  }

  public async addStream(): Promise<void> {
    // TODO: handle error (e.g. rejection)
    const captureStream =
      await navigator.mediaDevices.getDisplayMedia(displayMediaOptions);

    this.streams.add(captureStream);
    captureStream.addEventListener("inactive", () => {
      this.streams.delete(captureStream);
    });

    this.streamList.render(this.streams);
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
