import { App } from "./app";

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

window.addEventListener("load", () => {
  const app = new App();
  console.log(app);

  document.querySelector("section#videos")!.append(app.streamList.ul);

  document.querySelector("#videos-add")!.addEventListener("click", async () => {
    const captureStream =
      await navigator.mediaDevices.getDisplayMedia(displayMediaOptions);
    app.addStream(captureStream);
  });

  document
    .querySelector("#videos-throw")!
    .addEventListener("click", () => app.throwStreamDemo());
});
