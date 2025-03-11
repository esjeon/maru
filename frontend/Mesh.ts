import * as signaling from "../shared/signaling";
import { SignalingChannel } from "./SignalingChannel";

class PeerConnection {
  public dataChannel?: RTCDataChannel;

  public isMaker: boolean;

  constructor(
    public rtcConnection: RTCPeerConnection,
    public localId: string,
    public peerId: string,
    public signalingChannel: SignalingChannel,
  ) {
    this.isMaker = localId < peerId;

    this.rtcConnection.addEventListener("icecandidate", (ev) => {
      if (ev.candidate) {
        this.signalingChannel.sendMessage({
          rtc: {
            from: this.localId,
            to: this.peerId,
            iceCandidate: ev.candidate,
          },
        });
      }
    });
  }

  public async setupCall(): Promise<void> {
    if (this.isMaker) this.makeCall();
    else this.takeCall();
  }

  private async makeCall(): Promise<void> {
    this.dataChannel = this.rtcConnection.createDataChannel(
      `${this.localId}<->${this.peerId}`,
    );

    this.dataChannel.addEventListener("open", () =>
      console.log("datachannle OPEN !!!!!!!!!!"),
    );

    const offer = await this.rtcConnection.createOffer();
    await this.rtcConnection.setLocalDescription(offer);

    this.signalingChannel.sendMessage({
      rtc: { from: this.localId, to: this.peerId, offer },
    });
  }

  private async takeCall(): Promise<void> {
    this.rtcConnection.addEventListener("datachannel", (ev) => {
      console.log("RTCPeerConnection datachannel", ev);

      this.dataChannel = ev.channel;
      // TODO: fire datachannel event

      this.dataChannel.addEventListener("open", () =>
        console.log("datachannle OPEN !!!!!!!!!!"),
      );
    });
  }

  public async acceptOffer(offer: RTCSessionDescriptionInit): Promise<void> {
    if (!this.isMaker) {
      this.rtcConnection.setRemoteDescription(new RTCSessionDescription(offer));

      const answer = await this.rtcConnection.createAnswer();
      await this.rtcConnection.setLocalDescription(answer);

      this.signalingChannel.sendMessage({
        rtc: { from: this.localId, to: this.peerId, answer },
      });
    }
  }

  public acceptAnswer(answer: RTCSessionDescriptionInit): void {
    if (this.isMaker) {
      this.rtcConnection.setRemoteDescription(
        new RTCSessionDescription(answer),
      );
    }
  }

  public addICECandidate(candidate: RTCIceCandidate): void {
    this.rtcConnection.addIceCandidate(candidate);
  }

  public close(): void {
    this.rtcConnection.close();
  }
}

export class Mesh {
  public connections: Map<string, PeerConnection>;

  constructor(
    public localId: string,
    public signalingChannel: SignalingChannel,
    public rtcConfig: RTCConfiguration,
  ) {
    this.connections = new Map();
  }

  public handleRTCMessage(msg: NonNullable<signaling.Message["rtc"]>): void {
    if (msg.to !== this.localId) throw new Error("wrong recipient");

    const conn = this.connections.get(msg.from);
    if (!conn) throw new Error("wrong sender");

    if (msg.offer) conn.acceptOffer(msg.offer);
    if (msg.answer) conn.acceptAnswer(msg.answer);
    if (msg.iceCandidate) conn.addICECandidate(msg.iceCandidate);
  }

  public setPeers(newPeers: Set<string>): void {
    const oldPeers = new Set(this.connections.keys());

    const removed = oldPeers.difference(newPeers);
    removed.forEach((id) => this.removePeer(id));

    const added = newPeers.difference(oldPeers);
    added.forEach((id) => this.addPeer(id));
  }

  public addPeer(peerId: string): void {
    if (peerId === this.localId) return;
    if (this.connections.has(peerId)) return;

    const conn = new PeerConnection(
      new RTCPeerConnection(this.rtcConfig),
      this.localId,
      peerId,
      this.signalingChannel,
    );
    this.connections.set(peerId, conn);

    conn.setupCall();
  }

  public removePeer(peerId: string) {
    const conn = this.connections.get(peerId);
    if (conn) {
      conn.close();
      this.connections.delete(peerId);
    }
  }
}
