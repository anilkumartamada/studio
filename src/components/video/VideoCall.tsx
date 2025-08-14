"use client";

import { useState, useEffect, useRef } from 'react';
import { db, auth } from '@/lib/firebase';
import { useAuth } from '@/hooks/useAuth';
import { collection, query, where, onSnapshot, addDoc, doc, updateDoc, getDoc, serverTimestamp, deleteDoc } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Loader2, PhoneOff, Send, Video, AlertCircle } from 'lucide-react';
import { Input } from '../ui/input';
import { ScrollArea } from '../ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import type { Call, Message } from '@/types';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';

export function VideoCall() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [callId, setCallId] = useState<string | null>(null);
  const [callData, setCallData] = useState<Call | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isFinding, setIsFinding] = useState(false);
  const [hasCameraPermission, setHasCameraPermission] = useState(true);

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    const getCameraPermission = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }
        localStreamRef.current = stream;
        setHasCameraPermission(true);
      } catch (error) {
        console.error('Error accessing camera:', error);
        setHasCameraPermission(false);
        toast({
          variant: 'destructive',
          title: 'Camera Access Denied',
          description: 'Please enable camera permissions in your browser settings to use this app.',
        });
      }
    };
    getCameraPermission();
  }, [toast]);


  const startCall = async () => {
    if (!user || !localStreamRef.current) return;
    setIsFinding(true);

    const callsRef = collection(db, 'calls');
    const q = query(callsRef, where('status', '==', 'pending'));
    
    const unsubscribe = onSnapshot(q, async (snapshot) => {
      if (!isFinding) {
          unsubscribe();
          return;
      }
      
      const pendingCalls = snapshot.docs.filter(doc => !doc.data().participants.includes(user.uid));
      
      if (pendingCalls.length > 0) {
        // Join an existing call
        const callDoc = pendingCalls[0];
        setCallId(callDoc.id);
        
        pcRef.current = createPeerConnection(callDoc.id);
        localStreamRef.current?.getTracks().forEach(track => pcRef.current?.addTrack(track, localStreamRef.current!));

        const offer = callDoc.data().offer;
        await pcRef.current.setRemoteDescription(new RTCSessionDescription(offer));
        
        const answer = await pcRef.current.createAnswer();
        await pcRef.current.setLocalDescription(answer);

        await updateDoc(doc(db, 'calls', callDoc.id), {
          status: 'active',
          participants: [...callDoc.data().participants, user.uid],
          answer: { sdp: answer.sdp, type: answer.type },
        });

      } else {
        // Create a new call
        const newCallDoc = await addDoc(callsRef, {
          participants: [user.uid],
          status: 'pending',
          startedAt: serverTimestamp(),
        });
        setCallId(newCallDoc.id);

        pcRef.current = createPeerConnection(newCallDoc.id);
        localStreamRef.current?.getTracks().forEach(track => pcRef.current?.addTrack(track, localStreamRef.current!));
        
        const offer = await pcRef.current.createOffer();
        await pcRef.current.setLocalDescription(offer);

        await updateDoc(newCallDoc, {
          offer: { sdp: offer.sdp, type: offer.type },
        });
      }
      unsubscribe();
    }, (error) => {
        console.error("Error finding call: ", error);
        toast({
            variant: "destructive",
            title: "Error",
            description: "Could not find a call. Please try again."
        });
        setIsFinding(false);
    });
  };

  const createPeerConnection = (currentCallId: string) => {
    const pc = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
    });

    pc.onicecandidate = async (event) => {
      if (event.candidate) {
        const iceCandidatesRef = collection(db, 'calls', currentCallId, 'iceCandidates');
        await addDoc(iceCandidatesRef, event.candidate.toJSON());
      }
    };

    pc.ontrack = (event) => {
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = event.streams[0];
      }
    };
    
    // Listen for ICE candidates
    const iceCandidatesRef = collection(db, 'calls', currentCallId, 'iceCandidates');
    onSnapshot(iceCandidatesRef, (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type === 'added') {
          pc.addIceCandidate(new RTCIceCandidate(change.doc.data()));
        }
      });
    });

    return pc;
  };

  const hangUp = async () => {
    if (callId) {
      await updateDoc(doc(db, 'calls', callId), { status: 'ended', endedAt: serverTimestamp() });
      const callDoc = await getDoc(doc(db, 'calls', callId));
      if (callDoc.exists() && callDoc.data().participants.length < 2) {
          await deleteDoc(doc(db, 'calls', callId));
      }
    }
    resetCallState();
  };

  const resetCallState = () => {
    pcRef.current?.close();
    pcRef.current = null;
    setCallId(null);
    setCallData(null);
    setMessages([]);
    setIsFinding(false);
    if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = null;
    }
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

  // Listen for call document changes
  useEffect(() => {
    if (!callId) return;

    const unsub = onSnapshot(doc(db, 'calls', callId), (doc) => {
      const data = doc.data() as Call;
      setCallData(data);
      if (data?.status === 'active' && isFinding) {
          setIsFinding(false);
      }
      if (data?.status === 'ended') {
        toast({ title: "Call Ended", description: "The other user has left the call." });
        resetCallState();
      }
      if (!pcRef.current?.remoteDescription && data?.answer) {
        pcRef.current?.setRemoteDescription(new RTCSessionDescription(data.answer));
      }
    });

    const messagesUnsub = onSnapshot(query(collection(db, 'calls', callId, 'messages')), (snapshot) => {
        const msgs = snapshot.docs.map(doc => ({id: doc.id, ...doc.data()}) as Message);
        msgs.sort((a, b) => (a.timestamp as any) - (b.timestamp as any));
        setMessages(msgs);
    });

    return () => {
      unsub();
      messagesUnsub();
    };
  }, [callId, isFinding, toast]);

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
                <Button variant="outline" className="w-full" onClick={() => setIsFinding(false)}>Cancel</Button>
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
                <Button variant="destructive" size="lg" className="rounded-full" onClick={hangUp}>
                    <PhoneOff />
                    <span className="ml-2">Hang Up</span>
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
                    <Button type="submit">
                        <Send />
                    </Button>
                </form>
            </CardFooter>
        </Card>
    </div>
  );
}
