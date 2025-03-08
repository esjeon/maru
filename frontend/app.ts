import { JSONWebSocket } from "./JSONWebSocket";

/*
 * Structures
 *
 */

interface SystemAudioField {
  systemAudio: "include" | "exclude";
}

/*
 * Constants
 *
 */

/*
 * Globals
 *
 */

const displayMediaOptions: DisplayMediaStreamOptions & SystemAudioField = {
  video: {
    displaySurface: ["browser", "window"],
  },
  audio: true,
  systemAudio: "include",
};

/*
 * Functions
 *
 */

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

class ChannelClient {
  public ws: JSONWebSocket;
  public id: string | null;
  public peerIds: string[];

  constructor() {
    const ws = new JSONWebSocket(window.location.origin + "/socket");
    this.ws = ws;
    this.id = null;
    this.peerIds = [];

    ws.addEventListener("open", (ev) => {
      this.ws.sendJSON({ type: "hello", target: null });
    });

    ws.addEventListener("jsonMessage", (ev) => {
      const msg = ev.object as ChannelMessage;
      if (!isChannelMessage(msg)) return console.warn(`invalid message`, msg);

      // if my ID is not set, accept only `setID` message.
      if (this.id === null) {
        if (msg.type === "setID") {
          console.assert(msg.target !== null);
          this.id = msg.target as string;
        }
        return;
      }

      // ignore message not for me.
      if (msg.target !== this.id) return;

      if (msg.type === "setPeers") {
        this.peerIds = msg.data;
      } else {
        console.warn(`unknown message type: ${msg.type}`, msg);
      }
    });
  }
}

class App {
  public channel: ChannelClient;

  public videos: Set<HTMLVideoElement>;
  public videoList: HTMLUListElement;

  constructor() {
    this.channel = new ChannelClient();

    this.videos = new Set();
    this.videoList = document.createElement("ul");
  }

  public async addStream(): Promise<void> {
    const captureStream =
      await navigator.mediaDevices.getDisplayMedia(displayMediaOptions);

    // Create <video> and put the stream.
    const video = document.createElement("video")!;
    video.srcObject = captureStream;
    video.onloadedmetadata = () => video.play();
    this.videos.add(video);

    // Add the <video> to <ul>
    const listItem = document.createElement("li");
    listItem.append(video);
    this.videoList.append(listItem);

    // Remove the <video> from the <ul> when the stream stops.
    // XXX: Typescript is missing `MediaStream.oninactive`.
    // @ts-ignore
    captureStream.oninactive = () => {
      this.videos.delete(video);
      listItem.remove();
    };
  }
}

window.addEventListener("load", () => {
  const app = new App();
  console.log(app);

  document.querySelector("section#videos")!.append(app.videoList);

  document
    .querySelector("#videos-add")!
    .addEventListener("click", () => app.addStream());
});
