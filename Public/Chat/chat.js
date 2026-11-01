var socket = io();
var socketIOConnected = false;
var username = null;
var MAX_MESSAGE_LENGTH = 300;

function escapeHtml(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function card(title, bodyHtml, extraClass) {
  return '<div class="card text-bg-dark border-light msg ' + (extraClass || '') + '">' +
    '<div class="card-body">' +
    '<h5 class="card-title">' + escapeHtml(title) + '</h5>' +
    bodyHtml +
    '</div></div>';
}

function appendHtml(html) {
  var chat = document.getElementById('chat');
  chat.insertAdjacentHTML('beforeend', html);
  chat.scrollTop = chat.scrollHeight;
}

function sendMessage(msg) {
  if (!socketIOConnected) return;
  socket.emit('client_message', msg);
  appendOwnMessage(msg);
}

function sendMessageImg(base64) {
  if (!socketIOConnected) return;
  socket.emit('client_message_img', base64);
  appendOwnMessageImg(base64);
}

function sendMessageButton() {
  var msg = document.getElementById('inputMessage').value;
  if (msg.length === 0) { throwError('Message is empty.'); return; }
  if (msg.length > MAX_MESSAGE_LENGTH) { throwError('Max length of message is: ' + MAX_MESSAGE_LENGTH + '.'); return; }
  sendMessage(msg);
  document.getElementById('inputMessage').value = '';
}

function sendFileButton() {
  var input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/png, image/jpeg, image/gif, image/webp';

  input.onchange = function (e) {
    var file = e.target.files[0];
    if (!file) return;
    if (file.size > 1.5 * 1024 * 1024) { throwError('Image is too large (max 1.5 MB).'); return; }
    var reader = new FileReader();
    reader.onloadend = function () { sendMessageImg(reader.result); };
    reader.readAsDataURL(file);
  };

  input.click();
}

socket.on('connect', function () { socketIOConnected = true; });
socket.on('disconnect', function () { socketIOConnected = false; });

socket.on('forwarded_message', function (msg) { appendForwardedMessage(msg); });
socket.on('forwarded_message_img', function (msg) { appendForwardedMessageImg(msg); });
socket.on('setupInfo', function (msg) { username = msg.username; });

function appendForwardedMessage(msg) {
  if (!msg || typeof msg.msg !== 'string') return;
  appendHtml(card(msg.username, '<p class="mb-0">' + escapeHtml(msg.msg) + '</p>'));
}

function appendForwardedMessageImg(msg) {
  if (!msg || typeof msg.msg !== 'string') return;
  var safe = escapeHtml(msg.msg);
  appendHtml(card(msg.username,
    '<a data-fancybox="gallery" href="' + safe + '"><img src="' + safe + '" alt="image"></a>', 'msg-img'));
}

function appendOwnMessage(msg) {
  appendHtml(card(username, '<p class="mb-0">' + escapeHtml(msg) + '</p>'));
}

function appendOwnMessageImg(base64) {
  var safe = escapeHtml(base64);
  appendHtml(card(username,
    '<a data-fancybox="gallery" href="' + safe + '"><img src="' + safe + '" alt="image"></a>', 'msg-img'));
}

function logoutButton() {
  window.location.replace('/chat/api/logout');
}

function throwError(error) {
  var toastLiveExample = document.getElementById('liveToast');
  var toastBootstrap = bootstrap.Toast.getOrCreateInstance(toastLiveExample);
  document.getElementById('toast-msg').textContent = error;
  toastBootstrap.show();
}

document.querySelector('#inputMessage').addEventListener('keypress', function (e) {
  if (e.key === 'Enter') sendMessageButton();
});