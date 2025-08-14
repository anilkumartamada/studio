# Connectile

Connectile is a full-stack Omegle-style random video calling and chat platform.

## Features

- **User Authentication**: Sign-up and sign-in with Firebase. Role-based access for users and admins.
- **Random Video Chat**: Connect with strangers for a peer-to-peer video call.
- **Real-time Chat**: Text chat with your partner during the video call.
- **Reporting System**: Report conversations for admin review. Call audio is transcribed automatically for moderation.
- **Admin Dashboard**: Admins can review reports, view transcriptions and chat logs, and block users.
- **Call History**: Users can view their past conversations and report them if needed.

## Tech Stack

- **Framework**: Next.js (App Router)
- **Authentication**: Firebase Authentication
- **Database**: Firestore
- **Real-time Communication**: WebRTC for video/audio, Firestore for signaling and chat
- **AI**: Genkit for call audio transcription
- **Styling**: Tailwind CSS & shadcn/ui
- **Deployment**: Vercel

## Getting Started

First, install the dependencies:

```bash
npm install
```

Then, run the development server:

```bash
npm run dev
```

Open [http://localhost:9002](http://localhost:9002) with your browser to see the result.

You will need to have a Firebase project set up and the configuration details added to `src/lib/firebase.ts`.
