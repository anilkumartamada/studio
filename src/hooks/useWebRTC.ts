import { useState, useEffect, useRef, useCallback, RefObject } from 'react';
import { db } from '@/lib/firebase';
import { useAuth } from '@/hooks/useAuth';
import {
  collection,
  query,
  where,
  onSnapshot,
  doc,
  updateDoc,
  getDoc,
  getDocs,
  serverTimestamp,
  deleteDoc,
  limit,
  setDoc,
  arrayUnion,
  runTransaction,
} from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import type { Call } from '@/types';

const servers = {
  iceServers: [
    {
      urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'],
    },
  ],
  iceCandidatePoolSize: 10,
};

export function useWebRTC(localVideoRef: RefObject<HTMLVideoElement>, remoteVideoRef: RefObject<HTMLVideoElement>) {
  const { user } = useAuth();
  const { toast } = useToast();

  const [callId, setCallId] = useState<string | null>(null);
  const [callData, setCallData] = useState<Call | null>(null);
  const [isFinding, setIsFinding] = useState(false);
  const [hasCameraPermission, setHasCameraPermission] = useState(true);
  const [isMicMuted, setIsMicMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);
  
  const localStreamRef = useRef<MediaStream | null>(null);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const callCleanupRef = useRef<(() => void) | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioBufferRef = useRef<Float32Array[]>([]);

  // ---- Permission Management ----
  useEffect(() => {
    const checkCameraPermission = async () => {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const hasVideo = devices.some((d) => d.kind === 'videoinput');
        if (!hasVideo) {
          setHasCameraPermission(false);
          return;
        }
        const stream = await navigator.mediaDevices.getUserMedia({ video: hasVideo, audio: true });
        stream.getTracks().forEach((t) => t.stop());
        setHasCameraPermission(true);
      } catch (err) {
        setHasCameraPermission(false);
        console.error('Initial permission check failed:', err);
      }
    };
    checkCameraPermission();
  }, []);

  const getCameraPermission = useCallback(async () => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) => t.stop());
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      localStreamRef.current = stream;
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }
      setHasCameraPermission(true);
      return stream;
    } catch (error) {
      console.error('Error accessing camera/mic:', error);
      setHasCameraPermission(false);
      toast({
        variant: 'destructive',
        title: 'Camera/Mic Access Denied',
        description: 'Please enable permissions in your browser settings.',
      });
      return null;
    }
  }, [localVideoRef, toast]);

  const toggleMic = useCallback(() => {
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach((track) => {
        track.enabled = !track.enabled;
      });
      setIsMicMuted((prev) => !prev);
    }
  }, []);

  const toggleCamera = useCallback(() => {
    if (localStreamRef.current) {
      localStreamRef.current.getVideoTracks().forEach((track) => {
        track.enabled = !track.enabled;
      });
      setIsCameraOff((prev) => !prev);
    }
  }, []);

  // ---- Call State Management ----
  const resetCallState = useCallback(() => {
    if (callCleanupRef.current) {
      callCleanupRef.current();
      callCleanupRef.current = null;
    }
    
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    localStreamRef.current = null;
    if (localVideoRef.current) localVideoRef.current.srcObject = null;
    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
    
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close();
    }
    audioContextRef.current = null;
    audioBufferRef.current = [];

    pcRef.current?.close();
    pcRef.current = null;

    setCallId(null);
    setCallData(null);
    setIsFinding(false);
    setIsMicMuted(false);
    setIsCameraOff(false);
  }, [localVideoRef, remoteVideoRef]);
  
  const hangUp = useCallback(async (reported = false) => {
    if (!callId) {
      setIsFinding(false);
      resetCallState();
      return;
    }

    if (!reported) {
      const callRef = doc(db, 'calls', callId);
      try {
        const callDoc = await getDoc(callRef);
        if (callDoc.exists()) {
          if (callDoc.data().status === 'active') {
            await updateDoc(callRef, { status: 'ended', endedAt: serverTimestamp() });
          } else if (callDoc.data().status === 'pending') {
            await deleteDoc(callRef);
          }
        }
      } catch (e) {
        console.error("Error ending call:", e);
      }
    }

    resetCallState();
  }, [callId, resetCallState]);

  const cancelFinding = useCallback(async () => {
    if (isFinding && callId) {
       const callRef = doc(db, 'calls', callId);
       const callDoc = await getDoc(callRef);
       if (callDoc.exists() && callDoc.data().status === 'pending') {
         await deleteDoc(callRef);
       }
    }
    setIsFinding(false);
    resetCallState();
  }, [callId, isFinding, resetCallState]);


  // ---- WebRTC & Signaling Logic ----

  const createPeerConnection = useCallback((currentCallId: string) => {
    const pc = new RTCPeerConnection(servers);

    pc.onicecandidate = async (event) => {
      if (!event.candidate) return;
      const callRef = doc(db, 'calls', currentCallId);
      try {
        const callDoc = await getDoc(callRef);
        if (!callDoc.exists()) return;
        const cData = callDoc.data() as Call;
        const isOfferer = cData.participants[0] === user?.uid;
        const field = isOfferer ? 'offerCandidates' : 'answerCandidates';
        await updateDoc(callRef, { [field]: arrayUnion(event.candidate.toJSON()) });
      } catch (err) {
        console.log('Failed to add ICE candidate (maybe call ended):', err);
      }
    };

    pc.ontrack = (event) => {
      const stream = event.streams[0];
       if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = stream;
      }
      startAudioRecording(stream);
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected' || pc.connectionState === 'closed') {
        hangUp();
      }
    };
    
    return pc;
  }, [user?.uid, remoteVideoRef, hangUp]);
  
  const startCall = useCallback(async () => {
    if (!user) return;

    const stream = await getCameraPermission();
    if (!stream) return;

    setIsFinding(true);

    const callsRef = collection(db, 'calls');
    const q = query(callsRef, where('status', '==', 'pending'), limit(1));
    const querySnapshot = await getDocs(q);
    const pendingCalls = querySnapshot.docs.filter((d) => !(d.data().participants || []).includes(user.uid));

    if (pendingCalls.length > 0) {
      const callDocToJoin = pendingCalls[0];
      const callDocRef = doc(db, 'calls', callDocToJoin.id);

      try {
        await runTransaction(db, async (transaction) => {
          const snap = await transaction.get(callDocRef);
          if (!snap.exists() || snap.data().status !== 'pending') {
            throw new Error('Call not available');
          }
          
          pcRef.current = createPeerConnection(callDocToJoin.id);
          stream.getTracks().forEach((track) => pcRef.current!.addTrack(track, stream));

          const offer = snap.data().offer;
          await pcRef.current!.setRemoteDescription(new RTCSessionDescription(offer));
          const answer = await pcRef.current!.createAnswer();
          await pcRef.current!.setLocalDescription(answer);

          transaction.update(callDocRef, {
            status: 'active',
            participants: arrayUnion(user.uid),
            answer: { sdp: answer.sdp || '', type: answer.type },
          });
        });

        setCallId(callDocToJoin.id);
      } catch (error) {
        console.error('Failed to join call, restarting search:', error);
        resetCallState();
        setTimeout(() => startCall(), 1000);
      }
    } else {
      const newCallDocRef = doc(collection(db, 'calls'));
      
      pcRef.current = createPeerConnection(newCallDocRef.id);
      stream.getTracks().forEach((track) => pcRef.current!.addTrack(track, stream));
      
      const offer = await pcRef.current!.createOffer();
      await pcRef.current!.setLocalDescription(offer);

      await setDoc(newCallDocRef, {
        participants: [user.uid],
        status: 'pending',
        startedAt: serverTimestamp(),
        offer: { sdp: offer.sdp || '', type: offer.type },
        offerCandidates: [],
        answerCandidates: [],
      });

      setCallId(newCallDocRef.id);
    }
  }, [user, getCameraPermission, createPeerConnection, resetCallState]);
  
  const startAudioRecording = (stream: MediaStream) => {
    if (!stream || audioContextRef.current || !stream.getAudioTracks().length) {
      return;
    }
    const audioContext = new AudioContext();
    audioContextRef.current = audioContext;

    const source = audioContext.createMediaStreamSource(stream);
    const processor = audioContext.createScriptProcessor(4096, 1, 1);

    source.connect(processor);
    processor.connect(audioContext.destination);

    processor.onaudioprocess = (e) => {
      const inputData = e.inputBuffer.getChannelData(0);
      const buffer = new Float32Array(inputData);
      audioBufferRef.current.push(buffer);
    };
  };

  // Firestore Listener for the Call Document
  useEffect(() => {
    if (!callId || !user) return;

    const addedCandidates = new Set<string>();

    const unsubCall = onSnapshot(doc(db, 'calls', callId), async (docSnapshot) => {
      if (!docSnapshot.exists()) {
        if (callId) { // Only show toast if a call was active
          toast({ title: 'Call Ended', description: 'The other user has left the call.' });
        }
        resetCallState();
        return;
      }

      const newData = docSnapshot.data() as Call;
      setCallData(newData);

      if (newData?.status === 'active' && isFinding) {
        setIsFinding(false);
      }
      
      if (newData?.status === 'ended') {
        toast({ title: 'Call Ended', description: 'The other user has left the call.' });
        resetCallState();
        return;
      }

      // Answerer logic is handled in startCall via transaction. Offerer needs this.
      if (pcRef.current && newData?.answer) {
        // Only set remote description if we are the offerer and haven't set it yet
        if (pcRef.current.signalingState === 'have-local-offer' && !pcRef.current.remoteDescription) {
          await pcRef.current.setRemoteDescription(new RTCSessionDescription(newData.answer));
        }
      }

      const isOfferer = newData.participants[0] === user.uid;
      const candidatesField = isOfferer ? 'answerCandidates' : 'offerCandidates';
      const candidates = (newData as any)[candidatesField] as RTCIceCandidateInit[] | undefined;

      if (candidates && pcRef.current?.remoteDescription) {
        candidates.forEach((c) => {
          const key = JSON.stringify(c);
          if (!addedCandidates.has(key)) {
            pcRef.current!.addIceCandidate(new RTCIceCandidate(c));
            addedCandidates.add(key);
          }
        });
      }
    });

    callCleanupRef.current = () => {
      unsubCall();
    };

    return unsubCall;
  }, [callId, user, isFinding, resetCallState, toast]);


  return {
    callId,
    callData,
    isFinding,
    hasCameraPermission,
    isMicMuted,
    isCameraOff,
    startCall,
    cancelFinding,
    hangUp,
    toggleMic,
    toggleCamera,
    getCameraPermission,
    audioBufferRef
  };
}

