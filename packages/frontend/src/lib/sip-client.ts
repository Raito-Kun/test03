import { UserAgent, Registerer, Inviter, Invitation, SessionState } from 'sip.js';
import type { Session } from 'sip.js';

export interface SipConfig {
  server: string;       // WSS URL: wss://fusionpbx:7443
  extension: string;    // SIP extension: 1001
  password: string;     // SIP password
  domain: string;       // SIP domain
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

  // Create audio element for remote audio
  if (!remoteAudio) {
    remoteAudio = new Audio();
    remoteAudio.autoplay = true;
    document.body.appendChild(remoteAudio);
  }

  const uri = UserAgent.makeURI(`sip:${config.extension}@${config.domain}`);
  if (!uri) { callbacks.onError?.('Invalid SIP URI'); return; }

  userAgent = new UserAgent({
    uri,
    transportOptions: { server: config.server },
    authorizationUsername: config.extension,
    authorizationPassword: config.password,
    delegate: {
      onInvite: (invitation: Invitation) => {
        currentSession = invitation;
        setupSessionHandlers(invitation);
        const caller = invitation.remoteIdentity.uri.user || 'Unknown';
        callbacks.onIncomingCall?.(caller, invitation);
      },
    },
  });

  userAgent.start().then(() => {
    registerer = new Registerer(userAgent!);
    registerer.register();
    callbacks.onRegistered?.();
  }).catch((err) => {
    callbacks.onError?.(`SIP start failed: ${err.message}`);
  });
}

/** Make outbound call */
export function makeCall(target: string, domain: string): Session | null {
  if (!userAgent) { callbacks.onError?.('SIP not initialized'); return null; }

  const targetUri = UserAgent.makeURI(`sip:${target}@${domain}`);
  if (!targetUri) { callbacks.onError?.('Invalid target'); return null; }

  const inviter = new Inviter(userAgent, targetUri);
  currentSession = inviter;
  setupSessionHandlers(inviter);
  inviter.invite();
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
  currentSession = null;
}

/** Hold/unhold */
export function toggleHold(hold: boolean): void {
  if (!currentSession || currentSession.state !== SessionState.Established) return;
  if (hold) {
    currentSession.invite({ requestDelegate: {}, sessionDescriptionHandlerOptions: {} });
  }
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

/** Send DTMF */
export function sendDtmf(digit: string): void {
  if (currentSession?.state === SessionState.Established) {
    currentSession.info({ requestOptions: { body: { contentDisposition: 'render', contentType: 'application/dtmf-relay', content: `Signal=${digit}\r\nDuration=100` } } });
  }
}

/** Disconnect SIP */
export function disconnectSip(): void {
  registerer?.unregister();
  userAgent?.stop();
  userAgent = null;
  registerer = null;
  currentSession = null;
  callbacks.onUnregistered?.();
}

/** Setup session event handlers */
function setupSessionHandlers(session: Session): void {
  session.stateChange.addListener((state) => {
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

/** Attach remote audio stream to audio element */
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
export function isRegistered(): boolean { return !!registerer; }
