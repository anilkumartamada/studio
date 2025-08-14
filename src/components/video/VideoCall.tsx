"use client";

import { useState, useEffect, useRef } from 'react';
import { db } from '@/lib/firebase';
import { useAuth } from '@/hooks/useAuth';
import { collection, query, where, onSnapshot, addDoc, doc, updateDoc, getDoc, getDocs, serverTimestamp, deleteDoc, limit, setDoc, arrayUnion, runTransaction } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Loader2, PhoneOff, Send, Video, AlertCircle, Flag } from 'lucide-react';
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


  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioBufferRef = useRef<Float32Array[]>([]);
  const callCleanupRef = useRef<(() => void) | null>(null);


  useEffect(() => {
    // Check for camera permission on component mount, but don't request it yet.
    const checkCameraPermission = async () => {
        try {
            const devices = await navigator.mediaDevices.enumerateDevices();
            const hasVideo = devices.some(device => device.kind === 'videoinput');
            if (!hasVideo) {
              setHasCameraPermission(false);
              return;
            }
            // Try to get user media to check for permission.
            const stream = await navigator.mediaDevices.getUserMedia({video: hasVideo, audio: true});
            // We got the stream, so we have permission. Stop the tracks immediately.
            stream.getTracks().forEach(track => track.stop());
            setHasCameraPermission(true);
        } catch (err) {
            setHasCameraPermission(false);
            console.error("Initial permission check failed:", err)
        }
    };
    checkCameraPermission();
  }, []);


  const getCameraPermission = async () => {
    if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => track.stop());
        localStreamRef.current = null;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }
      localStreamRef.current = stream;
      setHasCameraPermission(true);
      return stream;
    } catch (error) {
      console.error('Error accessing camera:', error);
      setHasCameraPermission(false);
      toast({
        variant: 'destructive',
        title: 'Camera Access Denied',
        description: 'Please enable camera permissions in your browser settings to use this app.',
      });
      return null;
    }
  };

  const startCall = async () => {
    if (!user) return;
    
    const stream = await getCameraPermission();
    if (!stream) {
        return;
    }

    setIsFinding(true);

    const callsRef = collection(db, 'calls');
    const q = query(callsRef, where('status', '==', 'pending'), limit(1));
    const querySnapshot = await getDocs(q);
    const pendingCalls = querySnapshot.docs.filter(doc => !doc.data().participants.includes(user.uid));

    if (pendingCalls.length > 0) {
      const callDocToJoin = pendingCalls[0];
      const callDocRef = doc(db, 'calls', callDocToJoin.id);

      try {
        await runTransaction(db, async (transaction) => {
          const callDocSnapshot = await transaction.get(callDocRef);

          if (!callDocSnapshot.exists() || callDocSnapshot.data().status !== 'pending') {
            throw new Error("Call not available");
          }

          setCallId(callDocToJoin.id);

          pcRef.current = await createPeerConnection(callDocToJoin.id);
          localStreamRef.current?.getTracks().forEach(track => pcRef.current?.addTrack(track, localStreamRef.current!));

          const offer = callDocSnapshot.data().offer;
          await pcRef.current.setRemoteDescription(new RTCSessionDescription(offer));
          
          const answer = await pcRef.current.createAnswer();
          await pcRef.current.setLocalDescription(answer);

          transaction.update(callDocRef, {
            status: 'active',
            participants: arrayUnion(user.uid),
            answer: { sdp: answer.sdp, type: answer.type },
          });
        });
      } catch (error) {
        console.error("Failed to join call, restarting search:", error);
        resetCallState();
        // Brief timeout to prevent immediate re-querying and potential loops
        setTimeout(() => startCall(), 1000);
        return;
      }
    } else {
      // Create a new call
      const newCallDocRef = doc(collection(db, 'calls'));
      setCallId(newCallDocRef.id);

      pcRef.current = await createPeerConnection(newCallDocRef.id);
      localStreamRef.current?.getTracks().forEach(track => pcRef.current?.addTrack(track, localStreamRef.current!));
      
      const offer = await pcRef.current.createOffer();
      await pcRef.current.setLocalDescription(offer);

      await setDoc(newCallDocRef, {
          participants: [user.uid],
          status: 'pending',
          startedAt: serverTimestamp(),
          offer: { sdp: offer.sdp, type: offer.type },
          offerCandidates: [],
          answerCandidates: [],
      });
    }
  };


  const createPeerConnection = async (currentCallId: string) => {
    const pc = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
    });

    pc.onicecandidate = async (event) => {
      if (event.candidate) {
        const callRef = doc(db, 'calls', currentCallId);
        try {
          // We don't need to get the doc first, just try to update it.
          // The security rules will determine if the user is a participant.
          // This can still fail if the other user hangs up at the same time.
          const callDoc = await getDoc(callRef);
          if (callDoc.exists()) {
              const callData = callDoc.data() as Call;
              const isOfferer = callData.participants[0] === user?.uid;
              const fieldToUpdate = isOfferer ? 'offerCandidates' : 'answerCandidates';
              
              await updateDoc(callRef, {
                  [fieldToUpdate]: arrayUnion(event.candidate.toJSON())
              });
          }
        } catch (error) {
            console.log("Failed to add ICE candidate, call may have ended:", error);
        }
      }
    };

    pc.ontrack = (event) => {
      remoteStreamRef.current = event.streams[0];
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = event.streams[0];
      }
      startAudioRecording();
    };
    
    return pc;
  };

    const startAudioRecording = () => {
        if (!remoteStreamRef.current || audioContextRef.current || !remoteStreamRef.current.getAudioTracks().length) return;
        
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
            return "No audio was recorded.";
        }

        const totalLength = audioBufferRef.current.reduce((acc, val) => acc + val.length, 0);
        const mergedBuffer = new Float32Array(totalLength);
        let offset = 0;
        audioBufferRef.current.forEach(buffer => {
            mergedBuffer.set(buffer, offset);
            offset += buffer.length;
        });

        // Convert Float32Array to Int16Array (PCM)
        const pcmBuffer = new Int16Array(mergedBuffer.length);
        for (let i = 0; i < mergedBuffer.length; i++) {
            pcmBuffer[i] = Math.max(-1, Math.min(1, mergedBuffer[i])) * 32767;
        }

        const audioDataUri = "data:audio/pcm;base64," + Buffer.from(pcmBuffer.buffer).toString('base64');
        audioBufferRef.current = [];

        try {
            const result = await transcribeCall({ audioDataUri });
            return result.transcription;
        } catch (error) {
            console.error("Transcription failed:", error);
            toast({
                variant: "destructive",
                title: "Transcription Failed",
                description: "Could not process the call audio.",
            });
            return "Transcription failed.";
        }
    };


  const hangUp = async (reported = false) => {
    if (!callId) {
        setIsFinding(false); // If hangUp is called during search
        resetCallState();
        return;
    }

    if (!reported) { // Don't delete the call doc if it's being reported
        const callRef = doc(db, 'calls', callId);
        const callDoc = await getDoc(callRef);
        if (callDoc.exists()) {
            if (callDoc.data().status === 'active') {
                await updateDoc(callRef, { status: 'ended', endedAt: serverTimestamp() }).catch(e => console.error("Could not update call to ended", e));
            } else if (callDoc.data().status === 'pending') {
                await deleteDoc(callRef).catch(e => console.error("Could not delete pending call", e));
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
        
        const otherParticipantId = callData.participants.find(p => p !== user.uid);
        if (!otherParticipantId) {
            throw new Error("Could not find the other participant to report.");
        }

        const report = {
            callId: callId,
            reporterId: user.uid,
            reportedUserId: otherParticipantId,
            chatHistory: messages,
            transcription: transcription,
            timestamp: serverTimestamp(),
            status: 'pending',
        };

        await addDoc(collection(db, 'reports'), report);

        toast({
            title: "Report Submitted",
            description: "Thank you. An admin will review the call shortly.",
        });

    } catch (error: any) {
        console.error("Failed to submit report:", error);
        toast({
            variant: "destructive",
            title: "Report Failed",
            description: error.message || "Could not submit the report.",
        });
    } finally {
        setIsReporting(false);
        // We pass 'true' to indicate the call record should be preserved for the report
        await hangUp(true); 
    }
};


  const resetCallState = () => {
    // Run any specific cleanup for the call (like unsubscribing from listeners)
    if(callCleanupRef.current) {
        callCleanupRef.current();
        callCleanupRef.current = null;
    }
    
    // Stop camera/mic tracks
    localStreamRef.current?.getTracks().forEach(track => track.stop());
    localStreamRef.current = null;
    if(localVideoRef.current) {
        localVideoRef.current.srcObject = null;
    }

    // Stop remote stream tracks
    remoteStreamRef.current?.getTracks().forEach(track => track.stop());
    remoteStreamRef.current = null;
    if(remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = null;
    }
     // Close audio context
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close();
    }
    audioContextRef.current = null;
    audioBufferRef.current = [];

    // Close peer connection
    pcRef.current?.close();
    pcRef.current = null;
    
    // Reset state
    setCallId(null);
    setCallData(null);
    setMessages([]);
    setIsFinding(false);
    setNewMessage('');
  };

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

  // Main listener for call document changes
  useEffect(() => {
    if (!callId || !user) return;

    const addedCandidates = new Set();

    const unsub = onSnapshot(doc(db, 'calls', callId), async (docSnapshot) => {
      // If doc is deleted (pending call cancelled by creator)
      if (!docSnapshot.exists()) {
        if (isFinding) {
          // If we were still finding a match, just restart the search silently.
          resetCallState();
          setTimeout(() => startCall(), 500); // Small delay to prevent loops
        } else {
          resetCallState();
          toast({ title: "Call Canceled", description: "The other user canceled the call." });
        }
        return;
      }

      const data = docSnapshot.data() as Call;
      const oldData = callData;
      setCallData(data);

      if (data?.status === 'active' && isFinding) {
          setIsFinding(false);
      }
      if (data?.status === 'ended' && !isReporting) {
        toast({ title: "Call Ended", description: "The other user has left the call." });
        resetCallState();
      }
      // For the user who created the call, set remote description when the other user answers
      if (pcRef.current && !pcRef.current.remoteDescription && data?.answer) {
        await pcRef.current?.setRemoteDescription(new RTCSessionDescription(data.answer));
      }

      // Add remote ICE candidates
      const isOfferer = data.participants[0] === user.uid;
      const candidatesFieldName = isOfferer ? 'answerCandidates' : 'offerCandidates';
      const candidates = data[candidatesFieldName as keyof Call] as any[] | undefined;

      if (candidates && pcRef.current?.remoteDescription) {
        candidates.forEach(candidate => {
          const candidateKey = JSON.stringify(candidate);
          if (!addedCandidates.has(candidateKey)) {
            pcRef.current!.addIceCandidate(new RTCIceCandidate(candidate));
            addedCandidates.add(candidateKey);
          }
        });
      }
    });

    const messagesUnsub = onSnapshot(query(collection(db, 'calls', callId, 'messages')), (snapshot) => {
        const msgs = snapshot.docs.map(doc => ({id: doc.id, ...doc.data()}) as Message);
        msgs.sort((a, b) => (a.timestamp as any) - (b.timestamp as any));
        setMessages(msgs);
    });

    callCleanupRef.current = () => {
        unsub();
        messagesUnsub();
    }

    // Main cleanup function
    return () => {
      unsub();
      messagesUnsub();
    };
  }, [callId, isFinding, isReporting, user, callData]);
  
  const cancelFinding = async () => {
    setIsFinding(false);
    if (callId) {
        const callRef = doc(db, 'calls', callId);
        const callDoc = await getDoc(callRef);
        // Only delete the doc if it's still pending (i.e., we created it and no one joined)
        if (callDoc.exists() && callDoc.data().status === 'pending') {
          await deleteDoc(callRef).catch(e => console.error("Could not delete pending call on cancel", e));
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
                 <Button onClick={getCameraPermission} className="mt-4">Try Again</Button>
            </CardContent>
        </Card>
    )
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
                <Button variant="outline" className="w-full" onClick={cancelFinding}>Cancel</Button>
            </CardFooter>
        </Card>
    )
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
            <div className="flex justify-center gap-4">
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
                            <div className={`rounded-lg px-3 py-2 text-sm ${msg.senderId === user?.uid ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
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
