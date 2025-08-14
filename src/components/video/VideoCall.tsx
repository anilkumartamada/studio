"use client";

import { useState, useEffect, useRef } from 'react';
import { db } from '@/lib/firebase';
import { useAuth } from '@/hooks/useAuth';
import {
  collection,
  query,
  where,
  onSnapshot,
  addDoc,
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
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { Loader2, PhoneOff, Send, Video, AlertCircle, Flag, Mic, MicOff, VideoOff } from 'lucide-react';
import { Input } from '../ui/input';
import { ScrollArea } from '../ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import type { Call, Message } from '@/types';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';
import { transcribeCall } from '@/ai/flows/transcribe-call';

export function VideoCall() {
  const { user } = useAuth();
  const { toast } = useToast();

  const [callId, setCallId] = useState<string | null>(null);
  const [callData, setCallData] = useState<Call | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isFinding, setIsFinding] = useState(false);
  const [hasCameraPermission, setHasCameraPermission] = useState(true);
  const [isReporting, setIsReporting] = useState(false);
  const [isMicMuted, setIsMicMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);


  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);

  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteStreamRef = useRef<MediaStream | null>(null);

  const audioContextRef = useRef<AudioContext | null>(null);
  const audioBufferRef = useRef<Float32Array[]>([]);
  const callCleanupRef = useRef<(() => void) | null>(null);

  // ---- Permission pre-check on mount (non-blocking) ----
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

  // ---- Get user media and attach to local video ----
  const getCameraPermission = async () => {
    // Stop any previous local stream (if re-trying)
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });

      // Attach to local preview
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }

      localStreamRef.current = stream;
      setHasCameraPermission(true);
      return stream;
    } catch (error) {
      console.error('Error accessing camera/mic:', error);
      setHasCameraPermission(false);
      toast({
        variant: 'destructive',
        title: 'Camera/Mic Access Denied',
        description: 'Please enable camera and microphone permissions in your browser settings.',
      });
      return null;
    }
  };

  // ---- Create PeerConnection and wire handlers (but do NOT create offers/answers here) ----
  const createPeerConnection = (currentCallId: string) => {
    const pc = new RTCPeerConnection({
      iceServers: [
        // STUN is fine for testing; for production behind NATs you’ll want a TURN server.
        { urls: 'stun:stun.l.google.com:19302' },
      ],
    });

    // Prepare remote media sink early
    if (!remoteStreamRef.current) {
      remoteStreamRef.current = new MediaStream();
    }
    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = remoteStreamRef.current;
    }

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
      // Ensure tracks are added to our dedicated remote stream (not directly to video)
      const [remoteStream] = event.streams;
      if (!remoteStreamRef.current) {
        remoteStreamRef.current = new MediaStream();
      }
      // Add all tracks from the event’s stream to our remote stream
      remoteStream.getTracks().forEach((track) => {
        if (!remoteStreamRef.current!.getTracks().includes(track)) {
          remoteStreamRef.current!.addTrack(track);
        }
      });
      // Attach (if not already)
      if (remoteVideoRef.current && remoteVideoRef.current.srcObject !== remoteStreamRef.current) {
        remoteVideoRef.current.srcObject = remoteStreamRef.current;
      }
      startAudioRecording();
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected' || pc.connectionState === 'closed') {
        // Soft cleanup if the connection dies
        console.log('Peer connection state:', pc.connectionState);
      }
    };

    return pc;
  };

  // ---- Start matching and connect logic ----
  const startCall = async () => {
    if (!user) return;

    // 1) Get local media FIRST
    const stream = await getCameraPermission();
    if (!stream) return;

    setIsFinding(true);

    // 2) Try to join a pending call from someone else
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

          // 3) Create PC
          pcRef.current = createPeerConnection(callDocToJoin.id);

          // 4) ADD LOCAL TRACKS *BEFORE* createAnswer
          stream.getTracks().forEach((track) => {
            pcRef.current!.addTrack(track, stream);
          });

          // 5) Set remote offer, create and set local answer
          const offer = snap.data().offer;
          await pcRef.current!.setRemoteDescription(new RTCSessionDescription(offer));

          const answer = await pcRef.current!.createAnswer();
          await pcRef.current!.setLocalDescription(answer);

          // 6) Move call to active with our answer
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
        return;
      }
    } else {
      // No pending call found — create one and wait
      const newCallDocRef = doc(collection(db, 'calls'));

      // 3) Create PC
      pcRef.current = createPeerConnection(newCallDocRef.id);

      // 4) ADD LOCAL TRACKS *BEFORE* createOffer
      stream.getTracks().forEach((track) => {
        pcRef.current!.addTrack(track, stream);
      });

      // 5) Create and set local offer
      const offer = await pcRef.current!.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: true,
      });
      await pcRef.current!.setLocalDescription(offer);

      // 6) Write pending call doc
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
  };

  // ---- Audio capture for report transcription (from REMOTE stream) ----
  const startAudioRecording = () => {
    if (!remoteStreamRef.current || audioContextRef.current || !remoteStreamRef.current.getAudioTracks().length) {
      return;
    }
    const audioContext = new AudioContext();
    audioContextRef.current = audioContext;

    const source = audioContext.createMediaStreamSource(remoteStreamRef.current);
    const processor = audioContext.createScriptProcessor(4096, 1, 1);

    source.connect(processor);
    processor.connect(audioContext.destination);

    processor.onaudioprocess = (e) => {
      const inputData = e.inputBuffer.getChannelData(0);
      const buffer = new Float32Array(inputData);
      audioBufferRef.current.push(buffer);
    };
  };

  const stopAudioRecordingAndTranscribe = async (): Promise<string> => {
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }

    if (audioBufferRef.current.length === 0) {
      return 'No audio was recorded.';
    }

    const totalLength = audioBufferRef.current.reduce((acc, val) => acc + val.length, 0);
    const mergedBuffer = new Float32Array(totalLength);
    let offset = 0;
    audioBufferRef.current.forEach((buffer) => {
      mergedBuffer.set(buffer, offset);
      offset += buffer.length;
    });

    // Convert Float32Array to Int16Array (PCM)
    const pcmBuffer = new Int16Array(mergedBuffer.length);
    for (let i = 0; i < mergedBuffer.length; i++) {
      const clamped = Math.max(-1, Math.min(1, mergedBuffer[i]));
      pcmBuffer[i] = clamped * 32767;
    }

    // NOTE: Buffer may need a polyfill in some bundlers. Keep as-is if it already works in your setup.
    const audioDataUri = 'data:audio/pcm;base64,' + Buffer.from(pcmBuffer.buffer).toString('base64');
    audioBufferRef.current = [];

    try {
      const result = await transcribeCall({ audioDataUri });
      return result.transcription;
    } catch (error) {
      console.error('Transcription failed:', error);
      toast({
        variant: 'destructive',
        title: 'Transcription Failed',
        description: 'Could not process the call audio.',
      });
      return 'Transcription failed.';
    }
  };

  // ---- Hang up / report ----
  const hangUp = async (reported = false) => {
    if (!callId) {
      setIsFinding(false);
      resetCallState();
      return;
    }

    if (!reported) {
      const callRef = doc(db, 'calls', callId);
      const callDoc = await getDoc(callRef);
      if (callDoc.exists()) {
        if (callDoc.data().status === 'active') {
          await updateDoc(callRef, { status: 'ended', endedAt: serverTimestamp() }).catch((e) =>
            console.error('Could not update call to ended', e),
          );
        } else if (callDoc.data().status === 'pending') {
          await deleteDoc(callRef).catch((e) => console.error('Could not delete pending call', e));
        }
      }
    }

    resetCallState();
  };

  const reportCall = async () => {
    if (!callId || !callData || !user) return;
    setIsReporting(true);

    try {
      const transcription = await stopAudioRecordingAndTranscribe();

      const otherParticipantId = callData.participants.find((p) => p !== user.uid);
      if (!otherParticipantId) {
        throw new Error('Could not find the other participant to report.');
      }

      const report = {
        callId,
        reporterId: user.uid,
        reportedUserId: otherParticipantId,
        chatHistory: messages,
        transcription,
        timestamp: serverTimestamp(),
        status: 'pending',
      };

      await addDoc(collection(db, 'reports'), report);

      toast({
        title: 'Report Submitted',
        description: 'Thank you. An admin will review the call shortly.',
      });
    } catch (error: any) {
      console.error('Failed to submit report:', error);
      toast({
        variant: 'destructive',
        title: 'Report Failed',
        description: error.message || 'Could not submit the report.',
      });
    } finally {
      setIsReporting(false);
      await hangUp(true); // Preserve call doc for reports
    }
  };

  // Ensure video elements are attached to streams after render
  useEffect(() => {
    if (localVideoRef.current && localStreamRef.current) {
      localVideoRef.current.srcObject = localStreamRef.current;
    }
    if (remoteVideoRef.current && remoteStreamRef.current) {
      remoteVideoRef.current.srcObject = remoteStreamRef.current;
    }
  }, [callId, localStreamRef.current, remoteStreamRef.current]);

  // Improved toggleMic and toggleCamera
  const toggleMic = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach((track) => {
        track.enabled = !isMicMuted;
      });
      setIsMicMuted((prev) => !prev);
    }
  };

  const toggleCamera = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getVideoTracks().forEach((track) => {
        track.enabled = !isCameraOff;
      });
      setIsCameraOff((prev) => !prev);
    }
  };

  // ---- Reset all state and media/PC resources ----
  const resetCallState = () => {
    if (callCleanupRef.current) {
      callCleanupRef.current();
      callCleanupRef.current = null;
    }

    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    localStreamRef.current = null;
    if (localVideoRef.current) localVideoRef.current.srcObject = null;

    remoteStreamRef.current?.getTracks().forEach((t) => t.stop());
    remoteStreamRef.current = null;
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
    setMessages([]);
    setIsFinding(false);
    setNewMessage('');
    setIsMicMuted(false);
    setIsCameraOff(false);
  };

  // ---- Chat ----
  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!callId || !newMessage.trim() || !user) return;

    const messagesRef = collection(db, 'calls', callId, 'messages');
    await addDoc(messagesRef, {
      text: newMessage,
      senderId: user.uid,
      timestamp: serverTimestamp(),
    });
    setNewMessage('');
  };

  // (Optional safety net) If something changes later, ensure tracks are present
  useEffect(() => {
    if (pcRef.current && localStreamRef.current && pcRef.current.connectionState !== 'closed') {
      localStreamRef.current.getTracks().forEach((track) => {
        if (!pcRef.current!.getSenders().find((s) => s.track === track)) {
          pcRef.current!.addTrack(track, localStreamRef.current!);
        }
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [callData]);

  // ---- Firestore listeners for the active/pending call ----
  useEffect(() => {
    if (!callId || !user) return;

    const addedCandidates = new Set<string>();

    const unsubCall = onSnapshot(doc(db, 'calls', callId), async (docSnapshot) => {
      if (!docSnapshot.exists()) {
        if (isFinding) {
          // If we were finding a call and it disappears, just restart the search
          resetCallState();
          setTimeout(() => startCall(), 500); 
        } else if (callId) {
          // If we were in an active call, notify the user
          resetCallState();
          toast({ title: 'Call Canceled', description: 'The other user canceled the call.' });
        }
        return;
      }

      const newData = docSnapshot.data() as Call;
      setCallData(newData);

      if (newData?.status === 'active' && isFinding) {
        setIsFinding(false);
      }

      if (newData?.status === 'ended' && !isReporting) {
        toast({ title: 'Call Ended', description: 'The other user has left the call.' });
        resetCallState();
        return;
      }

      // If we are the offerer and we now have an answer, set it
      if (pcRef.current && !pcRef.current.remoteDescription && newData?.answer) {
        // FIX: Check signaling state before setting remote description
        if (pcRef.current.signalingState === 'have-local-offer') {
          await pcRef.current.setRemoteDescription(new RTCSessionDescription(newData.answer));
        }
      }

      // Add remote ICE candidates
      const isOfferer = newData.participants[0] === user.uid;
      const candidatesField = isOfferer ? 'answerCandidates' : 'offerCandidates';
      const candidates = (newData as any)[candidatesField] as any[] | undefined;

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

    const unsubMessages = onSnapshot(query(collection(db, 'calls', callId, 'messages')), (snapshot) => {
      const msgs = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as Message);
      msgs.sort((a, b) => (a.timestamp as any) - (b.timestamp as any));
      setMessages(msgs);
    });

    callCleanupRef.current = () => {
      unsubCall();
      unsubMessages();
    };

    return () => {
      unsubCall();
      unsubMessages();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [callId, user, isFinding]);

  // ---- UI states ----
  const cancelFinding = async () => {
    setIsFinding(false);
    if (callId) {
      const callRef = doc(db, 'calls', callId);
      const callDoc = await getDoc(callRef);
      if (callDoc.exists() && callDoc.data().status === 'pending') {
        await deleteDoc(callRef).catch((e) => console.error('Could not delete pending call on cancel', e));
      }
    }
    resetCallState();
  };

  if (!hasCameraPermission) {
    return (
      <Card className="w-full max-w-lg">
        <CardHeader>
          <CardTitle>Camera Access Required</CardTitle>
        </CardHeader>
        <CardContent>
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Permission Denied</AlertTitle>
            <AlertDescription>
              You have denied camera and microphone access. Please enable permissions in your browser settings to use Connectile.
            </AlertDescription>
          </Alert>
          <Button onClick={getCameraPermission} className="mt-4">
            Try Again
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (!callId && !isFinding) {
    return (
      <Card className="w-full max-w-lg text-center">
        <CardHeader>
          <CardTitle className="text-3xl font-bold">Connect with Strangers</CardTitle>
          <CardDescription>Click the button below to start a random video call.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex justify-center">
            <div className="relative">
              <div className="absolute -inset-0.5 animate-pulse rounded-full bg-gradient-to-r from-primary via-accent to-secondary opacity-75 blur"></div>
              <Button size="lg" className="relative h-24 w-24 rounded-full" onClick={startCall}>
                <Video className="h-12 w-12" />
              </Button>
            </div>
          </div>
          <p className="mt-6 text-sm text-muted-foreground">
            You will be connected with a random person for a video and text chat. Please be respectful.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (isFinding) {
    return (
      <Card className="w-full max-w-lg text-center">
        <CardHeader>
          <CardTitle>Finding a Partner...</CardTitle>
          <CardDescription>Please wait while we connect you with someone.</CardDescription>
        </CardHeader>
        <CardContent>
          <Loader2 className="mx-auto h-16 w-16 animate-spin text-primary" />
        </CardContent>
        <CardFooter>
          <Button variant="outline" className="w-full" onClick={cancelFinding}>
            Cancel
          </Button>
        </CardFooter>
      </Card>
    );
  }

  return (
    <div className="grid h-full max-h-[85vh] w-full grid-cols-1 gap-4 md:grid-cols-3">
      <div className="col-span-1 flex flex-col gap-4 md:col-span-2">
        <div className="relative aspect-video w-full overflow-hidden rounded-lg border bg-muted">
          <video ref={remoteVideoRef} autoPlay playsInline className="h-full w-full object-cover" />
          <div className="absolute bottom-4 right-4 h-1/4 w-1/4 overflow-hidden rounded-lg border-2 border-primary">
            <video ref={localVideoRef} autoPlay playsInline muted className="h-full w-full object-cover" />
          </div>
        </div>
        <div className="flex justify-center gap-2">
          <Button
            variant={isMicMuted ? 'destructive' : 'secondary'}
            size="lg"
            className="rounded-full"
            onClick={toggleMic}
          >
            {isMicMuted ? <MicOff /> : <Mic />}
            <span className="sr-only">{isMicMuted ? 'Unmute' : 'Mute'}</span>
          </Button>
          <Button
            variant={isCameraOff ? 'destructive' : 'secondary'}
            size="lg"
            className="rounded-full"
            onClick={toggleCamera}
          >
            {isCameraOff ? <VideoOff /> : <Video />}
            <span className="sr-only">{isCameraOff ? 'Turn Camera On' : 'Turn Camera Off'}</span>
          </Button>
          <Button variant="destructive" size="lg" className="rounded-full" onClick={() => hangUp()}>
            <PhoneOff />
            <span className="ml-2">Hang Up</span>
          </Button>
          <Button variant="outline" size="lg" className="rounded-full" onClick={reportCall} disabled={isReporting}>
            {isReporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Flag />}
            <span className="ml-2">{isReporting ? 'Reporting...' : 'Report'}</span>
          </Button>
        </div>
      </div>
      <Card className="col-span-1 flex flex-col md:col-span-1">
        <CardHeader>
          <CardTitle>Chat</CardTitle>
        </CardHeader>
        <CardContent className="flex-1 overflow-hidden">
          <ScrollArea className="h-full pr-4">
            <div className="space-y-4">
              {messages.map((msg) => (
                <div key={msg.id} className={`flex ${msg.senderId === user?.uid ? 'justify-end' : 'justify-start'}`}>
                  <div
                    className={`rounded-lg px-3 py-2 text-sm ${
                      msg.senderId === user?.uid ? 'bg-primary text-primary-foreground' : 'bg-muted'
                    }`}
                  >
                    {msg.text}
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </CardContent>
        <CardFooter>
          <form onSubmit={sendMessage} className="flex w-full gap-2">
            <Input value={newMessage} onChange={(e) => setNewMessage(e.target.value)} placeholder="Type a message..." />
            <Button type="submit" disabled={!callData || callData.status !== 'active'}>
              <Send />
            </Button>
          </form>
        </CardFooter>
      </Card>
    </div>
  );
}

