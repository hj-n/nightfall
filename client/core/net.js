// Client networking. Owned by: Integration.
// Model: the server owns everything except each client's own player position,
// which the client simulates locally and reports with 'move' messages.
import { World } from '../../shared/world.js';
import { PRIVATE_PREFIX } from '../../shared/config.js';
import { clock } from '../../shared/time.js';

// When the connection drops (server restart, Wi-Fi hiccup), poll until the
// server answers again, then reload the page: that picks up any new code, and
// the server restores our player by name.
function reloadWhenServerIsBack(url) {
  const probe = new WebSocket(url);
  let opened = false;
  probe.addEventListener('open', () => { opened = true; probe.close(); location.reload(); });
  probe.addEventListener('close', () => { if (!opened) setTimeout(() => reloadWhenServerIsBack(url), 1000); });
}

export function connect(game, name) {
  const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
  const url = `${proto}//${location.host}`;
  const ws = new WebSocket(url);
  game.send = (msg) => { if (ws.readyState === 1) ws.send(JSON.stringify(msg)); };

  return new Promise((resolve) => {
    ws.addEventListener('open', () => game.send({ t: 'hello', name }));
    ws.addEventListener('close', () => {
      game.connected = false;
      game.bus.emit('disconnected');
      setTimeout(() => reloadWhenServerIsBack(url), 500);
    });

    ws.addEventListener('message', (ev) => {
      const msg = JSON.parse(ev.data);
      switch (msg.t) {
        case 'welcome':
          game.myId = msg.id;
          game.time = msg.time;
          clock.dayLength = msg.dayLength || clock.dayLength;
          game.world = World.generate(msg.w, msg.h, msg.seed);
          game.world.applyEdits(msg.edits);
          game.connected = true;
          resolve();
          break;
        case 'snap':
          game.time = msg.time;
          applySnapshot(game, msg.entities);
          break;
        case 'tile':
          game.world?.edit(msg.x, msg.y, msg.id);
          game.bus.emit('tileChanged', msg.x, msg.y, msg.id);
          break;
        case 'teleport': {
          const me = game.me;
          if (me) { me.x = me._rx = msg.x; me.y = me._ry = msg.y; }
          break;
        }
        case 'event':
          game.bus.emit(`net:${msg.name}`, msg.data);
          break;
        case 'reload': // client code changed (dev mode)
          location.reload();
          break;
      }
    });
  });
}

function applySnapshot(game, list) {
  const seen = new Set();
  for (const incoming of list) {
    seen.add(incoming.id);
    const e = game.entities.get(incoming.id);
    if (e) {
      // update in place so references held by other code stay valid
      for (const k in e) if (!k.startsWith(PRIVATE_PREFIX) && !(k in incoming)) delete e[k];
      const mine = incoming.id === game.myId;
      for (const k in incoming) {
        if (mine && (k === 'x' || k === 'y' || k === 'dir')) continue; // we own our position
        e[k] = incoming[k];
      }
    } else {
      const fresh = { ...incoming, _rx: incoming.x, _ry: incoming.y };
      game.entities.set(incoming.id, fresh);
      game.bus.emit('entityAppeared', fresh);
    }
  }
  for (const [id, e] of game.entities) {
    if (!seen.has(id)) { game.entities.delete(id); game.bus.emit('entityGone', e); }
  }
}
