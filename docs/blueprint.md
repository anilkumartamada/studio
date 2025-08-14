# **App Name**: Connectile

## Core Features:

- User Authentication: User authentication with Firebase (sign-up, sign-in) and role-based redirection (admin/user).
- Matchmaking Pool: Main page with "Start Video Call" button initiating matchmaking pool entry.
- Video Call: P2P video call using WebRTC, displaying both participants side-by-side with a chat box.
- Real-Time Chat: Real-time chat during video calls using Firestore or WebRTC DataChannels.
- Report Conversation: "Report" button to save chat history and video call transcript for admin review. Reports saved in Firestore.
- Call Transcription: The tool that will provide automatic transcription of video call audio, to be attached to admin reports. It will transcribe relevant sections of audio as judged necessary.
- Admin Dashboard: Admin dashboard to review reports, view chat history and video call transcripts, and block users.

## Style Guidelines:

- Primary color: Deep violet (#9400D3) to suggest depth of connection and an unconventional spirit.
- Background color: Light violet (#F0E6FF), a lighter tint of the primary color, for a calming backdrop.
- Accent color: Cerulean (#007BA7) for interactive elements to make them 'pop' from the design.
- Font: 'Inter' (sans-serif) for headlines and body text, offering a modern, objective feel suitable for interface elements. The font should provide a neutral base for an unusual application.
- Clean and simple line icons to represent actions (report, mute, disconnect). Subtle animations for user feedback.
- Responsive layout using Tailwind CSS, optimized for both desktop and mobile devices.
- Smooth transitions and subtle animations for interactive elements and loading states to improve UX.