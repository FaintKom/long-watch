/**
 * Opt-in P2P multiplayer via Trystero (nostr strategy, no signaling server).
 *
 * Activated when the URL contains `?room=NAME`. Each peer:
 *   - sends its position + yaw every 100ms via `sendPos`
 *   - receives others' positions via `getPos` and shows a "ghost" mesh per peer
 *   - sends chat events ("X looted Y") via `sendChat` for shared narration
 *
 * No NPC sync, no physics sync - this is a "shared sightseeing" layer for
 * up to a handful of players walking the same mansion. The local game world
 * (plot rolls, AI, save/load) remains authoritative-per-client.
 *
 * For deterministic shared plots, all clients should pass the same `?seed=`.
 */
import * as THREE from 'three';
import { joinRoom, selfId } from 'trystero';

type PosMsg = { x: number; y: number; z: number; rotY: number; name: string };
type ChatMsg = { text: string };

// Trystero's typed DataPayload requires JsonValue compatibility. We treat both
// payloads as `Record<string, string|number>` for the make/send action gates.
type WireMsg = Record<string, string | number>;

export interface Multiplayer {
  selfId: string;
  /** Call every frame with the local player position + yaw. Throttled internally to ~10 Hz. */
  pushSelfPos: (x: number, y: number, z: number, rotY: number, name: string) => void;
  /** Broadcast a short chat line to other peers. */
  sendChat: (text: string) => void;
  /** Subscribe to chat lines from other peers. */
  onChat: (cb: (peerId: string, text: string) => void) => void;
  /** Force-disconnect. */
  leave: () => void;
}

/** Initialise a room if `?room=...` is set. Returns null otherwise. */
export function maybeJoinRoom(scene: THREE.Scene): Multiplayer | null {
  if (typeof window === 'undefined' || !window.location) return null;
  const url = new URL(window.location.href);
  const roomName = url.searchParams.get('room');
  if (!roomName) return null;

  const room = joinRoom({ appId: 'long-watch' }, roomName);
  const [sendPosRaw, getPosRaw] = room.makeAction<WireMsg>('pos');
  const [sendChatRaw, getChatRaw] = room.makeAction<WireMsg>('chat');
  const sendPos = (m: PosMsg) => sendPosRaw(m as unknown as WireMsg);
  const sendChat = (m: ChatMsg) => sendChatRaw(m as unknown as WireMsg);
  const getPos = (cb: (data: PosMsg, peerId: string) => void) => getPosRaw((d, peer) => cb(d as unknown as PosMsg, peer));
  const getChat = (cb: (data: ChatMsg, peerId: string) => void) => getChatRaw((d, peer) => cb(d as unknown as ChatMsg, peer));

  const ghosts = new Map<string, THREE.Group>();

  function ghostFor(peerId: string, name: string): THREE.Group {
    let g = ghosts.get(peerId);
    if (g) return g;
    g = new THREE.Group();
    g.name = `ghost-${peerId}`;
    const torso = new THREE.Mesh(
      new THREE.BoxGeometry(0.55, 0.85, 0.35),
      new THREE.MeshStandardMaterial({ color: 0xcc88ff, transparent: true, opacity: 0.7, roughness: 0.5 }),
    );
    torso.castShadow = true;
    g.add(torso);
    const head = new THREE.Mesh(
      new THREE.BoxGeometry(0.4, 0.4, 0.4),
      new THREE.MeshStandardMaterial({ color: 0xeebbff, transparent: true, opacity: 0.7 }),
    );
    head.position.y = 0.65;
    g.add(head);
    const canvas = document.createElement('canvas');
    canvas.width = 256; canvas.height = 64;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = '#fff'; ctx.font = '28px serif'; ctx.textAlign = 'center';
      ctx.fillText(name || peerId.slice(0, 6), 128, 40);
    }
    const tex = new THREE.CanvasTexture(canvas);
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true }));
    sprite.position.y = 1.4;
    sprite.scale.set(1.5, 0.4, 1);
    g.add(sprite);
    scene.add(g);
    ghosts.set(peerId, g);
    return g;
  }

  getPos((data, peerId) => {
    const g = ghostFor(peerId, data.name);
    g.position.set(data.x, data.y, data.z);
    g.rotation.y = data.rotY;
  });

  room.onPeerLeave((peerId) => {
    const g = ghosts.get(peerId);
    if (g) { scene.remove(g); ghosts.delete(peerId); }
  });

  let chatHandler: ((peerId: string, text: string) => void) | null = null;
  getChat((data, peerId) => {
    if (chatHandler) chatHandler(peerId, data.text);
  });

  let lastPosSent = 0;
  function pushSelfPos(x: number, y: number, z: number, rotY: number, name: string) {
    const now = performance.now();
    if (now - lastPosSent < 100) return;
    lastPosSent = now;
    void sendPos({ x, y, z, rotY, name });
  }

  function leave() {
    for (const [, g] of ghosts) scene.remove(g);
    ghosts.clear();
    room.leave();
  }

  console.log(`[multiplayer] joined room "${roomName}" as ${selfId}`);
  return {
    selfId,
    pushSelfPos,
    sendChat: (text) => { void sendChat({ text }); },
    onChat: (cb) => { chatHandler = cb; },
    leave,
  };
}
