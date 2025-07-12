const io = require('socket.io-client');

const SERVER_URL = 'http://localhost:5000';
const NUM_BOTS = 3;
const DELAY = 2000; // ms between actions

function randomUsername(base) {
  return base + Math.floor(Math.random() * 10000);
}

const botProfiles = [
  { username: randomUsername('AliceBot'), photo: '', bio: 'I am Alice the bot.' },
  { username: randomUsername('BobBot'), photo: '', bio: 'I am Bob the bot.' },
  { username: randomUsername('CharlieBot'), photo: '', bio: 'I am Charlie the bot.' },
];

const bots = [];

function randomMessage() {
  const messages = [
    'Hello!',
    'How are you?',
    'Nice to meet you!',
    'Let’s chat!',
    'What’s up?',
    '🤖',
  ];
  return messages[Math.floor(Math.random() * messages.length)];
}

for (let i = 0; i < NUM_BOTS; i++) {
  const socket = io(SERVER_URL, {
    reconnection: true,
    autoConnect: true,
  });
  bots.push(socket);

  socket.on('connect', () => {
    console.log(`${botProfiles[i].username} connected`);
    socket.emit('user_join', botProfiles[i]);
    setTimeout(() => {
      // Send a message in General room before matching
      socket.emit('send_message', { message: randomMessage() });
      setTimeout(() => {
        socket.emit('find_match');
      }, DELAY);
    }, DELAY);
  });

  socket.on('matched', ({ room, match }) => {
    console.log(`${botProfiles[i].username} matched with ${match.username} in room ${room}`);
    setTimeout(() => {
      socket.emit('send_message', { message: randomMessage() });
    }, DELAY);
  });

  socket.on('receive_message', (msg) => {
    if (msg.sender !== botProfiles[i].username) {
      console.log(`${botProfiles[i].username} received: ${msg.message}`);
    }
  });
} 