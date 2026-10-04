import { tokens } from "./tokens.js";
import { sound } from "./sound.js";

export interface LoomKnot {
  id: string;
  label: string;
  role: string;
  x: number;
  y: number;
  z?: number;
  radius: number;
  balance: number;
  netPosition: number;
  status: "healthy" | "constrained" | "stressed" | "frozen";
}

export interface LoomThread {
  id: string;
  fromId: string;
  toId: string;
  amount: number;
  isNetSettlement: boolean;
  priority: "critical" | "normal" | "low";
  curvature?: number;
  flowSpeed?: number;
}

export interface LoomEngineOptions {
  canvas: HTMLCanvasElement;
  knots?: LoomKnot[];
  rawThreads?: LoomThread[];
  netThreads?: LoomThread[];
  unweaveProgress?: number;
  reducedMotion?: boolean;
  onKnotSelect?: (knot: LoomKnot | null) => void;
}

export class LoomEngine {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private animId: number | null = null;
  private knots: LoomKnot[] = [];
  private rawThreads: LoomThread[] = [];
  private netThreads: LoomThread[] = [];
  private unweaveProgress: number = 0;
  private targetUnweaveProgress: number = 0;
  private reducedMotion: boolean = false;
  private hoveredKnot: LoomKnot | null = null;
  private selectedKnot: LoomKnot | null = null;
  private onKnotSelect?: (knot: LoomKnot | null) => void;
  private time: number = 0;

  // 2.5D Camera and Interaction State
  private panX: number = 0;
  private panY: number = 0;
  private zoom: number = 1.0;
  private isDragging: boolean = false;
  private dragStartX: number = 0;
  private dragStartY: number = 0;
  private hasDragged: boolean = false;

  constructor(options: LoomEngineOptions) {
    this.canvas = options.canvas;
    const ctx = this.canvas.getContext("2d");
    if (!ctx) {
      throw new Error("Unable to obtain 2D rendering context for Loom Canvas");
    }
    this.ctx = ctx;
    this.reducedMotion = options.reducedMotion ?? false;
    this.onKnotSelect = options.onKnotSelect;

    if (options.knots) this.knots = options.knots;
    if (options.rawThreads) this.rawThreads = options.rawThreads;
    if (options.netThreads) this.netThreads = options.netThreads;
    if (options.unweaveProgress !== undefined) {
      this.unweaveProgress = options.unweaveProgress;
      this.targetUnweaveProgress = options.unweaveProgress;
    }

    this.bindEvents();
    this.start();
  }

  private bindEvents(): void {
    this.handleMouseMove = this.handleMouseMove.bind(this);
    this.handleMouseDown = this.handleMouseDown.bind(this);
    this.handleMouseUp = this.handleMouseUp.bind(this);
    this.handleWheel = this.handleWheel.bind(this);

    this.canvas.addEventListener("mousemove", this.handleMouseMove);
    this.canvas.addEventListener("mousedown", this.handleMouseDown);
    window.addEventListener("mouseup", this.handleMouseUp);
    this.canvas.addEventListener("wheel", this.handleWheel, { passive: false });
  }

  private unbindEvents(): void {
    this.canvas.removeEventListener("mousemove", this.handleMouseMove);
    this.canvas.removeEventListener("mousedown", this.handleMouseDown);
    window.removeEventListener("mouseup", this.handleMouseUp);
    this.canvas.removeEventListener("wheel", this.handleWheel);
  }

  private screenToWorld(screenX: number, screenY: number): { x: number; y: number } {
    const rect = this.canvas.getBoundingClientRect();
    const clientX = screenX - rect.left;
    const clientY = screenY - rect.top;
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;

    const worldX = (clientX - centerX - this.panX) / this.zoom + centerX;
    const worldY = (clientY - centerY - this.panY) / this.zoom + centerY;
    return { x: worldX, y: worldY };
  }

  private handleMouseDown(e: MouseEvent): void {
    this.isDragging = true;
    this.hasDragged = false;
    this.dragStartX = e.clientX - this.panX;
    this.dragStartY = e.clientY - this.panY;
  }

  private handleMouseMove(e: MouseEvent): void {
    if (this.isDragging) {
      const newPanX = e.clientX - this.dragStartX;
      const newPanY = e.clientY - this.dragStartY;
      if (Math.abs(newPanX - this.panX) > 3 || Math.abs(newPanY - this.panY) > 3) {
        this.hasDragged = true;
      }
      this.panX = newPanX;
      this.panY = newPanY;
      return;
    }

    const worldPos = this.screenToWorld(e.clientX, e.clientY);
    let hit: LoomKnot | null = null;

    for (const knot of this.knots) {
      const dx = worldPos.x - knot.x;
      const dy = worldPos.y - knot.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist <= knot.radius + 14) {
        hit = knot;
        break;
      }
    }

    if (this.hoveredKnot !== hit) {
      this.hoveredKnot = hit;
      this.canvas.style.cursor = hit ? "pointer" : "grab";
    }
  }

  private handleMouseUp(e: MouseEvent): void {
    if (!this.isDragging) return;
    this.isDragging = false;

    if (!this.hasDragged) {
      const worldPos = this.screenToWorld(e.clientX, e.clientY);
      let clicked: LoomKnot | null = null;

      for (const knot of this.knots) {
        const dx = worldPos.x - knot.x;
        const dy = worldPos.y - knot.y;
        if (Math.sqrt(dx * dx + dy * dy) <= knot.radius + 14) {
          clicked = knot;
          break;
        }
      }

      this.selectedKnot = clicked;
      if (clicked) {
        sound.playNodeSelect();
      } else {
        sound.playClick(600);
      }
      if (this.onKnotSelect) {
        this.onKnotSelect(clicked);
      }
    }
  }

  private handleWheel(e: WheelEvent): void {
    e.preventDefault();
    const zoomFactor = e.deltaY < 0 ? 1.08 : 0.92;
    const newZoom = Math.max(0.4, Math.min(3.0, this.zoom * zoomFactor));
    this.zoom = newZoom;
  }

  public resetCamera(): void {
    this.panX = 0;
    this.panY = 0;
    this.zoom = 1.0;
    sound.playClick(900);
  }

  public setZoom(zoom: number): void {
    this.zoom = Math.max(0.4, Math.min(3.0, zoom));
  }

  public setPan(x: number, y: number): void {
    this.panX = x;
    this.panY = y;
  }

  public setData(knots: LoomKnot[], rawThreads: LoomThread[], netThreads: LoomThread[]): void {
    this.knots = knots;
    this.rawThreads = rawThreads;
    this.netThreads = netThreads;
  }

  public setKnots(knots: LoomKnot[]): void {
    this.knots = knots;
  }

  public setThreads(rawThreads: LoomThread[], netThreads: LoomThread[]): void {
    this.rawThreads = rawThreads;
    this.netThreads = netThreads;
  }

  public setReducedMotion(reduced: boolean): void {
    this.reducedMotion = reduced;
  }

  public setUnweaveProgress(progress: number): void {
    const clamped = Math.max(0, Math.min(1, progress));
    this.targetUnweaveProgress = clamped;
    if (this.reducedMotion) {
      this.unweaveProgress = clamped;
    }
  }

  public setSelectedKnot(knot: LoomKnot | null): void {
    this.selectedKnot = knot;
  }

  public start(): void {
    if (this.animId !== null) return;
    const loop = () => {
      this.time += 0.016;
      this.updatePhysics();
      this.render();
      this.animId = requestAnimationFrame(loop);
    };
    this.animId = requestAnimationFrame(loop);
  }

  public stop(): void {
    if (this.animId !== null) {
      cancelAnimationFrame(this.animId);
      this.animId = null;
    }
    this.unbindEvents();
  }

  private updatePhysics(): void {
    if (!this.reducedMotion) {
      const diff = this.targetUnweaveProgress - this.unweaveProgress;
      if (Math.abs(diff) > 0.001) {
        this.unweaveProgress += diff * 0.12;
      } else {
        this.unweaveProgress = this.targetUnweaveProgress;
      }
    } else {
      this.unweaveProgress = this.targetUnweaveProgress;
    }
  }

  private render(): void {
    const { canvas, ctx } = this;
    const dpr = window.devicePixelRatio || 1;
    const width = canvas.width / dpr;
    const height = canvas.height / dpr;

    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, width, height);

    // Deep Obsidian Base
    ctx.fillStyle = tokens.bg;
    ctx.fillRect(0, 0, width, height);

    // World Transformation with Pan & Zoom
    const centerX = width / 2;
    const centerY = height / 2;
    ctx.translate(centerX + this.panX, centerY + this.panY);
    ctx.scale(this.zoom, this.zoom);
    ctx.translate(-centerX, -centerY);

    // 2.5D Tactical Dot-Matrix Grid
    this.renderTacticalGrid(width, height);

    // Render Threads (Obligation Strands)
    this.renderThreads();

    // Render Knots (Clearing Nodes)
    this.renderKnots();

    ctx.restore();
  }

  private renderTacticalGrid(width: number, height: number): void {
    const { ctx } = this;
    ctx.save();
    ctx.fillStyle = "rgba(30, 41, 59, 0.4)";
    const gridSize = 40;
    const startX = -gridSize * 4;
    const endX = width + gridSize * 4;
    const startY = -gridSize * 4;
    const endY = height + gridSize * 4;

    for (let x = startX; x < endX; x += gridSize) {
      for (let y = startY; y < endY; y += gridSize) {
        ctx.fillRect(x, y, 1.5, 1.5);
      }
    }
    ctx.restore();
  }

  private renderThreads(): void {
    const { ctx, unweaveProgress, rawThreads, netThreads, knots } = this;
    const knotMap = new Map<string, LoomKnot>();
    for (const knot of knots) {
      knotMap.set(knot.id, knot);
    }

    // 1. Raw Bilateral Strands (fade out as unweave increases)
    const rawAlpha = Math.max(0, 1 - unweaveProgress * 1.3);
    if (rawAlpha > 0.01) {
      ctx.save();
      for (const thread of rawThreads) {
        const from = knotMap.get(thread.fromId);
        const to = knotMap.get(thread.toId);
        if (!from || !to) continue;

        const isHighlighted =
          (this.selectedKnot && (this.selectedKnot.id === from.id || this.selectedKnot.id === to.id)) ||
          (this.hoveredKnot && (this.hoveredKnot.id === from.id || this.hoveredKnot.id === to.id));

        const baseAlpha = isHighlighted ? 0.8 : 0.22;
        const color = thread.priority === "critical"
          ? `rgba(244, 63, 94, ${baseAlpha * rawAlpha})`
          : `rgba(6, 182, 212, ${baseAlpha * rawAlpha})`;

        ctx.strokeStyle = color;
        ctx.lineWidth = isHighlighted ? 2.5 : 1.2;

        const curvature = (thread.curvature ?? 0.2) * 50;
        const midX = (from.x + to.x) / 2 + curvature;
        const midY = (from.y + to.y) / 2 - curvature;

        ctx.beginPath();
        ctx.moveTo(from.x, from.y);
        ctx.quadraticCurveTo(midX, midY, to.x, to.y);
        ctx.stroke();

        // Animated Gross Particle Pulse
        if (!this.reducedMotion && rawAlpha > 0.4) {
          const speed = (thread.flowSpeed ?? 1.0) * 0.4;
          const t = (this.time * speed + (thread.amount % 10) * 0.1) % 1;
          const qx = Math.pow(1 - t, 2) * from.x + 2 * (1 - t) * t * midX + Math.pow(t, 2) * to.x;
          const qy = Math.pow(1 - t, 2) * from.y + 2 * (1 - t) * t * midY + Math.pow(t, 2) * to.y;

          ctx.fillStyle = thread.priority === "critical" ? "#F43F5E" : "#38BDF8";
          ctx.beginPath();
          ctx.arc(qx, qy, 2, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.restore();
    }

    // 2. Multilateral Net Settlement Paths (emerge as unweave increases)
    const netAlpha = Math.min(1, unweaveProgress * 1.4);
    if (netAlpha > 0.01) {
      ctx.save();
      for (const thread of netThreads) {
        const from = knotMap.get(thread.fromId);
        const to = knotMap.get(thread.toId);
        if (!from || !to) continue;

        const isHighlighted =
          (this.selectedKnot && (this.selectedKnot.id === from.id || this.selectedKnot.id === to.id)) ||
          (this.hoveredKnot && (this.hoveredKnot.id === from.id || this.hoveredKnot.id === to.id));

        const baseAlpha = isHighlighted ? 0.95 : 0.65;
        ctx.strokeStyle = `rgba(16, 185, 129, ${baseAlpha * netAlpha})`;
        ctx.lineWidth = isHighlighted ? 3.5 : 2.2;
        ctx.shadowColor = "rgba(16, 185, 129, 0.5)";
        ctx.shadowBlur = isHighlighted ? 12 : 6;

        ctx.beginPath();
        ctx.moveTo(from.x, from.y);
        ctx.lineTo(to.x, to.y);
        ctx.stroke();

        // Directional Net Arrow indicator
        const angle = Math.atan2(to.y - from.y, to.x - from.x);
        const arrowDist = 0.55;
        const arrowX = from.x + (to.x - from.x) * arrowDist;
        const arrowY = from.y + (to.y - from.y) * arrowDist;

        ctx.fillStyle = `rgba(16, 185, 129, ${netAlpha})`;
        ctx.beginPath();
        ctx.moveTo(arrowX, arrowY);
        ctx.lineTo(arrowX - 8 * Math.cos(angle - Math.PI / 6), arrowY - 8 * Math.sin(angle - Math.PI / 6));
        ctx.lineTo(arrowX - 8 * Math.cos(angle + Math.PI / 6), arrowY - 8 * Math.sin(angle + Math.PI / 6));
        ctx.closePath();
        ctx.fill();

        // Rapid Netting Pulse Particle
        if (!this.reducedMotion) {
          const t = (this.time * 0.8 + (thread.amount % 7) * 0.15) % 1;
          const px = from.x + (to.x - from.x) * t;
          const py = from.y + (to.y - from.y) * t;

          ctx.fillStyle = "#A7F3D0";
          ctx.beginPath();
          ctx.arc(px, py, 3, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.restore();
    }
  }

  private renderKnots(): void {
    const { ctx, knots, selectedKnot, hoveredKnot } = this;

    for (const knot of knots) {
      const isSelected = selectedKnot?.id === knot.id;
      const isHovered = hoveredKnot?.id === knot.id;

      ctx.save();

      // Determine Status Colors
      let mainColor = tokens.success;
      let glowColor = "rgba(16, 185, 129, 0.4)";
      if (knot.status === "stressed") {
        mainColor = tokens.danger;
        glowColor = "rgba(244, 63, 94, 0.5)";
      } else if (knot.status === "constrained") {
        mainColor = tokens.warning;
        glowColor = "rgba(245, 158, 11, 0.45)";
      } else if (knot.status === "frozen") {
        mainColor = "#64748B";
        glowColor = "rgba(100, 116, 139, 0.2)";
      }

      // Outer Selection / Status Halo
      if (isSelected || isHovered || knot.status === "stressed") {
        const pulse = Math.sin(this.time * 4) * 3;
        ctx.strokeStyle = glowColor;
        ctx.lineWidth = isSelected ? 3 : 1.5;
        ctx.beginPath();
        ctx.arc(knot.x, knot.y, knot.radius + (isSelected ? 8 : 5) + pulse, 0, Math.PI * 2);
        ctx.stroke();
      }

      // 2.5D Node Body Elevation
      const grad = ctx.createRadialGradient(
        knot.x - knot.radius * 0.3,
        knot.y - knot.radius * 0.3,
        knot.radius * 0.2,
        knot.x,
        knot.y,
        knot.radius
      );
      grad.addColorStop(0, tokens.surfaceElevated);
      grad.addColorStop(1, tokens.surface);

      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(knot.x, knot.y, knot.radius, 0, Math.PI * 2);
      ctx.fill();

      // Precision Perimeter Ring
      ctx.strokeStyle = isSelected ? "#38BDF8" : mainColor;
      ctx.lineWidth = isSelected ? 2.5 : 1.5;
      ctx.stroke();

      // Inner Status Pip
      ctx.fillStyle = mainColor;
      ctx.beginPath();
      ctx.arc(knot.x, knot.y, 3.5, 0, Math.PI * 2);
      ctx.fill();

      // Label & Role Typography
      ctx.font = "600 11px 'Space Grotesk', -apple-system, sans-serif";
      ctx.fillStyle = tokens.textPrimary;
      ctx.textAlign = "center";
      ctx.fillText(knot.label, knot.x, knot.y + knot.radius + 14);

      ctx.font = "500 9px 'JetBrains Mono', monospace";
      ctx.fillStyle = tokens.textSecondary;
      const netSign = knot.netPosition >= 0 ? "+" : "";
      const formattedNet = `${netSign}$${(Math.abs(knot.netPosition) / 1000).toFixed(0)}k`;
      ctx.fillText(formattedNet, knot.x, knot.y + knot.radius + 25);

      ctx.restore();
    }
  }
}

export default LoomEngine;
