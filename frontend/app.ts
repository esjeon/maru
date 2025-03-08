
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
  systemAudio: "include"
};

/*
 * Functions
 *
 */

class App {
  public videos: Set<HTMLVideoElement>;
  public videoList: HTMLUListElement;

  constructor() {
    this.videos = new Set();
    this.videoList = document.createElement('ul');
  }
  
  public async addStream(): Promise<void> {
    const captureStream = await navigator.mediaDevices.getDisplayMedia(displayMediaOptions);

    // Create <video> and put the stream.
    const video = document.createElement('video')!;
    video.srcObject = captureStream;
    video.onloadedmetadata = () => video.play();
    this.videos.add(video);

    // Add the <video> to <ul>
    const listItem = document.createElement('li');
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

window.addEventListener('load', () => {
  const app = new App();

  document.querySelector('section#videos')!
    .append(app.videoList);

  document
    .querySelector('#videos-add')!
    .addEventListener('click', () => app.addStream());
});