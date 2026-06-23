#!/usr/bin/env node
// ============================================================
// JET — Steel Ball Run · Servidor LAN (misma WiFi)
// Sin dependencias: solo módulos integrados de Node.
// Sirve el juego + registro de lobbies + relevo de mensajes (SSE).
//
//   node server.js
//
// Luego ambos jugadores abren la URL "En la WiFi" que imprime abajo.
// ============================================================
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');

const PORT = process.env.PORT || 8080;
const ROOT = __dirname;

// roomId -> { id, name, hostId, started, clients: Map(clientId -> {ready, weapon, name, host}) }
const lobbies = new Map();
// clientId -> ServerResponse (stream SSE)
const sseClients = new Map();

const ADJ = ['rojo', 'azul', 'veloz', 'dorado', 'sombrio', 'feroz', 'salvaje', 'electrico', 'lunar', 'solar', 'carmesi', 'glacial', 'fantasma', 'turbo'];
const ANI = ['caballo', 'aguila', 'lobo', 'toro', 'halcon', 'puma', 'bisonte', 'coyote', 'jaguar', 'zorro', 'cobra', 'condor', 'mustang', 'bronco'];
function randName() {
  const a = ADJ[Math.floor(Math.random() * ADJ.length)];
  const n = ANI[Math.floor(Math.random() * ANI.length)];
  return `${a}-${n}-${Math.floor(Math.random() * 100)}`;
}
function uniqueRoomName() {
  const taken = new Set([...lobbies.values()].map(r => r.name));
  let name = randName(), tries = 0;
  while (taken.has(name) && tries++ < 50) name = randName();
  return name;
}
function uid() { return Math.random().toString(36).slice(2, 10); }

function sendJSON(res, code, obj) {
  res.writeHead(code, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
  res.end(JSON.stringify(obj));
}
function pushTo(clientId, event) {
  const res = sseClients.get(clientId);
  if (res) { try { res.write(`data: ${JSON.stringify(event)}\n\n`); } catch (e) {} }
}
function roomState(room) {
  const players = [];
  for (const [cid, c] of room.clients) {
    players.push({ id: cid, name: c.name, ready: c.ready, weapon: c.weapon, host: cid === room.hostId });
  }
  return { type: 'room', roomId: room.id, name: room.name, players, started: room.started };
}
function broadcastRoom(room) {
  const st = roomState(room);
  for (const cid of room.clients.keys()) pushTo(cid, st);
}
function lobbyList() {
  const list = [];
  for (const room of lobbies.values()) {
    if (room.started) continue;
    list.push({ id: room.id, name: room.name, players: room.clients.size, full: room.clients.size >= 2 });
  }
  return list;
}
function readBody(req) {
  return new Promise(resolve => {
    let b = '';
    req.on('data', d => { b += d; if (b.length > 1e6) req.destroy(); });
    req.on('end', () => { try { resolve(JSON.parse(b || '{}')); } catch (e) { resolve({}); } });
  });
}
function leaveRoom(clientId, roomId) {
  const room = lobbies.get(roomId);
  if (!room || !room.clients.has(clientId)) return;
  room.clients.delete(clientId);
  if (room.clients.size === 0) { lobbies.delete(roomId); return; }
  // queda alguien: reabrir la sala y reiniciar "listos"
  room.started = false;
  for (const c of room.clients.values()) c.ready = false;
  for (const cid of room.clients.keys()) pushTo(cid, { type: 'peerleft' });
  broadcastRoom(room);
}
function disconnect(clientId) {
  for (const room of [...lobbies.values()]) {
    if (room.clients.has(clientId)) leaveRoom(clientId, room.id);
  }
}

const server = http.createServer(async (req, res) => {
  const u = new URL(req.url, 'http://x');
  const p = u.pathname;

  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    });
    res.end();
    return;
  }

  if (p === '/api/ping') return sendJSON(res, 200, { ok: true });

  if (p === '/api/events') {
    const clientId = u.searchParams.get('clientId');
    if (!clientId) { res.writeHead(400); res.end(); return; }
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
    });
    res.write(': connected\n\n');
    sseClients.set(clientId, res);
    const ka = setInterval(() => { try { res.write(': ka\n\n'); } catch (e) {} }, 15000);
    req.on('close', () => { clearInterval(ka); sseClients.delete(clientId); disconnect(clientId); });
    return;
  }

  if (p === '/api/lobbies') return sendJSON(res, 200, { lobbies: lobbyList() });

  if (p === '/api/create' && req.method === 'POST') {
    const b = await readBody(req);
    if (!b.clientId) return sendJSON(res, 400, { error: 'sin clientId' });
    disconnect(b.clientId); // por si estaba en otra sala
    const room = { id: uid(), name: uniqueRoomName(), hostId: b.clientId, started: false, clients: new Map() };
    room.clients.set(b.clientId, { ready: false, weapon: b.weapon || 'fists', name: b.name || 'Anfitrión', host: true });
    lobbies.set(room.id, room);
    broadcastRoom(room);
    return sendJSON(res, 200, { roomId: room.id, name: room.name });
  }

  if (p === '/api/join' && req.method === 'POST') {
    const b = await readBody(req);
    const room = lobbies.get(b.roomId);
    if (!room) return sendJSON(res, 404, { error: 'La sala ya no existe.' });
    if (room.started) return sendJSON(res, 409, { error: 'La partida ya empezó.' });
    if (room.clients.size >= 2 && !room.clients.has(b.clientId)) return sendJSON(res, 409, { error: 'La sala está llena.' });
    room.clients.set(b.clientId, { ready: false, weapon: b.weapon || 'fists', name: b.name || 'Rival', host: false });
    broadcastRoom(room);
    return sendJSON(res, 200, { roomId: room.id, name: room.name });
  }

  if (p === '/api/ready' && req.method === 'POST') {
    const b = await readBody(req);
    const room = lobbies.get(b.roomId);
    if (!room) return sendJSON(res, 404, {});
    const c = room.clients.get(b.clientId);
    if (c) { c.ready = !!b.ready; if (b.weapon) c.weapon = b.weapon; }
    broadcastRoom(room);
    if (room.clients.size === 2 && [...room.clients.values()].every(x => x.ready)) {
      room.started = true;
      for (const cid of room.clients.keys()) pushTo(cid, { type: 'start' });
    }
    return sendJSON(res, 200, { ok: true });
  }

  if (p === '/api/msg' && req.method === 'POST') {
    const b = await readBody(req);
    const room = lobbies.get(b.roomId);
    if (!room) return sendJSON(res, 404, {});
    for (const cid of room.clients.keys()) if (cid !== b.clientId) pushTo(cid, { type: 'peer', data: b.data });
    return sendJSON(res, 200, { ok: true });
  }

  if (p === '/api/leave' && req.method === 'POST') {
    const b = await readBody(req);
    leaveRoom(b.clientId, b.roomId);
    return sendJSON(res, 200, { ok: true });
  }

  // ---- archivos estáticos ----
  let rel = p === '/' ? '/index.html' : decodeURIComponent(p);
  const fp = path.normalize(path.join(ROOT, rel));
  if (!fp.startsWith(ROOT)) { res.writeHead(403); res.end('forbidden'); return; }
  fs.readFile(fp, (err, data) => {
    if (err) { res.writeHead(404); res.end('not found'); return; }
    const ext = path.extname(fp).toLowerCase();
    const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.json': 'application/json', '.ico': 'image/x-icon' };
    res.writeHead(200, { 'Content-Type': types[ext] || 'application/octet-stream' });
    res.end(data);
  });
});

server.listen(PORT, () => {
  const ips = [];
  for (const ifs of Object.values(os.networkInterfaces())) {
    for (const i of ifs) if (i.family === 'IPv4' && !i.internal) ips.push(i.address);
  }
  console.log('');
  console.log('  🐎  JET — Steel Ball Run · Servidor LAN listo (puerto ' + PORT + ')');
  console.log('  --------------------------------------------------------------');
  console.log('  En esta Mac:   http://localhost:' + PORT);
  ips.forEach(ip => console.log('  En la WiFi:    http://' + ip + ':' + PORT + '   ← comparte esta con tu amigo'));
  console.log('  --------------------------------------------------------------');
  console.log('  Ambos deben estar en la MISMA red WiFi. Ctrl+C para detener.');
  console.log('');
});
