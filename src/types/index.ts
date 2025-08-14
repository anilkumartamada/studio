import type { Timestamp } from 'firebase/firestore';

export interface UserData {
  uid: string;
  email: string | null;
  role: 'user' | 'admin';
  status: 'active' | 'blocked';
  createdAt: Timestamp;
}

export interface Call {
  id: string;
  participants: string[];
  status: 'pending' | 'active' | 'ended';
  startedAt: Timestamp;
  endedAt?: Timestamp;
  offer?: { sdp: string; type: string };
  answer?: { sdp: string; type: string };
  offerCandidates?: any[];
  answerCandidates?: any[];
}

export interface Message {
  id: string;
  text: string;
  senderId: string;
  timestamp: Timestamp;
}

export interface Report {
  id: string;
  callId: string;
  reporterId: string;
  reportedUserId: string;
  chatHistory: Message[];
  transcription: string;
  timestamp: Timestamp;
}
