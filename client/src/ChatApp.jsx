import React, { useState, useEffect, useRef } from 'react';
import { useSocket } from './socket/socket';

function getInitials(name) {
  if (typeof name !== 'string') return '';
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase();
}

const ChatApp = () => {
  const [profile, setProfile] = useState({ username: '', photo: '', bio: '' });
  const [showPrompt, setShowPrompt] = useState(true);
  const [file, setFile] = useState(null);
  const [hasMore, setHasMore] = useState(true);
  const [photoFile, setPhotoFile] = useState(null);
  const chatWindowRef = useRef();
  const { connect, sendMessage, sendPrivateMessage, setTyping, socket } = useSocket();

  // --- RESTORE REAL-TIME STATE AND HANDLERS ---
  const [input, setInput] = useState('');
  const [selectedUser, setSelectedUser] = useState(null);
  const [loveCounts, setLoveCounts] = useState({});
  const [currentRoom, setCurrentRoom] = useState('General');
  const [roomMessages, setRoomMessages] = useState([]);
  const [roomUsers, setRoomUsers] = useState([]);
  const [matchedUser, setMatchedUser] = useState(null);
  const [typingUsers, setTypingUsers] = useState([]);

  // Add state for threads
  const [threads, setThreads] = useState([]);
  const [currentThread, setCurrentThread] = useState(null);
  const [showThreadModal, setShowThreadModal] = useState(false);
  const [newThreadName, setNewThreadName] = useState('');
  
  // Add state for rooms
  const [rooms, setRooms] = useState(['General', 'Random', 'Help', 'Off-topic']);

  // Handle thread creation
  const handleCreateThread = (e) => {
    e.preventDefault();
    if (!newThreadName.trim()) return;
    
    const newThread = {
      id: Date.now(),
      name: newThreadName,
      room: currentRoom,
      messages: [],
      createdAt: new Date().toISOString()
    };
    
    setThreads(prev => [...prev, newThread]);
    setCurrentThread(newThread);
    setShowThreadModal(false);
    setNewThreadName('');
  };

  // Handle thread switch
  const handleThreadSwitch = (thread) => {
    setCurrentThread(thread);
    setRoomMessages(thread.messages || []);
  };

  // Update message handling to include threads
  const handleSend = async (e) => {
    e.preventDefault();
    if (!input.trim() && !file) return;
    let messageText = input;
    let fileData = null;
    if (file) {
      try {
        fileData = await uploadFile(file);
        messageText += (messageText ? ' ' : '') + fileData.url;
      } catch (err) {
        alert('File upload failed');
        return;
      }
    }
    
    const newMsg = {
      id: Date.now(),
      sender: profile.username || 'You',
      senderPhoto: profile.photo || 'https://placehold.co/50x50',
      message: messageText,
      timestamp: new Date().toISOString(),
      love: 0,
      threadId: currentThread?.id || null
    };

    if (selectedUser) {
      sendPrivateMessage(selectedUser.id, messageText);
    } else {
      socket.emit('send_message', { message: messageText, threadId: currentThread?.id });
    }

    // Update thread messages if in a thread
    if (currentThread) {
      setThreads(prev => prev.map(thread => 
        thread.id === currentThread.id 
          ? { ...thread, messages: [...thread.messages, newMsg] }
          : thread
      ));
    }

    setRoomMessages(prev => [...prev, newMsg]);
    setInput('');
    setFile(null);
    setTyping(false);
  };

  const handleLove = (messageId) => {
    socket.emit('love_message', messageId);
  };

  const handleRoomSwitch = (room) => {
    if (room !== currentRoom) {
      socket.emit('join_room', room);
      setCurrentThread(null); // Reset thread when switching rooms
    }
  };

  const fetchOlderMessages = async () => {
    if (!roomMessages.length) return;
    const oldest = roomMessages[0];
    const res = await fetch(`/api/messages/${currentRoom}?before=${encodeURIComponent(oldest.timestamp)}&limit=20`);
    if (res.ok) {
      const older = await res.json();
      if (older.length === 0) setHasMore(false);
      setRoomMessages(prev => [...older, ...prev]);
    }
  };

  const handleScroll = (e) => {
    if (e.target.scrollTop === 0 && hasMore) {
      fetchOlderMessages();
    }
  };

  const handleFindMatch = () => {
    console.log('Find Match button clicked', socket.connected);
    socket.emit('find_match');
  };

  const colors = {
    primary: '#1976d2',
    secondary: '#f5f5f5',
    accent: '#e3f2fd',
    border: '#e0e0e0',
    text: '#222',
    muted: '#888',
    love: '#e53935',
    private: '#ad1457',
  };

  const responsiveStyles = {
    container: {
      maxWidth: 900,
      margin: '40px auto',
      border: '1px solid #ccc',
      borderRadius: 8,
      padding: 24,
      background: '#fff',
      boxSizing: 'border-box',
    },
    flex: {
      display: 'flex',
      gap: 24,
    },
    column: {
      width: 180,
      borderRight: '1px solid #eee',
      paddingRight: 16,
      minWidth: 120,
      boxSizing: 'border-box',
    },
    chat: {
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      height: 500,
      minWidth: 0,
    },
    chatWindow: {
      flex: 1,
      overflowY: 'auto',
      marginBottom: 12,
      border: '1px solid #eee',
      borderRadius: 4,
      padding: 12,
      background: '#fafafa',
      minHeight: 0,
    },
    '@media (max-width: 700px)': {
      container: {
        padding: 4,
        margin: 0,
        border: 'none',
        borderRadius: 0,
        maxWidth: '100vw',
      },
      flex: {
        flexDirection: 'column',
        gap: 8,
      },
      column: {
        width: '100%',
        borderRight: 'none',
        borderBottom: '1px solid #eee',
        paddingRight: 0,
        paddingBottom: 8,
      },
      chat: {
        height: 350,
      },
      chatWindow: {
        padding: 6,
        fontSize: 14,
      },
    },
  };

  function mergeStyles(...styles) {
    return Object.assign({}, ...styles);
  }

  // Mock data for online users
  const mockUsers = [
    { id: 1, username: 'Alice', photo: 'https://placehold.co/50x50', bio: 'Just a friendly user' },
    { id: 2, username: 'Bob', photo: 'https://placehold.co/50x50', bio: 'Another user' },
    { id: 3, username: 'Charlie', photo: 'https://placehold.co/50x50', bio: 'Yet another user' },
    { id: 4, username: 'Diana', photo: 'https://placehold.co/50x50', bio: 'A real user' },
    { id: 5, username: 'Eve', photo: 'https://placehold.co/50x50', bio: 'A real user' },
    { id: 6, username: 'Frank', photo: 'https://placehold.co/50x50', bio: 'A real user' },
    { id: 7, username: 'Grace', photo: 'https://placehold.co/50x50', bio: 'A real user' },
    { id: 8, username: 'Hank', photo: 'https://placehold.co/50x50', bio: 'A real user' },
    { id: 9, username: 'Ivy', photo: 'https://placehold.co/50x50', bio: 'A real user' },
    { id: 10, username: 'Jack', photo: 'https://placehold.co/50x50', bio: 'A real user' },
    { id: 11, username: 'Kyle', photo: 'https://placehold.co/50x50', bio: 'A real user' },
    { id: 12, username: 'Lily', photo: 'https://placehold.co/50x50', bio: 'A real user' },
    { id: 13, username: 'Mia', photo: 'https://placehold.co/50x50', bio: 'A real user' },
    { id: 14, username: 'Nate', photo: 'https://placehold.co/50x50', bio: 'A real user' },
    { id: 15, username: 'Olivia', photo: 'https://placehold.co/50x50', bio: 'A real user' },
    { id: 16, username: 'Peter', photo: 'https://placehold.co/50x50', bio: 'A real user' },
    { id: 17, username: 'Quinn', photo: 'https://placehold.co/50x50', bio: 'A real user' },
    { id: 18, username: 'Ryan', photo: 'https://placehold.co/50x50', bio: 'A real user' },
    { id: 19, username: 'Sarah', photo: 'https://placehold.co/50x50', bio: 'A real user' },
    { id: 20, username: 'Tom', photo: 'https://placehold.co/50x50', bio: 'A real user' },
    { id: 21, username: 'Uma', photo: 'https://placehold.co/50x50', bio: 'A real user' },
    { id: 22, username: 'Victor', photo: 'https://placehold.co/50x50', bio: 'A real user' },
    { id: 23, username: 'Wendy', photo: 'https://placehold.co/50x50', bio: 'A real user' },
    { id: 24, username: 'Xavier', photo: 'https://placehold.co/50x50', bio: 'A real user' },
    { id: 25, username: 'Yara', photo: 'https://placehold.co/50x50', bio: 'A real user' },
    { id: 26, username: 'Zach', photo: 'https://placehold.co/50x50', bio: 'A real user' },
  ];

  const mockBots = [
    { id: 27, username: 'Bot1', photo: 'https://placehold.co/50x50', bio: 'A friendly bot' },
    { id: 28, username: 'Bot2', photo: 'https://placehold.co/50x50', bio: 'Another friendly bot' },
    { id: 29, username: 'Bot3', photo: 'https://placehold.co/50x50', bio: 'Yet another friendly bot' },
  ];

  const [sidebarSearch, setSidebarSearch] = useState('');
  const [sidebarHoverUser, setSidebarHoverUser] = useState(null);

  const filteredRealUsers = mockUsers.filter(u =>
    u.username.toLowerCase().includes(sidebarSearch.toLowerCase())
  );

  const filteredBots = mockBots.filter(u =>
    u.username.toLowerCase().includes(sidebarSearch.toLowerCase())
  );

  const mockUserStatus = (user) => {
    const statuses = ['Online', 'Away', 'Busy', 'Offline'];
    const weights = [0.7, 0.2, 0.05, 0.05]; // Higher weights for Online
    const rand = Math.random();
    let cumulativeWeight = 0;
    for (let i = 0; i < weights.length; i++) {
      cumulativeWeight += weights[i];
      if (rand < cumulativeWeight) {
        return statuses[i];
      }
    }
    return statuses[statuses.length - 1]; // Fallback
  };

  useEffect(() => {
    const onMessageLoved = ({ messageId, count }) => setLoveCounts(prev => ({ ...prev, [messageId]: count }));
    const onJoinedRoom = (room) => { setCurrentRoom(room); setSelectedUser(null); setInput(''); };
    const onRoomMessages = (msgs) => setRoomMessages(msgs);
    const onRoomUserList = (userList) => setRoomUsers(userList);
    const onReceiveMessage = (msg) => {
      if (msg.room === currentRoom) {
        setRoomMessages(prev => [...prev, msg]);
        if (msg.sender !== profile.username && !msg.system) {
          if (window.Notification && Notification.permission === 'granted') {
            new Notification(`New message from ${msg.sender}`, {
              body: msg.message,
              icon: '/favicon.ico',
            });
          }
        }
      }
    };
    const onUserJoined = (user) => setRoomMessages(prev => [...prev, { id: Date.now() + Math.random(), system: true, message: `${user.username} joined the chat`, timestamp: new Date().toISOString() }]);
    const onUserLeft = (user) => setRoomMessages(prev => [...prev, { id: Date.now() + Math.random(), system: true, message: `${user.username} left the chat`, timestamp: new Date().toISOString() }]);
    const onTypingUsers = (users) => setTypingUsers(users);
    socket.on('message_loved', onMessageLoved);
    socket.on('joined_room', onJoinedRoom);
    socket.on('room_messages', onRoomMessages);
    socket.on('user_list', onRoomUserList);
    socket.on('receive_message', onReceiveMessage);
    socket.on('user_joined', onUserJoined);
    socket.on('user_left', onUserLeft);
    socket.on('typing_users', onTypingUsers);
    socket.emit('join_room', currentRoom);
    socket.emit('room_list');
    if (window.Notification && Notification.permission !== 'granted') {
      Notification.requestPermission();
    }
    return () => {
      socket.off('message_loved', onMessageLoved);
      socket.off('joined_room', onJoinedRoom);
      socket.off('room_messages', onRoomMessages);
      socket.off('user_list', onRoomUserList);
      socket.off('receive_message', onReceiveMessage);
      socket.off('user_joined', onUserJoined);
      socket.off('user_left', onUserLeft);
      socket.off('typing_users', onTypingUsers);
    };
  }, [socket, currentRoom, profile.username]);

  useEffect(() => {
    setHasMore(true);
  }, [currentRoom]);

  useEffect(() => {
    const onMatched = ({ room, match }) => {
      setCurrentRoom(room);
      setMatchedUser(match);
      setSelectedUser(null);
      setInput('');
    };
    socket.on('matched', onMatched);
    return () => socket.off('matched', onMatched);
  }, [socket]);

  const handleProfileSubmit = async (e) => {
    e.preventDefault();
    if (!profile.username.trim()) return;
    let updatedProfile = { ...profile };
    if (photoFile) {
      try {
        const formData = new FormData();
        formData.append('file', photoFile);
        const res = await fetch('/api/upload', {
          method: 'POST',
          body: formData,
        });
        if (!res.ok) throw new Error('Upload failed');
        const data = await res.json();
        updatedProfile.photo = data.url;
        setProfile((prev) => ({ ...prev, photo: data.url }));
      } catch {
        alert('Photo upload failed');
        return;
      }
    }
    connect(updatedProfile);
    setShowPrompt(false);
  };

  const uploadFile = async (file) => {
    const formData = new FormData();
    formData.append('file', file);
    const res = await fetch('/api/upload', {
      method: 'POST',
      body: formData,
    });
    if (!res.ok) throw new Error('Upload failed');
    return res.json();
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'row', minHeight: '100vh', background: colors.secondary }}>
      {/* Rooms Column (left) */}
      <div style={{ width: 200, background: '#fff', borderRight: '1px solid #e0e0e0', padding: 16, boxSizing: 'border-box', display: 'flex', flexDirection: 'column' }}>
        <h3 style={{ margin: '0 0 16px 0', fontSize: 18, fontWeight: 600 }}>Rooms</h3>
        <ul style={{ listStyle: 'none', padding: 0, margin: 0, flex: 1 }}>
          {rooms.map(room => (
            <li
              key={room}
              style={{
                fontWeight: room === currentRoom ? 'bold' : 'normal',
                background: room === currentRoom ? '#e3f2fd' : 'transparent',
                cursor: 'pointer',
                borderRadius: 4,
                padding: '8px 12px',
                marginBottom: 4,
                border: room === currentRoom ? '1px solid #1976d2' : '1px solid transparent'
              }}
              onClick={() => handleRoomSwitch(room)}
            >
              #{room}
            </li>
          ))}
        </ul>
        
        {/* Find a Match button */}
        {!showPrompt && (
          <button 
            onClick={handleFindMatch} 
            style={{ 
              width: '100%', 
              margin: '12px 0', 
              padding: 10, 
              background: colors.primary, 
              color: '#fff', 
              border: 'none', 
              borderRadius: 4, 
              fontWeight: 600, 
              fontSize: 14,
              cursor: 'pointer'
            }}
          >
            Find a Match
          </button>
        )}
        
        {matchedUser && (
          <div style={{ margin: '12px 0', color: colors.primary, fontWeight: 600, fontSize: 14 }}>
            Matched with: {matchedUser.username}
          </div>
        )}

        {/* Threads Section */}
        {currentRoom && !showPrompt && (
          <>
            <hr style={{ margin: '16px 0', border: 'none', borderTop: '1px solid #e0e0e0' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <h4 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>Threads</h4>
              <button
                onClick={() => setShowThreadModal(true)}
                style={{
                  background: colors.primary,
                  color: '#fff',
                  border: 'none',
                  borderRadius: 4,
                  padding: '4px 8px',
                  fontSize: 12,
                  cursor: 'pointer'
                }}
              >
                + New
              </button>
            </div>
            
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              <li
                style={{
                  fontWeight: !currentThread ? 'bold' : 'normal',
                  background: !currentThread ? '#e3f2fd' : 'transparent',
                  cursor: 'pointer',
                  borderRadius: 4,
                  padding: '6px 10px',
                  marginBottom: 2,
                  fontSize: 14
                }}
                onClick={() => handleThreadSwitch(null)}
              >
                #general
              </li>
              {threads
                .filter(thread => thread.room === currentRoom)
                .map(thread => (
                  <li
                    key={thread.id}
                    style={{
                      fontWeight: currentThread?.id === thread.id ? 'bold' : 'normal',
                      background: currentThread?.id === thread.id ? '#e3f2fd' : 'transparent',
                      cursor: 'pointer',
                      borderRadius: 4,
                      padding: '6px 10px',
                      marginBottom: 2,
                      fontSize: 14
                    }}
                    onClick={() => handleThreadSwitch(thread)}
                  >
                    #{thread.name}
                  </li>
                ))}
            </ul>
          </>
        )}
      </div>

      {/* Main Chat Container (center) */}
      <div style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
        <div style={{ ...responsiveStyles.container, fontFamily: 'Segoe UI, Arial, sans-serif', background: colors.secondary, margin: '40px 0', minWidth: 0, maxWidth: 'none' }}>
          {/* Header */}
          <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: colors.primary, color: '#fff', padding: '16px 24px', borderRadius: 8, marginBottom: 16 }}>
            <div style={{ fontWeight: 700, fontSize: 24, letterSpacing: 1 }}>💬 MatchChat</div>
            {profile.username && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                {profile.photo ? (
                  <img src={profile.photo} alt="avatar" style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover', border: '2px solid #fff' }} />
                ) : (
                  <div style={{ width: 36, height: 36, borderRadius: '50%', background: colors.accent, color: colors.primary, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 18 }}>{getInitials(profile.username)}</div>
                )}
                <div>
                  <div style={{ fontWeight: 600 }}>{profile.username}</div>
                  <div style={{ fontSize: 12, color: '#e3f2fd' }}>{profile.bio}</div>
                </div>
              </div>
            )}
          </header>
          
          {/* Profile Modal */}
          {showPrompt && (
            <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10 }}>
              <form onSubmit={handleProfileSubmit} style={{ background: '#fff', padding: 32, borderRadius: 8, boxShadow: '0 2px 8px rgba(0,0,0,0.2)', minWidth: 320 }}>
                <h2 style={{ marginBottom: 16 }}>Create Your Profile</h2>
                <label style={{ display: 'block', marginBottom: 8 }}>Username</label>
                <input value={profile.username} onChange={e => setProfile(p => ({ ...p, username: e.target.value }))} required style={{ width: '100%', marginBottom: 12, padding: 8, borderRadius: 4, border: `1px solid ${colors.border}` }} autoFocus />
                <label style={{ display: 'block', marginBottom: 8 }}>Profile Photo</label>
                <input type="file" accept="image/*" onChange={e => setPhotoFile(e.target.files[0])} style={{ marginBottom: 12 }} />
                <label style={{ display: 'block', marginBottom: 8 }}>Bio</label>
                <textarea value={profile.bio} onChange={e => setProfile(p => ({ ...p, bio: e.target.value }))} rows={2} style={{ width: '100%', marginBottom: 16, padding: 8, borderRadius: 4, border: `1px solid ${colors.border}` }} />
                <button type="submit" style={{ width: '100%', padding: 10, background: colors.primary, color: '#fff', border: 'none', borderRadius: 4, fontWeight: 600, fontSize: 16 }}>Join Chat</button>
              </form>
            </div>
          )}

          {/* Thread Creation Modal */}
          {showThreadModal && (
            <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10 }}>
              <form onSubmit={handleCreateThread} style={{ background: '#fff', padding: 32, borderRadius: 8, boxShadow: '0 2px 8px rgba(0,0,0,0.2)', minWidth: 320 }}>
                <h2 style={{ marginBottom: 16 }}>Create New Thread</h2>
                <label style={{ display: 'block', marginBottom: 8 }}>Thread Name</label>
                <input 
                  value={newThreadName} 
                  onChange={e => setNewThreadName(e.target.value)} 
                  required 
                  style={{ width: '100%', marginBottom: 16, padding: 8, borderRadius: 4, border: `1px solid ${colors.border}` }} 
                  autoFocus 
                  placeholder="Enter thread name..."
                />
                <div style={{ display: 'flex', gap: 8 }}>
                  <button type="submit" style={{ flex: 1, padding: 10, background: colors.primary, color: '#fff', border: 'none', borderRadius: 4, fontWeight: 600, fontSize: 16 }}>Create Thread</button>
                  <button type="button" onClick={() => setShowThreadModal(false)} style={{ flex: 1, padding: 10, background: '#ccc', color: '#333', border: 'none', borderRadius: 4, fontWeight: 600, fontSize: 16 }}>Cancel</button>
                </div>
              </form>
            </div>
          )}

          {/* Chat Window */}
          <div style={{ display: 'flex', flexDirection: 'column', height: 500 }}>
            {/* Chat Header */}
            <div style={{ padding: '12px 16px', borderBottom: '1px solid #e0e0e0', background: '#fafafa', borderRadius: '8px 8px 0 0' }}>
              <div style={{ fontWeight: 600, fontSize: 16 }}>
                #{currentRoom}
                {currentThread && (
                  <span style={{ color: colors.muted, fontWeight: 400 }}> → #{currentThread.name}</span>
                )}
              </div>
            </div>

            <div
              ref={chatWindowRef}
              style={{ flex: 1, overflowY: 'auto', border: '1px solid #eee', borderRadius: '0 0 8px 8px', padding: 12, background: '#fafafa', minHeight: 0 }}
              onScroll={handleScroll}
            >
              {/* Typing indicator */}
              {typingUsers && typingUsers.filter(u => u !== profile.username).length > 0 && (
                <div style={{ color: '#888', fontStyle: 'italic', margin: '4px 0 8px 0' }}>
                  {typingUsers
                    .filter(u => u !== profile.username)
                    .map((u, i, arr) =>
                      i === arr.length - 1
                        ? u
                        : i === arr.length - 2
                        ? `${u} and `
                        : `${u}, `
                    )}
                  {typingUsers.filter(u => u !== profile.username).length === 1 ? ' is typing...' : ' are typing...'}
                </div>
              )}
              
              {roomMessages.map(msg => (
                <div key={msg.id} style={{ margin: '8px 0', color: msg.system ? '#888' : msg.isPrivate ? '#ad1457' : '#222', background: msg.isPrivate ? '#fce4ec' : 'transparent', borderRadius: 4, padding: msg.isPrivate ? '4px 8px' : 0 }}>
                  {msg.system ? (
                    <em>{msg.message}</em>
                  ) : (
                    <>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        {!msg.system && (
                          msg.senderPhoto
                            ? <img src={msg.senderPhoto} alt="avatar" style={{ width: 24, height: 24, borderRadius: '50%', objectFit: 'cover' }} />
                            : <div style={{ width: 24, height: 24, borderRadius: '50%', background: colors.accent, color: colors.primary, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 14 }}>{getInitials(msg.sender || '')}</div>
                        )}
                        <strong>{msg.sender}</strong> <span style={{ fontSize: 12, color: '#888' }}>{new Date(msg.timestamp).toLocaleTimeString()}</span>
                      </div>
                      {msg.isPrivate && <span style={{ fontSize: 11, color: '#ad1457', marginLeft: 6 }}>[Private]</span>}
                      : {msg.message && msg.message.split(' ').map((part, i) => {
                        if (part.startsWith('/uploads/')) {
                          const isImage = /\.(jpg|jpeg|png|gif|webp)$/i.test(part);
                          return isImage ? (
                            <img key={i} src={part} alt="upload" style={{ maxWidth: 120, maxHeight: 120, margin: '0 4px', verticalAlign: 'middle' }} />
                          ) : (
                            <a key={i} href={part} target="_blank" rel="noopener noreferrer" style={{ margin: '0 4px' }}>Download</a>
                          );
                        }
                        return part + ' ';
                      })}
                      <button
                        style={{ marginLeft: 8, fontSize: 15, background: 'none', border: 'none', cursor: 'pointer' }}
                        title="Love this message"
                        onClick={() => handleLove(msg.id)}
                      >
                        ❤️ {loveCounts[msg.id] || 0}
                      </button>
                    </>
                  )}
                </div>
              ))}
            </div>
            
            {/* Message Input */}
            <form onSubmit={handleSend} style={{ display: 'flex', gap: 8, padding: '12px 0' }}>
              <input
                value={input}
                onChange={e => {
                  setInput(e.target.value);
                  setTyping(e.target.value.length > 0);
                }}
                placeholder={selectedUser ? `Message @${selectedUser.username}...` : `Message #${currentRoom}${currentThread ? ` → #${currentThread.name}` : ''}...`}
                style={{ flex: 1, padding: 8, borderRadius: 4, border: '1px solid #ccc' }}
                disabled={showPrompt}
              />
              <input
                type="file"
                style={{ width: 120 }}
                onChange={e => setFile(e.target.files[0])}
                disabled={showPrompt}
              />
              <button type="submit" disabled={(!input.trim() && !file) || showPrompt}>Send</button>
            </form>
          </div>
        </div>
      </div>
      {/* Online Users Sidebar (fixed on right) */}
      <div style={{ width: 260, background: '#f0f7fa', borderLeft: '2px solid #b3e5fc', padding: 24, boxSizing: 'border-box', position: 'fixed', right: 0, top: 0, height: '100vh', overflowY: 'auto', zIndex: 100, display: 'flex', flexDirection: 'column' }}>
        {/* Sidebar Header: Your profile and settings */}
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 18, gap: 10 }}>
          {profile.photo ? (
            <img src={profile.photo} alt="avatar" style={{ width: 38, height: 38, borderRadius: '50%', objectFit: 'cover', border: '2px solid #fff' }} />
          ) : (
            <div style={{ width: 38, height: 38, borderRadius: '50%', background: colors.accent, color: colors.primary, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 18 }}>{getInitials(profile.username)}</div>
          )}
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 600 }}>{profile.username || 'You'}</div>
            <div style={{ fontSize: 12, color: colors.muted }}>{profile.bio || 'Set your bio...'}</div>
          </div>
          <span title="Settings" style={{ cursor: 'pointer', fontSize: 20, color: colors.primary, marginLeft: 4 }}>⚙️</span>
        </div>
        {/* Search Bar */}
        <input
          type="text"
          placeholder="Search users..."
          style={{ width: '100%', padding: '7px 10px', borderRadius: 6, border: '1px solid #b3e5fc', marginBottom: 16, fontSize: 15 }}
          onChange={e => setSidebarSearch(e.target.value)}
          value={sidebarSearch || ''}
        />
        {/* Online Users List (with bots separated) */}
        <h3 style={{ margin: '10px 0 6px 0', fontSize: 17 }}>Online Users</h3>
        <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
          {filteredRealUsers.length === 0 && (
            <li style={{ color: colors.muted, textAlign: 'center', margin: '30px 0' }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>🕊️</div>
              No real users online
            </li>
          )}
          {filteredRealUsers.map(u => (
            <li
              key={u.id}
              style={{
                fontWeight: u.username === profile.username ? 'bold' : 'normal',
                background: selectedUser && selectedUser.id === u.id ? '#e0f7fa' : 'transparent',
                cursor: u.username !== profile.username ? 'pointer' : 'default',
                borderRadius: 4,
                padding: '6px 10px',
                marginBottom: 4,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                position: 'relative',
              }}
              onMouseEnter={() => setSidebarHoverUser(u)}
              onMouseLeave={() => setSidebarHoverUser(null)}
              onClick={() => u.username !== profile.username && setSelectedUser(selectedUser && selectedUser.id === u.id ? null : u)}
              title={u.username === profile.username ? 'You' : 'Click to send private message'}
            >
              <span style={{
                display: 'inline-block',
                width: 10,
                height: 10,
                borderRadius: '50%',
                background: '#4caf50',
                marginRight: 8,
              }} />
              {u.photo
                ? <img src={u.photo} alt="avatar" style={{ width: 28, height: 28, borderRadius: '50%', marginRight: 10 }} />
                : <div style={{ width: 28, height: 28, borderRadius: '50%', background: colors.accent, color: colors.primary, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 14 }}>{getInitials(u.username || '')}</div>
              }
              <span>{u.username} {u.username === profile.username && '(You)'}</span>
              {/* Mock status */}
              <span style={{ fontSize: 11, color: '#388e3c', marginLeft: 'auto', marginRight: 4 }}>{mockUserStatus(u)}</span>
              {/* Quick actions (mock) */}
              <span style={{ display: 'flex', gap: 6 }}>
                <span title="Start Chat" style={{ cursor: 'pointer', fontSize: 16 }}>💬</span>
                <span title="Send Wave" style={{ cursor: 'pointer', fontSize: 16 }}>👋</span>
              </span>
              {/* Profile preview on hover */}
              {sidebarHoverUser && sidebarHoverUser.id === u.id && (
                <div style={{ position: 'absolute', left: 50, top: 38, zIndex: 10, background: '#fff', border: '1px solid #b3e5fc', borderRadius: 8, boxShadow: '0 2px 8px rgba(0,0,0,0.08)', padding: 12, minWidth: 180 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    {u.photo
                      ? <img src={u.photo} alt="avatar" style={{ width: 36, height: 36, borderRadius: '50%' }} />
                      : <div style={{ width: 36, height: 36, borderRadius: '50%', background: colors.accent, color: colors.primary, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 16 }}>{getInitials(u.username || '')}</div>
                    }
                    <div>
                      <div style={{ fontWeight: 600 }}>{u.username}</div>
                      <div style={{ fontSize: 12, color: colors.muted }}>{u.bio || 'No bio set.'}</div>
                    </div>
                  </div>
                  <div style={{ marginTop: 8, fontSize: 12, color: colors.muted }}>Status: {mockUserStatus(u)}</div>
                </div>
              )}
            </li>
          ))}
        </ul>
        {/* Bots Section */}
        <h4 style={{ margin: '18px 0 6px 0', fontSize: 15, color: colors.muted, fontWeight: 500 }}>Bots</h4>
        <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
          {filteredBots.length === 0 && (
            <li style={{ color: colors.muted, textAlign: 'center', margin: '10px 0' }}>No bots online</li>
          )}
          {filteredBots.map(u => (
            <li
              key={u.id}
              style={{
                background: selectedUser && selectedUser.id === u.id ? '#e0f7fa' : 'transparent',
                cursor: 'pointer',
                borderRadius: 4,
                padding: '6px 10px',
                marginBottom: 4,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                position: 'relative',
                color: '#607d8b',
                fontStyle: 'italic',
              }}
              onMouseEnter={() => setSidebarHoverUser(u)}
              onMouseLeave={() => setSidebarHoverUser(null)}
              onClick={() => setSelectedUser(selectedUser && selectedUser.id === u.id ? null : u)}
              title="Bot user"
            >
              <span style={{
                display: 'inline-block',
                width: 10,
                height: 10,
                borderRadius: '50%',
                background: '#bdbdbd',
                marginRight: 8,
              }} />
              {u.photo
                ? <img src={u.photo} alt="avatar" style={{ width: 28, height: 28, borderRadius: '50%', marginRight: 10 }} />
                : <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#e0e0e0', color: '#607d8b', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 14 }}>{getInitials(u.username || '')}</div>
              }
              <span>{u.username}</span>
              <span style={{ fontSize: 11, color: '#888', marginLeft: 'auto', marginRight: 4 }}>Bot</span>
              {/* Quick actions (mock) */}
              <span style={{ display: 'flex', gap: 6 }}>
                <span title="Start Chat" style={{ cursor: 'pointer', fontSize: 16 }}>💬</span>
              </span>
              {/* Profile preview on hover */}
              {sidebarHoverUser && sidebarHoverUser.id === u.id && (
                <div style={{ position: 'absolute', left: 50, top: 38, zIndex: 10, background: '#fff', border: '1px solid #b3e5fc', borderRadius: 8, boxShadow: '0 2px 8px rgba(0,0,0,0.08)', padding: 12, minWidth: 180 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    {u.photo
                      ? <img src={u.photo} alt="avatar" style={{ width: 36, height: 36, borderRadius: '50%' }} />
                      : <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#e0e0e0', color: '#607d8b', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 16 }}>{getInitials(u.username || '')}</div>
                    }
                    <div>
                      <div style={{ fontWeight: 600 }}>{u.username}</div>
                      <div style={{ fontSize: 12, color: colors.muted }}>Bot user</div>
                    </div>
                  </div>
                  <div style={{ marginTop: 8, fontSize: 12, color: colors.muted }}>Status: Online</div>
                </div>
              )}
            </li>
          ))}
        </ul>
        {selectedUser && (
          <div style={{ marginTop: 12, fontSize: 13, color: '#00796b' }}>
            Private messaging <strong>{selectedUser.username}</strong>
            <button style={{ marginLeft: 10, fontSize: 12 }} onClick={() => setSelectedUser(null)}>Cancel</button>
          </div>
        )}
      </div>
    </div>
  );
};

export default ChatApp; 