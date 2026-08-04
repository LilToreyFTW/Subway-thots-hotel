import * as THREE from 'three';
import { io } from 'socket.io-client';

import { calculateProximityGain, canShareAudioSpace, isSpeakingLevel } from './proximity.js';

const DEFAULT_ICE_SERVERS = [{ urls: 'stun:stun.l.google.com:19302' }];

function emit(target, type, detail = {}) {
  target.dispatchEvent(new CustomEvent(type, { detail }));
}

function rmsLevel(analyser, buffer) {
  analyser.getByteTimeDomainData(buffer);
  let sum = 0;
  for (const sample of buffer) {
    const centered = (sample - 128) / 128;
    sum += centered * centered;
  }
  return Math.sqrt(sum / buffer.length);
}

export class ProximityVoiceClient extends EventTarget {
  constructor({
    serverUrl,
    lobbyCode = 'PUBLIC',
    playerId,
    displayName = 'Guest',
    authToken = null,
    listener = null,
    maxDistance = 25,
    iceServers = DEFAULT_ICE_SERVERS,
    getLocalState,
    getRemoteObject,
  }) {
    super();
    this.serverUrl = serverUrl;
    this.lobbyCode = lobbyCode;
    this.playerId = playerId;
    this.displayName = displayName;
    this.authToken = authToken;
    this.listener = listener;
    this.maxDistance = maxDistance;
    this.iceServers = iceServers;
    this.getLocalState = getLocalState;
    this.getRemoteObject = getRemoteObject;
    this.socket = null;
    this.localStream = null;
    this.localAnalyser = null;
    this.localAnalyserBuffer = null;
    this.localSource = null;
    this.muted = true;
    this.connected = false;
    this.lastStateAt = 0;
    this.lastSpeaking = false;
    this.lastSpeakingAt = 0;
    this.peers = new Map();
    this.remoteStates = new Map();
  }

  connect() {
    if (!this.serverUrl || this.socket) return;
    emit(this, 'status', { state: 'connecting', label: 'VOICE CONNECTING' });
    this.socket = io(this.serverUrl, {
      transports: ['websocket'],
      reconnection: true,
      reconnectionDelay: 750,
      reconnectionDelayMax: 10_000,
      timeout: 8_000,
      auth: this.authToken ? { token: this.authToken } : {},
    });

    this.socket.on('connect', () => {
      this.socket.emit('lobby:join', {
        lobbyCode: this.lobbyCode,
        playerId: this.playerId,
        displayName: this.displayName,
      }, (response) => {
        if (!response?.ok) {
          emit(this, 'error', { message: response?.error || 'Unable to join voice lobby' });
          return;
        }
        this.connected = true;
        emit(this, 'status', { state: 'connected', label: `VOICE · ${response.lobbyCode}` });
        for (const peer of response.peers || []) {
          this.ensurePeer(peer.socketId, peer);
          emit(this, 'playerjoined', peer);
          if (peer.state) {
            const state = { socketId: peer.socketId, playerId: peer.playerId, ...peer.state };
            this.remoteStates.set(peer.socketId, state);
            emit(this, 'playerstate', state);
          }
        }
      });
    });

    this.socket.on('disconnect', () => {
      this.connected = false;
      emit(this, 'status', { state: 'disconnected', label: 'VOICE OFFLINE' });
      for (const peerId of [...this.peers.keys()]) this.removePeer(peerId);
    });
    this.socket.on('connect_error', (error) => emit(this, 'error', { message: error.message }));
    this.socket.on('player:joined', (peer) => {
      this.ensurePeer(peer.socketId, peer);
      emit(this, 'playerjoined', peer);
    });
    this.socket.on('player:left', (peer) => {
      this.removePeer(peer.socketId);
      emit(this, 'playerleft', peer);
    });
    this.socket.on('player:state', (state) => {
      this.remoteStates.set(state.socketId, state);
      const peer = this.peers.get(state.socketId);
      if (peer) peer.playerId = state.playerId || peer.playerId;
      emit(this, 'playerstate', state);
    });
    this.socket.on('voice:speaking', ({ socketId, speaking }) => {
      const peer = this.peers.get(socketId);
      if (peer) peer.signaledSpeaking = Boolean(speaking);
    });
    this.socket.on('webrtc:signal', ({ fromId, signal }) => this.handleSignal(fromId, signal));
  }

  async enableMicrophone() {
    if (!navigator.mediaDevices?.getUserMedia) throw new Error('Microphone capture is unavailable in this browser');
    await this.listener?.context?.resume?.();
    if (!this.localStream) {
      this.localStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          channelCount: 1,
        },
        video: false,
      });
      this.createLocalAnalyser();
      for (const peer of this.peers.values()) this.attachLocalTrack(peer);
    }
    this.muted = false;
    for (const track of this.localStream.getAudioTracks()) track.enabled = true;
    emit(this, 'mutechange', { muted: false });
  }

  async toggleMicrophone() {
    if (!this.localStream) {
      await this.enableMicrophone();
      return false;
    }
    this.muted = !this.muted;
    for (const track of this.localStream.getAudioTracks()) track.enabled = !this.muted;
    if (this.muted && this.lastSpeaking) this.setLocalSpeaking(false);
    emit(this, 'mutechange', { muted: this.muted });
    return this.muted;
  }

  createLocalAnalyser() {
    const context = this.listener?.context || new AudioContext();
    this.localSource = context.createMediaStreamSource(this.localStream);
    this.localAnalyser = context.createAnalyser();
    this.localAnalyser.fftSize = 256;
    this.localAnalyser.smoothingTimeConstant = 0.55;
    this.localAnalyserBuffer = new Uint8Array(this.localAnalyser.fftSize);
    this.localSource.connect(this.localAnalyser);
  }

  ensurePeer(peerId, metadata = {}) {
    if (!peerId || peerId === this.socket?.id) return null;
    const existing = this.peers.get(peerId);
    if (existing) {
      existing.playerId = metadata.playerId || existing.playerId;
      existing.displayName = metadata.displayName || existing.displayName;
      return existing;
    }

    const connection = new RTCPeerConnection({ iceServers: this.iceServers });
    const peer = {
      id: peerId,
      playerId: metadata.playerId,
      displayName: metadata.displayName || 'Player',
      connection,
      makingOffer: false,
      ignoreOffer: false,
      settingRemoteAnswer: false,
      polite: String(this.socket?.id) > String(peerId),
      positionalAudio: null,
      audioElement: null,
      analyser: null,
      analyserBuffer: null,
      remoteStream: null,
      remoteStreamAt: 0,
      signaledSpeaking: false,
      speaking: false,
    };
    this.peers.set(peerId, peer);
    connection.addTransceiver('audio', { direction: 'sendrecv' });
    this.attachLocalTrack(peer);

    connection.onicecandidate = ({ candidate }) => {
      if (candidate) this.sendSignal(peerId, { candidate });
    };
    connection.onnegotiationneeded = async () => {
      try {
        peer.makingOffer = true;
        await connection.setLocalDescription();
        this.sendSignal(peerId, { description: connection.localDescription });
      } catch (error) {
        emit(this, 'error', { message: `Voice negotiation failed: ${error.message}` });
      } finally {
        peer.makingOffer = false;
      }
    };
    connection.ontrack = ({ streams }) => {
      const [stream] = streams;
      if (!stream || peer.remoteStream === stream) return;
      peer.remoteStream = stream;
      peer.remoteStreamAt = performance.now();
      this.attachRemoteAudio(peer);
    };
    connection.onconnectionstatechange = () => {
      if (['failed', 'closed'].includes(connection.connectionState)) this.removePeer(peerId);
    };
    return peer;
  }

  attachLocalTrack(peer) {
    const track = this.localStream?.getAudioTracks()[0];
    if (!track) return;
    const sender = peer.connection.getSenders().find((item) => item.track?.kind === 'audio' || item.track === null);
    if (sender) sender.replaceTrack(track).catch((error) => emit(this, 'error', { message: error.message }));
    else peer.connection.addTrack(track, this.localStream);
  }

  async handleSignal(peerId, signal) {
    const peer = this.ensurePeer(peerId);
    if (!peer) return;
    const connection = peer.connection;
    try {
      if (signal.description) {
        const readyForOffer = !peer.makingOffer && (connection.signalingState === 'stable' || peer.settingRemoteAnswer);
        const offerCollision = signal.description.type === 'offer' && !readyForOffer;
        peer.ignoreOffer = !peer.polite && offerCollision;
        if (peer.ignoreOffer) return;
        peer.settingRemoteAnswer = signal.description.type === 'answer';
        await connection.setRemoteDescription(signal.description);
        peer.settingRemoteAnswer = false;
        if (signal.description.type === 'offer') {
          await connection.setLocalDescription();
          this.sendSignal(peerId, { description: connection.localDescription });
        }
      } else if (signal.candidate) {
        try {
          await connection.addIceCandidate(signal.candidate);
        } catch (error) {
          if (!peer.ignoreOffer) throw error;
        }
      }
    } catch (error) {
      emit(this, 'error', { message: `Voice signaling error: ${error.message}` });
    }
  }

  sendSignal(targetId, signal) {
    if (this.socket?.connected) this.socket.emit('webrtc:signal', { targetId, signal });
  }

  attachRemoteAudio(peer) {
    const object = this.getRemoteObject?.(peer.playerId);
    if (this.listener && object) {
      if (peer.audioElement) {
        peer.audioElement.pause();
        peer.audioElement.srcObject = null;
        peer.audioElement = null;
      }
      const sound = new THREE.PositionalAudio(this.listener);
      sound.setMediaStreamSource(peer.remoteStream);
      sound.setDistanceModel('linear');
      sound.setRefDistance(1.5);
      sound.setMaxDistance(this.maxDistance);
      sound.setRolloffFactor(1);
      object.add(sound);
      peer.positionalAudio = sound;
      peer.analyser = new THREE.AudioAnalyser(sound, 32);
      return;
    }
    // Give the avatar renderer time to create the remote object before using the non-spatial fallback.
    if (this.listener && performance.now() - peer.remoteStreamAt < 1500) return;
    if (peer.audioElement) return;
    const audio = new Audio();
    audio.autoplay = true;
    audio.playsInline = true;
    audio.srcObject = peer.remoteStream;
    audio.play().catch(() => {});
    peer.audioElement = audio;
  }

  update(now = performance.now()) {
    if (this.connected && now - this.lastStateAt >= 100) {
      const state = this.getLocalState?.();
      if (state) this.socket.volatile.emit('player:state', state);
      this.lastStateAt = now;
    }

    if (this.localAnalyser && !this.muted && now - this.lastSpeakingAt >= 80) {
      this.setLocalSpeaking(isSpeakingLevel(rmsLevel(this.localAnalyser, this.localAnalyserBuffer)));
      this.lastSpeakingAt = now;
    }

    const localState = this.getLocalState?.();
    for (const peer of this.peers.values()) {
      const remoteObjectAvailable = Boolean(this.getRemoteObject?.(peer.playerId));
      if (peer.remoteStream && !peer.positionalAudio && (!peer.audioElement || remoteObjectAvailable)) this.attachRemoteAudio(peer);
      const remote = this.remoteStates.get(peer.id);
      const sameSpace = canShareAudioSpace(localState, remote);
      if (peer.positionalAudio) peer.positionalAudio.setVolume(sameSpace ? 1 : 0);
      if (peer.audioElement) {
        if (sameSpace && localState?.position && remote?.position) {
          const dx = localState.position.x - remote.position.x;
          const dy = localState.position.y - remote.position.y;
          const dz = localState.position.z - remote.position.z;
          peer.audioElement.volume = calculateProximityGain(Math.hypot(dx, dy, dz), this.maxDistance);
        } else peer.audioElement.volume = 0;
      }
      let speaking = peer.signaledSpeaking;
      if (peer.analyser) {
        const data = peer.analyser.getFrequencyData();
        speaking = data.reduce((sum, value) => sum + value, 0) / Math.max(1, data.length) > 8;
      }
      speaking = speaking && sameSpace;
      if (speaking !== peer.speaking) {
        peer.speaking = speaking;
        emit(this, 'speaking', { playerId: peer.playerId, speaking });
      }
    }
  }

  setLocalSpeaking(speaking) {
    if (speaking === this.lastSpeaking) return;
    this.lastSpeaking = speaking;
    this.socket?.volatile.emit('voice:speaking', speaking);
    emit(this, 'localspeaking', { speaking });
  }

  removePeer(peerId) {
    const peer = this.peers.get(peerId);
    if (!peer) return;
    peer.connection.onicecandidate = null;
    peer.connection.ontrack = null;
    peer.connection.close();
    peer.positionalAudio?.parent?.remove(peer.positionalAudio);
    peer.positionalAudio?.disconnect?.();
    if (peer.audioElement) {
      peer.audioElement.pause();
      peer.audioElement.srcObject = null;
    }
    this.peers.delete(peerId);
    this.remoteStates.delete(peerId);
    emit(this, 'speaking', { playerId: peer.playerId, speaking: false });
  }

  disconnect() {
    this.socket?.disconnect();
    this.socket = null;
    for (const peerId of [...this.peers.keys()]) this.removePeer(peerId);
    this.localStream?.getTracks().forEach((track) => track.stop());
    this.localSource?.disconnect();
    this.localStream = null;
    this.connected = false;
  }
}
