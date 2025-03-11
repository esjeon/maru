import * as signaling from "../shared/signaling";
import { SignalingChannel } from "./SignalingChannel";

export class Mesh extends EventTarget {
  public conns: Map<string, RTCPeerConnection>;
  public dc: Map<string, RTCDataChannel>;

  // TODO: make sure ID exists...
  constructor(
    public readonly id: string,
    public signal: SignalingChannel,
    public rtcConfig: RTCConfiguration,
  ) {
    super();

    this.conns = new Map();

    this.signal.addMessageHandler("rtc", (ev) => this.handleRTCMessage(ev));
    this.dc = new Map();
  }

  private async handleRTCMessage(
    ev: CustomEvent<NonNullable<signaling.Message["rtc"]>>,
  ): Promise<void> {
    const msg = ev.detail;
    if (msg.to !== this.id) {
      return console.warn("ignored message with wrong recipient", ev);
    }

    const conn = this.conns.get(msg.from);
    if (!conn) {
      return console.warn("ignored message with wrong sender", ev);
    }

    // TODO: check who's initiating the connection
    if (msg.answer) {
      const remoteDesc = new RTCSessionDescription(msg.answer);
      return conn.setRemoteDescription(remoteDesc);
    }

    if (msg.offer) {
      conn.setRemoteDescription(new RTCSessionDescription(msg.offer));

      const answer = await conn.createAnswer();
      await conn.setLocalDescription(answer);

      this.signal.sendMessage({
        rtc: { from: this.id, to: msg.from, answer },
      });
      return;
    }

    if (msg.iceCandidate) {
      try {
        await conn.addIceCandidate(msg.iceCandidate);
      } catch (err) {
        console.error("Error adding received ice candidate", err);
      }
      return;
    }
  }

  private async rtcMakeCall(
    conn: RTCPeerConnection,
    peerId: string,
  ): Promise<void> {
    const offer = await conn.createOffer();
    await conn.setLocalDescription(offer);

    this.signal.sendMessage({ rtc: { from: this.id, to: peerId, offer } });
  }

  public async addPeer(peerId: string): Promise<void> {
    if (peerId === this.id) return;
    if (this.conns.has(peerId)) return;

    const conn = new RTCPeerConnection(this.rtcConfig);
    this.conns.set(peerId, conn);

    if (this.id < peerId) {
      console.log("make call", peerId);
      const dc = conn.createDataChannel("testchannel");
      this.dc.set(peerId, dc);

      dc.addEventListener("open", (ev) => {
        console.log("datachannel open", ev);
        dc.send("Hello World");
      });

      this.rtcMakeCall(conn, peerId);
    } else {
      console.log("waiting for call", peerId);

      conn.addEventListener("datachannel", (ev) => {
        console.log("RTCPeerConnection datachannel", ev);
        const dc = ev.channel;
        this.dc.set(peerId, dc);

        dc.addEventListener("message", (ev) => {
          console.log("DataChannel message", ev);
        });
      });
    }

    conn.addEventListener("icecandidate", (ev) => {
      console.log(ev);
      if (ev.candidate) {
        this.signal.sendMessage({
          rtc: { from: this.id, to: peerId, iceCandidate: ev.candidate },
        });
      }
    });
  }

  public removePeer(peerId: string) {
    const conn = this.conns.get(peerId);
    if (conn) conn.close();

    this.dc.delete(peerId);
    this.conns.delete(peerId);
  }
}
