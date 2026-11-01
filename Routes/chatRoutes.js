const express = require('express');
const path = require('path');

const router = express.Router();
const publicDir = path.resolve(__dirname, '..', 'Public');
const MAX_USERNAME = 24;

router.get('/', (req, res) => {
  if (!req.session.username) return res.redirect('/');
  res.sendFile(path.join(publicDir, 'Chat', 'chat.html'));
});

router.get('/chat.js', (req, res) => {
  res.sendFile(path.join(publicDir, 'Chat', 'chat.js'));
});

router.get('/api/setUsername/:username', (req, res) => {
  const name = String(req.params.username || '').trim();
  if (!name || name.length > MAX_USERNAME) return res.redirect('/');
  req.session.username = name;
  req.session.save(() => res.redirect('/chat'));
});

router.get('/api/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/'));
});

module.exports = router;