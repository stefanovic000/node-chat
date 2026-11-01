// Generates docs/screenshot.png: opens the chat, has a short conversation,
// and captures the page with a headless Edge.
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const { io } = require('socket.io-client');

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const PORT = 3100;
const CDP_PORT = 9700;
const BASE = 'http://127.0.0.1:' + PORT;
const OUT = path.join(__dirname, '..', 'docs', 'screenshot.png');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitFor(fn, timeout = 15000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    try {
      const value = await fn();
      if (value) return value;
    } catch (e) { /* retry */ }
    await sleep(150);
  }
  throw new Error('timeout');
}

async function login(name) {
  const res = await fetch(BASE + '/chat/api/setUsername/' + name, { redirect: 'manual' });
  return (res.headers.get('set-cookie') || '').split(';')[0];
}

(async () => {
  const server = spawn(process.execPath, ['app.js'], {
    cwd: path.join(__dirname, '..'),
    env: { ...process.env, PORT: String(PORT), HOST: '127.0.0.1', SESSION_SECRET: 'shot' },
    stdio: 'ignore'
  });

  const profile = path.join(process.env.TEMP, 'chat-shot-' + Date.now());
  const edge = spawn(EDGE, ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--no-first-run',
    '--remote-debugging-port=' + CDP_PORT, '--user-data-dir=' + profile, 'about:blank'], { stdio: 'ignore' });

  try {
    await waitFor(async () => (await fetch(BASE + '/')).ok);

    const markoCookie = await login('Marko');
    const marko = io(BASE, { transports: ['websocket'], extraHeaders: { Cookie: markoCookie } });

    const target = await waitFor(async () => {
      const res = await fetch('http://127.0.0.1:' + CDP_PORT + '/json/list');
      const list = await res.json();
      return list.find((t) => t.type === 'page');
    });

    const ws = new WebSocket(target.webSocketDebuggerUrl);
    await new Promise((r) => (ws.onopen = r));
    let id = 0;
    const pending = new Map();
    ws.onmessage = (e) => {
      const msg = JSON.parse(e.data);
      if (msg.id && pending.has(msg.id)) {
        pending.get(msg.id)(msg.result);
        pending.delete(msg.id);
      }
    };
    const send = (method, params = {}) => new Promise((resolve) => {
      const i = ++id;
      pending.set(i, resolve);
      ws.send(JSON.stringify({ id: i, method, params }));
    });
    const evaluate = async (expression) => (await send('Runtime.evaluate', { expression, returnByValue: true })).result.value;

    await send('Page.enable');
    await send('Emulation.setDeviceMetricsOverride', { width: 1200, height: 900, deviceScaleFactor: 1, mobile: false });

    await send('Page.navigate', { url: BASE + '/chat/api/setUsername/Uros' });
    await sleep(800);
    await send('Page.navigate', { url: BASE + '/chat' });
    await sleep(1500);

    const say = async (text) => {
      await evaluate('document.getElementById("inputMessage").value = ' + JSON.stringify(text) + '; sendMessageButton();');
      await sleep(400);
    };

    marko.emit('client_message', 'hey, did the session bit work in the end?');
    await sleep(500);
    await say('yeah, reloading keeps you logged in now');
    marko.emit('client_message', 'nice. does it do images too?');
    await sleep(500);
    await say('yep, pick a PNG and it goes to everyone');

    const demo = fs.readFileSync(path.join(__dirname, 'demo-image.png')).toString('base64');
    marko.emit('client_message_img', 'data:image/png;base64,' + demo);
    await sleep(900);

    const shot = await send('Page.captureScreenshot', { format: 'png' });
    fs.mkdirSync(path.dirname(OUT), { recursive: true });
    fs.writeFileSync(OUT, Buffer.from(shot.data, 'base64'));
    console.log('wrote ' + OUT);

    ws.close();
    marko.close();
  } finally {
    edge.kill();
    server.kill();
    await sleep(300);
    try { fs.rmSync(profile, { recursive: true, force: true }); } catch (e) {}
  }
})();