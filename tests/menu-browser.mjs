import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';

const site = process.env.TEST_URL || 'http://127.0.0.1:4173/';
const chromePath = process.env.CHROME_PATH || (process.platform === 'win32'
  ? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
  : '/usr/bin/google-chrome');
const profile = resolve(tmpdir(), `julington-menu-${process.pid}`);
assert.ok(profile.startsWith(resolve(tmpdir()) + sep), 'Chrome profile must stay in the temp directory');
const screenshotDir = resolve('tests/.screenshots');
await mkdir(screenshotDir, { recursive: true });
await fetch(site).then((response) => assert.equal(response.status, 200));

const chrome = spawn(chromePath, [
  '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
  '--remote-debugging-port=0', `--user-data-dir=${profile}`, site,
], { windowsHide: true, stdio: 'ignore' });

let socket;
try {
  let port;
  for (let attempt = 0; attempt < 100; attempt++) {
    try {
      port = Number((await readFile(join(profile, 'DevToolsActivePort'), 'utf8')).split('\n')[0]);
      if (port) break;
    } catch { /* Chrome is starting. */ }
    await new Promise((done) => setTimeout(done, 100));
  }
  assert.ok(port, 'Chrome did not start DevTools');
  const targets = await fetch(`http://127.0.0.1:${port}/json/list`).then((response) => response.json());
  const page = targets.find((target) => target.type === 'page' && target.url.startsWith(site));
  assert.ok(page, 'Could not find the test page');
  socket = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((resolveOpen, rejectOpen) => {
    socket.addEventListener('open', resolveOpen, { once: true });
    socket.addEventListener('error', rejectOpen, { once: true });
  });

  let nextId = 0;
  const pending = new Map();
  socket.addEventListener('message', (event) => {
    const message = JSON.parse(event.data);
    const task = pending.get(message.id);
    if (!task) return;
    pending.delete(message.id);
    if (message.error) task.reject(new Error(message.error.message));
    else task.resolve(message.result);
  });
  function send(method, params = {}) {
    const id = ++nextId;
    return new Promise((resolveResult, rejectResult) => {
      pending.set(id, { resolve: resolveResult, reject: rejectResult });
      socket.send(JSON.stringify({ id, method, params }));
    });
  }
  async function evaluate(expression) {
    const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.text);
    return result.result.value;
  }
  async function inspect() {
    return evaluate(`(() => {
      const toggle = document.querySelector('.menu-toggle');
      const nav = document.querySelector('#site-navigation');
      return {
        width: innerWidth,
        mobile: matchMedia('(max-width: 780px)').matches,
        toggle: getComputedStyle(toggle).display,
        nav: getComputedStyle(nav).display,
        expanded: toggle.getAttribute('aria-expanded'),
        focus: document.activeElement === toggle ? 'toggle' : document.activeElement?.getAttribute('href'),
        overflow: document.documentElement.scrollWidth > innerWidth,
        links: [...nav.querySelectorAll('a')].map((link) => link.getAttribute('href')),
      };
    })()`);
  }
  async function viewport(width) {
    await send('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: width <= 780 });
    await send('Page.navigate', { url: `${site}?qa=${width}` });
    for (let attempt = 0; attempt < 100; attempt++) {
      if (await evaluate(`document.readyState === 'complete' && !!document.querySelector('.menu-toggle')`)) return;
      await new Promise((done) => setTimeout(done, 50));
    }
    throw new Error(`Page did not load at ${width}px`);
  }
  async function screenshot(name) {
    const result = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
    await writeFile(join(screenshotDir, name), Buffer.from(result.data, 'base64'));
  }

  await send('Page.enable');
  await send('Runtime.enable');
  await send('Emulation.setFocusEmulationEnabled', { enabled: true });
  for (const width of [375, 390, 430, 768, 820, 1024]) {
    await viewport(width);
    const state = await inspect();
    assert.equal(state.overflow, false, `Horizontal overflow at ${width}px`);
    assert.deepEqual(state.links.slice(0, 4), ['#about', '#services', '#reviews', '#contact']);
    if (width <= 780) {
      assert.notEqual(state.toggle, 'none', `Menu button hidden at ${width}px`);
      assert.equal(state.nav, 'none', `Closed menu visible at ${width}px`);
    } else {
      assert.equal(state.toggle, 'none', `Menu button visible at ${width}px`);
      assert.notEqual(state.nav, 'none', `Desktop links hidden at ${width}px`);
    }
    if (width === 390) await screenshot('phone-closed.png');
    if (width === 1024) await screenshot('desktop.png');
    console.log(`${width}px: toggle=${state.toggle}, nav=${state.nav}, overflow=${state.overflow}`);
  }

  await viewport(390);
  await evaluate(`document.querySelector('.menu-toggle').click()`);
  assert.equal((await inspect()).expanded, 'true');
  assert.notEqual((await inspect()).nav, 'none');
  await screenshot('phone-open.png');
  await evaluate(`document.querySelector('#site-navigation a[href="#services"]').click()`);
  assert.equal((await inspect()).expanded, 'false', 'Selecting a link must close the menu');
  assert.equal(await evaluate('location.hash'), '#services');

  await evaluate(`document.querySelector('.menu-toggle').click()`);
  await evaluate(`document.querySelector('main').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))`);
  assert.equal((await inspect()).expanded, 'false', 'Tapping outside must close the menu');

  await evaluate(`document.querySelector('.menu-toggle').focus()`);
  assert.equal((await inspect()).focus, 'toggle');
  await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Enter', code: 'Enter', text: '\r', unmodifiedText: '\r', windowsVirtualKeyCode: 13 });
  await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 });
  assert.equal((await inspect()).expanded, 'true', 'Enter must open the menu');
  await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 });
  await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 });
  assert.equal((await inspect()).focus, '#about', 'Tab must reach the first menu link');
  await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
  await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
  assert.equal((await inspect()).expanded, 'false', 'Escape must close the menu');
  assert.equal((await inspect()).focus, 'toggle', 'Escape must return focus to the button');
  await send('Input.dispatchKeyEvent', { type: 'keyDown', key: ' ', code: 'Space', text: ' ', windowsVirtualKeyCode: 32 });
  await send('Input.dispatchKeyEvent', { type: 'keyUp', key: ' ', code: 'Space', windowsVirtualKeyCode: 32 });
  assert.equal((await inspect()).expanded, 'true', 'Space must open the menu');
  await evaluate(`document.querySelector('.menu-toggle').click()`);

  await viewport(768);
  await evaluate(`document.querySelector('.menu-toggle').click()`);
  assert.equal((await inspect()).expanded, 'true');
  await screenshot('tablet-open.png');
  await send('Emulation.setDeviceMetricsOverride', { width: 820, height: 900, deviceScaleFactor: 1, mobile: false });
  let resizeState;
  for (let attempt = 0; attempt < 20; attempt++) {
    resizeState = await inspect();
    if (resizeState.width === 820 && resizeState.expanded === 'false') break;
    await new Promise((done) => setTimeout(done, 50));
  }
  assert.equal(resizeState.expanded, 'false', `Desktop resize must reset menu state: ${JSON.stringify(resizeState)}`);
  console.log('Link, outside tap, Enter, Space, Tab, Escape, focus return, and resize checks passed.');
} finally {
  socket?.close();
  chrome.kill();
  await new Promise((done) => setTimeout(done, 300));
  await rm(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
}
