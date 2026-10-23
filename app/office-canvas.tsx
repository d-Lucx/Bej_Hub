'use client';
import { useEffect, useRef } from 'react';
import Phaser from 'phaser';

export default function OfficeCanvas({ agents, selected, onSelect }: { agents: any[]; selected: string; onSelect: (id: string) => void }) {
  const host = useRef<HTMLDivElement>(null); const scene = useRef<Phaser.Scene | null>(null);
  const current = useRef({ agents, selected, onSelect }); current.current = { agents, selected, onSelect };
  useEffect(() => {
    if (!host.current) return;
    class Office extends Phaser.Scene {
      actors: Record<string, { sprite: Phaser.GameObjects.Container; bubble: Phaser.GameObjects.Text; ring: Phaser.GameObjects.Ellipse }> = {};
      create() {
        scene.current = this;
        const g = this.add.graphics();
        const rect = (x: number, y: number, w: number, h: number, c: number) => { g.fillStyle(c); g.fillRect(x, y, w, h); };
        // Original code-drawn pixel room. Integer coordinates, hard shadows, no external assets.
        rect(0, 0, 960, 560, 0xe9e0ca); rect(35, 30, 890, 490, 0x8b6953); rect(43, 38, 874, 470, 0xb88a63);
        for (let y = 116; y < 508; y += 28) for (let x = 43; x < 917; x += 110) { const shift = Math.floor(y / 28) % 2 ? -55 : 0; const xx = Math.max(43, x + shift); rect(xx, y, Math.min(108, 917 - xx), 26, [0xd0aa7c,0xcda375,0xd6b184][(x + y) % 3]); rect(xx + 10, y + 18, 36, 1, 0xbd956e); }
        rect(43, 38, 874, 90, 0xe8d8b8); rect(43, 118, 874, 10, 0xa17a55); rect(43, 128, 874, 5, 0x7d634d);
        const window = (x: number) => { rect(x - 7, 46, 128, 68, 0xba946e); rect(x, 50, 114, 57, 0x9fbdb5); rect(x + 5, 55, 104, 47, 0xc4dbd0); rect(x + 12, 55, 18, 47, 0xe1ebd5); rect(x + 53, 50, 7, 57, 0xf5e8cc); rect(x, 78, 114, 6, 0xf5e8cc); rect(x - 12, 107, 138, 8, 0xf3e1b9); rect(x - 12, 115, 138, 5, 0xb58b61); };
        window(182); window(665);
        // Afternoon light, rug, and little studio sign.
        g.fillStyle(0xfff0bf, .13); g.fillPoints([{ x: 188, y: 134 }, { x: 290, y: 134 }, { x: 370, y: 490 }, { x: 220, y: 490 }], true);
        rect(142, 184, 680, 214, 0xa06e55); rect(148, 184, 668, 207, 0xcb8d6c); rect(158, 194, 648, 187, 0xe2b78b); rect(166, 202, 632, 171, 0xcca080);
        for (let x = 150; x < 815; x += 12) { rect(x, 179, 5, 6, 0xe2bd98); rect(x, 392, 5, 7, 0xe2bd98); }
        for (let x = 178; x < 790; x += 24) { rect(x, 210, 8, 4, 0xdfb793); rect(x, 362, 8, 4, 0xdfb793); }
        rect(407, 57, 145, 48, 0x8c7051); rect(412, 62, 135, 38, 0xf0dfbb);
        this.add.text(480, 81, 'BEJ  STUDIO', { fontFamily: 'monospace', fontSize: '17px', color: '#7c674e', fontStyle: 'bold' }).setOrigin(.5);
        const plant = (x: number, y: number, size = 1) => { const p = this.add.graphics(); p.fillStyle(0x82634c,.18); p.fillEllipse(x + 3, y + 7, 42 * size, 16 * size); p.fillStyle(0xb77555); p.fillRect(x - 14 * size, y - 8 * size, 28 * size, 20 * size); p.fillStyle(0xd3986d); p.fillRect(x - 18 * size, y - 10 * size, 36 * size, 7 * size); p.fillStyle(0x7e9b60); p.fillRect(x - 4 * size, y - 47 * size, 8 * size, 38 * size); p.fillRect(x - 22 * size, y - 38 * size, 22 * size, 12 * size); p.fillRect(x + 2 * size, y - 31 * size, 23 * size, 12 * size); p.fillStyle(0x557952); p.fillRect(x - 17 * size, y - 25 * size, 15 * size, 11 * size); p.fillRect(x + 3 * size, y - 44 * size, 15 * size, 11 * size); };
        plant(99, 171, 1.3); plant(863, 171, 1.3); plant(863, 461, 1.1);
        // Bookcase, sofa, coffee table, and coffee nook.
        rect(72, 338, 49, 127, 0x8c6549); rect(76, 342, 41, 116, 0xc59b6c);
        for (let y = 348; y < 450; y += 34) { rect(76, y + 25, 41, 6, 0x8c6549); for (let i = 0; i < 5; i++) rect(79 + i * 7, y + i % 3 * 3, 5, 24 - i % 3 * 3, [0x6c8b74,0xc17d58,0xe4cf9f,0x8391a0,0x987566][i]); }
        rect(202, 427, 160, 51, 0x65836d); rect(198, 441, 168, 39, 0x53715c); rect(210, 438, 68, 35, 0x8ca486); rect(284, 438, 68, 35, 0x92aa8d); rect(192, 432, 16, 51, 0x72917a); rect(354, 432, 16, 51, 0x72917a); rect(205, 483, 9, 8, 0x72583f); rect(350, 483, 9, 8, 0x72583f);
        rect(416, 441, 106, 37, 0x9c724e); rect(412, 436, 114, 34, 0xd3ab77); rect(429, 442, 25, 18, 0xe9d6ab); rect(435, 444, 17, 2, 0xac9270); rect(490, 443, 13, 13, 0xf3e6c9); rect(503, 446, 5, 6, 0xeee0bf);
        rect(604, 428, 160, 49, 0x98714f); rect(600, 421, 168, 12, 0xdcc19b); rect(618, 439, 60, 30, 0xba936c); rect(687, 439, 60, 30, 0xba936c); rect(667, 451, 5, 5, 0x846345); rect(694, 451, 5, 5, 0x846345); rect(620, 394, 32, 27, 0x4e5146); rect(626, 400, 20, 12, 0xaaa997); rect(635, 413, 11, 7, 0xf3e1bd); plant(733, 414, .5);
        const desk = (x: number, id: string, color: number) => {
          rect(x - 71, 310, 142, 12, 0x967350); rect(x - 70, 263, 10, 48, 0x8d6549); rect(x + 60, 263, 10, 48, 0x8d6549);
          rect(x - 81, 229, 162, 66, 0x936647); rect(x - 81, 222, 162, 63, 0xd6ad7b); rect(x - 76, 225, 152, 3, 0xe6c696); rect(x - 79, 279, 158, 6, 0xb7895c);
          rect(x - 27, 205, 54, 41, 0x464e49); rect(x - 22, 210, 44, 29, 0x9bbcaf); rect(x - 16, 215, 27, 3, 0xdbe5be); rect(x - 16, 222, 19, 2, 0x779688); rect(x - 16, 228, 31, 2, 0x779688); rect(x - 3, 246, 6, 9, 0x52584b); rect(x - 17, 253, 34, 4, 0x666a58); rect(x - 24, 264, 48, 10, 0xf1e0b9);
          for (let xx = x - 20; xx < x + 22; xx += 6) rect(xx, 267, 3, 2, 0xab9f83);
          rect(x + 51, 251, 12, 15, 0xf3dfb7); rect(x + 63, 254, 5, 7, 0xf3dfb7); rect(x + 53, 251, 8, 3, 0x86644d); rect(x - 64, 246, 21, 27, 0xf0d9b0); rect(x - 61, 251, 14, 2, 0xc1a181);
          rect(x - 23, 310, 46, 34, 0x685c48); rect(x - 20, 309, 40, 28, color); rect(x - 3, 338, 6, 12, 0x675b48);
          const ring = this.add.ellipse(x, 333, 65, 22, color, .24).setStrokeStyle(2, color);
          const actor = this.add.container(x, 304); const a = this.add.graphics();
          const ar = (xx: number, yy: number, w: number, h: number, c: number) => { a.fillStyle(c); a.fillRect(xx, yy, w, h); };
          ar(-16,-29,32,21,0x514035); ar(-21,-20,42,14,0x514035); ar(-14,-15,28,25,0xedbb8e); ar(-16,-20,32,8,0x514035); ar(-9,-5,4,4,0x514035); ar(6,-5,4,4,0x514035); ar(-19,10,38,23,color); ar(-24,17,6,12,0xedbb8e); ar(19,17,6,12,0xedbb8e); ar(-5,10,10,8,0xf0dfbc); ar(-16,33,12,8,0x51473c); ar(4,33,12,8,0x51473c); actor.add(a);
          const bubble = this.add.text(x, 181, '', { fontFamily: 'monospace', fontSize: '18px', color: '#635642', backgroundColor: '#fff5dd', padding: { x: 12, y: 7 } }).setOrigin(.5);
          const label = this.add.text(x, 366, id === 'manager' ? 'BEJ MANAGER' : id === 'researcher' ? 'RESEARCH BOT' : 'WRITER BOT', { fontFamily: 'monospace', fontSize: '12px', color: '#654b3a', fontStyle: 'bold' }).setOrigin(.5);
          this.add.zone(x, 273, 172, 200).setInteractive({ useHandCursor: true }).on('pointerdown', () => current.current.onSelect(id));
          this.actors[id] = { sprite: actor, bubble, ring };
        };
        desk(235,'manager',0xbb764c); desk(480,'researcher',0x658e72); desk(725,'writer',0x7981af);
      }
      update(time: number) {
        const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        for (const agent of current.current.agents) {
          const actor = this.actors[agent.id]; if (!actor) continue;
          actor.ring.setVisible(current.current.selected === agent.id);
          const active = agent.state !== 'IDLE';
          actor.sprite.y = 304 + (reduced ? 0 : Math.sin(time / (active ? 170 : 650)) * (active ? 2 : .6));
          actor.bubble.setText(agent.state === 'THINKING' ? '…' : agent.state === 'WORKING' ? '>_' : agent.state === 'HANDOFF' ? '↗' : agent.state === 'BLOCKED' ? '!' : 'z z');
          actor.bubble.setColor(agent.state === 'BLOCKED' ? '#a64837' : '#635642');
          actor.bubble.setAlpha(active ? 1 : .65);
        }
      }
    }
    const game = new Phaser.Game({ type: Phaser.CANVAS, parent: host.current, width: 960, height: 560, backgroundColor: '#e9e0ca', pixelArt: true, antialias: false, banner: false, scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH }, scene: Office, audio: { noAudio: true } });
    return () => { scene.current = null; game.destroy(true); };
  }, []);
  return <div className="office-canvas" ref={host} role="img" aria-label="Cozy pixel studio with three wooden desks, agents, plants, a green sofa, and a coffee nook. Use the team buttons to select an agent with the keyboard." />;
}
