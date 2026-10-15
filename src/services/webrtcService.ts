// @ts-nocheck
import { createClient } from '@supabase/supabase-js';
import { dbService } from './dbService';

// Obfuscated default credentials
const DEFAULT_SUPABASE_URL_ENC = 'aHR0cHM6Ly9janV3c3p4eHhpcmt5ZndncWFzci5zdXBhYmFzZS5jbw==';
const DEFAULT_SUPABASE_KEY_ENC = 'c2JfcHVibGlzaGFibGVfQjZVNUpkbWVmM0x6YWpaaEU1Q0R1QV9rZTdGck5sdg==';

function decodeKey(enc) {
  try {
    return atob(enc);
  } catch {
    return '';
  }
}

const RTC_CONFIG = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun.cloudflare.com:3478' }
  ]
};

export interface PeerInfo {
  id: string;
  connected: boolean;
  joinedAt: number;
  dataChannelState: string;
}

export interface SyncLog {
  id: string;
  time: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
}

class WebRTCService {
  constructor() {
    this.supabaseClient = null;
    this.channel = null;
    this.databaseId = null;
    this.myPeerId = this.generatePeerId();
    this.peers = new Map(); // peerId -> { pc, dc, info, candidateQueue }
    this.status = 'disconnected'; // 'disconnected' | 'connecting' | 'connected' | 'error'
    this.error = null;
    this.isEnabled = localStorage.getItem('webrtc_sync_enabled') !== 'false';
    this.logs = [];

    // Callbacks
    this.statusListeners = new Set();
    this.peersListeners = new Set();
    this.remoteMutationListeners = new Set();
    this.logsListeners = new Set();
    this.syncSuccessListeners = new Set();
  }

  generatePeerId() {
    return 'peer_' + Math.random().toString(36).substring(2, 7) + '_' + Date.now().toString(36).slice(-4);
  }

  log(message, type = 'info') {
    const entry = {
      id: Math.random().toString(36).substring(2, 9),
      time: new Date().toLocaleTimeString(),
      message,
      type
    };
    this.logs = [entry, ...this.logs.slice(0, 49)];
    this.notifyLogs();
  }

  // --- Configuration ---
  getConfig() {
    const envUrl = import.meta.env?.VITE_SUPABASE_URL;
    const envKey = import.meta.env?.VITE_SUPABASE_ANON_KEY;

    const encUrl = localStorage.getItem('supabase_url_enc');
    const encKey = localStorage.getItem('supabase_anon_key_enc');

    const storedUrl = encUrl ? decodeKey(encUrl) : localStorage.getItem('supabase_url');
    const storedKey = encKey ? decodeKey(encKey) : localStorage.getItem('supabase_anon_key');

    return {
      url: storedUrl || envUrl || decodeKey(DEFAULT_SUPABASE_URL_ENC),
      key: storedKey || envKey || decodeKey(DEFAULT_SUPABASE_KEY_ENC)
    };
  }

  saveConfig(url, key) {
    if (url) {
      localStorage.setItem('supabase_url_enc', btoa(url.trim()));
      localStorage.removeItem('supabase_url');
    }
    if (key) {
      localStorage.setItem('supabase_anon_key_enc', btoa(key.trim()));
      localStorage.removeItem('supabase_anon_key');
    }
    this.log('Updated Supabase configuration', 'info');
    this.reconnect();
  }

  resetConfig() {
    localStorage.removeItem('supabase_url_enc');
    localStorage.removeItem('supabase_anon_key_enc');
    localStorage.removeItem('supabase_url');
    localStorage.removeItem('supabase_anon_key');
    this.log('Reset Supabase configuration to defaults', 'info');
    this.reconnect();
  }

  setEnabled(enabled) {
    this.isEnabled = enabled;
    localStorage.setItem('webrtc_sync_enabled', enabled ? 'true' : 'false');
    if (enabled) {
      this.init(this.databaseId);
    } else {
      this.disconnect();
    }
  }

  // --- Subscriptions ---
  onStatusChange(cb) {
    this.statusListeners.add(cb);
    cb(this.status, this.error);
    return () => this.statusListeners.delete(cb);
  }

  onPeersChange(cb) {
    this.peersListeners.add(cb);
    cb(this.getConnectedPeersList());
    return () => this.peersListeners.delete(cb);
  }

  onRemoteMutation(cb) {
    this.remoteMutationListeners.add(cb);
    return () => this.remoteMutationListeners.delete(cb);
  }

  onLogsChange(cb) {
    this.logsListeners.add(cb);
    cb(this.logs);
    return () => this.logsListeners.delete(cb);
  }

  onSyncSuccess(cb) {
    this.syncSuccessListeners.add(cb);
    return () => this.syncSuccessListeners.delete(cb);
  }

  notifyStatus() {
    for (const cb of this.statusListeners) cb(this.status, this.error);
  }

  notifyPeers() {
    const list = this.getConnectedPeersList();
    for (const cb of this.peersListeners) cb(list);
  }

  notifyLogs() {
    for (const cb of this.logsListeners) cb(this.logs);
  }

  getConnectedPeersList() {
    const list = [];
    for (const [id, peer] of this.peers.entries()) {
      list.push({
        id,
        connected: peer.dc && peer.dc.readyState === 'open',
        dataChannelState: peer.dc ? peer.dc.readyState : 'closed',
        joinedAt: peer.info.joinedAt
      });
    }
    return list;
  }

  // --- Main Lifecycle ---
  async init(databaseId) {
    if (!databaseId) {
      this.log('WebRTC init aborted: no database ID provided', 'warning');
      return;
    }

    this.databaseId = databaseId;

    if (!this.isEnabled) {
      this.status = 'disconnected';
      this.notifyStatus();
      return;
    }

    await this.connectSignaling();
  }

  async connectSignaling() {
    this.disconnectSignaling();

    const { url, key } = this.getConfig();
    if (!url || !key) {
      this.status = 'error';
      this.error = 'Missing Supabase URL or Anon Key';
      this.notifyStatus();
      return;
    }

    try {
      this.status = 'connecting';
      this.error = null;
      this.notifyStatus();

      this.supabaseClient = createClient(url, key, {
        realtime: {
          params: { eventsPerSecond: 20 }
        }
      });

      // Channel name scoped to the exact database ID
      const channelName = `db-sync:${this.databaseId}`;
      this.channel = this.supabaseClient.channel(channelName, {
        config: {
          broadcast: { self: false },
          presence: { key: this.myPeerId }
        }
      });

      // Presence handling
      this.channel
        .on('presence', { event: 'sync' }, () => {
          this.handlePresenceSync();
        })
        .on('presence', { event: 'join' }, ({ key }) => {
          this.handlePeerJoined(key);
        })
        .on('presence', { event: 'leave' }, ({ key }) => {
          this.handlePeerLeft(key);
        });

      // Signaling message handling (offer, answer, candidate)
      this.channel.on('broadcast', { event: 'webrtc-signal' }, ({ payload }) => {
        if (payload && payload.to === this.myPeerId) {
          this.handleIncomingSignal(payload.from, payload.signal);
        }
      });

      // Subscribe to channel
      this.channel.subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          this.status = 'connected';
          this.log(`Joined signaling room for DB: ${this.databaseId.substring(0, 16)}...`, 'success');
          this.notifyStatus();

          // Announce presence
          await this.channel.track({
            peerId: this.myPeerId,
            joinedAt: Date.now()
          });
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          this.status = 'error';
          this.error = `Signaling connection ${status}`;
          this.log(`Signaling channel error: ${status}`, 'error');
          this.notifyStatus();
        } else if (status === 'CLOSED') {
          this.status = 'disconnected';
          this.notifyStatus();
        }
      });
    } catch (err) {
      console.error('Failed to setup Supabase Realtime channel:', err);
      this.status = 'error';
      this.error = err.message || 'Connection failed';
      this.notifyStatus();
    }
  }

  disconnectSignaling() {
    if (this.channel && this.supabaseClient) {
      try {
        this.channel.untrack();
        this.supabaseClient.removeChannel(this.channel);
      } catch {
        // Ignore cleanup errors
      }
      this.channel = null;
    }
    this.supabaseClient = null;
  }

  disconnect() {
    this.disconnectSignaling();
    for (const [peerId] of this.peers) {
      this.closePeer(peerId);
    }
    this.peers.clear();
    this.status = 'disconnected';
    this.notifyStatus();
    this.notifyPeers();
  }

  async reconnect() {
    this.disconnect();
    if (this.databaseId) {
      await this.connectSignaling();
    }
  }

  // --- Presence & Glare Management ---
  handlePresenceSync() {
    if (!this.channel) return;
    const state = this.channel.presenceState();
    const onlinePeerIds = Object.keys(state).filter((id) => id !== this.myPeerId);

    // Remove peers that left
    for (const [peerId] of this.peers) {
      if (!onlinePeerIds.includes(peerId)) {
        this.handlePeerLeft(peerId);
      }
    }

    // Connect to newly discovered peers
    for (const peerId of onlinePeerIds) {
      if (!this.peers.has(peerId)) {
        this.handlePeerJoined(peerId);
      }
    }
  }

  handlePeerJoined(peerId) {
    if (peerId === this.myPeerId) return;
    if (this.peers.has(peerId)) return;

    this.log(`Detected peer in room: ${peerId}`, 'info');

    // Polite Peer pattern: deterministically decide who sends the offer
    const isInitiator = this.myPeerId < peerId;
    this.setupPeer(peerId, isInitiator);
  }

  handlePeerLeft(peerId) {
    this.log(`Peer departed: ${peerId}`, 'warning');
    this.closePeer(peerId);
    this.notifyPeers();
  }

  // --- WebRTC Peer Connection Setup ---
  setupPeer(peerId, isInitiator) {
    const pc = new RTCPeerConnection(RTC_CONFIG);
    const peerObj = {
      pc,
      dc: null,
      info: { joinedAt: Date.now() },
      candidateQueue: [],
      makingOffer: false,
      isInitiator
    };

    this.peers.set(peerId, peerObj);

    // ICE Candidate handler
    pc.onicecandidate = ({ candidate }) => {
      if (candidate) {
        this.sendSignal(peerId, { type: 'candidate', candidate });
      }
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'connected') {
        this.log(`WebRTC P2P direct link established with ${peerId}`, 'success');
      } else if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
        this.log(`WebRTC P2P link with ${peerId} changed to ${pc.connectionState}`, 'warning');
        this.closePeer(peerId);
      }
      this.notifyPeers();
    };

    if (isInitiator) {
      // Initiator creates data channel
      try {
        const dc = pc.createDataChannel('db-sync', { ordered: true });
        this.setupDataChannel(peerId, dc);
      } catch (err) {
        console.error('Failed to create data channel:', err);
      }

      // Create and send offer
      peerObj.makingOffer = true;
      pc.createOffer()
        .then((offer) => pc.setLocalDescription(offer))
        .then(() => {
          this.sendSignal(peerId, { type: 'offer', sdp: pc.localDescription });
        })
        .catch((err) => {
          console.error(`Error creating offer for ${peerId}:`, err);
        })
        .finally(() => {
          peerObj.makingOffer = false;
        });
    } else {
      // Non-initiator waits for data channel from remote
      pc.ondatachannel = (e) => {
        this.setupDataChannel(peerId, e.channel);
      };
    }
  }

  setupDataChannel(peerId, dc) {
    const peer = this.peers.get(peerId);
    if (!peer) return;

    peer.dc = dc;

    dc.onopen = () => {
      this.log(`DataChannel OPEN with peer ${peerId}. Ready for real-time sync!`, 'success');
      this.notifyPeers();

      // Send initial handshake with database identity confirmation
      this.sendToPeer(peerId, {
        type: 'HANDSHAKE',
        senderPeerId: this.myPeerId,
        databaseId: this.databaseId,
        timestamp: Date.now(),
        lastLocalSave: localStorage.getItem('last_local_save') || null
      });
    };

    dc.onclose = () => {
      this.log(`DataChannel CLOSED with peer ${peerId}`, 'info');
      this.notifyPeers();
    };

    dc.onerror = (err) => {
      console.error(`DataChannel error with ${peerId}:`, err);
    };

    dc.onmessage = (e) => {
      try {
        const message = JSON.parse(e.data);
        this.handleDataChannelMessage(peerId, message);
      } catch (err) {
        console.error('Failed to parse DataChannel message:', err);
      }
    };
  }

  // --- Signaling Message Handling ---
  sendSignal(toPeerId, signal) {
    if (!this.channel) return;
    this.channel.send({
      type: 'broadcast',
      event: 'webrtc-signal',
      payload: {
        from: this.myPeerId,
        to: toPeerId,
        signal
      }
    });
  }

  async handleIncomingSignal(fromPeerId, signal) {
    let peer = this.peers.get(fromPeerId);

    if (!peer) {
      // Create peer object for incoming call
      this.setupPeer(fromPeerId, false);
      peer = this.peers.get(fromPeerId);
    }

    if (!peer || !peer.pc) return;
    const { pc } = peer;

    try {
      if (signal.type === 'offer') {
        // Handle offer
        const offerCollision = peer.makingOffer || pc.signalingState !== 'stable';
        const polite = !peer.isInitiator;

        if (offerCollision && !polite) {
          // Ignore offer if impolite and colliding
          return;
        }

        await pc.setRemoteDescription(new RTCSessionDescription(signal.sdp));

        // Process buffered ICE candidates
        while (peer.candidateQueue.length > 0) {
          const cand = peer.candidateQueue.shift();
          await pc.addIceCandidate(new RTCIceCandidate(cand));
        }

        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);

        this.sendSignal(fromPeerId, { type: 'answer', sdp: pc.localDescription });
      } else if (signal.type === 'answer') {
        // Handle answer
        await pc.setRemoteDescription(new RTCSessionDescription(signal.sdp));

        // Process buffered ICE candidates
        while (peer.candidateQueue.length > 0) {
          const cand = peer.candidateQueue.shift();
          await pc.addIceCandidate(new RTCIceCandidate(cand));
        }
      } else if (signal.type === 'candidate') {
        // Handle ICE candidate
        if (pc.remoteDescription && pc.remoteDescription.type) {
          await pc.addIceCandidate(new RTCIceCandidate(signal.candidate));
        } else {
          peer.candidateQueue.push(signal.candidate);
        }
      }
    } catch (err) {
      console.error(`Signaling error handling ${signal.type} from ${fromPeerId}:`, err);
    }
  }

  closePeer(peerId) {
    const peer = this.peers.get(peerId);
    if (peer) {
      try {
        if (peer.dc) peer.dc.close();
        if (peer.pc) peer.pc.close();
      } catch {
        // Ignore
      }
      this.peers.delete(peerId);
    }
  }

  // --- Real-time DataChannel Messages ---
  sendToPeer(peerId, message) {
    const peer = this.peers.get(peerId);
    if (peer && peer.dc && peer.dc.readyState === 'open') {
      try {
        peer.dc.send(JSON.stringify(message));
      } catch (err) {
        console.error(`Failed to send message to peer ${peerId}:`, err);
      }
    }
  }

  broadcast(message) {
    let sentCount = 0;
    for (const [peerId, peer] of this.peers.entries()) {
      if (peer.dc && peer.dc.readyState === 'open') {
        try {
          peer.dc.send(JSON.stringify(message));
          sentCount++;
        } catch (err) {
          console.error(`Failed to broadcast to ${peerId}:`, err);
        }
      }
    }
    return sentCount;
  }

  // Broadcast a database mutation to all connected WebRTC peers
  broadcastMutation(mutation) {
    const sentCount = this.broadcast({
      type: 'SQL_MUTATION',
      sql: mutation.sql,
      bind: mutation.bind,
      timestamp: mutation.timestamp || Date.now(),
      senderPeerId: this.myPeerId
    });

    if (sentCount > 0) {
      this.log(`Streamed DB change to ${sentCount} peer(s)`, 'info');
    }
  }

  async handleDataChannelMessage(fromPeerId, message) {
    if (!message || !message.type) return;

    switch (message.type) {
      case 'HANDSHAKE': {
        // Zero-SQL collision check: verify the remote peer is actually using our database
        if (message.databaseId !== this.databaseId) {
          this.log(`Rejecting peer ${fromPeerId}: Database ID mismatch!`, 'error');
          this.closePeer(fromPeerId);
          return;
        }

        this.log(`Handshake verified with ${fromPeerId} (DB: ${message.databaseId.substring(0, 16)}...)`, 'success');
        break;
      }

      case 'SQL_MUTATION': {
        // Execute SQL statement on local SQLite database without echoing it back
        try {
          await dbService.execRemote(message.sql, message.bind);
          this.log(`Applied live change from ${fromPeerId}`, 'success');

          for (const cb of this.remoteMutationListeners) {
            try {
              cb(message);
            } catch (cbErr) {
              console.error('Remote mutation callback error:', cbErr);
            }
          }
        } catch (err) {
          this.log(`Failed to apply remote mutation: ${err.message}`, 'error');
        }
        break;
      }

      case 'SNAPSHOT_REQUEST': {
        this.log(`Peer ${fromPeerId} requested full database snapshot`, 'info');
        try {
          const binary = await dbService.exportBinary();
          // Convert to base64
          let binaryString = '';
          const len = binary.byteLength;
          for (let i = 0; i < len; i++) {
            binaryString += String.fromCharCode(binary[i]);
          }
          const base64 = btoa(binaryString);

          this.sendToPeer(fromPeerId, {
            type: 'SNAPSHOT_RESPONSE',
            base64,
            timestamp: Date.now()
          });
          this.log(`Sent full database snapshot to ${fromPeerId} (${Math.round(len / 1024)} KB)`, 'success');
        } catch (err) {
          this.log(`Failed to send snapshot: ${err.message}`, 'error');
        }
        break;
      }

      case 'SNAPSHOT_RESPONSE': {
        this.log(`Received full database snapshot from ${fromPeerId}`, 'info');
        try {
          const binaryString = atob(message.base64);
          const len = binaryString.length;
          const bytes = new Uint8Array(len);
          for (let i = 0; i < len; i++) {
            bytes[i] = binaryString.charCodeAt(i);
          }

          await dbService.importBinary(bytes);
          this.log(`Imported peer snapshot (${Math.round(len / 1024)} KB) and saved to OPFS!`, 'success');

          for (const cb of this.syncSuccessListeners) {
            try {
              cb();
            } catch (cbErr) {
              console.error('Sync success callback error:', cbErr);
            }
          }
        } catch (err) {
          this.log(`Failed to import peer snapshot: ${err.message}`, 'error');
        }
        break;
      }

      default:
        console.warn('Unknown DataChannel message type:', message.type);
    }
  }

  // Request a full database snapshot from a specific peer (or the first available connected peer)
  requestSnapshotFromPeer(peerId = null) {
    const targetPeerId = peerId || Array.from(this.peers.keys())[0];
    if (!targetPeerId) {
      this.log('Cannot request snapshot: no connected peers', 'warning');
      return false;
    }

    this.log(`Requesting full database snapshot from ${targetPeerId}...`, 'info');
    this.sendToPeer(targetPeerId, {
      type: 'SNAPSHOT_REQUEST',
      senderPeerId: this.myPeerId,
      timestamp: Date.now()
    });
    return true;
  }

  // Push our full database snapshot to a specific peer (or all connected peers)
  async sendSnapshotToPeers(peerId = null) {
    try {
      const binary = await dbService.exportBinary();
      let binaryString = '';
      const len = binary.byteLength;
      for (let i = 0; i < len; i++) {
        binaryString += String.fromCharCode(binary[i]);
      }
      const base64 = btoa(binaryString);

      const payload = {
        type: 'SNAPSHOT_RESPONSE',
        base64,
        timestamp: Date.now()
      };

      if (peerId) {
        this.sendToPeer(peerId, payload);
        this.log(`Sent snapshot to ${peerId} (${Math.round(len / 1024)} KB)`, 'success');
      } else {
        const count = this.broadcast(payload);
        this.log(`Broadcasted snapshot to ${count} peer(s) (${Math.round(len / 1024)} KB)`, 'success');
      }
      return true;
    } catch (err) {
      this.log(`Failed to send snapshot: ${err.message}`, 'error');
      return false;
    }
  }
}

export const webrtcService = new WebRTCService();
