'use strict';
const fs = require('node:fs'),
  path = require('node:path'),
  os = require('node:os'),
  http = require('node:http'),
  assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const root = path.resolve(__dirname, '../dist');
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'pikavolley-offline-'));
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const connections = [],
  errors = [];
let chrome;
const server = http.createServer((req, res) => {
  let file = path.resolve(
    root,
    '.' + decodeURIComponent(req.url.split('?')[0])
  );
  if (!file.startsWith(root + path.sep)) {
    res.writeHead(403);
    res.end();
    return;
  }
  if (fs.existsSync(file) && fs.statSync(file).isDirectory())
    file = path.join(file, 'index.html');
  if (!fs.existsSync(file)) {
    res.writeHead(404);
    res.end();
    return;
  }
  res.setHeader(
    'content-type',
    {
      '.html': 'text/html',
      '.js': 'text/javascript',
      '.json': 'application/json',
      '.css': 'text/css',
      '.png': 'image/png',
      '.mp3': 'audio/mpeg',
      '.wav': 'audio/wav',
    }[path.extname(file)] || 'application/octet-stream'
  );
  fs.createReadStream(file).pipe(res);
});
async function cdp(url) {
  const socket = new WebSocket(url);
  connections.push(socket);
  await new Promise((resolve, reject) => {
    socket.addEventListener('open', resolve, { once: true });
    socket.addEventListener('error', reject, { once: true });
  });
  let serial = 0;
  const pending = new Map();
  socket.addEventListener('message', (event) => {
    const message = JSON.parse(event.data);
    if (message.id) {
      const callback = pending.get(message.id);
      pending.delete(message.id);
      if (callback) callback(message);
    }
    if (message.method === 'Runtime.exceptionThrown')
      errors.push(message.params.exceptionDetails);
  });
  const send = (method, params = {}) =>
    new Promise((resolve, reject) => {
      const id = ++serial;
      const timer = setTimeout(
        () => reject(Error('CDP timeout ' + method)),
        20000
      );
      pending.set(id, (message) => {
        clearTimeout(timer);
        message.error
          ? reject(Error(JSON.stringify(message.error)))
          : resolve(message.result);
      });
      socket.send(JSON.stringify({ id, method, params }));
    });
  const ev = async (expression) => {
    const result = await send('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true,
    });
    if (result.exceptionDetails)
      throw Error(JSON.stringify(result.exceptionDetails));
    return result.result.value;
  };
  const until = async (expression) => {
    for (let i = 0; i < 200; i++) {
      if (await ev(expression)) return;
      await delay(60);
    }
    throw Error('Timed out: ' + expression);
  };
  return { send, ev, until };
}
async function key(page, code, type) {
  const values = {
    Enter: ['Enter', 13],
    Comma: [',', 188],
    ArrowUp: ['ArrowUp', 38],
    ArrowDown: ['ArrowDown', 40],
    ArrowLeft: ['ArrowLeft', 37],
    ArrowRight: ['ArrowRight', 39],
  };
  const [value, number] = values[code] || [
    code.slice(3).toLowerCase(),
    code.charCodeAt(3),
  ];
  await page.send('Input.dispatchKeyEvent', {
    type,
    code,
    key: value,
    windowsVirtualKeyCode: number,
  });
}
async function tap(page, code) {
  await key(page, code, 'keyDown');
  await delay(110);
  await key(page, code, 'keyUp');
  await delay(70);
}
async function selectMode(page, index, code) {
  await page.ev(
    '__volley.game.setMode(true);__volley.game.paused=false;__volley.game.frameCounter=72;__volley.game.selectedWithWho=' +
      index +
      ';__volley.game.view.menu.selectWithWho(' +
      index +
      ');'
  );
  await tap(page, code);
  await page.until('__volley.game.doublesHumanSlots!==null');
  await page.ev('__volley.game.paused=true');
}
async function input(page, slot, code) {
  await key(page, code, 'keyDown');
  const value = await page.ev(
    '(()=>{const k=__volley.game.keyboardArray[' +
      slot +
      '];k.getInput();return [k.xDirection,k.yDirection,k.powerHit];})()'
  );
  await key(page, code, 'keyUp');
  await page.ev('__volley.game.keyboardArray[' + slot + '].getInput()');
  return value;
}
(async () => {
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const executable =
    process.env.PIKA_CHROME ||
    'C:/Program Files/Google/Chrome/Application/chrome.exe';
  chrome = spawn(
    executable,
    [
      '--headless=new',
      '--mute-audio',
      '--disable-gpu',
      '--no-first-run',
      '--no-default-browser-check',
      '--autoplay-policy=no-user-gesture-required',
      '--remote-debugging-port=0',
      '--window-size=1280,1000',
      '--user-data-dir=' + profile,
      'about:blank',
    ],
    { stdio: 'ignore', windowsHide: true }
  );
  const active = path.join(profile, 'DevToolsActivePort');
  for (let i = 0; i < 150 && !fs.existsSync(active); i++) await delay(100);
  assert.ok(
    fs.existsSync(active),
    'Chrome must be installed or PIKA_CHROME set'
  );
  const port = fs.readFileSync(active, 'utf8').split('\n')[0];
  const version = await (
    await fetch('http://127.0.0.1:' + port + '/json/version')
  ).json();
  const browser = await cdp(version.webSocketDebuggerUrl);
  const { targetId } = await browser.send('Target.createTarget', {
    url: 'about:blank',
  });
  const targets = await (
    await fetch('http://127.0.0.1:' + port + '/json/list')
  ).json();
  const target = targets.find((item) => item.id === targetId);
  const page = await cdp(target.webSocketDebuggerUrl);
  await page.send('Runtime.enable');
  await page.send('Page.navigate', {
    url: 'http://127.0.0.1:' + server.address().port + '/en/',
  });
  await page.until('!!document.getElementById("game-canvas")');
  await page.ev('document.getElementById("close-about-btn").click()');
  await page.until(
    '!!window.__volley && !!document.getElementById("doubles-fv-mode")'
  );
  assert.equal(await page.ev('__volley.game.doublesCourtWidth'), 340);
  assert.equal(
    await page.ev('document.getElementById("court-width-input").value'),
    '340'
  );
  await page.ev('__volley.game.frameCounter=72');
  await tap(page, 'ArrowDown');
  assert.equal(await page.ev('__volley.game.selectedWithWho'), 1);
  await tap(page, 'ArrowDown');
  assert.equal(await page.ev('__volley.game.selectedWithWho'), 2);
  await tap(page, 'KeyR');
  assert.equal(await page.ev('__volley.game.selectedWithWho'), 1);
  for (const [index, code] of ['KeyZ', 'KeyV', 'Comma', 'Enter'].entries()) {
    await selectMode(page, 0, code);
    assert.deepEqual(await page.ev('__volley.game.doublesHumanSlots'), [index]);
    assert.deepEqual(
      await page.ev('__volley.game.players.map(p=>p.isComputer)'),
      [0, 1, 2, 3].map((i) => i !== index)
    );
    assert.deepEqual((await input(page, index, 'KeyF')).slice(0, 2), [
      index < 2 ? 1 : -1,
      1,
    ]);
    assert.equal((await input(page, index, 'ArrowUp'))[1], -1);
    assert.equal((await input(page, index, 'KeyR'))[1], -1);
  }
  for (const [code, slots] of [
    ['KeyZ', [0, 1]],
    ['Enter', [2, 3]],
  ]) {
    await selectMode(page, 1, code);
    assert.deepEqual(await page.ev('__volley.game.doublesHumanSlots'), slots);
    assert.equal((await input(page, slots[0], 'KeyG'))[0], 1);
    assert.equal((await input(page, slots[1], 'ArrowLeft'))[0], -1);
  }
  // Verify real independent movement during a live right-team match.
  await page.ev('__volley.game.paused=false');
  await page.until('__volley.game.state===__volley.game.round');
  const before = await page.ev('__volley.game.players.slice(2).map(p=>p.x)');
  await key(page, 'KeyD', 'keyDown');
  await key(page, 'ArrowLeft', 'keyDown');
  await delay(350);
  await key(page, 'KeyD', 'keyUp');
  await key(page, 'ArrowLeft', 'keyUp');
  const after = await page.ev('__volley.game.players.slice(2).map(p=>p.x)');
  assert.ok(after[0] < before[0] && after[1] < before[1]);
  await page.ev(
    'document.getElementById("doubles-fv-mode").value="down-only";document.getElementById("doubles-fv-mode").dispatchEvent(new Event("change"));window.beforeReload=true;'
  );
  assert.equal(
    await page.ev('localStorage.getItem("pv-offline-doubles-fv")'),
    'down-only'
  );
  await page.send('Page.reload', { ignoreCache: true });
  await page.until(
    '!window.beforeReload && !!document.getElementById("game-canvas")'
  );
  await page.ev('document.getElementById("close-about-btn").click()');
  await page.until(
    '!window.beforeReload && window.__volley && __volley.game.doublesFVMode==="down-only"'
  );
  assert.equal(
    await page.ev('document.getElementById("doubles-fv-mode").value'),
    'down-only'
  );
  await selectMode(page, 0, 'KeyV');
  assert.deepEqual(await page.ev('__volley.game.doublesHumanSlots'), [1]);
  assert.deepEqual((await input(page, 1, 'KeyF')).slice(0, 2), [0, 1]);
  assert.deepEqual((await input(page, 1, 'KeyV')).slice(0, 2), [0, 0]);
  await page.ev('__volley.game.setMode(false);__volley.game.paused=true');
  assert.deepEqual((await input(page, 0, 'KeyF')).slice(0, 2), [1, 1]);
  assert.deepEqual((await input(page, 0, 'KeyV')).slice(0, 2), [0, 1]);
  await selectMode(page, 2, 'Enter');
  assert.deepEqual(
    await page.ev('__volley.game.players.map(p=>p.isComputer)'),
    [false, false, false, false]
  );
  assert.equal((await input(page, 1, 'KeyV'))[2], 1);
  await page.ev('document.getElementById("fast-speed-btn").click()');
  assert.equal(await page.ev('__volley.game.normalFPS'), 30);
  assert.equal(await page.ev('__volley.ticker.maxFPS'), 30);
  assert.equal(
    await page.ev('localStorage.getItem("pv-offline-speed")'),
    'fast'
  );
  await page.ev(
    '__volley.game.setMode(false);__volley.game.setMode(true);__volley.game.setCourtWidth(360);__volley.game.setServeMode("fixed")'
  );
  assert.equal(await page.ev('__volley.game.normalFPS'), 30);
  assert.equal(await page.ev('__volley.ticker.maxFPS'), 30);

  await page.send('Page.navigate', {
    url: 'http://127.0.0.1:' + server.address().port + '/ko/',
  });
  await page.until(
    'document.documentElement.lang==="ko" && !!document.getElementById("game-canvas")'
  );
  await page.ev('document.getElementById("close-about-btn").click()');
  await page.until(
    'document.documentElement.lang==="ko" && window.__volley && __volley.game.doublesFVMode==="down-only"'
  );
  assert.equal(
    await page.ev('document.getElementById("doubles-fv-mode").value'),
    'down-only'
  );
  assert.equal(await page.ev('__volley.game.normalFPS'), 30);
  assert.equal(await page.ev('__volley.ticker.maxFPS'), 30);
  assert.equal(
    await page.ev(
      'document.getElementById("fast-speed-btn").classList.contains("selected")'
    ),
    true
  );
  await page.ev('window.speedReload=true');
  await page.send('Page.reload', { ignoreCache: true });
  await page.until(
    '!window.speedReload && !!document.getElementById("game-canvas")'
  );
  await page.ev('document.getElementById("close-about-btn").click()');
  await page.until('!!window.__volley && __volley.game.normalFPS===30');
  assert.equal(await page.ev('__volley.ticker.maxFPS'), 30);
  // Check the rendered localized pages, including narrow screens and dark mode.
  for (const lang of ['en', 'ko', 'zh']) {
    for (const mobile of [false, true]) {
      await page.send('Emulation.setDeviceMetricsOverride', {
        width: mobile ? 390 : 1280,
        height: mobile ? 844 : 1000,
        deviceScaleFactor: 1,
        mobile,
      });
      await page.send('Page.navigate', {
        url: 'http://127.0.0.1:' + server.address().port + '/' + lang + '/',
      });
      await page.until(
        'document.documentElement.lang===' +
          JSON.stringify(lang) +
          ' && !!document.getElementById("game-canvas")'
      );
      await page.ev(
        'document.documentElement.dataset.colorScheme=' +
          JSON.stringify(mobile ? 'dark' : 'light')
      );
      assert.equal(
        await page.ev(
          'document.querySelector(".doubles-online-version a").href.includes("ilesejin.github.io/pikachu-volleyball-2v2-online/")'
        ),
        true
      );
      assert.equal(
        await page.ev(
          'document.querySelector(".release-date").textContent.includes("2026-??-??")'
        ),
        true
      );
      assert.equal(
        await page.ev(
          'getComputedStyle(document.querySelector(".doubles-description")).fontWeight'
        ),
        '600'
      );
      assert.equal(
        await page.ev(
          'document.getElementById("about-box").scrollWidth<=document.getElementById("about-box").clientWidth+1'
        ),
        true,
        lang + ' About content must fit horizontally'
      );
      assert.equal(
        await page.ev(
          '!!document.getElementById("doubles-fv-mode") && !!document.getElementById("court-width-input") && !!document.getElementById("serve-settings-panel")'
        ),
        true
      );
      if ((lang === 'ko' && !mobile) || (lang === 'zh' && mobile)) {
        const shot = await page.send('Page.captureScreenshot', {
          format: 'png',
        });
        fs.writeFileSync(
          path.join(os.tmpdir(), 'pikavolley-about-' + lang + '.png'),
          Buffer.from(shot.data, 'base64')
        );
      }
      await page.ev('document.getElementById("close-about-btn").click()');
      await page.until('!!window.__volley && __volley.game.isDoubles');
      assert.equal(await page.ev('__volley.game.players.length'), 4);
      await selectMode(page, 0, 'KeyV');
      assert.deepEqual(await page.ev('__volley.game.doublesHumanSlots'), [1]);
      await page.ev('document.getElementById("serve-settings-btn").click()');
      assert.equal(
        await page.ev('document.getElementById("serve-settings-panel").open'),
        true
      );
      assert.equal(
        await page.ev(
          '(()=>{const r=document.getElementById("serve-settings-panel").getBoundingClientRect();return r.left>=0&&r.right<=innerWidth&&r.top>=0&&r.bottom<=innerHeight;})()'
        ),
        true
      );
      await page.ev('document.getElementById("serve-settings-cancel").click()');
    }
  }
  assert.equal(errors.length, 0, JSON.stringify(errors));
  console.log(
    'Offline browser checks passed: 1/2/4 humans, side/slot selection, independent default keys, inward F, F/V persistence across reload/languages, original 1v1 controls, width 340, and saved speed across modes/restarts/reloads.'
  );
})()
  .catch((error) => {
    console.error(error);
    if (errors.length)
      console.error('Browser exceptions:', JSON.stringify(errors));
    process.exitCode = 1;
  })
  .finally(async () => {
    connections.forEach((socket) => socket.close());
    if (chrome) chrome.kill();
    server.close();
    await delay(500);
    const resolved = path.resolve(profile);
    if (
      path.dirname(resolved) === path.resolve(os.tmpdir()) &&
      path.basename(resolved).startsWith('pikavolley-offline-')
    ) {
      try {
        fs.rmSync(resolved, { recursive: true, force: true });
      } catch {}
    }
  });
