const { spawn } = require('child_process');
const { io } = require('socket.io-client');

const PORT = 3999;
const BASE = 'http://127.0.0.1:' + PORT;
const results = [];

function check(name, ok, extra) {
  results.push({ name, ok });
  console.log((ok ? 'PASS  ' : 'FAIL  ') + name + (extra ? '  (' + extra + ')' : ''));
}

async function waitForServer(timeoutMs) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const res = await fetch(BASE + '/');
      if (res.ok) return true;
    } catch (e) { /* not up yet */ }
    await new Promise((r) => setTimeout(r, 150));
  }
  return false;
}

async function login(name) {
  const res = await fetch(BASE + '/chat/api/setUsername/' + encodeURIComponent(name), { redirect: 'manual' });
  const cookie = (res.headers.get('set-cookie') || '').split(';')[0];
  return { status: res.status, location: res.headers.get('location'), cookie };
}

function connect(cookie) {
  return io(BASE, { transports: ['websocket'], extraHeaders: { Cookie: cookie } });
}

(async () => {
  const server = spawn(process.execPath, ['app.js'], {
    env: { ...process.env, PORT: String(PORT), HOST: '127.0.0.1', SESSION_SECRET: 'test-secret', MAX_MESSAGE_LENGTH: '300' },
    stdio: ['ignore', 'pipe', 'pipe']
  });

  try {
    check('server starts', await waitForServer(8000));

    const home = await fetch(BASE + '/');
    const homeHtml = await home.text();
    check('GET / serves the username page', home.status === 200 && homeHtml.includes('Username'));

    const chatRedirect = await fetch(BASE + '/chat', { redirect: 'manual' });
    check('GET /chat without a session redirects', chatRedirect.status === 302);

    const alice = await login('Uros');
    check('setUsername redirects to /chat', alice.status === 302 && alice.location === '/chat');

    const bob = await login('Marko');
    check('second session gets its own cookie', bob.cookie && bob.cookie !== alice.cookie);

    const chatPage = await fetch(BASE + '/chat', { headers: { Cookie: alice.cookie } });
    const chatHtml = await chatPage.text();
    check('GET /chat with a session serves the chat', chatPage.status === 200 && chatHtml.includes('inputMessage'));

    const a = connect(alice.cookie);
    const b = connect(bob.cookie);

    const setup = await new Promise((resolve) => {
      a.once('setupInfo', resolve);
      setTimeout(() => resolve(null), 3000);
    });
    check('socket receives setupInfo', !!setup && setup.username === 'Uros');

    const received = new Promise((resolve) => { b.once('forwarded_message', resolve); });
    a.emit('client_message', '<img src=x onerror=alert(1)>hello there');
    const msg = await Promise.race([received, new Promise((r) => setTimeout(() => r(null), 3000))]);
    check('message is broadcast to the other client', !!msg && msg.username === 'Uros');
    check('message HTML is stripped of the img payload', !!msg && !/<img/i.test(msg.msg) && msg.msg.includes('hello there'), msg && msg.msg);

    let leaked = false;
    b.once('forwarded_message', () => { leaked = true; });
    a.emit('client_message', 'x'.repeat(400));
    await new Promise((r) => setTimeout(r, 700));
    check('over-long messages are dropped', !leaked);

    const imgOk = new Promise((resolve) => { b.once('forwarded_message_img', resolve); });
    a.emit('client_message_img', 'data:image/png;base64,iVBORw0KGgo=');
    const img = await Promise.race([imgOk, new Promise((r) => setTimeout(() => r(null), 3000))]);
    check('valid image data URL is forwarded', !!img && img.username === 'Uros');

    let badImage = false;
    b.once('forwarded_message_img', () => { badImage = true; });
    a.emit('client_message_img', 'data:text/html;base64,PHNjcmlwdD4=');
    await new Promise((r) => setTimeout(r, 700));
    check('non-image data URL is rejected', !badImage);

    a.close();
    b.close();
  } catch (err) {
    check('unexpected error: ' + err.message, false);
  } finally {
    server.kill();
  }

  const failed = results.filter((r) => !r.ok).length;
  console.log('\n' + (results.length - failed) + '/' + results.length + ' checks passed');
  process.exit(failed ? 1 : 0);
})();