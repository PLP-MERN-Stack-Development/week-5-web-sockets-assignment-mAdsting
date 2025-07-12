# MatchChat

A modern real-time chat app built with React, Socket.io, and Node.js.

## Features
- Real-time messaging in rooms
- Private messaging
- File and image sharing
- Emoji reactions (❤️)
- Matchmaking (Find a Match for 1-on-1 chat)
- Typing indicator (see when others are typing)
- User profiles with avatar and bio
- Responsive, modern UI
- **Sidebar with visually full mock users and bots** (for demo look)

## Setup & Run

### 1. Install dependencies
From the project root, run:
```sh
npm install
cd client && npm install
cd ../server && npm install
```

### 2. Start the server
From the `server` directory:
```sh
node server.js
```

### 3. Start the client
From the `client` directory:
```sh
npm run dev
```

### 4. (Optional) Run mock bots for testing
From the project root:
```sh
node mock-bots.js
```

## Notes
- The **sidebar user list** is filled with mock users and bots for a lively demo look. The main chat, rooms, and messages are fully real-time.
- You can chat, share files, react, and see typing status in real time.
- Matchmaking pairs you with another user for a private chat room.

## Assignment Requirements
- [x] Real-time chat with rooms
- [x] Private messaging
- [x] File/image sharing
- [x] Emoji reactions
- [x] Typing indicator
- [x] User profiles
- [x] Matchmaking
- [x] Responsive, modern UI
- [x] Mock users in sidebar for demo

---

**Enjoy using MatchChat!** 