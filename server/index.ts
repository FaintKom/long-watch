/**
 * Long Watch — Colyseus multiplayer server (skeleton).
 *
 * Run: cd server && npm install && npm run dev
 * Default port: 2567 (configurable via env PORT).
 */
import { Server, Room, Client } from '@colyseus/core';
import { Schema, type, MapSchema } from '@colyseus/schema';
import { WebSocketTransport } from '@colyseus/ws-transport';
import express from 'express';
import { createServer } from 'http';

class PlayerSchema extends Schema {
  @type('string') id: string = '';
  @type('string') className: string = 'fighter';
  @type('number') hp: number = 28;
  @type('number') maxHp: number = 28;
  @type('number') ac: number = 15;
  @type('number') x: number = 17.5;
  @type('number') y: number = 1.5;
  @type('number') z: number = 12;
  @type('number') yaw: number = 0;
  @type('number') pitch: number = 0;
  @type('string') objective: string = 'oblivious';
  @type('boolean') alive: boolean = true;
}

class GameStateSchema extends Schema {
  @type('string') phase: string = 'lobby';
  @type('number') clockMinute: number = 21 * 60;
  @type('string') boss: string = 'freelance';
  @type('string') assassin: string = 'mooks';
  @type('boolean') bossRevealed: boolean = false;
  @type('boolean') assassinRevealed: boolean = false;
  @type({ map: PlayerSchema }) players = new MapSchema<PlayerSchema>();
}

class LongWatchRoom extends Room<GameStateSchema> {
  maxClients = 4;
  private clockInterval: NodeJS.Timeout | null = null;

  onCreate() {
    this.setState(new GameStateSchema());
    console.log(`[long-watch] Room ${this.roomId} created.`);

    this.onMessage('move', (client, msg: { x: number; y: number; z: number; yaw: number; pitch: number }) => {
      const p = this.state.players.get(client.sessionId);
      if (!p) return;
      p.x = msg.x; p.y = msg.y; p.z = msg.z; p.yaw = msg.yaw; p.pitch = msg.pitch;
    });

    this.onMessage('chat_npc', (_client, msg: { npcId: string; message: string }) => {
      console.log('[long-watch] NPC chat request:', msg);
      // Future: proxy to Groq with strict persona context
    });

    this.clockInterval = setInterval(() => {
      if (this.state.phase === 'long_watch') this.state.clockMinute++;
    }, 1000);
  }

  onJoin(client: Client) {
    const p = new PlayerSchema();
    p.id = client.sessionId;
    this.state.players.set(client.sessionId, p);
    console.log(`[long-watch] ${client.sessionId} joined.`);

    if (this.state.players.size === 1) this.rollPlot();
    this.assignObjective(client.sessionId);
  }

  onLeave(client: Client) {
    this.state.players.delete(client.sessionId);
    console.log(`[long-watch] ${client.sessionId} left.`);
  }

  onDispose() {
    if (this.clockInterval) clearInterval(this.clockInterval);
  }

  private rollPlot() {
    const bosses = ['forewaters', 'assassin_guild', 'sea_goddess', 'forsythe', 'unseelie', 'sentient_sword', 'right_hand', 'freelance'];
    const assassins = ['mooks', 'cult_of_umberlee', 'crimson_angel', 'sebek_ari', 'mezzoloth', 'air_elemental'];
    this.state.boss = bosses[Math.floor(Math.random() * bosses.length)];
    this.state.assassin = assassins[Math.floor(Math.random() * assassins.length)];
  }

  private assignObjective(sessionId: string) {
    const all = ['oblivious', 'thief', 'saboteur', 'pacifist', 'smitten', 'seeker', 'protector', 'accomplice', 'celebrity', 'boozer', 'leader', 'traitor'];
    const used = new Set<string>();
    this.state.players.forEach(p => used.add(p.objective));
    const free = all.filter(o => !used.has(o));
    const pick = free[Math.floor(Math.random() * free.length)] || 'oblivious';
    const p = this.state.players.get(sessionId);
    if (p) p.objective = pick;
  }
}

const port = Number(process.env.PORT) || 2567;
const app = express();
const httpServer = createServer(app);
const gameServer = new Server({ transport: new WebSocketTransport({ server: httpServer }) });
gameServer.define('long_watch', LongWatchRoom);

app.get('/', (_req, res) => {
  res.send('Long Watch multiplayer server running. Connect via Colyseus client to /matchmake/joinOrCreate/long_watch.');
});

httpServer.listen(port, () => {
  console.log(`[long-watch] Server listening on http://localhost:${port}`);
});
