const express = require('express');
const path = require('path');

const router = express.Router();
const publicDir = path.resolve(__dirname, '..', 'Public');

router.get('/', (req, res) => {
  if (req.session.username) return res.redirect('/chat');
  res.sendFile(path.join(publicDir, 'Index', 'index.html'));
});

router.get('/index.js', (req, res) => {
  res.sendFile(path.join(publicDir, 'Index', 'index.js'));
});

module.exports = router;