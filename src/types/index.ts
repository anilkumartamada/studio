import type { Timestamp } from 'firebase/firestore';

// Represents user account details stored in Firestore
export interface UserData {
  uid: string;
  email: string | null;
  role: 'user' | 'admin';
  status: 'active' | 'blocked';
  createdAt: Timestamp;
}

// Represents a video call document in Firestore
export interface Call {
  id: string;
  participants: string[]; // Array of user UIDs
  status: 'pending' | 'active' | 'ended';
  startedAt: Timestamp;
  endedAt?: Timestamp;

  // WebRTC signaling data
  offer?: { sdp: string; type: RTCSdpType };
  answer?: { sdp: string; type: RTCSdpType };
  offerCandidates?: RTCIceCandidateInit[];
  answerCandidates?: RTCIceCandidateInit[];
}

// Represents a single chat message in a call
export interface Message {
  id: string;
  text: string;
  senderId: string; // UID of sender
  timestamp: Timestamp;
}

// Represents a report generated after a call
export interface Report {
  id: string;
  callId: string;
  reporterId: string; // UID of reporter
  reportedUserId: string; // UID of reported person
  chatHistory: Message[];
  transcription: string;
  timestamp: Timestamp;
}
