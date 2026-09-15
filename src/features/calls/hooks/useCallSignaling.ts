import { useEffect, useRef, useState } from 'react';
import { getCallSocket } from '../../../lib/socket/callSocket';
import { CallState, DirectMessage, Neighbor } from '../../../types';
import { User as FirebaseUser } from 'firebase/auth';
import { ApiUser } from '../../../lib/api/types';

interface UseCallSignalingParams {
  currentUser: FirebaseUser | null;
  appUser: ApiUser | null;
  friendIds: string[];
  neighbors: Neighbor[];
  triggerBeep: (freq: number, duration: number, type?: OscillatorType) => void;
  setAudioFeedback: (msg: string) => void;
  setChatMessages: (
    updater: (prev: Record<string, DirectMessage[]>) => Record<string, DirectMessage[]>,
  ) => void;
}

const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
  { urls: 'stun:stun3.l.google.com:19302' },
  { urls: 'stun:stun4.l.google.com:19302' },
  { urls: 'stun:stun.cloudflare.com:3478' },
  { urls: 'turn:openrelay.metered.ca:80', username: 'openrelayproject', credential: 'openrelayproject' },
  { urls: 'turn:openrelay.metered.ca:443', username: 'openrelayproject', credential: 'openrelayproject' },
  { urls: 'turn:openrelay.metered.ca:443?transport=tcp', username: 'openrelayproject', credential: 'openrelayproject' },
];

// The whole audio/video call domain: WebRTC peer connection setup, call
// signaling (via CallGateway over Socket.IO), and the transport controls
// (mute/camera-switch/etc). Pulled out of useNearbyController.ts as the
// first piece of breaking that file into per-domain hooks — this one was
// picked first because it's freshly rewired (the signaling swap from
// Firestore to sockets happened this same session) and has the most
// clearly enumerable set of external dependencies of any domain in there.
export function useCallSignaling({
  currentUser,
  appUser,
  friendIds,
  neighbors,
  triggerBeep,
  setAudioFeedback,
  setChatMessages,
}: UseCallSignalingParams) {
  const [callState, setCallState] = useState<CallState>({
    active: false,
    type: 'video',
    neighborId: '',
    status: 'disconnected',
    incoming: false,
    durationSeconds: 0,
  });
  const [micMuted, setMicMuted] = useState<boolean>(false);
  const [videoOff, setVideoOff] = useState<boolean>(false);
  const [isSpeakerOn, setIsSpeakerOn] = useState<boolean>(true);
  const [beautyMode, setBeautyMode] = useState<boolean>(false);
  const [bluetoothOn, setBluetoothOn] = useState<boolean>(false);
  const [cameraFacingMode, setCameraFacingMode] = useState<'user' | 'environment'>('user');
  const [networkQuality, setNetworkQuality] = useState<'excellent' | 'good' | 'poor' | 'checking'>('checking');
  const [networkQualityDesc, setNetworkQualityDesc] = useState<string>('Connecting...');
  const [iceConnectionState, setIceConnectionState] = useState<string>('new');
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteStreamRef = useRef<MediaStream | null>(null);
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const statsIntervalRef = useRef<any>(null);
  const localCandidatesAddedRef = useRef<number>(0);
  const remoteCandidatesAddedRef = useRef<number>(0);
  const queuedCandidatesRef = useRef<any[]>([]);
  const incomingOfferRef = useRef<{ sdp: string; type: string } | null>(null);

  useEffect(() => {
    if (!currentUser || !appUser) return;
    let cancelled = false;
    let socket: Awaited<ReturnType<typeof getCallSocket>> | null = null;

    getCallSocket().then((s) => {
      if (cancelled) return;
      socket = s;

      s.on('call:incoming', (data: { callerId: string; offer: { sdp: string; type: string }; type: 'audio' | 'video' }) => {
        incomingOfferRef.current = data.offer;
        setCallState(prev => {
          if (prev.active) return prev;
          triggerBeep(650, 0.3, 'sine');
          return {
            active: true,
            type: data.type,
            neighborId: data.callerId,
            status: 'ringing',
            incoming: true,
            durationSeconds: 0,
            callId: `call-${Date.now()}`,
          };
        });
      });

      s.on('call:unavailable', () => {
        setAudioFeedback("They're not reachable right now.");
        setTimeout(() => setAudioFeedback(""), 3000);
        endCall('missed');
      });

      s.on('call:answered', async (data: { calleeId: string; answer: { sdp: string; type: string } }) => {
        if (pcRef.current && !pcRef.current.remoteDescription) {
          try {
            await pcRef.current.setRemoteDescription(new RTCSessionDescription({
              type: 'answer',
              sdp: data.answer.sdp,
            }));
            setCallState(prev => (prev.active ? { ...prev, status: 'connected' } : prev));
            triggerBeep(650, 0.3, 'sine');

            if (queuedCandidatesRef.current.length > 0) {
              for (const cand of queuedCandidatesRef.current) {
                try {
                  await pcRef.current.addIceCandidate(cand);
                } catch (e) {
                  console.warn("Draining queued candidate failed on Caller:", e);
                }
              }
              queuedCandidatesRef.current = [];
            }
          } catch (sdpErr) {
            console.error("WebRTC Caller: Error setting remote description:", sdpErr);
          }
        }
      });

      s.on('call:ice-candidate', async (data: { fromUserId: string; candidate: RTCIceCandidateInit }) => {
        try {
          const rtcCand = new RTCIceCandidate(data.candidate);
          if (pcRef.current && pcRef.current.remoteDescription) {
            await pcRef.current.addIceCandidate(rtcCand);
          } else {
            queuedCandidatesRef.current.push(rtcCand);
          }
        } catch (iceErr) {
          console.warn("Adding ICE candidate failed:", iceErr);
        }
      });

      s.on('call:ended', () => {
        setCallState(prev => {
          if (prev.active) {
            if (localStreamRef.current) {
              localStreamRef.current.getTracks().forEach((track) => track.stop());
              localStreamRef.current = null;
            }
            setLocalStream(null);

            if (remoteStreamRef.current) {
              remoteStreamRef.current.getTracks().forEach((track) => track.stop());
              remoteStreamRef.current = null;
            }
            setRemoteStream(null);

            if (pcRef.current) {
              pcRef.current.close();
              pcRef.current = null;
            }

            if (statsIntervalRef.current) {
              clearInterval(statsIntervalRef.current);
              statsIntervalRef.current = null;
            }

            localCandidatesAddedRef.current = 0;
            remoteCandidatesAddedRef.current = 0;

            triggerBeep(320, 0.2, 'triangle');

            return {
              active: false,
              type: 'video',
              neighborId: '',
              status: 'disconnected',
              incoming: false,
              durationSeconds: 0
            };
          }
          return prev;
        });
      });
    });

    return () => {
      cancelled = true;
      socket?.off('call:incoming');
      socket?.off('call:unavailable');
      socket?.off('call:answered');
      socket?.off('call:ice-candidate');
      socket?.off('call:ended');
    };
  }, [currentUser, appUser]);

  const startCall = async (neighborId: string, type: 'audio' | 'video') => {
    if (callState.active) {
      console.warn("Call already active, ignoring startCall request.");
      setAudioFeedback("⚠️ An active call session is already running!");
      setTimeout(() => setAudioFeedback(""), 3500);
      return;
    }

    if (!friendIds.includes(neighborId) && !neighborId.startsWith('nb-')) {
      setAudioFeedback("🔒 You can only call friends! Send a friend request first.");
      setTimeout(() => setAudioFeedback(""), 4000);
      return;
    }

    const callId = `call-${Date.now()}`;
    triggerBeep(580, 0.15, 'triangle');
    setCallState({
      active: true,
      type,
      neighborId,
      status: 'ringing',
      incoming: false,
      durationSeconds: 0,
      callId
    });

    localCandidatesAddedRef.current = 0;
    remoteCandidatesAddedRef.current = 0;
    setNetworkQuality('checking');
    setNetworkQualityDesc('Establishing peer-to-peer secure link...');

    if (neighborId.startsWith('nb-')) {
      setTimeout(async () => {
        setCallState(prev => {
          if (!prev.active || prev.neighborId !== neighborId) return prev;
          return { ...prev, status: 'connected' };
        });

        try {
          const stream = await navigator.mediaDevices.getUserMedia({
            audio: true,
            video: type === 'video' ? { facingMode: cameraFacingMode } : false
          });
          localStreamRef.current = stream;
          setLocalStream(stream);
          if (localVideoRef.current) {
            localVideoRef.current.srcObject = stream;
          }

          if (type === 'audio') {
            if ('speechSynthesis' in window) {
              const target = neighbors.find(n => n.id === neighborId);
              window.speechSynthesis.cancel();
              const utterance = new SpeechSynthesisUtterance(`Hello! This is ${target?.name || 'your neighbor'}. Nice of you to call! How are things?`);
              window.speechSynthesis.speak(utterance);
            }
          }
        } catch (err) {
          console.warn("Simulated call media initialization failed:", err);
        }
      }, 3000);
      return;
    }

    try {
      const constraints = {
        audio: true,
        video: type === 'video' ? { facingMode: cameraFacingMode } : false
      };

      let stream;
      try {
        stream = await navigator.mediaDevices.getUserMedia(constraints);
      } catch (err) {
        if (type === 'video') {
          console.warn("Camera grab failed o, trying audio-only fallback o:", err);
          setAudioFeedback("⚠️ Camera not found! Answering/calling as audio-only.");
          setTimeout(() => setAudioFeedback(""), 3500);
          type = 'audio';
          setCallState(prev => ({ ...prev, type: 'audio' }));
          stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        } else {
          throw err;
        }
      }

      localStreamRef.current = stream;
      setLocalStream(stream);

      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }

      const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
      pcRef.current = pc;

      stream.getTracks().forEach((track) => {
        pc.addTrack(track, stream);
      });

      pc.ontrack = (event) => {
        console.log("WebRTC Caller: Remote track received o!", event.streams, event.track);
        const incomingStream = (event.streams && event.streams[0])
          ? event.streams[0]
          : (remoteStreamRef.current || new MediaStream());

        if (!event.streams || !event.streams[0]) {
          incomingStream.addTrack(event.track);
        }

        remoteStreamRef.current = incomingStream;
        setRemoteStream(incomingStream);
        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = incomingStream;
          remoteVideoRef.current.play().catch((playErr) => console.warn("WebRTC Caller: remote play() blocked by browser:", playErr));
        }
      };

      pc.oniceconnectionstatechange = () => {
        const state = pc.iceConnectionState;
        setIceConnectionState(state);
        if (state === 'disconnected' || state === 'failed') {
          setNetworkQuality('poor');
          setNetworkQualityDesc('Connection dropped.');
        } else if (state === 'connected' || state === 'completed') {
          setNetworkQuality('excellent');
          setNetworkQualityDesc('Secure Connection Established');
        }
      };

      statsIntervalRef.current = setInterval(() => {
        if (pcRef.current && pcRef.current.iceConnectionState === 'connected') {
          pcRef.current.getStats().then((stats) => {
            stats.forEach((report) => {
              if (report.type === 'candidate-pair' && report.state === 'succeeded') {
                const rtt = report.currentRoundTripTime;
                if (typeof rtt === 'number') {
                  const rttMs = rtt * 1000;
                  if (rttMs < 120) {
                    setNetworkQuality('excellent');
                    setNetworkQualityDesc(`Stable (Ping: ${Math.round(rttMs)}ms)`);
                  } else if (rttMs < 350) {
                    setNetworkQuality('good');
                    setNetworkQualityDesc(`Good (Ping: ${Math.round(rttMs)}ms)`);
                  } else {
                    setNetworkQuality('poor');
                    setNetworkQualityDesc(`Poor Connection (Ping: ${Math.round(rttMs)}ms)`);
                  }
                }
              }
            });
          });
        }
      }, 2000);

      pc.onicecandidate = async (event) => {
        if (event.candidate) {
          try {
            const socket = await getCallSocket();
            socket.emit('call:ice-candidate', {
              targetUserId: neighborId,
              candidate: event.candidate.toJSON(),
            });
          } catch (candErr) {
            console.warn("Failed sending Caller ICE Candidate:", candErr);
          }
        }
      };

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      try {
        const socket = await getCallSocket();
        socket.emit('call:invite', {
          calleeId: neighborId,
          offer: { sdp: offer.sdp, type: offer.type },
          type,
        });
      } catch (inviteErr) {
        console.error("Failed to send call invite:", inviteErr);
        endCall('missed');
      }
    } catch (gUerr) {
      console.error("Camera/Mic WebRTC setup failed:", gUerr);
      setAudioFeedback("Local caller permissions error. Enable Camera/Mic!");
      setTimeout(() => setAudioFeedback(""), 4000);
      endCall('missed');
    }
  };

  const receiveCallSimulation = async (neighborId: string, type: 'audio' | 'video' = 'audio') => {
    if (callState.active) return;
    setCallState({
      active: true,
      type,
      neighborId,
      status: 'ringing',
      incoming: true,
      durationSeconds: 0
    });
  };

  const answerIncomingCall = async () => {
    triggerBeep(680, 0.2, 'sine');

    localCandidatesAddedRef.current = 0;
    remoteCandidatesAddedRef.current = 0;
    setNetworkQuality('checking');
    setNetworkQualityDesc('Configuring secure media handshake...');

    if (callState.neighborId && callState.neighborId.startsWith('nb-')) {
      try {
        const constraints = {
          audio: true,
          video: callState.type === 'video' ? { facingMode: cameraFacingMode } : false
        };
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        localStreamRef.current = stream;
        setLocalStream(stream);
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }

        setCallState(prev => ({
          ...prev,
          status: 'connected'
        }));

        if (callState.type === 'audio') {
          if ('speechSynthesis' in window) {
            const target = neighbors.find(n => n.id === callState.neighborId);
            window.speechSynthesis.cancel();
            const utterance = new SpeechSynthesisUtterance(`Hello! Thanks for picking up my call. This is ${target?.name || 'friend'}. Let's chat!`);
            window.speechSynthesis.speak(utterance);
          }
        }
      } catch (err) {
        console.error("Answering simulated call failed:", err);
      }
      return;
    }

    if (currentUser && callState.neighborId) {
      try {
        const offerSdp = incomingOfferRef.current?.sdp;
        const offerType = incomingOfferRef.current?.type || 'offer';

        if (!offerSdp) {
          console.error("No offer found — cannot answer yet.");
          setAudioFeedback("Call info still loading, try answering again in a moment.");
          setTimeout(() => setAudioFeedback(""), 3000);
          return;
        }

        const constraints = {
          audio: true,
          video: callState.type === 'video' ? { facingMode: cameraFacingMode } : false
        };

        let stream;
        try {
          stream = await navigator.mediaDevices.getUserMedia(constraints);
        } catch (err) {
          if (callState.type === 'video') {
            console.warn("Receiver camera hook failed o, fallback to audio-only o:", err);
            setAudioFeedback("⚠️ Camera not found! Answering as audio-only.");
            setTimeout(() => setAudioFeedback(""), 3500);
            setCallState(prev => ({ ...prev, type: 'audio' }));
            stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
          } else {
            throw err;
          }
        }

        localStreamRef.current = stream;
        setLocalStream(stream);

        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }

        const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
        pcRef.current = pc;

        stream.getTracks().forEach((track) => {
          pc.addTrack(track, stream);
        });

        pc.ontrack = (event) => {
          console.log("WebRTC Receiver: Remote track received o!", event.streams, event.track);
          const incomingStream = (event.streams && event.streams[0])
            ? event.streams[0]
            : (remoteStreamRef.current || new MediaStream());

          if (!event.streams || !event.streams[0]) {
            incomingStream.addTrack(event.track);
          }

          remoteStreamRef.current = incomingStream;
          setRemoteStream(incomingStream);
          if (remoteVideoRef.current) {
            remoteVideoRef.current.srcObject = incomingStream;
            remoteVideoRef.current.play().catch((playErr) => console.warn("WebRTC Receiver: remote play() blocked by browser:", playErr));
          }
        };

        pc.oniceconnectionstatechange = () => {
          const state = pc.iceConnectionState;
          setIceConnectionState(state);
          if (state === 'disconnected' || state === 'failed') {
            setNetworkQuality('poor');
            setNetworkQualityDesc('Connection dropped.');
          } else if (state === 'connected' || state === 'completed') {
            setNetworkQuality('excellent');
            setNetworkQualityDesc('Secure Connection Established');
          }
        };

        statsIntervalRef.current = setInterval(() => {
          if (pcRef.current && pcRef.current.iceConnectionState === 'connected') {
            pcRef.current.getStats().then((stats) => {
              stats.forEach((report) => {
                if (report.type === 'candidate-pair' && report.state === 'succeeded') {
                  const rtt = report.currentRoundTripTime;
                  if (typeof rtt === 'number') {
                    const rttMs = rtt * 1000;
                    if (rttMs < 120) {
                      setNetworkQuality('excellent');
                      setNetworkQualityDesc(`Stable (Ping: ${Math.round(rttMs)}ms)`);
                    } else if (rttMs < 350) {
                      setNetworkQuality('good');
                      setNetworkQualityDesc(`Good (Ping: ${Math.round(rttMs)}ms)`);
                    } else {
                      setNetworkQuality('poor');
                      setNetworkQualityDesc(`Poor Connection (Ping: ${Math.round(rttMs)}ms)`);
                    }
                  }
                }
              });
            });
          }
        }, 2000);

        pc.onicecandidate = async (event) => {
          if (event.candidate) {
            try {
              const socket = await getCallSocket();
              socket.emit('call:ice-candidate', {
                targetUserId: callState.neighborId,
                candidate: event.candidate.toJSON(),
              });
            } catch (candErr) {
              console.warn("Failed sending Receiver ICE Candidate:", candErr);
            }
          }
        };

        await pc.setRemoteDescription(new RTCSessionDescription({
          type: offerType as 'offer',
          sdp: offerSdp
        }));

        const queuedList = Array.isArray(queuedCandidatesRef.current) ? queuedCandidatesRef.current : [];
        if (queuedList.length > 0) {
          for (const cand of queuedList) {
            try {
              await pc.addIceCandidate(cand);
            } catch (e) {
              console.warn("Draining queued candidate failed on Receiver:", e);
            }
          }
          queuedCandidatesRef.current = [];
        }

        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);

        try {
          const socket = await getCallSocket();
          socket.emit('call:answer', {
            callerId: callState.neighborId,
            answer: { sdp: answer.sdp, type: answer.type },
          });
        } catch (answerErr) {
          console.error("Failed to send call answer:", answerErr);
        }

        setCallState(prev => ({
          ...prev,
          status: 'connected'
        }));
      } catch (err) {
        console.error("WebRTC answering failed:", err);
        setAudioFeedback("Answering call media initialization failed!");
        setTimeout(() => setAudioFeedback(""), 4000);
        endCall('missed');
      }
    }
  };

  const endCall = async (status: 'completed' | 'declined' | 'missed' = 'completed') => {
    triggerBeep(300, 0.25, 'triangle');
    const { neighborId, type, durationSeconds } = callState;

    if (statsIntervalRef.current) {
      clearInterval(statsIntervalRef.current);
      statsIntervalRef.current = null;
    }

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => {
        try {
          track.stop();
          track.enabled = false;
        } catch (e) {
          console.warn("Failed to stop track on localStreamRef:", e);
        }
      });
      localStreamRef.current = null;
    }
    if (localStream) {
      localStream.getTracks().forEach((track) => {
        try {
          track.stop();
          track.enabled = false;
        } catch (e) {
          console.warn("Failed to stop track on localStream:", e);
        }
      });
    }
    setLocalStream(null);

    if (remoteStreamRef.current) {
      remoteStreamRef.current.getTracks().forEach((track) => {
        try {
          track.stop();
          track.enabled = false;
        } catch (e) {
          console.warn("Failed to stop track on remoteStreamRef:", e);
        }
      });
      remoteStreamRef.current = null;
    }
    if (remoteStream) {
      remoteStream.getTracks().forEach((track) => {
        try {
          track.stop();
          track.enabled = false;
        } catch (e) {
          console.warn("Failed to stop track on remoteStream:", e);
        }
      });
    }
    setRemoteStream(null);

    if (localVideoRef.current) {
      localVideoRef.current.srcObject = null;
    }
    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = null;
    }

    if (pcRef.current) {
      pcRef.current.onicecandidate = null;
      pcRef.current.oniceconnectionstatechange = null;
      pcRef.current.ontrack = null;
      try {
        pcRef.current.close();
      } catch (e) {
        console.warn("Error closing peer connection:", e);
      }
      pcRef.current = null;
    }

    localCandidatesAddedRef.current = 0;
    remoteCandidatesAddedRef.current = 0;
    queuedCandidatesRef.current = [];
    setNetworkQuality('checking');
    setNetworkQualityDesc('Checking...');

    if (currentUser && neighborId && !neighborId.startsWith('nb-')) {
      try {
        const socket = await getCallSocket();
        socket.emit('call:end', { targetUserId: neighborId });
      } catch (err) {
        console.error("Error sending call:end signal:", err);
      }
    }

    if (neighborId) {
      const logMsg: DirectMessage = {
        id: `call-log-${Date.now()}`,
        senderId: callState.incoming ? neighborId : 'user',
        receiverId: callState.incoming ? 'user' : neighborId,
        timestamp: new Date().toISOString(),
        type: 'call_log',
        callLog: {
          type,
          status,
          durationSeconds
        }
      };
      setChatMessages(prev => ({
        ...prev,
        [neighborId]: [...(prev[neighborId] || []), logMsg]
      }));

      try {
        const prevLogs = JSON.parse(localStorage.getItem('call_history_logs') || '[]');
        const newLog = {
          id: `log-${Date.now()}`,
          neighborId,
          type,
          status,
          durationSeconds,
          timestamp: new Date().toLocaleDateString() + ' ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          incoming: callState.incoming
        };
        localStorage.setItem('call_history_logs', JSON.stringify([newLog, ...prevLogs]));
      } catch (logErr) {
        console.warn("Call history append log error:", logErr);
      }
    }

    setCallState({
      active: false,
      type: 'video',
      neighborId: '',
      status: 'disconnected',
      incoming: false,
      durationSeconds: 0
    });
  };

  const switchCamera = async () => {
    if (!localStreamRef.current || callState.type !== 'video') return;
    triggerBeep(450, 0.08);

    const nextFacing = cameraFacingMode === 'user' ? 'environment' : 'user';
    setCameraFacingMode(nextFacing);
    setAudioFeedback(`🔄 Switching to ${nextFacing} camera...`);
    setTimeout(() => setAudioFeedback(""), 2000);

    try {
      const oldVideoTrack = localStreamRef.current.getVideoTracks()[0];
      if (oldVideoTrack) {
        oldVideoTrack.stop();
      }

      const newStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: nextFacing },
        audio: false
      });
      const newVideoTrack = newStream.getVideoTracks()[0];

      localStreamRef.current.removeTrack(oldVideoTrack);
      localStreamRef.current.addTrack(newVideoTrack);

      const updatedStream = new MediaStream(localStreamRef.current.getTracks());
      localStreamRef.current = updatedStream;
      setLocalStream(updatedStream);

      if (localVideoRef.current) {
        localVideoRef.current.srcObject = updatedStream;
      }

      const sender = pcRef.current?.getSenders().find((s) => s.track?.kind === 'video');
      if (sender) {
        await sender.replaceTrack(newVideoTrack);
        console.log("WebRTC Video Sender Track replaced successfully!");
      }
    } catch (err) {
      console.error("Failed to switch camera source:", err);
      setAudioFeedback("⚠ Camera switch failed!");
      setTimeout(() => setAudioFeedback(""), 2000);
    }
  };

  const toggleMicMute = () => {
    const isMuted = !micMuted;
    setMicMuted(isMuted);
    triggerBeep(isMuted ? 380 : 500, 0.05);

    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach((track) => {
        track.enabled = !isMuted;
      });
    }
  };

  const toggleVideoOff = () => {
    const isOff = !videoOff;
    setVideoOff(isOff);
    triggerBeep(isOff ? 380 : 500, 0.05);

    if (localStreamRef.current) {
      localStreamRef.current.getVideoTracks().forEach((track) => {
        track.enabled = !isOff;
      });
    }
  };

  return {
    callState, setCallState,
    micMuted, setMicMuted,
    videoOff, setVideoOff,
    isSpeakerOn, setIsSpeakerOn,
    beautyMode, setBeautyMode,
    bluetoothOn, setBluetoothOn,
    cameraFacingMode, setCameraFacingMode,
    networkQuality, networkQualityDesc, iceConnectionState,
    localStream, remoteStream,
    pcRef, localStreamRef, remoteStreamRef, localVideoRef, remoteVideoRef,
    startCall, receiveCallSimulation, answerIncomingCall, endCall,
    switchCamera, toggleMicMute, toggleVideoOff,
  };
}
