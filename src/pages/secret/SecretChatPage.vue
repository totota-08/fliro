<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref, computed } from "vue";
import { useRouter } from "vue-router";
import { ROUTE_NAMES } from "@/constants/routes";
import { consumeSecretAccess } from "@/services/secretAccess";
import { appName } from "@/constants/appMeta";

const router = useRouter();
const canvasRef = ref<HTMLCanvasElement | null>(null);
const score = ref(0);
const highScore = ref(0);
const lives = ref(3);
const stage = ref(1);
const gameState = ref<"ready" | "playing" | "gameover" | "clear">("ready");
const audioContext = ref<AudioContext | null>(null);

// Pixel art scale
const PIXEL_SIZE = 4;
const CANVAS_WIDTH = 480;
const CANVAS_HEIGHT = 320;

interface Player {
  x: number;
  y: number;
  vx: number;
  vy: number;
  width: number;
  height: number;
  grounded: boolean;
  attacking: boolean;
  attackFrame: number;
  facing: "left" | "right";
  frame: number;
  invincible: number;
}

interface Enemy {
  x: number;
  y: number;
  vx: number;
  width: number;
  height: number;
  type: "drone" | "turret" | "walker";
  health: number;
  frame: number;
  shootTimer: number;
}

interface Bullet {
  x: number;
  y: number;
  vx: number;
  vy: number;
  isEnemy: boolean;
  size: number;
}

interface Platform {
  x: number;
  y: number;
  width: number;
  height: number;
  moving?: boolean;
  moveRange?: number;
  moveSpeed?: number;
  startX?: number;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  color: string;
  size: number;
}

interface PowerUp {
  x: number;
  y: number;
  type: "health" | "score" | "power";
  collected: boolean;
}

const player = ref<Player>({
  x: 50,
  y: 200,
  vx: 0,
  vy: 0,
  width: 16,
  height: 24,
  grounded: false,
  attacking: false,
  attackFrame: 0,
  facing: "right",
  frame: 0,
  invincible: 0,
});

const enemies = ref<Enemy[]>([]);
const bullets = ref<Bullet[]>([]);
const platforms = ref<Platform[]>([]);
const particles = ref<Particle[]>([]);
const powerUps = ref<PowerUp[]>([]);
const keys = ref<Set<string>>(new Set());
const cameraX = ref(0);

let animationId: number | null = null;
let frameCount = 0;

const GRAVITY = 0.5;
const JUMP_FORCE = -10;
const MOVE_SPEED = 3;
const GROUND_Y = CANVAS_HEIGHT - 40;

// Cyberpunk color palette
const COLORS = {
  bg: "#0a0a12",
  bgGradient: "#0f1624",
  platform: "#1a3a4a",
  platformHighlight: "#2a5a6a",
  player: "#00ffff",
  playerDark: "#00aaaa",
  enemy: "#ff00ff",
  enemyDark: "#aa00aa",
  bullet: "#ffff00",
  bulletEnemy: "#ff3366",
  particle: "#00ff88",
  ui: "#00ffff",
  uiDark: "#006666",
  ground: "#1a2a3a",
  groundLine: "#2a4a5a",
};

function initAudio() {
  try {
    audioContext.value = new (
      window.AudioContext || (window as any).webkitAudioContext
    )();
  } catch {
    // Audio not supported
  }
}

function playSound(
  type: "jump" | "attack" | "hit" | "explosion" | "powerup" | "shoot",
) {
  if (!audioContext.value) return;
  const ctx = audioContext.value;

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  switch (type) {
    case "jump":
      osc.type = "square";
      osc.frequency.setValueAtTime(200, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(600, ctx.currentTime + 0.1);
      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.1);
      break;
    case "attack":
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(150, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(80, ctx.currentTime + 0.08);
      gain.gain.setValueAtTime(0.1, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.08);
      break;
    case "hit":
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(100, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(50, ctx.currentTime + 0.15);
      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.15);
      break;
    case "explosion":
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(200, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(30, ctx.currentTime + 0.3);
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.3);
      break;
    case "powerup":
      const notes = [523.25, 659.25, 783.99];
      notes.forEach((freq, i) => {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = "sine";
        o.frequency.setValueAtTime(freq, ctx.currentTime + i * 0.06);
        g.gain.setValueAtTime(0.1, ctx.currentTime + i * 0.06);
        g.gain.exponentialRampToValueAtTime(
          0.001,
          ctx.currentTime + i * 0.06 + 0.12,
        );
        o.connect(g);
        g.connect(ctx.destination);
        o.start(ctx.currentTime + i * 0.06);
        o.stop(ctx.currentTime + i * 0.06 + 0.12);
      });
      break;
    case "shoot":
      osc.type = "square";
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(220, ctx.currentTime + 0.05);
      gain.gain.setValueAtTime(0.06, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.05);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.05);
      break;
  }
}

function createExplosion(x: number, y: number, color: string) {
  for (let i = 0; i < 12; i++) {
    const angle = (Math.PI * 2 * i) / 12;
    const speed = 2 + Math.random() * 3;
    particles.value.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 20 + Math.random() * 15,
      color,
      size: 2 + Math.floor(Math.random() * 3),
    });
  }
}

function generateStage() {
  platforms.value = [];
  enemies.value = [];
  powerUps.value = [];
  bullets.value = [];
  particles.value = [];

  // Ground
  platforms.value.push({
    x: 0,
    y: GROUND_Y,
    width: 2000 + stage.value * 500,
    height: 40,
  });

  // Generate platforms
  const stageLength = 1500 + stage.value * 400;
  let lastPlatformX = 200;

  for (let i = 0; i < 8 + stage.value * 2; i++) {
    const x = lastPlatformX + 80 + Math.random() * 120;
    const y = GROUND_Y - 60 - Math.random() * 100;
    const width = 60 + Math.random() * 80;
    const isMoving = stage.value >= 2 && Math.random() > 0.7;

    platforms.value.push({
      x,
      y,
      width,
      height: 12,
      moving: isMoving,
      moveRange: isMoving ? 40 + Math.random() * 40 : 0,
      moveSpeed: isMoving ? 0.5 + Math.random() * 0.5 : 0,
      startX: x,
    });

    // Maybe add enemy on platform
    if (Math.random() > 0.5) {
      const enemyType: Enemy["type"] =
        stage.value >= 3 && Math.random() > 0.7
          ? "turret"
          : stage.value >= 2 && Math.random() > 0.6
            ? "walker"
            : "drone";

      enemies.value.push({
        x: x + width / 2 - 8,
        y: y - 20,
        vx: enemyType === "drone" ? (Math.random() > 0.5 ? 1 : -1) : 0,
        width: 16,
        height: 16,
        type: enemyType,
        health: enemyType === "turret" ? 2 : 1,
        frame: 0,
        shootTimer: 0,
      });
    }

    // Maybe add power-up
    if (Math.random() > 0.8) {
      const powerType: PowerUp["type"] =
        Math.random() > 0.7
          ? "health"
          : Math.random() > 0.5
            ? "power"
            : "score";

      powerUps.value.push({
        x: x + width / 2 - 6,
        y: y - 24,
        type: powerType,
        collected: false,
      });
    }

    lastPlatformX = x + width;
  }

  // Add goal platform
  platforms.value.push({
    x: stageLength - 100,
    y: GROUND_Y - 20,
    width: 100,
    height: 20,
  });

  // Ground enemies
  for (let i = 0; i < 5 + stage.value * 2; i++) {
    enemies.value.push({
      x: 300 + i * 200 + Math.random() * 100,
      y: GROUND_Y - 20,
      vx: Math.random() > 0.5 ? 1 : -1,
      width: 16,
      height: 20,
      type: "walker",
      health: 1,
      frame: 0,
      shootTimer: 0,
    });
  }
}

function resetPlayer() {
  player.value.x = 50;
  player.value.y = GROUND_Y - 50;
  player.value.vx = 0;
  player.value.vy = 0;
  player.value.grounded = false;
  player.value.attacking = false;
  player.value.invincible = 60;
  cameraX.value = 0;
}

function startGame() {
  score.value = 0;
  lives.value = 3;
  stage.value = 1;
  gameState.value = "playing";

  initAudio();
  generateStage();
  resetPlayer();
  gameLoop();
}

function nextStage() {
  stage.value++;
  score.value += 1000;
  generateStage();
  resetPlayer();
  gameState.value = "playing";
  gameLoop();
}

function endGame() {
  gameState.value = "gameover";
  if (score.value > highScore.value) {
    highScore.value = score.value;
    localStorage.setItem(
      `${appName}_cyber_runner_highscore`,
      String(highScore.value),
    );
  }
  if (animationId) {
    cancelAnimationFrame(animationId);
    animationId = null;
  }
}

function gameLoop() {
  if (gameState.value !== "playing") return;

  const canvas = canvasRef.value;
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  frameCount++;
  update();
  render(ctx);

  animationId = requestAnimationFrame(gameLoop);
}

function update() {
  const p = player.value;

  // Player movement
  p.vx = 0;
  if (keys.value.has("ArrowLeft") || keys.value.has("a")) {
    p.vx = -MOVE_SPEED;
    p.facing = "left";
  }
  if (keys.value.has("ArrowRight") || keys.value.has("d")) {
    p.vx = MOVE_SPEED;
    p.facing = "right";
  }

  // Jump
  if (
    (keys.value.has("ArrowUp") || keys.value.has("w") || keys.value.has(" ")) &&
    p.grounded
  ) {
    p.vy = JUMP_FORCE;
    p.grounded = false;
    playSound("jump");
  }

  // Attack
  if (keys.value.has("z") || keys.value.has("j")) {
    if (!p.attacking) {
      p.attacking = true;
      p.attackFrame = 0;
      playSound("attack");

      // Shoot bullet
      bullets.value.push({
        x: p.x + (p.facing === "right" ? p.width : -8),
        y: p.y + p.height / 2 - 2,
        vx: p.facing === "right" ? 8 : -8,
        vy: 0,
        isEnemy: false,
        size: 6,
      });
    }
  }

  // Apply gravity
  p.vy += GRAVITY;
  p.y += p.vy;
  p.x += p.vx;

  // Animation
  if (Math.abs(p.vx) > 0) {
    p.frame = Math.floor(frameCount / 6) % 4;
  } else {
    p.frame = 0;
  }

  // Attack animation
  if (p.attacking) {
    p.attackFrame++;
    if (p.attackFrame > 15) {
      p.attacking = false;
      p.attackFrame = 0;
    }
  }

  // Invincibility
  if (p.invincible > 0) {
    p.invincible--;
  }

  // Platform collision
  p.grounded = false;
  platforms.value.forEach((plat) => {
    // Update moving platforms
    if (
      plat.moving &&
      plat.startX !== undefined &&
      plat.moveRange &&
      plat.moveSpeed
    ) {
      plat.x =
        plat.startX +
        Math.sin(frameCount * plat.moveSpeed * 0.05) * plat.moveRange;
    }

    // Check collision
    if (
      p.x + p.width > plat.x &&
      p.x < plat.x + plat.width &&
      p.y + p.height > plat.y &&
      p.y + p.height < plat.y + plat.height + 10 &&
      p.vy >= 0
    ) {
      p.y = plat.y - p.height;
      p.vy = 0;
      p.grounded = true;
    }
  });

  // Keep player on screen (horizontal)
  p.x = Math.max(cameraX.value, p.x);

  // Fall death
  if (p.y > CANVAS_HEIGHT + 50) {
    lives.value--;
    playSound("hit");
    if (lives.value <= 0) {
      endGame();
    } else {
      resetPlayer();
    }
    return;
  }

  // Camera follow
  const targetCameraX = p.x - CANVAS_WIDTH / 3;
  cameraX.value = Math.max(0, targetCameraX);

  // Check stage clear
  const stageLength = 1400 + stage.value * 400;
  if (p.x > stageLength) {
    gameState.value = "clear";
    playSound("powerup");
    if (animationId) {
      cancelAnimationFrame(animationId);
      animationId = null;
    }
    return;
  }

  // Update bullets
  bullets.value = bullets.value.filter((bullet) => {
    bullet.x += bullet.vx;
    bullet.y += bullet.vy;

    // Check if off screen
    if (
      bullet.x < cameraX.value - 50 ||
      bullet.x > cameraX.value + CANVAS_WIDTH + 50
    ) {
      return false;
    }

    // Player bullets vs enemies
    if (!bullet.isEnemy) {
      for (let i = enemies.value.length - 1; i >= 0; i--) {
        const enemy = enemies.value[i];
        if (!enemy) continue;

        if (
          bullet.x < enemy.x + enemy.width &&
          bullet.x + bullet.size > enemy.x &&
          bullet.y < enemy.y + enemy.height &&
          bullet.y + bullet.size > enemy.y
        ) {
          enemy.health--;
          if (enemy.health <= 0) {
            const points =
              enemy.type === "turret"
                ? 200
                : enemy.type === "walker"
                  ? 100
                  : 50;
            score.value += points;
            createExplosion(
              enemy.x + enemy.width / 2,
              enemy.y + enemy.height / 2,
              COLORS.enemy,
            );
            playSound("explosion");
            enemies.value.splice(i, 1);
          } else {
            playSound("hit");
          }
          return false;
        }
      }
    }

    // Enemy bullets vs player
    if (bullet.isEnemy && p.invincible === 0) {
      if (
        bullet.x < p.x + p.width &&
        bullet.x + bullet.size > p.x &&
        bullet.y < p.y + p.height &&
        bullet.y + bullet.size > p.y
      ) {
        lives.value--;
        p.invincible = 90;
        createExplosion(p.x + p.width / 2, p.y + p.height / 2, COLORS.player);
        playSound("hit");
        if (lives.value <= 0) {
          endGame();
        }
        return false;
      }
    }

    return true;
  });

  // Update enemies
  enemies.value.forEach((enemy) => {
    enemy.frame = Math.floor(frameCount / 8) % 2;

    if (enemy.type === "drone") {
      enemy.x += enemy.vx * 1.5;
      enemy.y += Math.sin(frameCount * 0.1) * 0.5;

      // Reverse at edges
      if (
        enemy.x < cameraX.value - 50 ||
        enemy.x > cameraX.value + CANVAS_WIDTH + 50
      ) {
        enemy.vx *= -1;
      }
    } else if (enemy.type === "walker") {
      enemy.x += enemy.vx;

      // Simple AI: reverse when hitting edge or player is behind
      if (Math.random() > 0.98) {
        enemy.vx *= -1;
      }
    }

    // Turret shooting
    if (enemy.type === "turret") {
      enemy.shootTimer++;
      if (enemy.shootTimer > 90) {
        enemy.shootTimer = 0;
        const dx = p.x - enemy.x;
        const dy = p.y - enemy.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 300) {
          bullets.value.push({
            x: enemy.x + enemy.width / 2,
            y: enemy.y + enemy.height / 2,
            vx: (dx / dist) * 4,
            vy: (dy / dist) * 4,
            isEnemy: true,
            size: 6,
          });
          playSound("shoot");
        }
      }
    }

    // Enemy collision with player
    if (p.invincible === 0) {
      if (
        p.x + p.width > enemy.x &&
        p.x < enemy.x + enemy.width &&
        p.y + p.height > enemy.y &&
        p.y < enemy.y + enemy.height
      ) {
        // Stomp enemy
        if (p.vy > 0 && p.y + p.height < enemy.y + enemy.height / 2) {
          enemy.health--;
          if (enemy.health <= 0) {
            score.value +=
              enemy.type === "turret"
                ? 200
                : enemy.type === "walker"
                  ? 100
                  : 50;
            createExplosion(
              enemy.x + enemy.width / 2,
              enemy.y + enemy.height / 2,
              COLORS.enemy,
            );
            playSound("explosion");
            const idx = enemies.value.indexOf(enemy);
            if (idx > -1) enemies.value.splice(idx, 1);
          }
          p.vy = JUMP_FORCE * 0.6;
        } else {
          // Take damage
          lives.value--;
          p.invincible = 90;
          createExplosion(p.x + p.width / 2, p.y + p.height / 2, COLORS.player);
          playSound("hit");
          if (lives.value <= 0) {
            endGame();
          }
        }
      }
    }
  });

  // Power-ups
  powerUps.value.forEach((pu) => {
    if (pu.collected) return;

    if (
      p.x + p.width > pu.x &&
      p.x < pu.x + 12 &&
      p.y + p.height > pu.y &&
      p.y < pu.y + 12
    ) {
      pu.collected = true;
      playSound("powerup");

      if (pu.type === "health" && lives.value < 5) {
        lives.value++;
      } else if (pu.type === "score") {
        score.value += 500;
      } else if (pu.type === "power") {
        score.value += 300;
        p.invincible = 180;
      }

      createExplosion(pu.x + 6, pu.y + 6, "#00ff88");
    }
  });

  // Update particles
  particles.value = particles.value.filter((pt) => {
    pt.x += pt.vx;
    pt.y += pt.vy;
    pt.vy += 0.1;
    pt.life--;
    return pt.life > 0;
  });
}

function render(ctx: CanvasRenderingContext2D) {
  const camX = cameraX.value;
  const p = player.value;

  // Background
  ctx.fillStyle = COLORS.bg;
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

  // Background gradient
  const bgGrad = ctx.createLinearGradient(0, 0, 0, CANVAS_HEIGHT);
  bgGrad.addColorStop(0, COLORS.bg);
  bgGrad.addColorStop(1, COLORS.bgGradient);
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

  // Parallax background elements
  for (let i = 0; i < 10; i++) {
    const bx = ((i * 200 - camX * 0.3) % (CANVAS_WIDTH + 200)) - 100;
    ctx.fillStyle = "rgba(0, 255, 255, 0.1)";
    ctx.fillRect(bx, 50 + i * 20, 4, 100 + i * 10);
  }

  // Draw grid lines
  ctx.strokeStyle = "rgba(0, 255, 255, 0.05)";
  ctx.lineWidth = 1;
  for (let x = -camX % 40; x < CANVAS_WIDTH; x += 40) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, CANVAS_HEIGHT);
    ctx.stroke();
  }
  for (let y = 0; y < CANVAS_HEIGHT; y += 40) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(CANVAS_WIDTH, y);
    ctx.stroke();
  }

  // Draw platforms
  platforms.value.forEach((plat) => {
    const x = plat.x - camX;
    if (x > -plat.width && x < CANVAS_WIDTH) {
      // Platform body
      ctx.fillStyle = COLORS.platform;
      ctx.fillRect(x, plat.y, plat.width, plat.height);

      // Highlight
      ctx.fillStyle = COLORS.platformHighlight;
      ctx.fillRect(x, plat.y, plat.width, 4);

      // Pixel detail
      ctx.fillStyle = "rgba(0, 255, 255, 0.3)";
      for (let px = 0; px < plat.width; px += 16) {
        ctx.fillRect(x + px, plat.y + 6, 4, 4);
      }
    }
  });

  // Draw power-ups
  powerUps.value.forEach((pu) => {
    if (pu.collected) return;
    const x = pu.x - camX;
    if (x > -20 && x < CANVAS_WIDTH + 20) {
      const bobY = Math.sin(frameCount * 0.1) * 3;

      ctx.fillStyle =
        pu.type === "health"
          ? "#ff0066"
          : pu.type === "score"
            ? "#ffff00"
            : "#00ff88";
      ctx.shadowColor = ctx.fillStyle;
      ctx.shadowBlur = 10;

      // Diamond shape
      ctx.beginPath();
      ctx.moveTo(x + 6, pu.y + bobY);
      ctx.lineTo(x + 12, pu.y + 6 + bobY);
      ctx.lineTo(x + 6, pu.y + 12 + bobY);
      ctx.lineTo(x, pu.y + 6 + bobY);
      ctx.closePath();
      ctx.fill();
      ctx.shadowBlur = 0;
    }
  });

  // Draw particles
  particles.value.forEach((pt) => {
    const x = pt.x - camX;
    ctx.fillStyle = pt.color;
    ctx.globalAlpha = pt.life / 35;
    ctx.fillRect(x, pt.y, pt.size, pt.size);
  });
  ctx.globalAlpha = 1;

  // Draw bullets
  bullets.value.forEach((bullet) => {
    const x = bullet.x - camX;
    ctx.fillStyle = bullet.isEnemy ? COLORS.bulletEnemy : COLORS.bullet;
    ctx.shadowColor = ctx.fillStyle;
    ctx.shadowBlur = 8;
    ctx.fillRect(x, bullet.y, bullet.size, bullet.size);
    ctx.shadowBlur = 0;
  });

  // Draw enemies
  enemies.value.forEach((enemy) => {
    const x = enemy.x - camX;
    if (x > -enemy.width - 20 && x < CANVAS_WIDTH + 20) {
      ctx.fillStyle = COLORS.enemyDark;
      ctx.fillRect(x, enemy.y, enemy.width, enemy.height);

      ctx.fillStyle = COLORS.enemy;
      if (enemy.type === "drone") {
        // Drone shape
        ctx.fillRect(x + 2, enemy.y + 4, 12, 8);
        ctx.fillRect(x, enemy.y + 6 + enemy.frame * 2, 16, 4);
      } else if (enemy.type === "turret") {
        // Turret shape
        ctx.fillRect(x + 4, enemy.y, 8, 12);
        ctx.fillRect(x + 2, enemy.y + 10, 12, 6);
        // Cannon
        ctx.fillStyle = "#ff3366";
        ctx.fillRect(x + 6, enemy.y + 4, 4, 6);
      } else {
        // Walker shape
        ctx.fillRect(x + 4, enemy.y + 2, 8, 10);
        ctx.fillRect(x + 2, enemy.y + 12, 12, 8);
        // Legs
        ctx.fillRect(x + 2 + enemy.frame * 4, enemy.y + 18, 4, 4);
        ctx.fillRect(x + 10 - enemy.frame * 4, enemy.y + 18, 4, 4);
      }

      // Eyes
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(x + 4, enemy.y + 4, 2, 2);
      ctx.fillRect(x + 10, enemy.y + 4, 2, 2);
    }
  });

  // Draw player
  const px = p.x - camX;
  const flash = p.invincible > 0 && Math.floor(p.invincible / 4) % 2 === 0;

  if (!flash) {
    // Body
    ctx.fillStyle = COLORS.playerDark;
    ctx.fillRect(px, p.y, p.width, p.height);

    ctx.fillStyle = COLORS.player;
    ctx.fillRect(px + 2, p.y + 2, 12, 8); // Head
    ctx.fillRect(px + 4, p.y + 10, 8, 10); // Body

    // Legs animation
    const legOffset = p.frame % 2 === 0 ? 0 : 2;
    ctx.fillRect(px + 4 + legOffset, p.y + 20, 4, 4);
    ctx.fillRect(px + 8 - legOffset, p.y + 20, 4, 4);

    // Eyes
    ctx.fillStyle = "#000000";
    const eyeX = p.facing === "right" ? 4 : 2;
    ctx.fillRect(px + eyeX + 2, p.y + 4, 2, 2);
    ctx.fillRect(px + eyeX + 6, p.y + 4, 2, 2);

    // Attack effect
    if (p.attacking) {
      ctx.fillStyle = COLORS.bullet;
      ctx.shadowColor = COLORS.bullet;
      ctx.shadowBlur = 10;
      const attackX = p.facing === "right" ? px + p.width : px - 8;
      ctx.fillRect(attackX, p.y + 8, 8, 4);
      ctx.shadowBlur = 0;
    }
  }

  // UI - HUD
  ctx.fillStyle = "rgba(0, 20, 30, 0.8)";
  ctx.fillRect(0, 0, CANVAS_WIDTH, 32);
  ctx.strokeStyle = COLORS.ui;
  ctx.lineWidth = 2;
  ctx.strokeRect(0, 30, CANVAS_WIDTH, 2);

  // Score
  ctx.fillStyle = COLORS.ui;
  ctx.font = "12px monospace";
  ctx.textAlign = "left";
  ctx.fillText(`SCORE: ${score.value.toString().padStart(6, "0")}`, 8, 20);

  // Stage
  ctx.textAlign = "center";
  ctx.fillText(`STAGE ${stage.value}`, CANVAS_WIDTH / 2, 20);

  // Lives
  ctx.textAlign = "right";
  ctx.fillText("LIFE:", CANVAS_WIDTH - 80, 20);
  for (let i = 0; i < lives.value; i++) {
    ctx.fillStyle = COLORS.player;
    ctx.fillRect(CANVAS_WIDTH - 70 + i * 14, 12, 10, 10);
  }

  // Scanline effect
  ctx.fillStyle = "rgba(0, 0, 0, 0.03)";
  for (let y = 0; y < CANVAS_HEIGHT; y += 2) {
    ctx.fillRect(0, y, CANVAS_WIDTH, 1);
  }
}

function handleKeyDown(e: KeyboardEvent) {
  if (gameState.value === "playing") {
    keys.value.add(e.key);
    if (
      ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", " "].includes(e.key)
    ) {
      e.preventDefault();
    }
  }
}

function handleKeyUp(e: KeyboardEvent) {
  keys.value.delete(e.key);
}

function goBack() {
  router.push({ name: ROUTE_NAMES.myPage });
}

onMounted(() => {
  const access = consumeSecretAccess();
  if (access !== "chat") {
    router.replace({ name: ROUTE_NAMES.myPage });
    return;
  }

  // Load high score
  const saved = localStorage.getItem(`${appName}_cyber_runner_highscore`);
  if (saved) {
    highScore.value = parseInt(saved, 10) || 0;
  }

  window.addEventListener("keydown", handleKeyDown);
  window.addEventListener("keyup", handleKeyUp);

  // Initial canvas draw
  const canvas = canvasRef.value;
  if (canvas) {
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.fillStyle = COLORS.bg;
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    }
  }
});

onBeforeUnmount(() => {
  window.removeEventListener("keydown", handleKeyDown);
  window.removeEventListener("keyup", handleKeyUp);
  if (animationId) {
    cancelAnimationFrame(animationId);
  }
  if (audioContext.value) {
    audioContext.value.close();
  }
});

const displayMessage = computed(() => {
  if (gameState.value === "ready") return "PRESS START";
  if (gameState.value === "gameover") return `GAME OVER`;
  if (gameState.value === "clear") return `STAGE ${stage.value} CLEAR!`;
  return "";
});
</script>

<template>
  <div class="game-shell">
    <!-- Background rain effect -->
    <div class="bg-rain">
      <div
        v-for="i in 20"
        :key="i"
        class="rain-drop"
        :style="{ left: `${i * 5}%`, animationDelay: `${Math.random() * 2}s` }"
      />
    </div>

    <div class="game-container">
      <header class="game-header">
        <div class="header-left">
          <p class="eyebrow">CYBER RUNNER</p>
          <h1>NEON DASH</h1>
        </div>
        <div class="header-right">
          <div class="stat">
            <span class="stat-label">HIGH</span>
            <span class="stat-value highlight">{{
              highScore.toLocaleString()
            }}</span>
          </div>
        </div>
      </header>

      <div class="canvas-wrapper">
        <canvas
          ref="canvasRef"
          :width="CANVAS_WIDTH"
          :height="CANVAS_HEIGHT"
          class="game-canvas"
        />
        <div
          v-if="gameState !== 'playing'"
          class="game-overlay"
          @click="gameState === 'clear' ? nextStage() : startGame()"
        >
          <div class="overlay-content">
            <p class="overlay-text">{{ displayMessage }}</p>
            <p v-if="gameState === 'gameover'" class="overlay-score">
              SCORE: {{ score.toLocaleString() }}
            </p>
            <p v-if="gameState === 'clear'" class="overlay-score">
              +1000 BONUS
            </p>
            <p v-if="gameState === 'ready'" class="overlay-hint">
              Arrow Keys / WASD to Move<br />
              Z / J to Shoot<br /><br />
              Click to Start
            </p>
            <p v-else class="overlay-hint">
              Click to {{ gameState === "clear" ? "Next Stage" : "Retry" }}
            </p>
          </div>
        </div>
      </div>

      <div class="game-controls">
        <div class="control-group">
          <span class="control-key">WASD</span>
          <span class="control-label">Move</span>
        </div>
        <div class="control-group">
          <span class="control-key">SPACE</span>
          <span class="control-label">Jump</span>
        </div>
        <div class="control-group">
          <span class="control-key">Z / J</span>
          <span class="control-label">Shoot</span>
        </div>
      </div>

      <div class="game-actions">
        <button type="button" class="back-button" @click="goBack">
          &#x2190; EXIT TO MAINFRAME
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.game-shell {
  min-height: 100vh;
  background: linear-gradient(135deg, #0a0a12 0%, #0d1520 50%, #0a1018 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #e5ecff;
  padding: 1rem;
  font-family: "Courier New", monospace;
  position: relative;
  overflow: hidden;
}

/* Background rain */
.bg-rain {
  position: absolute;
  inset: 0;
  overflow: hidden;
  pointer-events: none;
}

.rain-drop {
  position: absolute;
  top: -100px;
  width: 2px;
  height: 80px;
  background: linear-gradient(
    to bottom,
    transparent,
    rgba(0, 255, 255, 0.3),
    transparent
  );
  animation: rain-fall 1.5s linear infinite;
}

@keyframes rain-fall {
  0% {
    transform: translateY(-100px);
    opacity: 0;
  }
  10% {
    opacity: 1;
  }
  90% {
    opacity: 1;
  }
  100% {
    transform: translateY(100vh);
    opacity: 0;
  }
}

.game-container {
  max-width: 520px;
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 1rem;
  position: relative;
  z-index: 1;
}

.game-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  padding: 0 0.5rem;
}

.header-left {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.eyebrow {
  margin: 0;
  text-transform: uppercase;
  letter-spacing: 0.35em;
  color: #00ffff;
  font-size: 0.7rem;
  text-shadow: 0 0 10px #00ffff;
}

h1 {
  margin: 0;
  font-size: 1.5rem;
  background: linear-gradient(120deg, #00ffff, #ff00ff);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  text-shadow: none;
}

.stat {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.25rem;
}

.stat-label {
  font-size: 0.65rem;
  color: #00ffff;
  text-transform: uppercase;
  letter-spacing: 0.15em;
}

.stat-value {
  font-size: 1.25rem;
  font-weight: 700;
  color: #e5ecff;
  text-shadow: 0 0 10px currentColor;
}

.stat-value.highlight {
  color: #ff00ff;
}

.canvas-wrapper {
  position: relative;
  aspect-ratio: 480 / 320;
  width: 100%;
  max-width: 480px;
  margin: 0 auto;
  border: 2px solid rgba(0, 255, 255, 0.3);
  border-radius: 0.5rem;
  overflow: hidden;
  box-shadow:
    0 0 30px rgba(0, 255, 255, 0.2),
    inset 0 0 60px rgba(0, 0, 0, 0.5);
  image-rendering: pixelated;
}

.game-canvas {
  width: 100%;
  height: 100%;
  display: block;
  image-rendering: pixelated;
  image-rendering: crisp-edges;
}

.game-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: rgba(0, 10, 20, 0.9);
  cursor: pointer;
  transition: background 0.2s;
}

.game-overlay:hover {
  background: rgba(0, 10, 20, 0.85);
}

.overlay-content {
  text-align: center;
}

.overlay-text {
  margin: 0;
  font-size: 1.8rem;
  font-weight: 700;
  color: #00ffff;
  text-shadow: 0 0 20px #00ffff;
  animation: pulse-text 1.5s ease-in-out infinite;
}

.overlay-score {
  margin: 1rem 0 0;
  font-size: 1.2rem;
  color: #ff00ff;
  text-shadow: 0 0 15px #ff00ff;
}

@keyframes pulse-text {
  0%,
  100% {
    opacity: 1;
    text-shadow: 0 0 20px #00ffff;
  }
  50% {
    opacity: 0.7;
    text-shadow:
      0 0 40px #00ffff,
      0 0 60px #00ffff;
  }
}

.overlay-hint {
  margin: 1.5rem 0 0;
  font-size: 0.85rem;
  color: #9bbad4;
  line-height: 1.6;
}

.game-controls {
  display: flex;
  justify-content: center;
  gap: 1.5rem;
  flex-wrap: wrap;
}

.control-group {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.25rem;
}

.control-key {
  padding: 0.25rem 0.5rem;
  background: rgba(0, 255, 255, 0.1);
  border: 1px solid rgba(0, 255, 255, 0.3);
  border-radius: 0.25rem;
  font-size: 0.75rem;
  color: #00ffff;
}

.control-label {
  font-size: 0.65rem;
  color: #9bbad4;
  text-transform: uppercase;
  letter-spacing: 0.1em;
}

.game-actions {
  display: flex;
  justify-content: center;
}

.back-button {
  border: 1px solid rgba(0, 255, 255, 0.3);
  border-radius: 0.5rem;
  padding: 0.75rem 1.5rem;
  cursor: pointer;
  font-weight: 600;
  font-family: inherit;
  background: transparent;
  color: #00ffff;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  font-size: 0.85rem;
  transition: all 0.2s;
}

.back-button:hover {
  background: rgba(0, 255, 255, 0.1);
  border-color: rgba(0, 255, 255, 0.5);
  box-shadow: 0 0 15px rgba(0, 255, 255, 0.2);
}

/* Scanline overlay */
.canvas-wrapper::after {
  content: "";
  position: absolute;
  inset: 0;
  background: repeating-linear-gradient(
    0deg,
    rgba(0, 0, 0, 0.1),
    rgba(0, 0, 0, 0.1) 1px,
    transparent 1px,
    transparent 2px
  );
  pointer-events: none;
}

@media (max-width: 520px) {
  .game-shell {
    padding: 0.5rem;
  }

  h1 {
    font-size: 1.2rem;
  }

  .stat-value {
    font-size: 1rem;
  }

  .overlay-text {
    font-size: 1.4rem;
  }

  .overlay-hint {
    font-size: 0.75rem;
  }

  .game-controls {
    gap: 1rem;
  }

  .control-key {
    font-size: 0.65rem;
    padding: 0.2rem 0.4rem;
  }
}
</style>
