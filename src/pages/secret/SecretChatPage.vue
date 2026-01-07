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
const gameState = ref<"ready" | "playing" | "gameover">("ready");
const timeLeft = ref(30);

interface Target {
  x: number;
  y: number;
  radius: number;
  speed: number;
  dx: number;
  dy: number;
  color: string;
}

const targets = ref<Target[]>([]);
let animationId: number | null = null;
let timerInterval: ReturnType<typeof setInterval> | null = null;

const COLORS = ["#5ee1e6", "#5c7cfa", "#7ef9ff", "#a78bfa", "#34d399"];

function createTarget(): Target {
  const radius = 20 + Math.random() * 15;
  return {
    x: radius + Math.random() * (400 - radius * 2),
    y: radius + Math.random() * (400 - radius * 2),
    radius,
    speed: 1 + score.value * 0.1,
    dx: (Math.random() - 0.5) * 4,
    dy: (Math.random() - 0.5) * 4,
    color: COLORS[Math.floor(Math.random() * COLORS.length)] ?? "#5ee1e6",
  };
}

function startGame() {
  score.value = 0;
  timeLeft.value = 30;
  gameState.value = "playing";
  targets.value = [createTarget(), createTarget(), createTarget()];

  timerInterval = setInterval(() => {
    timeLeft.value--;
    if (timeLeft.value <= 0) {
      endGame();
    }
  }, 1000);

  gameLoop();
}

function endGame() {
  gameState.value = "gameover";
  if (score.value > highScore.value) {
    highScore.value = score.value;
    localStorage.setItem(
      `${appName}_secret_highscore`,
      String(highScore.value),
    );
  }
  if (animationId) {
    cancelAnimationFrame(animationId);
    animationId = null;
  }
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
}

function gameLoop() {
  if (gameState.value !== "playing") return;

  const canvas = canvasRef.value;
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  // Clear
  ctx.fillStyle = "#0c0f1c";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Update and draw targets
  targets.value.forEach((target) => {
    target.x += target.dx * target.speed;
    target.y += target.dy * target.speed;

    // Bounce off walls
    if (
      target.x - target.radius < 0 ||
      target.x + target.radius > canvas.width
    ) {
      target.dx *= -1;
      target.x = Math.max(
        target.radius,
        Math.min(canvas.width - target.radius, target.x),
      );
    }
    if (
      target.y - target.radius < 0 ||
      target.y + target.radius > canvas.height
    ) {
      target.dy *= -1;
      target.y = Math.max(
        target.radius,
        Math.min(canvas.height - target.radius, target.y),
      );
    }

    // Draw target
    ctx.beginPath();
    ctx.arc(target.x, target.y, target.radius, 0, Math.PI * 2);
    ctx.fillStyle = target.color;
    ctx.fill();
    ctx.closePath();

    // Draw inner circle
    ctx.beginPath();
    ctx.arc(target.x, target.y, target.radius * 0.4, 0, Math.PI * 2);
    ctx.fillStyle = "#0c0f1c";
    ctx.fill();
    ctx.closePath();
  });

  animationId = requestAnimationFrame(gameLoop);
}

function handleCanvasClick(event: MouseEvent) {
  if (gameState.value !== "playing") return;

  const canvas = canvasRef.value;
  if (!canvas) return;

  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  const x = (event.clientX - rect.left) * scaleX;
  const y = (event.clientY - rect.top) * scaleY;

  // Check if clicked on any target
  for (let i = targets.value.length - 1; i >= 0; i--) {
    const target = targets.value[i];
    if (!target) continue;
    const dist = Math.sqrt((x - target.x) ** 2 + (y - target.y) ** 2);
    if (dist <= target.radius) {
      score.value += Math.round((30 / target.radius) * 10);
      targets.value.splice(i, 1);
      targets.value.push(createTarget());

      // Add more targets as score increases
      if (
        score.value > 0 &&
        score.value % 100 === 0 &&
        targets.value.length < 8
      ) {
        targets.value.push(createTarget());
      }
      return;
    }
  }
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
  const saved = localStorage.getItem(`${appName}_secret_highscore`);
  if (saved) {
    highScore.value = parseInt(saved, 10) || 0;
  }
});

onBeforeUnmount(() => {
  if (animationId) {
    cancelAnimationFrame(animationId);
  }
  if (timerInterval) {
    clearInterval(timerInterval);
  }
});

const displayMessage = computed(() => {
  if (gameState.value === "ready") return "クリックしてスタート";
  if (gameState.value === "gameover")
    return `ゲームオーバー！スコア: ${score.value}`;
  return "";
});
</script>

<template>
  <div class="game-shell">
    <div class="game-card">
      <header class="game-header">
        <p class="eyebrow">Secret Game</p>
        <h1>Target Hunter</h1>
        <p class="subtitle">動く的をクリックしてスコアを稼ごう！</p>
      </header>

      <div class="game-stats">
        <div class="stat">
          <span class="stat-label">スコア</span>
          <span class="stat-value">{{ score }}</span>
        </div>
        <div class="stat">
          <span class="stat-label">残り時間</span>
          <span class="stat-value" :class="{ warning: timeLeft <= 10 }"
            >{{ timeLeft }}s</span
          >
        </div>
        <div class="stat">
          <span class="stat-label">ハイスコア</span>
          <span class="stat-value highlight">{{ highScore }}</span>
        </div>
      </div>

      <div class="game-container">
        <canvas
          ref="canvasRef"
          width="400"
          height="400"
          class="game-canvas"
          @click="handleCanvasClick"
        />
        <div
          v-if="gameState !== 'playing'"
          class="game-overlay"
          @click="startGame"
        >
          <p class="overlay-text">{{ displayMessage }}</p>
          <p v-if="gameState === 'gameover'" class="overlay-hint">
            クリックで再挑戦
          </p>
        </div>
      </div>

      <div class="game-actions">
        <button type="button" class="back-button" @click="goBack">
          マイページへ戻る
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.game-shell {
  min-height: 100vh;
  background: radial-gradient(circle at top, #1b1f38, #0c0f1c);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #e5ecff;
  padding: 2rem;
}

.game-card {
  max-width: 520px;
  width: 100%;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 1.5rem;
  padding: 2rem;
  background: rgba(7, 11, 25, 0.85);
  backdrop-filter: blur(12px);
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.game-header {
  text-align: center;
}

.eyebrow {
  margin: 0;
  text-transform: uppercase;
  letter-spacing: 0.35em;
  color: #7ef9ff;
  font-size: 0.75rem;
}

h1 {
  margin: 0.5rem 0 0;
  font-size: 1.75rem;
  background: linear-gradient(120deg, #6ff3ff, #506bff);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.subtitle {
  margin: 0.5rem 0 0;
  color: #9bbad4;
  font-size: 0.875rem;
}

.game-stats {
  display: flex;
  justify-content: space-around;
  gap: 1rem;
}

.stat {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.25rem;
}

.stat-label {
  font-size: 0.75rem;
  color: #9bbad4;
  text-transform: uppercase;
  letter-spacing: 0.1em;
}

.stat-value {
  font-size: 1.5rem;
  font-weight: 700;
  color: #e5ecff;
}

.stat-value.warning {
  color: #ff7a7a;
  animation: pulse 0.5s ease-in-out infinite;
}

.stat-value.highlight {
  color: #7ef9ff;
}

@keyframes pulse {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.6;
  }
}

.game-container {
  position: relative;
  aspect-ratio: 1;
  width: 100%;
  max-width: 400px;
  margin: 0 auto;
}

.game-canvas {
  width: 100%;
  height: 100%;
  border-radius: 1rem;
  border: 2px solid rgba(94, 225, 230, 0.3);
  cursor: crosshair;
}

.game-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: rgba(12, 15, 28, 0.9);
  border-radius: 1rem;
  cursor: pointer;
  transition: background 0.2s;
}

.game-overlay:hover {
  background: rgba(12, 15, 28, 0.8);
}

.overlay-text {
  margin: 0;
  font-size: 1.25rem;
  font-weight: 600;
  color: #7ef9ff;
}

.overlay-hint {
  margin: 0.5rem 0 0;
  font-size: 0.875rem;
  color: #9bbad4;
}

.game-actions {
  display: flex;
  justify-content: center;
}

.back-button {
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 0.85rem;
  padding: 0.75rem 1.5rem;
  cursor: pointer;
  font-weight: 600;
  background: transparent;
  color: #9bbad4;
  transition: all 0.2s;
}

.back-button:hover {
  background: rgba(255, 255, 255, 0.05);
  border-color: rgba(255, 255, 255, 0.3);
  color: #e5ecff;
}
</style>
