import { useState, useRef, useEffect } from 'react';
import { getSocket } from '../socket';
import { toast } from '../store/toastStore';

const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' }
];

function useWebRTC() {
  const [callState, setCallState] = useState('idle'); // 'idle' | 'calling' | 'incoming' | 'active'
  const [callType, setCallType] = useState(null); // 'audio' | 'video'
  const [caller, setCaller] = useState(null);
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);

  const peerConnectionRef = useRef(null);
  const pendingOfferRef = useRef(null);
  const targetUserIdRef = useRef(null);

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    socket.on('incoming_call', handleIncomingCall);
    socket.on('webrtc_answer', handleWebRTCAnswer);
    socket.on('webrtc_ice_candidate', handleICECandidate);
    socket.on('call_ended', handleCallEnded);
    socket.on('call_rejected', handleCallRejected);

    return () => {
      socket.off('incoming_call', handleIncomingCall);
      socket.off('webrtc_answer', handleWebRTCAnswer);
      socket.off('webrtc_ice_candidate', handleICECandidate);
      socket.off('call_ended', handleCallEnded);
      socket.off('call_rejected', handleCallRejected);
    };
  }, []);

  const handleIncomingCall = ({ from, offer, callType: type }) => {
    setCallState('incoming');
    setCallType(type);
    setCaller({ id: from });
    pendingOfferRef.current = offer;
    targetUserIdRef.current = from;
  };

  const handleWebRTCAnswer = ({ answer }) => {
    if (peerConnectionRef.current) {
      peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(answer));
      setCallState('active');
    }
  };

  const handleICECandidate = ({ candidate }) => {
    if (peerConnectionRef.current && candidate) {
      peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(candidate));
    }
  };

  const handleCallEnded = () => {
    cleanup();
    toast.success({ title: 'CALL ENDED', message: 'Connection closed cleanly' });
  };

  const handleCallRejected = () => {
    cleanup();
    toast.error({ title: 'CALL REJECTED', message: 'Peer declined the call' });
  };

  const initCall = async (userId, type) => {
    try {
      targetUserIdRef.current = userId;
      setCallType(type);
      setCallState('calling');

      // Get user media
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: type === 'video'
      });

      setLocalStream(stream);

      // Create peer connection
      const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
      peerConnectionRef.current = pc;

      // Add local stream tracks
      stream.getTracks().forEach((track) => {
        pc.addTrack(track, stream);
      });

      // Handle ICE candidates
      pc.onicecandidate = (event) => {
        if (event.candidate) {
          const socket = getSocket();
          socket?.emit('webrtc_ice_candidate', {
            to: userId,
            candidate: event.candidate
          });
        }
      };

      // Handle remote stream
      pc.ontrack = (event) => {
        setRemoteStream(event.streams[0]);
      };

      // Create and send offer
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      const socket = getSocket();
      socket?.emit('webrtc_offer', {
        to: userId,
        offer,
        callType: type
      });
    } catch (error) {
      console.error('Failed to init call:', error);
      cleanup();
      toast.error({ title: 'CALL FAILED', message: 'Failed to access camera/microphone' });
    }
  };

  const answerCall = async () => {
    try {
      const offer = pendingOfferRef.current;
      if (!offer) return;

      // Get user media
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: callType === 'video'
      });

      setLocalStream(stream);

      // Create peer connection
      const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
      peerConnectionRef.current = pc;

      // Add local stream tracks
      stream.getTracks().forEach((track) => {
        pc.addTrack(track, stream);
      });

      // Handle ICE candidates
      pc.onicecandidate = (event) => {
        if (event.candidate) {
          const socket = getSocket();
          socket?.emit('webrtc_ice_candidate', {
            to: targetUserIdRef.current,
            candidate: event.candidate
          });
        }
      };

      // Handle remote stream
      pc.ontrack = (event) => {
        setRemoteStream(event.streams[0]);
      };

      // Set remote description and create answer
      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      // Send answer
      const socket = getSocket();
      socket?.emit('webrtc_answer', {
        to: targetUserIdRef.current,
        answer
      });

      setCallState('active');
      pendingOfferRef.current = null;
    } catch (error) {
      console.error('Failed to answer call:', error);
      cleanup();
      toast.error({ title: 'CALL FAILED', message: 'Failed to access camera/microphone' });
    }
  };

  const rejectCall = () => {
    const socket = getSocket();
    socket?.emit('call_rejected', { to: targetUserIdRef.current });
    cleanup();
  };

  const endCall = () => {
    const socket = getSocket();
    socket?.emit('call_end', { to: targetUserIdRef.current });
    cleanup();
  };

  const cleanup = () => {
    // Stop local stream
    if (localStream) {
      localStream.getTracks().forEach((track) => track.stop());
    }

    // Close peer connection
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }

    setLocalStream(null);
    setRemoteStream(null);
    setCallState('idle');
    setCallType(null);
    setCaller(null);
    setIsMuted(false);
    setIsVideoEnabled(true);
    targetUserIdRef.current = null;
    pendingOfferRef.current = null;
  };

  const toggleMute = () => {
    if (localStream) {
      const audioTrack = localStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsMuted(!audioTrack.enabled);
      }
    }
  };

  const toggleVideo = () => {
    if (localStream) {
      const videoTrack = localStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsVideoEnabled(videoTrack.enabled);
      }
    }
  };

  // Polls peerConnection.getStats() and returns { ping, bandwidth, packetLoss, quality }
  const getStats = async () => {
    const pc = peerConnectionRef.current;
    if (!pc) return null;
    try {
      const report = await pc.getStats();
      let rtt = null;
      let bytesInbound = 0;
      let packetsLost = 0;
      let packetsReceived = 0;
      report.forEach((r) => {
        if (r.type === 'candidate-pair' && r.nominated && typeof r.currentRoundTripTime === 'number') {
          rtt = r.currentRoundTripTime * 1000; // → ms
        }
        if (r.type === 'inbound-rtp' && !r.isRemote) {
          bytesInbound += r.bytesReceived || 0;
          packetsLost += r.packetsLost || 0;
          packetsReceived += r.packetsReceived || 0;
        }
      });
      return { rtt, bytesInbound, packetsLost, packetsReceived };
    } catch { return null; }
  };

  return {
    callState,
    callType,
    caller,
    localStream,
    remoteStream,
    isMuted,
    isVideoEnabled,
    initCall,
    answerCall,
    rejectCall,
    endCall,
    toggleMute,
    toggleVideo,
    getStats,
  };
}

export default useWebRTC;
