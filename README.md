# Messenger - Full-Stack Real-Time Chat Application

Modern messenger with React, Socket.io, and SQLite.

## Tech Stack

### Backend
- **Node.js** + **Express** - REST API
- **Socket.io** - Real-time communication
- **better-sqlite3** - Database
- **JWT** - Authentication
- **Multer** - File uploads
- **bcryptjs** - Password hashing

### Frontend
- **React 18** + **Vite** - UI framework
- **TailwindCSS** - Styling
- **Zustand** - State management
- **Socket.io-client** - Real-time client
- **Axios** - HTTP client

## Features

### Core Messaging
- ✅ Real-time messaging with Socket.io
- ✅ Direct chats, group chats, channels
- ✅ Text, images, files, audio, video, voice messages
- ✅ Message reactions (emoji)
- ✅ Reply to messages
- ✅ Forward messages
- ✅ Edit/delete messages
- ✅ Message read receipts
- ✅ Typing indicators
- ✅ Online/offline status

### Advanced Features
- ✅ Polls with multiple choice and anonymous voting
- ✅ Stories (24h expiration)
- ✅ Pinned messages
- ✅ Saved messages
- ✅ Contacts management
- ✅ File uploads (images, videos, documents)
- ✅ WebRTC voice/video calls (signaling)

## Database Schema

### Tables
- **users** - User accounts and profiles
- **chats** - Chat rooms (direct/group/channel)
- **chat_members** - Chat participants with roles
- **messages** - All messages with types
- **message_reactions** - Emoji reactions
- **message_reads** - Read receipts
- **polls** - Poll data
- **poll_votes** - Poll voting records
- **stories** - 24h stories
- **story_views** - Story view tracking
- **pinned_messages** - Pinned messages per chat
- **contacts** - User contacts
- **saved_messages** - Bookmarked messages

## Project Structure

```
messenger/
├── server/
│   ├── index.js              # Express + Socket.io server
│   ├── db.js                 # SQLite schema
│   ├── auth.js               # JWT utilities
│   ├── routes/
│   │   ├── auth.js           # Authentication endpoints
│   │   ├── chats.js          # Chat CRUD
│   │   ├── messages.js       # Message operations
│   │   ├── users.js          # User profile & search
│   │   ├── files.js          # File uploads
│   │   ├── stories.js        # Stories management
│   │   └── polls.js          # Poll operations
│   ├── socket/
│   │   └── handlers.js       # Socket.io event handlers
│   └── uploads/              # Uploaded files storage
├── client/
│   ├── src/
│   │   ├── main.jsx          # React entry point
│   │   ├── App.jsx           # Root component
│   │   ├── socket.js         # Socket.io client singleton
│   │   ├── store/            # Zustand stores
│   │   │   ├── authStore.js
│   │   │   ├── chatStore.js
│   │   │   └── uiStore.js
│   │   ├── pages/
│   │   │   ├── Auth.jsx      # Login/Register
│   │   │   └── Messenger.jsx # Main chat interface
│   │   ├── components/
│   │   │   ├── Sidebar/      # Chat list
│   │   │   ├── Chat/         # Chat window
│   │   │   ├── Message/      # Message bubble
│   │   │   └── Modals/       # Modal dialogs
│   │   └── hooks/            # Custom React hooks
│   └── vite.config.js
└── README.md
```

## Socket.io Events

### Client → Server
- `join_chat` - Join a chat room
- `leave_chat` - Leave a chat room
- `send_message` - Send a message
- `typing_start` - User started typing
- `typing_stop` - User stopped typing
- `message_read` - Mark message as read
- `add_reaction` - Add emoji reaction
- `remove_reaction` - Remove emoji reaction
- `pin_message` - Pin a message
- `edit_message` - Edit a message
- `delete_message` - Delete a message
- `create_poll` - Create a poll
- `vote_poll` - Vote in a poll
- `webrtc_offer` - WebRTC offer for calls
- `webrtc_answer` - WebRTC answer
- `webrtc_ice_candidate` - ICE candidate
- `call_end` - End a call

### Server → Client
- `new_message` - New message received
- `message_edited` - Message was edited
- `message_deleted` - Message was deleted
- `user_typing` - User is typing
- `user_stop_typing` - User stopped typing
- `message_reaction` - Reaction added/removed
- `user_online` - User came online
- `user_offline` - User went offline
- `poll_updated` - Poll votes updated
- `incoming_call` - Incoming call
- `call_accepted` - Call was accepted
- `call_rejected` - Call was rejected
- `webrtc_offer` - WebRTC offer
- `webrtc_answer` - WebRTC answer
- `webrtc_ice_candidate` - ICE candidate

## Installation

### Server
```bash
cd server
npm install
cp .env.example .env
# Edit .env with your JWT_SECRET
npm run dev
```

### Client
```bash
cd client
npm install
npm run dev
```

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user
- `GET /api/auth/me` - Get current user

### Chats
- `GET /api/chats` - Get user's chats
- `POST /api/chats` - Create new chat
- `GET /api/chats/:id` - Get chat details
- `PUT /api/chats/:id` - Update chat
- `DELETE /api/chats/:id` - Delete chat
- `POST /api/chats/:id/members` - Add member
- `DELETE /api/chats/:id/members/:userId` - Remove member

### Messages
- `GET /api/messages/:chatId` - Get chat messages
- `POST /api/messages` - Send message
- `PUT /api/messages/:id` - Edit message
- `DELETE /api/messages/:id` - Delete message
- `POST /api/messages/:id/reactions` - Add reaction
- `DELETE /api/messages/:id/reactions` - Remove reaction

### Users
- `GET /api/users/search` - Search users
- `GET /api/users/:id` - Get user profile
- `PUT /api/users/profile` - Update profile
- `GET /api/users/contacts` - Get contacts
- `POST /api/users/contacts` - Add contact

### Files
- `POST /api/files/upload` - Upload file

### Stories
- `GET /api/stories` - Get active stories
- `POST /api/stories` - Create story
- `POST /api/stories/:id/view` - Mark story as viewed

### Polls
- `POST /api/polls` - Create poll
- `POST /api/polls/:id/vote` - Vote in poll
- `GET /api/polls/:id/results` - Get poll results

## Environment Variables

```env
PORT=3000
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
JWT_EXPIRES_IN=30d
NODE_ENV=development
```

## License

MIT
