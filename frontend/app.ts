import { ChannelClient } from "./ChannelClient";

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

class App {
  public channel: ChannelClient;

  public videos: Set<HTMLVideoElement>;
  public videoList: HTMLUListElement;

  public peers: Set<string>;

  constructor() {
    this.channel = new ChannelClient();
    this.channel.addEventListener("open", (ev) => {
      this.channel.sendRequest({ type: "id" });
      this.channel.sendRequest({ type: "ls-peers" });
    });
    this.channel.addResponseHandler("set-peers", (ev) => {
      this.peers = new Set(ev.detail.peers);
    });
    this.channel.addResponseHandler("add-peer", (ev) => {
      this.peers.add(ev.detail.peer);
      console.log(ev, this.peers);
    });
    this.channel.addResponseHandler("delete-peer", (ev) => {
      this.peers.delete(ev.detail.peer);
      console.log(ev, this.peers);
    });

    this.videos = new Set();
    this.videoList = document.createElement("ul");

    this.peers = new Set();
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
