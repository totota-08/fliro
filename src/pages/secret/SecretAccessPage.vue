<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, nextTick } from "vue";
import { useRouter } from "vue-router";
import { ROUTE_NAMES } from "@/constants/routes";
import { grantSecretAccess } from "@/services/secretAccess";

const router = useRouter();
const command = ref("");
const terminalLines = ref<
  {
    text: string;
    type: "system" | "user" | "error" | "success" | "warning" | "highlight";
  }[]
>([]);
const inputRef = ref<HTMLInputElement | null>(null);
const canvasRef = ref<HTMLCanvasElement | null>(null);
const showSuccessAnimation = ref(false);
const isBooting = ref(true);
const audioContext = ref<AudioContext | null>(null);
const accessCode = ref("");
const passwordMode = ref(false);
const passwordAttempts = ref(0);

// Cyberpunk rain effect
let rainAnimationId: number | null = null;
const rainDrops: {
  x: number;
  y: number;
  speed: number;
  char: string;
  opacity: number;
  size: number;
}[] = [];
const RAIN_CHARS =
  "アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲン01234567890<>{}[]|\\/:;$#@!%^&*";

// Generate random access code
function generateAccessCode(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

function initRain() {
  const canvas = canvasRef.value;
  if (!canvas) return;

  const cols = Math.floor(canvas.width / 16);
  rainDrops.length = 0;

  for (let i = 0; i < cols; i++) {
    rainDrops.push({
      x: i * 16,
      y: Math.random() * canvas.height,
      speed: 3 + Math.random() * 6,
      char: RAIN_CHARS[Math.floor(Math.random() * RAIN_CHARS.length)] || "0",
      opacity: 0.1 + Math.random() * 0.6,
      size: 12 + Math.floor(Math.random() * 6),
    });
  }
}

function drawRain() {
  const canvas = canvasRef.value;
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  // Darker trail for more dramatic effect
  ctx.fillStyle = "rgba(0, 8, 12, 0.08)";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  rainDrops.forEach((drop) => {
    // Cyan color with varying opacity
    ctx.font = `${drop.size}px monospace`;
    ctx.fillStyle = `rgba(0, 255, 255, ${drop.opacity * 0.7})`;
    ctx.shadowColor = "#00ffff";
    ctx.shadowBlur = drop.opacity * 15;
    ctx.fillText(drop.char, drop.x, drop.y);

    // Bright head
    if (Math.random() > 0.7) {
      ctx.fillStyle = `rgba(255, 255, 255, ${drop.opacity})`;
      ctx.fillText(drop.char, drop.x, drop.y);
    }

    drop.y += drop.speed;

    if (drop.y > canvas.height) {
      drop.y = -20;
      drop.char =
        RAIN_CHARS[Math.floor(Math.random() * RAIN_CHARS.length)] || "0";
      drop.opacity = 0.1 + Math.random() * 0.6;
      drop.speed = 3 + Math.random() * 6;
    }

    if (Math.random() > 0.96) {
      drop.char =
        RAIN_CHARS[Math.floor(Math.random() * RAIN_CHARS.length)] || "0";
    }
  });

  ctx.shadowBlur = 0;
  rainAnimationId = requestAnimationFrame(drawRain);
}

function resizeCanvas() {
  const canvas = canvasRef.value;
  if (!canvas) return;
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  initRain();
}

// Cyberpunk ambient sound
function createAmbientSound() {
  try {
    audioContext.value = new (
      window.AudioContext || (window as any).webkitAudioContext
    )();
    const ctx = audioContext.value;

    // Deep bass drone
    const bassOsc = ctx.createOscillator();
    const bassGain = ctx.createGain();
    bassOsc.type = "sine";
    bassOsc.frequency.setValueAtTime(40, ctx.currentTime);
    bassGain.gain.setValueAtTime(0.08, ctx.currentTime);
    bassOsc.connect(bassGain);
    bassGain.connect(ctx.destination);
    bassOsc.start();

    // Rain noise
    const bufferSize = 2 * ctx.sampleRate;
    const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);

    let lastOut = 0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      output[i] = (lastOut + 0.02 * white) / 1.02;
      lastOut = output[i] ?? 0;
      output[i]! *= 0.25;
    }

    const whiteNoise = ctx.createBufferSource();
    whiteNoise.buffer = noiseBuffer;
    whiteNoise.loop = true;

    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.12, ctx.currentTime);

    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(300, ctx.currentTime);

    whiteNoise.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(ctx.destination);
    whiteNoise.start(0);

    // Occasional synth pings
    setInterval(() => {
      if (Math.random() > 0.6 && audioContext.value) {
        const osc = audioContext.value.createOscillator();
        const oscGain = audioContext.value.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(
          400 + Math.random() * 1200,
          audioContext.value.currentTime,
        );
        oscGain.gain.setValueAtTime(0.015, audioContext.value.currentTime);
        oscGain.gain.exponentialRampToValueAtTime(
          0.001,
          audioContext.value.currentTime + 0.4,
        );
        osc.connect(oscGain);
        oscGain.connect(audioContext.value.destination);
        osc.start();
        osc.stop(audioContext.value.currentTime + 0.4);
      }
    }, 800);
  } catch {
    // Audio not supported
  }
}

function playTypingSound() {
  if (!audioContext.value) return;
  const ctx = audioContext.value;

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "square";
  osc.frequency.setValueAtTime(800 + Math.random() * 400, ctx.currentTime);
  gain.gain.setValueAtTime(0.02, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.03);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start();
  osc.stop(ctx.currentTime + 0.03);
}

function playSuccessSound() {
  if (!audioContext.value) return;
  const ctx = audioContext.value;

  // Epic arpeggio
  const notes = [261.63, 329.63, 392.0, 523.25, 659.25, 783.99, 1046.5];

  notes.forEach((freq, i) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(freq, ctx.currentTime + i * 0.08);
    gain.gain.setValueAtTime(0.12, ctx.currentTime + i * 0.08);
    gain.gain.exponentialRampToValueAtTime(
      0.001,
      ctx.currentTime + i * 0.08 + 0.4,
    );
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(ctx.currentTime + i * 0.08);
    osc.stop(ctx.currentTime + i * 0.08 + 0.4);
  });

  // Bass drop
  setTimeout(() => {
    if (!audioContext.value) return;
    const bassOsc = audioContext.value.createOscillator();
    const bassGain = audioContext.value.createGain();
    bassOsc.type = "sawtooth";
    bassOsc.frequency.setValueAtTime(80, audioContext.value.currentTime);
    bassOsc.frequency.exponentialRampToValueAtTime(
      40,
      audioContext.value.currentTime + 0.5,
    );
    bassGain.gain.setValueAtTime(0.2, audioContext.value.currentTime);
    bassGain.gain.exponentialRampToValueAtTime(
      0.001,
      audioContext.value.currentTime + 0.5,
    );
    bassOsc.connect(bassGain);
    bassGain.connect(audioContext.value.destination);
    bassOsc.start();
    bassOsc.stop(audioContext.value.currentTime + 0.5);
  }, 500);
}

function playErrorSound() {
  if (!audioContext.value) return;
  const ctx = audioContext.value;

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "sawtooth";
  osc.frequency.setValueAtTime(200, ctx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(50, ctx.currentTime + 0.25);
  gain.gain.setValueAtTime(0.12, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start();
  osc.stop(ctx.currentTime + 0.25);
}

async function bootSequence() {
  accessCode.value = generateAccessCode();

  const bootMessages: {
    text: string;
    type: "system" | "warning" | "highlight" | "success";
    delay?: number;
  }[] = [
    { text: "CYBERDECK OS v2.077", type: "highlight", delay: 100 },
    {
      text: "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
      type: "system",
      delay: 50,
    },
    { text: "", type: "system", delay: 30 },
    { text: "INITIALIZING NEURAL INTERFACE...", type: "system", delay: 120 },
    { text: "[OK] Quantum processor online", type: "system", delay: 80 },
    { text: "[OK] Neural link established", type: "system", delay: 80 },
    { text: "[OK] Encryption protocols active", type: "system", delay: 80 },
    { text: "[OK] Firewall bypassed", type: "system", delay: 80 },
    { text: "", type: "system", delay: 50 },
    {
      text: "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
      type: "system",
      delay: 50,
    },
    { text: "⚠ WARNING: RESTRICTED ACCESS ZONE", type: "warning", delay: 150 },
    {
      text: "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
      type: "system",
      delay: 50,
    },
    { text: "", type: "system", delay: 100 },
    {
      text: `ACCESS CODE: [ ${accessCode.value} ]`,
      type: "highlight",
      delay: 200,
    },
    { text: "", type: "system", delay: 50 },
    { text: "Enter access code to continue...", type: "system", delay: 100 },
    { text: "Type 'help' for available commands", type: "system", delay: 80 },
    { text: "", type: "system", delay: 50 },
  ];

  for (const msg of bootMessages) {
    terminalLines.value.push({ text: msg.text, type: msg.type });
    playTypingSound();
    await new Promise((r) => setTimeout(r, msg.delay || 80));
  }

  isBooting.value = false;
  await nextTick();
  inputRef.value?.focus();
}

function handleSubmit() {
  const value = command.value.trim();
  const lowerValue = value.toLowerCase();
  terminalLines.value.push({
    text: `> ${passwordMode.value ? "*".repeat(value.length) : value}`,
    type: "user",
  });
  command.value = "";

  if (passwordMode.value) {
    if (value.toUpperCase() === accessCode.value) {
      terminalLines.value.push({ text: "", type: "system" });
      terminalLines.value.push({
        text: "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
        type: "system",
      });
      terminalLines.value.push({
        text: "▓▓▓ ACCESS GRANTED ▓▓▓",
        type: "success",
      });
      terminalLines.value.push({
        text: "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
        type: "system",
      });
      terminalLines.value.push({ text: "", type: "system" });
      terminalLines.value.push({
        text: "Initiating neural link synchronization...",
        type: "system",
      });
      playSuccessSound();

      showSuccessAnimation.value = true;

      setTimeout(() => {
        grantSecretAccess("chat");
        router.push({ name: ROUTE_NAMES.secretChat });
      }, 3500);
    } else {
      passwordAttempts.value++;
      playErrorSound();
      terminalLines.value.push({
        text: `ACCESS DENIED - Invalid code (Attempt ${passwordAttempts.value}/3)`,
        type: "error",
      });

      if (passwordAttempts.value >= 3) {
        terminalLines.value.push({ text: "", type: "system" });
        terminalLines.value.push({
          text: "⚠ SECURITY LOCKOUT - Regenerating access code...",
          type: "warning",
        });
        accessCode.value = generateAccessCode();
        passwordAttempts.value = 0;
        setTimeout(() => {
          terminalLines.value.push({
            text: `NEW ACCESS CODE: [ ${accessCode.value} ]`,
            type: "highlight",
          });
        }, 1000);
      }

      passwordMode.value = false;
    }
    return;
  }

  if (lowerValue === "help") {
    terminalLines.value.push({ text: "", type: "system" });
    terminalLines.value.push({
      text: "╔════════════════════════════════════════════════╗",
      type: "system",
    });
    terminalLines.value.push({
      text: "║ AVAILABLE COMMANDS                             ║",
      type: "system",
    });
    terminalLines.value.push({
      text: "╠════════════════════════════════════════════════╣",
      type: "system",
    });
    terminalLines.value.push({
      text: "║ help    - Display this message                 ║",
      type: "system",
    });
    terminalLines.value.push({
      text: "║ clear   - Clear terminal screen                ║",
      type: "system",
    });
    terminalLines.value.push({
      text: "║ access  - Enter access code                    ║",
      type: "system",
    });
    terminalLines.value.push({
      text: "║ code    - Display current access code          ║",
      type: "system",
    });
    terminalLines.value.push({
      text: "║ exit    - Return to main system                ║",
      type: "system",
    });
    terminalLines.value.push({
      text: "╚════════════════════════════════════════════════╝",
      type: "system",
    });
    terminalLines.value.push({ text: "", type: "system" });
    return;
  }

  if (lowerValue === "clear" || lowerValue === "cls") {
    terminalLines.value = [];
    return;
  }

  if (lowerValue === "exit" || lowerValue === "quit") {
    router.push({ name: ROUTE_NAMES.myPage });
    return;
  }

  if (lowerValue === "code") {
    terminalLines.value.push({ text: "", type: "system" });
    terminalLines.value.push({
      text: `ACCESS CODE: [ ${accessCode.value} ]`,
      type: "highlight",
    });
    terminalLines.value.push({ text: "", type: "system" });
    return;
  }

  if (lowerValue === "access") {
    terminalLines.value.push({ text: "", type: "system" });
    terminalLines.value.push({ text: "Enter access code:", type: "system" });
    passwordMode.value = true;
    return;
  }

  // Direct code entry
  if (value.toUpperCase() === accessCode.value) {
    terminalLines.value.push({ text: "", type: "system" });
    terminalLines.value.push({
      text: "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
      type: "system",
    });
    terminalLines.value.push({
      text: "▓▓▓ ACCESS GRANTED ▓▓▓",
      type: "success",
    });
    terminalLines.value.push({
      text: "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
      type: "system",
    });
    terminalLines.value.push({ text: "", type: "system" });
    terminalLines.value.push({
      text: "Initiating neural link synchronization...",
      type: "system",
    });
    playSuccessSound();

    showSuccessAnimation.value = true;

    setTimeout(() => {
      grantSecretAccess("chat");
      router.push({ name: ROUTE_NAMES.secretChat });
    }, 3500);
    return;
  }

  playErrorSound();
  terminalLines.value.push({
    text: `Command not found: ${value}`,
    type: "error",
  });
  terminalLines.value.push({
    text: "Type 'help' for available commands",
    type: "system",
  });
}

function focusInput() {
  if (!isBooting.value) {
    inputRef.value?.focus();
  }
}

onMounted(async () => {
  resizeCanvas();
  window.addEventListener("resize", resizeCanvas);

  // Start rain animation
  drawRain();

  // Start ambient sound on first interaction
  const startAudio = () => {
    createAmbientSound();
    document.removeEventListener("click", startAudio);
    document.removeEventListener("keydown", startAudio);
  };
  document.addEventListener("click", startAudio);
  document.addEventListener("keydown", startAudio);

  // Boot sequence
  await bootSequence();
});

onBeforeUnmount(() => {
  window.removeEventListener("resize", resizeCanvas);
  if (rainAnimationId) {
    cancelAnimationFrame(rainAnimationId);
  }
  if (audioContext.value) {
    audioContext.value.close();
  }
});
</script>

<template>
  <div class="terminal-shell" @click="focusInput">
    <!-- Cyberpunk Rain Canvas -->
    <canvas ref="canvasRef" class="rain-canvas" />

    <!-- CRT Effects -->
    <div class="crt-overlay" />
    <div class="crt-flicker" />

    <!-- Success Animation -->
    <Transition name="success">
      <div v-if="showSuccessAnimation" class="success-overlay">
        <div class="success-content">
          <div class="hex-grid">
            <div
              v-for="i in 12"
              :key="i"
              class="hex"
              :style="{ animationDelay: `${i * 0.1}s` }"
            />
          </div>
          <div class="glitch-container">
            <div class="glitch-text" data-text="ACCESS GRANTED">
              ACCESS GRANTED
            </div>
          </div>
          <div class="neural-bars">
            <div
              v-for="i in 5"
              :key="i"
              class="neural-bar"
              :style="{ animationDelay: `${i * 0.15}s` }"
            />
          </div>
          <p class="success-subtitle">NEURAL LINK SYNCHRONIZED</p>
          <div class="loading-bar">
            <div class="loading-progress" />
          </div>
        </div>
      </div>
    </Transition>

    <!-- Terminal Content -->
    <div class="terminal-container">
      <div class="terminal-header">
        <span class="header-dot header-dot--red" />
        <span class="header-dot header-dot--yellow" />
        <span class="header-dot header-dot--green" />
        <span class="header-title">CYBERDECK TERMINAL v2.077</span>
      </div>

      <div class="terminal-output">
        <p
          v-for="(line, index) in terminalLines"
          :key="index"
          class="terminal-line"
          :class="`terminal-line--${line.type}`"
        >
          {{ line.text }}
        </p>
      </div>

      <form
        v-if="!isBooting && !showSuccessAnimation"
        class="terminal-input"
        @submit.prevent="handleSubmit"
      >
        <span class="prompt">
          <span class="prompt-user">GHOST</span>
          <span class="prompt-at">@</span>
          <span class="prompt-host">CYBERDECK</span>
          <span class="prompt-arrow">:~$</span>
        </span>
        <input
          ref="inputRef"
          v-model="command"
          :type="passwordMode ? 'password' : 'text'"
          class="input-field"
          autocomplete="off"
          spellcheck="false"
        />
        <span class="cursor" />
      </form>
    </div>
  </div>
</template>

<style scoped>
.terminal-shell {
  position: fixed;
  inset: 0;
  background: #000508;
  overflow: hidden;
  font-family: "Courier New", "Lucida Console", Monaco, monospace;
  cursor: text;
}

/* Cyberpunk Rain Canvas */
.rain-canvas {
  position: absolute;
  inset: 0;
  opacity: 0.5;
}

/* CRT Effects */
.crt-overlay {
  position: absolute;
  inset: 0;
  background: repeating-linear-gradient(
    0deg,
    rgba(0, 0, 0, 0.2),
    rgba(0, 0, 0, 0.2) 1px,
    transparent 1px,
    transparent 3px
  );
  pointer-events: none;
  z-index: 10;
}

.crt-overlay::before {
  content: "";
  position: absolute;
  inset: 0;
  background: radial-gradient(
    ellipse at center,
    transparent 0%,
    rgba(0, 0, 0, 0.4) 100%
  );
}

.crt-flicker {
  position: absolute;
  inset: 0;
  background: rgba(0, 255, 255, 0.02);
  pointer-events: none;
  z-index: 11;
  animation: flicker 0.1s infinite;
}

@keyframes flicker {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.95;
  }
}

/* Terminal Container */
.terminal-container {
  position: relative;
  z-index: 5;
  height: 100%;
  padding: 1rem;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.terminal-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1rem;
  background: rgba(0, 20, 30, 0.9);
  border: 1px solid rgba(0, 255, 255, 0.2);
  border-radius: 0.5rem 0.5rem 0 0;
  margin-bottom: -1px;
}

.header-dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
}

.header-dot--red {
  background: #ff5f56;
}
.header-dot--yellow {
  background: #ffbd2e;
}
.header-dot--green {
  background: #27c93f;
}

.header-title {
  margin-left: 1rem;
  font-size: 0.75rem;
  color: rgba(0, 255, 255, 0.7);
  letter-spacing: 0.1em;
}

.terminal-output {
  flex: 1;
  overflow-y: auto;
  padding: 1.5rem;
  background: rgba(0, 10, 15, 0.95);
  border: 1px solid rgba(0, 255, 255, 0.2);
  border-top: none;
}

.terminal-output::-webkit-scrollbar {
  width: 8px;
}

.terminal-output::-webkit-scrollbar-track {
  background: rgba(0, 255, 255, 0.05);
}

.terminal-output::-webkit-scrollbar-thumb {
  background: rgba(0, 255, 255, 0.3);
}

.terminal-line {
  margin: 0;
  padding: 0.15rem 0;
  font-size: 0.9rem;
  line-height: 1.5;
  white-space: pre-wrap;
  word-break: break-all;
}

.terminal-line--system {
  color: #00d4d4;
  text-shadow: 0 0 8px rgba(0, 212, 212, 0.5);
}

.terminal-line--user {
  color: #00ffff;
  text-shadow: 0 0 10px rgba(0, 255, 255, 0.6);
}

.terminal-line--error {
  color: #ff4444;
  text-shadow: 0 0 10px rgba(255, 68, 68, 0.6);
}

.terminal-line--warning {
  color: #ffaa00;
  text-shadow: 0 0 10px rgba(255, 170, 0, 0.6);
  animation: pulse-warning 1s ease-in-out infinite;
}

.terminal-line--highlight {
  color: #00ffff;
  font-weight: bold;
  text-shadow:
    0 0 15px rgba(0, 255, 255, 0.8),
    0 0 30px rgba(0, 255, 255, 0.4);
  animation: glow-pulse 2s ease-in-out infinite;
}

.terminal-line--success {
  color: #00ff88;
  font-weight: bold;
  font-size: 1.1rem;
  text-shadow:
    0 0 20px rgba(0, 255, 136, 0.8),
    0 0 40px rgba(0, 255, 136, 0.4);
  animation: success-glow 0.5s ease-in-out 3;
}

@keyframes pulse-warning {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.7;
  }
}

@keyframes glow-pulse {
  0%,
  100% {
    text-shadow:
      0 0 15px rgba(0, 255, 255, 0.8),
      0 0 30px rgba(0, 255, 255, 0.4);
  }
  50% {
    text-shadow:
      0 0 25px rgba(0, 255, 255, 1),
      0 0 50px rgba(0, 255, 255, 0.6);
  }
}

@keyframes success-glow {
  0%,
  100% {
    text-shadow: 0 0 20px rgba(0, 255, 136, 0.8);
  }
  50% {
    text-shadow:
      0 0 40px rgba(0, 255, 136, 1),
      0 0 80px rgba(0, 255, 136, 0.6);
  }
}

/* Terminal Input */
.terminal-input {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 1rem 1.5rem;
  background: rgba(0, 10, 15, 0.95);
  border: 1px solid rgba(0, 255, 255, 0.2);
  border-top: 1px solid rgba(0, 255, 255, 0.1);
  border-radius: 0 0 0.5rem 0.5rem;
}

.prompt {
  display: flex;
  white-space: nowrap;
  text-shadow: 0 0 10px currentColor;
}

.prompt-user {
  color: #ff00ff;
}

.prompt-at {
  color: #00ffff;
}

.prompt-host {
  color: #00ff88;
}

.prompt-arrow {
  color: #00ffff;
  margin-left: 0.25rem;
}

.input-field {
  flex: 1;
  background: transparent;
  border: none;
  outline: none;
  color: #00ffff;
  font-family: inherit;
  font-size: 0.9rem;
  caret-color: transparent;
  text-shadow: 0 0 10px rgba(0, 255, 255, 0.6);
}

.cursor {
  display: inline-block;
  width: 10px;
  height: 1.1rem;
  background: #00ffff;
  box-shadow: 0 0 10px #00ffff;
  animation: blink 0.8s step-end infinite;
}

@keyframes blink {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0;
  }
}

/* Success Animation */
.success-overlay {
  position: fixed;
  inset: 0;
  z-index: 100;
  background: rgba(0, 5, 10, 0.98);
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.success-content {
  text-align: center;
  position: relative;
  z-index: 2;
}

.hex-grid {
  position: absolute;
  inset: -100px;
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  align-items: center;
  gap: 20px;
  opacity: 0.3;
  animation: hex-rotate 20s linear infinite;
}

.hex {
  width: 60px;
  height: 60px;
  background: transparent;
  border: 2px solid #00ffff;
  clip-path: polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%);
  animation: hex-pulse 2s ease-in-out infinite;
}

@keyframes hex-rotate {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

@keyframes hex-pulse {
  0%,
  100% {
    opacity: 0.2;
    transform: scale(1);
  }
  50% {
    opacity: 0.5;
    transform: scale(1.1);
  }
}

.glitch-container {
  margin-bottom: 2rem;
}

.glitch-text {
  font-size: 3.5rem;
  font-weight: bold;
  color: #00ffff;
  text-shadow:
    0 0 20px #00ffff,
    0 0 40px #00ffff,
    0 0 80px #00ffff;
  position: relative;
  animation: glitch 0.3s infinite;
}

.glitch-text::before,
.glitch-text::after {
  content: attr(data-text);
  position: absolute;
  left: 0;
  top: 0;
  width: 100%;
  height: 100%;
}

.glitch-text::before {
  color: #ff00ff;
  animation: glitch-1 0.2s infinite;
  clip-path: polygon(0 0, 100% 0, 100% 45%, 0 45%);
}

.glitch-text::after {
  color: #00ff88;
  animation: glitch-2 0.2s infinite;
  clip-path: polygon(0 55%, 100% 55%, 100% 100%, 0 100%);
}

@keyframes glitch {
  0%,
  100% {
    transform: translate(0);
  }
  20% {
    transform: translate(-3px, 3px);
  }
  40% {
    transform: translate(-3px, -3px);
  }
  60% {
    transform: translate(3px, 3px);
  }
  80% {
    transform: translate(3px, -3px);
  }
}

@keyframes glitch-1 {
  0%,
  100% {
    transform: translate(0);
  }
  20% {
    transform: translate(3px, -3px);
  }
  40% {
    transform: translate(-3px, 3px);
  }
  60% {
    transform: translate(3px, -3px);
  }
  80% {
    transform: translate(-3px, 3px);
  }
}

@keyframes glitch-2 {
  0%,
  100% {
    transform: translate(0);
  }
  20% {
    transform: translate(-3px, 3px);
  }
  40% {
    transform: translate(3px, -3px);
  }
  60% {
    transform: translate(-3px, 3px);
  }
  80% {
    transform: translate(3px, -3px);
  }
}

.neural-bars {
  display: flex;
  justify-content: center;
  gap: 0.5rem;
  margin: 2rem 0;
}

.neural-bar {
  width: 80px;
  height: 6px;
  background: linear-gradient(90deg, transparent, #00ffff, transparent);
  animation: bar-pulse 0.8s ease-in-out infinite;
  box-shadow: 0 0 15px #00ffff;
}

@keyframes bar-pulse {
  0%,
  100% {
    opacity: 0.3;
    transform: scaleX(0.8);
  }
  50% {
    opacity: 1;
    transform: scaleX(1);
  }
}

.success-subtitle {
  color: #00ffff;
  font-size: 1.2rem;
  letter-spacing: 0.4em;
  text-shadow: 0 0 15px #00ffff;
  animation: fade-in 0.5s ease-out 0.5s both;
  margin-bottom: 2rem;
}

.loading-bar {
  width: 300px;
  height: 4px;
  background: rgba(0, 255, 255, 0.2);
  border-radius: 2px;
  margin: 0 auto;
  overflow: hidden;
}

.loading-progress {
  height: 100%;
  background: linear-gradient(90deg, #00ffff, #00ff88, #00ffff);
  animation: loading 3s ease-in-out forwards;
  box-shadow: 0 0 15px #00ffff;
}

@keyframes loading {
  0% {
    width: 0%;
  }
  100% {
    width: 100%;
  }
}

@keyframes fade-in {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* Success Transition */
.success-enter-active {
  animation: flash-in 0.4s ease-out;
}

.success-leave-active {
  animation: flash-out 0.3s ease-in;
}

@keyframes flash-in {
  0% {
    opacity: 0;
    background: rgba(0, 255, 255, 0.5);
  }
  50% {
    background: rgba(0, 255, 255, 0.2);
  }
  100% {
    opacity: 1;
    background: rgba(0, 5, 10, 0.98);
  }
}

@keyframes flash-out {
  to {
    opacity: 0;
  }
}

/* Mobile Responsive */
@media (max-width: 768px) {
  .terminal-container {
    padding: 0.5rem;
  }

  .terminal-header {
    padding: 0.5rem 0.75rem;
  }

  .header-title {
    font-size: 0.65rem;
  }

  .terminal-output {
    padding: 1rem;
  }

  .terminal-line {
    font-size: 0.8rem;
  }

  .terminal-input {
    padding: 0.75rem 1rem;
    flex-wrap: wrap;
  }

  .prompt {
    font-size: 0.75rem;
  }

  .input-field {
    font-size: 0.8rem;
  }

  .glitch-text {
    font-size: 1.8rem;
  }

  .success-subtitle {
    font-size: 0.9rem;
    letter-spacing: 0.2em;
  }

  .loading-bar {
    width: 200px;
  }
}
</style>
