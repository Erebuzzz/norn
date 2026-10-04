export interface LoomHeroNode {
  x: number;
  y: number;
  baseX: number;
  baseY: number;
  vx: number;
  vy: number;
  radius: number;
  id: string;
  label: string;
  cluster: number;
}

export interface LoomHeroThread {
  fromIndex: number;
  toIndex: number;
  amount: number;
  curvature: number;
  speed: number;
  isNet: boolean;
}

export class LoomHeroCanvas {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private nodes: LoomHeroNode[] = [];
  private threads: LoomHeroThread[] = [];
  private animId: number | null = null;
  private width: number = 0;
  private height: number = 0;
  private dpr: number = 1;
  private time: number = 0;
  private unweaveProgress: number = 1.0;
  private mouseX: number = -1000;
  private mouseY: number = -1000;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Could not get 2d context for LoomHeroCanvas");
    this.ctx = ctx;

    this.handleResize = this.handleResize.bind(this);
    this.handleMouseMove = this.handleMouseMove.bind(this);
    this.handleTouchMove = this.handleTouchMove.bind(this);
    this.handleTouchEnd = this.handleTouchEnd.bind(this);
    this.tick = this.tick.bind(this);

    this.init();
  }

  private init(): void {
    this.handleResize();
    this.createNetwork();

    window.addEventListener("resize", this.handleResize);
    window.addEventListener("mousemove", this.handleMouseMove);
    window.addEventListener("touchmove", this.handleTouchMove, { passive: true });
    window.addEventListener("touchend", this.handleTouchEnd, { passive: true });
    this.start();
  }

  public setUnweaveProgress(progress: number): void {
    this.unweaveProgress = Math.max(0, Math.min(1, progress));
  }

  private handleMouseMove(e: MouseEvent): void {
    const rect = this.canvas.getBoundingClientRect();
    this.mouseX = (e.clientX - rect.left) * this.dpr;
    this.mouseY = (e.clientY - rect.top) * this.dpr;
  }

  private handleTouchMove(e: TouchEvent): void {
    if (e.touches.length > 0) {
      const rect = this.canvas.getBoundingClientRect();
      this.mouseX = (e.touches[0].clientX - rect.left) * this.dpr;
      this.mouseY = (e.touches[0].clientY - rect.top) * this.dpr;
    }
  }

  private handleTouchEnd(): void {
    this.mouseX = -1000;
    this.mouseY = -1000;
  }

  public handleResize(): void {
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    const rect = this.canvas.getBoundingClientRect();
    this.width = (rect.width || window.innerWidth) * this.dpr;
    this.height = (rect.height || 600) * this.dpr;

    this.canvas.width = this.width;
    this.canvas.height = this.height;

    this.createNetwork();
  }

  private createNetwork(): void {
    this.nodes = [];
    this.threads = [];

    const nodeLabels = [
      "AGENT-LLM-01",
      "USDC-RESERVE",
      "SEARCH-NODE",
      "WEATHER-IOT",
      "COMPUTE-BURST",
      "DATA-FEED-X",
      "ROBINHOOD-HOOD",
      "ARBITRUM-STYLUS",
      "SEQUENCER-PRIME",
      "SETTLE-GATE",
    ];

    const isMobile = typeof window !== "undefined" && window.innerWidth < 768;
    const count = nodeLabels.length;
    const centerX = isMobile ? this.width * 0.5 : this.width * 0.65;
    const centerY = isMobile ? this.height * 0.35 : this.height * 0.5;
    const radiusX = isMobile
      ? Math.min(this.width * 0.38, 160 * this.dpr)
      : Math.min(this.width * 0.28, 380 * this.dpr);
    const radiusY = isMobile
      ? Math.min(this.height * 0.25, 120 * this.dpr)
      : Math.min(this.height * 0.38, 240 * this.dpr);

    // Arrange nodes in an elliptical constellation on the right half of the hero
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2;
      const x = centerX + Math.cos(angle) * radiusX + (Math.sin(i * 3) * 30 * this.dpr);
      const y = centerY + Math.sin(angle) * radiusY + (Math.cos(i * 2) * 20 * this.dpr);

      this.nodes.push({
        x,
        y,
        baseX: x,
        baseY: y,
        vx: 0,
        vy: 0,
        radius: (i % 2 === 0 ? 6 : 8) * this.dpr,
        id: `node-${i}`,
        label: nodeLabels[i],
        cluster: i % 3,
      });
    }

    // Dense bilateral obligations (gross mesh)
    for (let i = 0; i < count; i++) {
      for (let j = 0; j < count; j++) {
        if (i !== j && (i + j) % 2 === 0) {
          this.threads.push({
            fromIndex: i,
            toIndex: j,
            amount: 50000 + ((i * 17 + j * 23) % 80000),
            curvature: (((i + j) % 5) - 2) * 0.15,
            speed: 0.8 + ((i + j) % 4) * 0.3,
            isNet: false,
          });
        }
      }
    }

    // Sparse multilateral net settlements (collapsed paths)
    for (let i = 0; i < count; i += 2) {
      const target = (i + 3) % count;
      this.threads.push({
        fromIndex: i,
        toIndex: target,
        amount: 320000,
        curvature: 0,
        speed: 1.4,
        isNet: true,
      });
    }
  }

  public start(): void {
    if (this.animId !== null) return;
    this.tick();
  }

  public stop(): void {
    if (this.animId !== null) {
      cancelAnimationFrame(this.animId);
      this.animId = null;
    }
    window.removeEventListener("resize", this.handleResize);
    window.removeEventListener("mousemove", this.handleMouseMove);
  }

  private tick(): void {
    this.time += 0.016;
    this.updateNodes();
    this.render();
    this.animId = requestAnimationFrame(this.tick);
  }

  private updateNodes(): void {
    for (const node of this.nodes) {
      // Gentle natural hovering oscillation
      const hoverOffset = Math.sin(this.time * 2 + node.cluster) * 4 * this.dpr;
      let targetX = node.baseX;
      let targetY = node.baseY + hoverOffset;

      // Mouse magnetic cursor reaction
      const dx = this.mouseX - node.x;
      const dy = this.mouseY - node.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const repelDist = 140 * this.dpr;

      if (dist < repelDist && dist > 0) {
        const force = (1 - dist / repelDist) * 25 * this.dpr;
        targetX -= (dx / dist) * force;
        targetY -= (dy / dist) * force;
      }

      node.x += (targetX - node.x) * 0.1;
      node.y += (targetY - node.y) * 0.1;
    }
  }

  private render(): void {
    const { ctx, width, height, nodes, threads, unweaveProgress } = this;
    ctx.clearRect(0, 0, width, height);

    // Subtle tactical dot grid in canvas
    ctx.fillStyle = "rgba(30, 41, 59, 0.25)";
    const gridSize = 48 * this.dpr;
    for (let x = 0; x < width; x += gridSize) {
      for (let y = 0; y < height; y += gridSize) {
        ctx.fillRect(x, y, 1.5 * this.dpr, 1.5 * this.dpr);
      }
    }

    // 1. Raw Bilateral Strands (Fades out with unweaving)
    const rawAlpha = Math.max(0, 1 - unweaveProgress * 1.3);
    if (rawAlpha > 0.01) {
      ctx.save();
      for (const t of threads) {
        if (t.isNet) continue;
        const from = nodes[t.fromIndex];
        const to = nodes[t.toIndex];
        if (!from || !to) continue;

        ctx.strokeStyle = `rgba(6, 182, 212, ${0.18 * rawAlpha})`;
        ctx.lineWidth = 1 * this.dpr;

        const curvature = t.curvature * 80 * this.dpr;
        const midX = (from.x + to.x) / 2 + curvature;
        const midY = (from.y + to.y) / 2 - curvature;

        ctx.beginPath();
        ctx.moveTo(from.x, from.y);
        ctx.quadraticCurveTo(midX, midY, to.x, to.y);
        ctx.stroke();

        // Traveling pulse
        if (rawAlpha > 0.3) {
          const progress = (this.time * t.speed * 0.4 + (t.amount % 11) * 0.09) % 1;
          const px = Math.pow(1 - progress, 2) * from.x + 2 * (1 - progress) * progress * midX + Math.pow(progress, 2) * to.x;
          const py = Math.pow(1 - progress, 2) * from.y + 2 * (1 - progress) * progress * midY + Math.pow(progress, 2) * to.y;

          ctx.fillStyle = `rgba(56, 189, 248, ${0.8 * rawAlpha})`;
          ctx.beginPath();
          ctx.arc(px, py, 1.8 * this.dpr, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.restore();
    }

    // 2. Multilateral Net Settlement Lines (Fades in with unweaving)
    const netAlpha = Math.min(1, unweaveProgress * 1.4);
    if (netAlpha > 0.01) {
      ctx.save();
      for (const t of threads) {
        if (!t.isNet) continue;
        const from = nodes[t.fromIndex];
        const to = nodes[t.toIndex];
        if (!from || !to) continue;

        ctx.strokeStyle = `rgba(16, 185, 129, ${0.75 * netAlpha})`;
        ctx.lineWidth = 2.4 * this.dpr;
        ctx.shadowColor = "rgba(16, 185, 129, 0.6)";
        ctx.shadowBlur = 10 * this.dpr;

        ctx.beginPath();
        ctx.moveTo(from.x, from.y);
        ctx.lineTo(to.x, to.y);
        ctx.stroke();

        // Net particle pulse
        const progress = (this.time * 0.9 + (t.amount % 7) * 0.14) % 1;
        const px = from.x + (to.x - from.x) * progress;
        const py = from.y + (to.y - from.y) * progress;

        ctx.fillStyle = "#A7F3D0";
        ctx.beginPath();
        ctx.arc(px, py, 3 * this.dpr, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    // 3. Render Nodes
    for (const node of nodes) {
      ctx.save();

      // Outer Glow Ring
      const pulse = Math.sin(this.time * 3 + node.cluster) * 2 * this.dpr;
      ctx.strokeStyle = "rgba(16, 185, 129, 0.4)";
      ctx.lineWidth = 1.2 * this.dpr;
      ctx.beginPath();
      ctx.arc(node.x, node.y, node.radius + 4 * this.dpr + pulse, 0, Math.PI * 2);
      ctx.stroke();

      // Core Node Body
      ctx.fillStyle = "#111620";
      ctx.beginPath();
      ctx.arc(node.x, node.y, node.radius, 0, Math.PI * 2);
      ctx.fill();

      // Precision Perimeter Border
      ctx.strokeStyle = "#10B981";
      ctx.lineWidth = 1.5 * this.dpr;
      ctx.stroke();

      // Inner Light Core
      ctx.fillStyle = "#10B981";
      ctx.beginPath();
      ctx.arc(node.x, node.y, 2.5 * this.dpr, 0, Math.PI * 2);
      ctx.fill();

      // Node Label
      ctx.font = `600 ${9 * this.dpr}px 'Space Grotesk', sans-serif`;
      ctx.fillStyle = "#F8FAFC";
      ctx.textAlign = "center";
      ctx.fillText(node.label, node.x, node.y + node.radius + 12 * this.dpr);

      ctx.restore();
    }
  }
}

export default LoomHeroCanvas;
