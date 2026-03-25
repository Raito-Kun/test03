import { UserAgent, Registerer, RegistererState, Inviter, Invitation, SessionState } from 'sip.js';
import type { Session } from 'sip.js';

export interface SipConfig {
  server: string;
  extension: string;
  password: string;
  domain: string;
}

export interface SipCallbacks {
  onRegistered?: () => void;
  onUnregistered?: () => void;
  onIncomingCall?: (caller: string, session: Session) => void;
  onCallEstablished?: () => void;
  onCallEnded?: () => void;
  onError?: (error: string) => void;
}

let userAgent: UserAgent | null = null;
let registerer: Registerer | null = null;
let currentSession: Session | null = null;
let remoteAudio: HTMLAudioElement | null = null;
let callbacks: SipCallbacks = {};

/** Initialize SIP User Agent */
export function initSip(config: SipConfig, cbs: SipCallbacks): void {
  callbacks = cbs;

  if (!remoteAudio) {
    remoteAudio = new Audio();
    remoteAudio.autoplay = true;
    document.body.appendChild(remoteAudio);
  }

  const uri = UserAgent.makeURI(`sip:${config.extension}@${config.domain}`);
  if (!uri) { callbacks.onError?.('Invalid SIP URI'); return; }

  console.log('[SIP] Creating UserAgent', { server: config.server, ext: config.extension, domain: config.domain });

  userAgent = new UserAgent({
    uri,
    transportOptions: { server: config.server },
    authorizationUsername: config.extension,
    authorizationPassword: config.password,
    logLevel: 'warn',
    delegate: {
      onInvite: (invitation: Invitation) => {
        console.log('[SIP] Incoming call');
        currentSession = invitation;
        setupSessionHandlers(invitation);
        const caller = invitation.remoteIdentity.uri.user || 'Unknown';
        callbacks.onIncomingCall?.(caller, invitation);
      },
    },
  });

  userAgent.start().then(() => {
    console.log('[SIP] UserAgent started, registering...');
    registerer = new Registerer(userAgent!);

    // Listen for registration state changes
    registerer.stateChange.addListener((state) => {
      console.log('[SIP] Registerer state:', state);
      if (state === RegistererState.Registered) {
        callbacks.onRegistered?.();
      } else if (state === RegistererState.Unregistered) {
        callbacks.onUnregistered?.();
      }
    });

    registerer.register().catch((err) => {
      console.error('[SIP] Register failed:', err);
      callbacks.onError?.(`SIP register failed: ${err.message || err}`);
    });
  }).catch((err) => {
    console.error('[SIP] Start failed:', err);
    callbacks.onError?.(`SIP start failed: ${err.message}`);
  });
}

/** Make outbound call */
export function makeCall(target: string, domain: string): Session | null {
  if (!userAgent) { callbacks.onError?.('SIP not initialized'); return null; }

  const targetUri = UserAgent.makeURI(`sip:${target}@${domain}`);
  if (!targetUri) { callbacks.onError?.('Invalid target'); return null; }

  console.log('[SIP] Calling', target);
  const inviter = new Inviter(userAgent, targetUri);
  currentSession = inviter;
  setupSessionHandlers(inviter);
  inviter.invite().catch((err) => {
    console.error('[SIP] Invite failed:', err);
    callbacks.onError?.(`Call failed: ${err.message || err}`);
  });
  return inviter;
}

/** Answer incoming call */
export function answerCall(): void {
  if (currentSession && currentSession instanceof Invitation) {
    (currentSession as Invitation).accept();
  }
}

/** Hang up current call */
export function hangupCall(): void {
  if (!currentSession) return;
  try {
    switch (currentSession.state) {
      case SessionState.Initial:
      case SessionState.Establishing:
        if (currentSession instanceof Inviter) currentSession.cancel();
        else if (currentSession instanceof Invitation) (currentSession as Invitation).reject();
        break;
      case SessionState.Established:
        currentSession.bye();
        break;
    }
  } catch (err) {
    console.error('[SIP] Hangup error:', err);
  }
  currentSession = null;
}

/** Mute/unmute local audio */
export function toggleMute(mute: boolean): void {
  if (!currentSession) return;
  const pc = (currentSession.sessionDescriptionHandler as unknown as { peerConnection: RTCPeerConnection })?.peerConnection;
  if (pc) {
    pc.getSenders().forEach((sender) => {
      if (sender.track?.kind === 'audio') sender.track.enabled = !mute;
    });
  }
}

/** Hold (simplified — re-invite not fully implemented) */
export function toggleHold(_hold: boolean): void {
  // Hold requires re-INVITE with sendonly SDP — complex for MVP
  console.log('[SIP] Hold not fully implemented in WebRTC mode');
}

/** Send DTMF */
export function sendDtmf(digit: string): void {
  if (currentSession?.state === SessionState.Established) {
    const pc = (currentSession.sessionDescriptionHandler as unknown as { peerConnection: RTCPeerConnection })?.peerConnection;
    if (pc) {
      const sender = pc.getSenders().find((s) => s.track?.kind === 'audio');
      if (sender) {
        (sender as unknown as { dtmf: RTCDTMFSender }).dtmf?.insertDTMF(digit, 100, 70);
      }
    }
  }
}

/** Disconnect SIP */
export function disconnectSip(): void {
  try {
    registerer?.unregister();
    userAgent?.stop();
  } catch (err) {
    console.error('[SIP] Disconnect error:', err);
  }
  userAgent = null;
  registerer = null;
  currentSession = null;
  callbacks.onUnregistered?.();
}

/** Setup session event handlers */
function setupSessionHandlers(session: Session): void {
  session.stateChange.addListener((state) => {
    console.log('[SIP] Session state:', state);
    switch (state) {
      case SessionState.Established:
        attachRemoteAudio(session);
        callbacks.onCallEstablished?.();
        break;
      case SessionState.Terminated:
        currentSession = null;
        callbacks.onCallEnded?.();
        break;
    }
  });
}

/** Attach remote audio stream */
function attachRemoteAudio(session: Session): void {
  const pc = (session.sessionDescriptionHandler as unknown as { peerConnection: RTCPeerConnection })?.peerConnection;
  if (pc && remoteAudio) {
    const receivers = pc.getReceivers();
    if (receivers.length > 0) {
      const stream = new MediaStream();
      receivers.forEach((r) => { if (r.track) stream.addTrack(r.track); });
      remoteAudio.srcObject = stream;
    }
  }
}

export function getCurrentSession(): Session | null { return currentSession; }
export function isRegistered(): boolean { return registerer?.state === RegistererState.Registered; }
