"use client";

import { useState, useEffect, useRef } from 'react';
import { db } from '@/lib/firebase';
import { useAuth } from '@/hooks/useAuth';
import {
  collection,
  addDoc,
  serverTimestamp,
  query,
  onSnapshot,
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
import type { Message } from '@/types';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';
import { transcribeCall } from '@/ai/flows/transcribe-call';
import { useWebRTC } from '@/hooks/useWebRTC';

export function VideoCall() {
  const { user } = useAuth();
  const { toast } = useToast();
  
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);

  const {
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
    audioBufferRef,
  } = useWebRTC(localVideoRef, remoteVideoRef);

  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isReporting, setIsReporting] = useState(false);
  

  // ---- Chat Listener ----
  useEffect(() => {
    if (!callId) {
      setMessages([]);
      return;
    };

    const messagesRef = collection(db, 'calls', callId, 'messages');
    const q = query(messagesRef);

    const unsubMessages = onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as Message);
      msgs.sort((a, b) => (a.timestamp as any) - (b.timestamp as any));
      setMessages(msgs);
    });

    return () => unsubMessages();
  }, [callId]);


  const stopAudioRecordingAndTranscribe = async (): Promise<string> => {
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


  // ---- UI States ----

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
