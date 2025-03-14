import { SignalingChannel } from "./SignalingChannel";
import { CustomEventTarget } from "../shared/CustomEventTarget";

interface MeshEventMap {
  track: { peerId: string; track: MediaStreamTrack };
}

/** The baic strategy where no negotiation is taking place.
 *
 * Switches to CalleeStrategy upon receiving an offer from the remote peer. */
class NeutralStrategy {
  constructor(public conn: PeerConnection) {}

  onLocalOffer(_: RTCSessionDescriptionInit): void {
    console.warn("ignoing unexpected local offer");
  }

  onLocalAnswer(_: RTCSessionDescriptionInit): void {
    console.warn("ignoing unexpected local answer");
  }

  async onRemoteOffer(offer: RTCSessionDescriptionInit): Promise<void> {
    this.conn.strategy = new CalleeStrategy(this.conn);
    return this.conn.strategy.onRemoteOffer(offer);
  }

  onRemoteAnswer(_: RTCSessionDescriptionInit): void {
    console.warn("ignoing unexpected remote answer");
  }

  onNegotiationNeeded(): void {
    this.conn.makeCall();
  }

  onLocalICECandidate(localCandidate: RTCIceCandidate): void {
    this.conn.mesh.signalingChannel.sendMessage({
      rtc: {
        from: this.conn.localId,
        to: this.conn.remoteId,
        iceCandidate: localCandidate,
      },
    });
  }

  onRemoteICECandidate(remoteCandidate: RTCIceCandidate): void {
    this.conn.rtcConnection.addIceCandidate(remoteCandidate);
  }

  onDataChannel(dataChannel: RTCDataChannel): void {
    this.conn.dataChannel = dataChannel;

    dataChannel.addEventListener("open", () => {
      console.log("datachannel open");
    });
  }
}

/** A strategy that expects incoming offer. */
class CalleeStrategy extends NeutralStrategy {
  onNegotiationNeeded(): void {
    // Ignore, because we're already negotiating.
  }

  onLocalAnswer(answer: RTCSessionDescriptionInit): void {
    this.conn.mesh.signalingChannel.sendMessage({
      rtc: { from: this.conn.localId, to: this.conn.remoteId, answer },
    });

    // This concludes the negotiation. Back to normal.
    this.conn.strategy = new NeutralStrategy(this.conn);
  }

  async onRemoteOffer(offer: RTCSessionDescriptionInit): Promise<void> {
    this.conn.rtcConnection.setRemoteDescription(
      new RTCSessionDescription(offer),
    );

    const answer = await this.conn.rtcConnection.createAnswer();
    await this.conn.rtcConnection.setLocalDescription(answer);
    this.conn.strategy.onLocalAnswer(answer);
  }
}

/** A strategy that expects incoming answer.
 *
 * This strategy resolves the collision b/w offers. */
class CallerStrategy extends NeutralStrategy {
  onNegotiationNeeded(): void {
    // Ignore, because we're already negotiating.
  }

  onLocalOffer(offer: RTCSessionDescriptionInit): void {
    this.conn.mesh.signalingChannel.sendMessage({
      rtc: { from: this.conn.localId, to: this.conn.remoteId, offer },
    });
  }

  async onRemoteOffer(offer: RTCSessionDescriptionInit): Promise<void> {
    if (this.conn.isPolite()) {
      // "Polite" peer must fallback to accept the offer.
      console.info("Detected offer collision. Falling back...");
      this.conn.strategy = new CalleeStrategy(this.conn);
      this.conn.strategy.onRemoteOffer(offer);
    } else {
      // "Impolite" peer ignores the offer.
      console.info("Detected offer collision. Igonring...");
    }
  }

  onRemoteAnswer(answer: RTCSessionDescriptionInit): void {
    this.conn.rtcConnection.setRemoteDescription(
      new RTCSessionDescription(answer),
    );

    // This concludes the negotiation. Back to normal.
    this.conn.strategy = new NeutralStrategy(this.conn);
  }
}

/** Peer-to-peer connection to a remote peer.
 *
 * This class oversees negotiation process, and tracks resources related to the
 * connection.
 */
class PeerConnection {
  public strategy: NeutralStrategy;
  public dataChannel?: RTCDataChannel;

  constructor(
    public mesh: Mesh,
    public rtcConnection: RTCPeerConnection,
    public localId: string,
    public remoteId: string,
  ) {
    this.strategy = new NeutralStrategy(this);

    // Create a data channel from the impolite peer. This will trigger
    // `negotiationneeded`, causing a new negotiation take place.
    if (!this.isPolite()) {
      this.strategy.onDataChannel(
        this.rtcConnection.createDataChannel("default"),
      );
    }

    this.rtcConnection.addEventListener("icecandidate", (ev) => {
      if (ev.candidate) this.strategy.onLocalICECandidate(ev.candidate);
    });
    this.rtcConnection.addEventListener("datachannel", (ev) => {
      this.strategy.onDataChannel(ev.channel);
    });
    this.rtcConnection.addEventListener("negotiationneeded", (ev) => {
      this.strategy.onNegotiationNeeded();
    });

    this.rtcConnection.addEventListener("track", (ev) => {
      const detail = { peerId: this.remoteId, track: ev.track };
      this.mesh.dispatchEvent(new CustomEvent("track", { detail }));
    });
  }

  public isPolite(): boolean {
    return this.localId < this.remoteId;
  }

  public async makeCall(): Promise<void> {
    this.strategy = new CallerStrategy(this);

    const offer = await this.rtcConnection.createOffer();
    await this.rtcConnection.setLocalDescription(offer);
    this.strategy.onLocalOffer(offer);
  }

  public takeCall(): void {
    this.strategy = new CalleeStrategy(this);
  }

  public close(): void {
    this.rtcConnection.close();
  }
}
/** Mesh network containing multiple peers
 *
 * This class manages the peer connections and handle signaling messages from signaling channel.
 */
export class Mesh extends CustomEventTarget<MeshEventMap> {
  public connections: Map<string, PeerConnection>;
  public signalingChannel: SignalingChannel;

  constructor(
    public localId: string,
    public rtcConfig: RTCConfiguration,
  ) {
    super();

    this.signalingChannel = new SignalingChannel(this.localId);
    this.registerSignalHandlers();

    this.connections = new Map();
  }

  private registerSignalHandlers(): void {
    this.signalingChannel.addMessageHandler("peers", (ev) => {
      this.setPeers(new Set(ev.detail));
    });

    this.signalingChannel.addMessageHandler("addPeer", (ev) => {
      const peerId = ev.detail;
      this.addPeer(peerId);
    });

    this.signalingChannel.addMessageHandler("delPeer", (ev) => {
      const peerId = ev.detail;
      this.removePeer(peerId);
    });

    this.signalingChannel.addMessageHandler("rtc", (ev) => {
      const msg = ev.detail;

      if (msg.to !== this.localId) throw new Error("wrong recipient");

      const conn = this.connections.get(msg.from);
      if (!conn) throw new Error("wrong sender");

      if (msg.offer) conn.strategy.onRemoteOffer(msg.offer);
      if (msg.answer) conn.strategy.onRemoteAnswer(msg.answer);
      if (msg.iceCandidate)
        conn.strategy.onRemoteICECandidate(msg.iceCandidate);
    });
  }

  /** Sync the internal peer list to the given one */
  public setPeers(newPeers: Set<string>): void {
    const oldPeers = new Set(this.connections.keys());

    const removed = oldPeers.difference(newPeers);
    removed.forEach((peerId) => this.removePeer(peerId));

    const added = newPeers.difference(oldPeers);
    added.forEach((peerId) => this.addPeer(peerId));
  }

  /** Add the peer to the mesh, and establish a new connection to it. */
  public addPeer(peerId: string): void {
    // Avoid adding local peer to the list.
    if (peerId === this.localId) return;

    // Avoid adding duplicated entry.
    if (this.connections.has(peerId)) return;

    // Create and register a new peer connection.
    const rtcConnection = new RTCPeerConnection(this.rtcConfig);
    const conn = new PeerConnection(this, rtcConnection, this.localId, peerId);
    this.connections.set(peerId, conn);

    // Initiate negotiation only when impolite, as initiating both side would only waste resources.
    if (!conn.isPolite()) conn.makeCall();
  }

  /** Remove the peer from the mesh, and disconnect from it */
  public removePeer(peerId: string) {
    const conn = this.connections.get(peerId);
    if (conn) {
      conn.close();
      this.connections.delete(peerId);
    }
  }
}
