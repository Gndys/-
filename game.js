const canvas = document.querySelector("#board");
const ctx = canvas.getContext("2d");
const scoreEl = document.querySelector("#score");
const bestEl = document.querySelector("#best");
const levelEl = document.querySelector("#level");
const comboEl = document.querySelector("#combo");
const shieldEl = document.querySelector("#shield");
const statusEl = document.querySelector("#status");
const pauseButton = document.querySelector("#pauseButton");
const restartButton = document.querySelector("#restartButton");
const stateOverlay = document.querySelector("#stateOverlay");
const overlayTitle = document.querySelector("#overlayTitle");
const overlayHint = document.querySelector("#overlayHint");
const directionButtons = document.querySelectorAll("[data-direction]");

const gridSize = 20;
const tileCount = canvas.width / gridSize;
const startSpeed = 132;
const minSpeed = 54;
const comboWindow = 46;
const spawnArea = { x: 10, y: 10, radius: 4 };

const directions = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

const itemTypes = {
  food: {
    label: "食物",
    points: 10,
    color: "#ff5f68",
    glow: "#ff5f68",
    ttl: Infinity,
  },
  bonus: {
    label: "奖励",
    points: 30,
    color: "#ffcf5a",
    glow: "#ff9f43",
    ttl: 85,
  },
  slow: {
    label: "减速",
    points: 6,
    color: "#5bebff",
    glow: "#5bebff",
    ttl: 95,
  },
  shield: {
    label: "护盾",
    points: 12,
    color: "#a66bff",
    glow: "#c7a0ff",
    ttl: 110,
  },
};

let snake;
let items;
let obstacles;
let effects;
let stats;
let direction;
let nextDirection;
let gameTimer;
let running;
let paused;
let gameOver;
let tickCount;
let speed;
let bestScore;
let bestCombo;

function readStoredNumber(key) {
  return Number(localStorage.getItem(key) || 0);
}

function saveStoredNumber(key, value) {
  localStorage.setItem(key, String(value));
}

function resetGame() {
  snake = [
    { x: 10, y: 10 },
    { x: 9, y: 10 },
    { x: 8, y: 10 },
  ];
  items = [];
  obstacles = [];
  effects = {
    particles: [],
    flash: 0,
    message: "",
    messageTicks: 0,
  };
  stats = {
    score: 0,
    level: 1,
    combo: 1,
    comboTicks: comboWindow,
    shield: 0,
    slowTicks: 0,
    foodEaten: 0,
  };
  direction = directions.right;
  nextDirection = directions.right;
  running = false;
  paused = false;
  gameOver = false;
  tickCount = 0;
  speed = startSpeed;
  pauseButton.textContent = "暂停";
  statusEl.textContent = "按方向键或 WASD 开始";
  spawnItem("food");
  syncHud();
  stopLoop();
  updateOverlay();
  draw();
}

function startLoop() {
  if (running || gameOver) return;
  running = true;
  paused = false;
  statusEl.textContent = "进行中";
  pauseButton.textContent = "暂停";
  updateOverlay();
  scheduleTick();
}

function stopLoop() {
  clearTimeout(gameTimer);
  gameTimer = undefined;
  running = false;
}

function scheduleTick() {
  clearTimeout(gameTimer);
  gameTimer = setTimeout(() => {
    update();
    draw();
    if (running) scheduleTick();
  }, speed);
}

function update() {
  tickCount += 1;
  updateEffects();
  updateItems();
  updateSnake();
  updateDifficulty();
  syncHud();
}

function updateSnake() {
  direction = nextDirection;

  const currentHead = snake[0];
  let nextHead = {
    x: currentHead.x + direction.x,
    y: currentHead.y + direction.y,
  };

  const wallHit = isWall(nextHead);
  if (wallHit && stats.shield > 0) {
    stats.shield -= 1;
    nextHead = wrapPoint(nextHead);
    triggerShieldBurst(nextHead);
  } else if (wallHit) {
    endGame("撞到边界");
    return;
  }

  const item = findItemAt(nextHead);
  const willGrow = Boolean(item);
  const bodyToCheck = willGrow ? snake : snake.slice(0, -1);

  if (bodyToCheck.some((part) => samePoint(part, nextHead))) {
    endGame("撞到自己");
    return;
  }

  if (isObstacle(nextHead)) {
    if (stats.shield > 0) {
      stats.shield -= 1;
      removeObstacle(nextHead);
      triggerShieldBurst(nextHead);
    } else {
      endGame("撞上障碍");
      return;
    }
  }

  snake.unshift(nextHead);

  if (item) {
    handleItemPickup(item);
  } else {
    snake.pop();
    stats.comboTicks -= 1;
    if (stats.comboTicks <= 0) resetCombo();
  }
}

function handleItemPickup(item) {
  const multiplier = stats.combo;
  const gained = itemTypes[item.type].points * multiplier;
  stats.score += gained;
  stats.foodEaten += item.type === "food" ? 1 : 0;
  stats.combo = Math.min(9, stats.combo + 1);
  stats.comboTicks = comboWindow;
  bestCombo = Math.max(bestCombo, stats.combo);
  saveStoredNumber("snakeBestCombo", bestCombo);

  if (item.type === "slow") {
    stats.slowTicks = 56;
    effects.message = "时间减速";
    effects.messageTicks = 28;
  }

  if (item.type === "shield") {
    stats.shield = Math.min(3, stats.shield + 1);
    effects.message = "护盾充能";
    effects.messageTicks = 28;
  }

  if (item.type === "bonus") {
    effects.message = `奖励 +${gained}`;
    effects.messageTicks = 28;
  }

  burstAt(item, itemTypes[item.type].glow, item.type === "bonus" ? 20 : 12);
  items = items.filter((candidate) => candidate !== item);
  ensureCoreItems();

  if (stats.score > bestScore) {
    bestScore = stats.score;
    saveStoredNumber("snakeBestScore", bestScore);
  }
}

function updateDifficulty() {
  const nextLevel = Math.floor(stats.score / 90) + 1;
  if (nextLevel !== stats.level) {
    stats.level = nextLevel;
    refreshObstacles();
    effects.message = `LEVEL ${stats.level}`;
    effects.messageTicks = 34;
  }

  const slowBonus = stats.slowTicks > 0 ? 26 : 0;
  stats.slowTicks = Math.max(0, stats.slowTicks - 1);
  speed = Math.max(minSpeed, startSpeed - (stats.level - 1) * 9 - Math.floor(stats.score / 250) * 5 + slowBonus);
}

function updateItems() {
  items.forEach((item) => {
    item.age += 1;
    if (Number.isFinite(item.ttl)) item.ttl -= 1;
  });
  items = items.filter((item) => item.ttl > 0 || item.type === "food");
  ensureCoreItems();
}

function ensureCoreItems() {
  if (!items.some((item) => item.type === "food")) spawnItem("food");
  if (tickCount > 0 && tickCount % 48 === 0 && !items.some((item) => item.type === "bonus")) spawnItem("bonus");
  if (tickCount > 0 && tickCount % 72 === 0 && !items.some((item) => item.type === "slow")) spawnItem("slow");
  if (tickCount > 0 && tickCount % 105 === 0 && !items.some((item) => item.type === "shield")) spawnItem("shield");
}

function updateEffects() {
  effects.flash = Math.max(0, effects.flash - 1);
  effects.messageTicks = Math.max(0, effects.messageTicks - 1);
  effects.particles.forEach((particle) => {
    particle.x += particle.vx;
    particle.y += particle.vy;
    particle.life -= 1;
    particle.size *= 0.96;
  });
  effects.particles = effects.particles.filter((particle) => particle.life > 0);
}

function resetCombo() {
  stats.combo = 1;
  stats.comboTicks = comboWindow;
}

function endGame(reason) {
  effects.flash = 12;
  stopLoop();
  gameOver = true;
  statusEl.textContent = `${reason}，按空格或重新开始`;
  updateOverlay(reason);
}

function updateOverlay(reason = "") {
  if (gameOver) {
    stateOverlay.classList.add("is-visible");
    overlayTitle.textContent = "游戏结束";
    overlayHint.textContent = reason ? `${reason}，空格再来一局` : "按空格或重新开始再来一局";
    return;
  }

  if (paused) {
    stateOverlay.classList.add("is-visible");
    overlayTitle.textContent = "已暂停";
    overlayHint.textContent = "按空格或点击继续";
    return;
  }

  if (!running) {
    stateOverlay.classList.add("is-visible");
    overlayTitle.textContent = "准备开始";
    overlayHint.textContent = "收集道具、维持连击、用护盾穿越一次危险";
    return;
  }

  stateOverlay.classList.remove("is-visible");
}

function syncHud() {
  scoreEl.textContent = String(stats.score);
  bestEl.textContent = String(bestScore);
  levelEl.textContent = String(stats.level);
  comboEl.textContent = `x${stats.combo}`;
  shieldEl.textContent = String(stats.shield);
}

function spawnItem(type) {
  const point = randomOpenPoint();
  if (!point) return;
  items.push({
    ...point,
    type,
    age: 0,
    ttl: itemTypes[type].ttl,
  });
}

function refreshObstacles() {
  obstacles = [];
  const count = Math.min(24, Math.max(0, stats.level - 1) * 3);
  for (let i = 0; i < count; i += 1) {
    const point = randomOpenPoint();
    if (point) obstacles.push(point);
  }
}

function randomOpenPoint() {
  for (let attempt = 0; attempt < 800; attempt += 1) {
    const point = {
      x: Math.floor(Math.random() * tileCount),
      y: Math.floor(Math.random() * tileCount),
    };
    if (isOpenPoint(point)) return point;
  }
  return null;
}

function isOpenPoint(point) {
  return (
    !isSpawnArea(point) &&
    !snake.some((part) => samePoint(part, point)) &&
    !items.some((item) => samePoint(item, point)) &&
    !obstacles.some((obstacle) => samePoint(obstacle, point))
  );
}

function isSpawnArea(point) {
  return Math.abs(point.x - spawnArea.x) <= spawnArea.radius && Math.abs(point.y - spawnArea.y) <= spawnArea.radius;
}

function isWall(point) {
  return point.x < 0 || point.x >= tileCount || point.y < 0 || point.y >= tileCount;
}

function isObstacle(point) {
  return obstacles.some((obstacle) => samePoint(obstacle, point));
}

function removeObstacle(point) {
  obstacles = obstacles.filter((obstacle) => !samePoint(obstacle, point));
}

function findItemAt(point) {
  return items.find((item) => samePoint(item, point));
}

function samePoint(a, b) {
  return a.x === b.x && a.y === b.y;
}

function wrapPoint(point) {
  return {
    x: (point.x + tileCount) % tileCount,
    y: (point.y + tileCount) % tileCount,
  };
}

function triggerShieldBurst(point) {
  effects.message = "护盾抵消";
  effects.messageTicks = 24;
  burstAt(point, "#a66bff", 24);
}

function burstAt(point, color, count) {
  const centerX = point.x * gridSize + gridSize / 2;
  const centerY = point.y * gridSize + gridSize / 2;
  for (let i = 0; i < count; i += 1) {
    const angle = Math.random() * Math.PI * 2;
    const force = 1.2 + Math.random() * 3.4;
    effects.particles.push({
      x: centerX,
      y: centerY,
      vx: Math.cos(angle) * force,
      vy: Math.sin(angle) * force,
      size: 2 + Math.random() * 3,
      life: 15 + Math.random() * 18,
      color,
    });
  }
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawBoard();
  drawObstacles();
  drawItems();
  drawSnake();
  drawParticles();
  drawHudState();
}

function drawBoard() {
  const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
  gradient.addColorStop(0, "#07111e");
  gradient.addColorStop(0.52, "#091827");
  gradient.addColorStop(1, "#050a13");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.strokeStyle = "rgba(91, 235, 255, 0.07)";
  ctx.lineWidth = 1;
  for (let i = 0; i <= tileCount; i += 1) {
    const pos = i * gridSize + 0.5;
    ctx.beginPath();
    ctx.moveTo(pos, 0);
    ctx.lineTo(pos, canvas.height);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, pos);
    ctx.lineTo(canvas.width, pos);
    ctx.stroke();
  }

  if (effects.flash > 0) {
    ctx.fillStyle = `rgba(255, 95, 104, ${effects.flash / 32})`;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  ctx.strokeStyle = stats.shield > 0 ? "rgba(166, 107, 255, 0.56)" : "rgba(255, 79, 216, 0.16)";
  ctx.lineWidth = 2;
  ctx.strokeRect(1, 1, canvas.width - 2, canvas.height - 2);
}

function drawItems() {
  items.forEach((item) => {
    const type = itemTypes[item.type];
    const centerX = item.x * gridSize + gridSize / 2;
    const centerY = item.y * gridSize + gridSize / 2;
    const pulse = Math.sin((tickCount + item.age) * 0.22) * 1.4;
    const radius = item.type === "food" ? 6.3 + pulse * 0.2 : 7.4 + pulse * 0.45;

    ctx.save();
    ctx.shadowColor = type.glow;
    ctx.shadowBlur = item.type === "food" ? 14 : 22;
    ctx.fillStyle = type.color;

    if (item.type === "slow") {
      drawDiamond(centerX, centerY, radius + 2);
    } else if (item.type === "shield") {
      drawShieldIcon(centerX, centerY, radius + 2);
    } else {
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.shadowBlur = 0;
    ctx.fillStyle = "rgba(255, 255, 255, 0.72)";
    ctx.beginPath();
    ctx.arc(centerX - 2.2, centerY - 2.4, 1.8, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  });
}

function drawDiamond(x, y, size) {
  ctx.beginPath();
  ctx.moveTo(x, y - size);
  ctx.lineTo(x + size, y);
  ctx.lineTo(x, y + size);
  ctx.lineTo(x - size, y);
  ctx.closePath();
  ctx.fill();
}

function drawShieldIcon(x, y, size) {
  ctx.beginPath();
  ctx.moveTo(x, y - size);
  ctx.lineTo(x + size * 0.82, y - size * 0.42);
  ctx.lineTo(x + size * 0.54, y + size * 0.72);
  ctx.lineTo(x, y + size);
  ctx.lineTo(x - size * 0.54, y + size * 0.72);
  ctx.lineTo(x - size * 0.82, y - size * 0.42);
  ctx.closePath();
  ctx.fill();
}

function drawObstacles() {
  obstacles.forEach((obstacle, index) => {
    const x = obstacle.x * gridSize + 3;
    const y = obstacle.y * gridSize + 3;
    const size = gridSize - 6;
    const pulse = Math.sin(tickCount * 0.1 + index) * 0.24 + 0.76;

    ctx.save();
    ctx.shadowColor = "#ff5f68";
    ctx.shadowBlur = 8;
    ctx.fillStyle = `rgba(255, 95, 104, ${pulse})`;
    ctx.beginPath();
    ctx.roundRect(x, y, size, size, 4);
    ctx.fill();
    ctx.strokeStyle = "rgba(255, 255, 255, 0.18)";
    ctx.strokeRect(x + 2, y + 2, size - 4, size - 4);
    ctx.restore();
  });
}

function drawSnake() {
  snake.forEach((part, index) => {
    const pad = index === 0 ? 2 : 3.2;
    const x = part.x * gridSize + pad;
    const y = part.y * gridSize + pad;
    const size = gridSize - pad * 2;
    const fill = ctx.createLinearGradient(x, y, x + size, y + size);

    if (index === 0) {
      fill.addColorStop(0, stats.shield > 0 ? "#f0dcff" : "#f1ff7a");
      fill.addColorStop(0.52, stats.shield > 0 ? "#a66bff" : "#a8ff5f");
      fill.addColorStop(1, "#48f7b1");
      ctx.shadowColor = stats.shield > 0 ? "#a66bff" : "#c7ff4f";
      ctx.shadowBlur = stats.shield > 0 ? 24 : 14;
    } else {
      const fade = Math.max(0.42, 1 - index / snake.length);
      fill.addColorStop(0, `rgba(98, 255, 156, ${fade})`);
      fill.addColorStop(1, `rgba(91, 235, 255, ${Math.max(0.34, fade - 0.1)})`);
      ctx.shadowColor = "#62ff9c";
      ctx.shadowBlur = 8;
    }

    ctx.fillStyle = fill;
    ctx.beginPath();
    ctx.roundRect(x, y, size, size, index === 0 ? 7 : 5);
    ctx.fill();

    if (index === 0) drawSnakeFace(part);
  });

  ctx.shadowBlur = 0;
}

function drawSnakeFace(head) {
  const centerX = head.x * gridSize + gridSize / 2;
  const centerY = head.y * gridSize + gridSize / 2;
  const eyeOffsetX = direction.y === 0 ? 3 * direction.x : 4;
  const eyeOffsetY = direction.x === 0 ? 3 * direction.y : 4;
  const secondEyeOffsetX = direction.y === 0 ? 3 * direction.x : -4;
  const secondEyeOffsetY = direction.x === 0 ? 3 * direction.y : -4;

  ctx.save();
  ctx.shadowBlur = 0;
  ctx.fillStyle = "#07101a";
  ctx.beginPath();
  ctx.arc(centerX + eyeOffsetX, centerY + eyeOffsetY, 2, 0, Math.PI * 2);
  ctx.arc(centerX + secondEyeOffsetX, centerY + secondEyeOffsetY, 2, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = "rgba(255, 255, 255, 0.72)";
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(centerX, centerY);
  ctx.lineTo(centerX + direction.x * 6, centerY + direction.y * 6);
  ctx.stroke();
  ctx.restore();
}

function drawParticles() {
  effects.particles.forEach((particle) => {
    ctx.save();
    ctx.globalAlpha = Math.max(0, particle.life / 32);
    ctx.fillStyle = particle.color;
    ctx.shadowColor = particle.color;
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  });
}

function drawHudState() {
  const comboWidth = Math.max(0, stats.comboTicks / comboWindow) * 104;
  ctx.save();
  ctx.fillStyle = "rgba(5, 10, 19, 0.58)";
  ctx.fillRect(14, 14, 128, 28);
  ctx.fillStyle = "rgba(199, 255, 79, 0.72)";
  ctx.fillRect(26, 33, comboWidth, 4);
  ctx.fillStyle = "#f5fbff";
  ctx.font = "700 12px Inter, system-ui, sans-serif";
  ctx.fillText(`COMBO x${stats.combo}`, 26, 28);

  if (effects.messageTicks > 0) {
    ctx.textAlign = "center";
    ctx.fillStyle = "rgba(255, 255, 255, 0.92)";
    ctx.font = "800 24px Inter, system-ui, sans-serif";
    ctx.shadowColor = "#5bebff";
    ctx.shadowBlur = 18;
    ctx.fillText(effects.message, canvas.width / 2, 58);
  }
  ctx.restore();
}

function setDirection(newDirection) {
  const reversing = newDirection.x + direction.x === 0 && newDirection.y + direction.y === 0;
  if (!reversing) nextDirection = newDirection;
}

function togglePause() {
  if (gameOver) return;
  if (!running && !paused) {
    startLoop();
    return;
  }

  paused = !paused;
  if (paused) {
    stopLoop();
    paused = true;
    statusEl.textContent = "已暂停";
    pauseButton.textContent = "继续";
    updateOverlay();
  } else {
    startLoop();
  }
}

function handleKeydown(event) {
  const keyMap = {
    ArrowUp: directions.up,
    w: directions.up,
    W: directions.up,
    ArrowDown: directions.down,
    s: directions.down,
    S: directions.down,
    ArrowLeft: directions.left,
    a: directions.left,
    A: directions.left,
    ArrowRight: directions.right,
    d: directions.right,
    D: directions.right,
  };

  if (event.code === "Space") {
    event.preventDefault();
    if (gameOver) {
      resetGame();
      startLoop();
    } else {
      togglePause();
    }
    return;
  }

  const newDirection = keyMap[event.key];
  if (!newDirection) return;

  event.preventDefault();
  setDirection(newDirection);
  startLoop();
}

function handleDirectionButton(event) {
  const button = event.currentTarget;
  const newDirection = directions[button.dataset.direction];
  if (!newDirection) return;

  setDirection(newDirection);
  startLoop();
}

pauseButton.addEventListener("click", togglePause);
restartButton.addEventListener("click", () => {
  resetGame();
  startLoop();
});
directionButtons.forEach((button) => {
  button.addEventListener("click", handleDirectionButton);
});
window.addEventListener("keydown", handleKeydown);

bestScore = readStoredNumber("snakeBestScore");
bestCombo = readStoredNumber("snakeBestCombo");
bestEl.textContent = String(bestScore);
resetGame();
