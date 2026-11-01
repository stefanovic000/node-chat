require('dotenv').config();
const http = require('http');
const express = require('express');
const session = require('express-session');
const setupIO = require('./Routes/ioHandler');

const app = express();
const server = http.createServer(app);

const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || '0.0.0.0';

const sessionMiddleware = session({
  secret: process.env.SESSION_SECRET || 'dev-only-change-me',
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, sameSite: 'lax', maxAge: 12 * 60 * 60 * 1000 }
});

app.disable('x-powered-by');
app.use(sessionMiddleware);

setupIO(sessionMiddleware, server);

app.use('/', require('./Routes/defaultRoutes'));
app.use('/chat', require('./Routes/chatRoutes'));

app.use((req, res) => res.status(404).type('text/plain').send('Not found'));

server.listen(PORT, HOST, () => {
  console.log('listening on http://' + HOST + ':' + PORT);
});