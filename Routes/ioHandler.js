const { Server } = require('socket.io');

const MAX_MESSAGE = Number(process.env.MAX_MESSAGE_LENGTH) || 300;
const MAX_IMAGE_CHARS = Number(process.env.MAX_IMAGE_CHARS) || 2 * 1024 * 1024;
const IMAGE_DATA_URL = /^data:image\/(png|jpeg|jpg|gif|webp);base64,[A-Za-z0-9+/=]+$/;

function stripTags(value) {
  return String(value == null ? '' : value).replace(/<[^>]*>/g, '').replace(/[<>]/g, '');
}

function cleanName(value) {
  return stripTags(value).slice(0, 24).trim();
}

function setupIO(sessionMiddleware, server) {
  const io = new Server(server, { maxHttpBufferSize: 3e6, pingTimeout: 60000 });
  io.engine.use(sessionMiddleware);

  io.on('connection', (socket) => {
    const req = socket.request;
    if (!req.session || !req.session.username) {
      socket.disconnect(true);
      return;
    }

    const username = cleanName(req.session.username);
    socket.emit('setupInfo', { username });

    socket.on('client_message', (msg) => {
      if (typeof msg !== 'string') return;
      const text = msg.trim();
      if (!text || text.length > MAX_MESSAGE) return;
      socket.broadcast.emit('forwarded_message', { username, msg: stripTags(text) });
    });

    socket.on('client_message_img', (data) => {
      if (typeof data !== 'string') return;
      if (data.length > MAX_IMAGE_CHARS) return;
      if (!IMAGE_DATA_URL.test(data)) return;
      socket.broadcast.emit('forwarded_message_img', { username, msg: data });
    });
  });
}

module.exports = setupIO;