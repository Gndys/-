const canvas = document.querySelector("#board");
const ctx = canvas.getContext("2d");
const scoreEl = document.querySelector("#score");
const bestEl = document.querySelector("#best");
const statusEl = document.querySelector("#status");
const pauseButton = document.querySelector("#pauseButton");
const restartButton = document.querySelector("#restartButton");
const stateOverlay = document.querySelector("#stateOverlay");
const overlayTitle = document.querySelector("#overlayTitle");
const overlayHint = document.querySelector("#overlayHint");
const directionButtons = document.querySelectorAll("[data-direction]");

const gridSize = 20;
const tileCount = canvas.width / gridSize;
const startSpeed = 135;
const minSpeed = 62;

let snake;
let food;
let direction;
let nextDirection;
let score;
let bestScore;
let gameTimer;
let speed;
let running;
let paused;
let gameOver;
let foodPulse;

const directions = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

function loadBestScore() {
  return Number(localStorage.getItem("snakeBestScore") || 0);
}

function saveBestScore(value) {
  localStorage.setItem("snakeBestScore", String(value));
}

function resetGame() {
  snake = [
    { x: 10, y: 10 },
    { x: 9, y: 10 },
    { x: 8, y: 10 },
  ];
  direction = { x: 1, y: 0 };
  nextDirection = { x: 1, y: 0 };
  score = 0;
  speed = startSpeed;
  running = false;
  paused = false;
  gameOver = false;
  foodPulse = 0;
  pauseButton.textContent = "暂停";
  statusEl.textContent = "按方向键或 WASD 开始";
  scoreEl.textContent = "0";
  placeFood();
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
    foodPulse += 1;
    update();
    draw();
    if (running) scheduleTick();
  }, speed);
}

function update() {
  direction = nextDirection;

  const head = {
    x: snake[0].x + direction.x,
    y: snake[0].y + direction.y,
  };

  if (hitWall(head) || hitSnake(head)) {
    endGame();
    return;
  }

  snake.unshift(head);

  if (head.x === food.x && head.y === food.y) {
    score += 10;
    scoreEl.textContent = String(score);
    if (score > bestScore) {
      bestScore = score;
      bestEl.textContent = String(bestScore);
      saveBestScore(bestScore);
    }
    speed = Math.max(minSpeed, startSpeed - Math.floor(score / 50) * 10);
    placeFood();
  } else {
    snake.pop();
  }
}

function endGame() {
  stopLoop();
  gameOver = true;
  statusEl.textContent = "游戏结束，按空格或重新开始";
  updateOverlay();
}

function updateOverlay() {
  if (gameOver) {
    stateOverlay.classList.add("is-visible");
    overlayTitle.textContent = "游戏结束";
    overlayHint.textContent = "按空格或重新开始再来一局";
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
    overlayHint.textContent = "方向键 / WASD 移动，空格暂停";
    return;
  }

  stateOverlay.classList.remove("is-visible");
}

function hitWall(point) {
  return point.x < 0 || point.x >= tileCount || point.y < 0 || point.y >= tileCount;
}

function hitSnake(point) {
  return snake.some((part) => part.x === point.x && part.y === point.y);
}

function placeFood() {
  do {
    food = {
      x: Math.floor(Math.random() * tileCount),
      y: Math.floor(Math.random() * tileCount),
    };
  } while (snake?.some((part) => part.x === food.x && part.y === food.y));
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawGrid();
  drawFood();
  drawSnake();
}

function drawGrid() {
  const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
  gradient.addColorStop(0, "#07111e");
  gradient.addColorStop(0.48, "#081421");
  gradient.addColorStop(1, "#050a13");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.strokeStyle = "rgba(91, 235, 255, 0.075)";
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

  ctx.strokeStyle = "rgba(255, 79, 216, 0.15)";
  ctx.lineWidth = 2;
  ctx.strokeRect(1, 1, canvas.width - 2, canvas.height - 2);
}

function drawFood() {
  const centerX = food.x * gridSize + gridSize / 2;
  const centerY = food.y * gridSize + gridSize / 2;
  const pulse = Math.sin(foodPulse * 0.42) * 0.7;
  const appleSize = 13 + pulse;
  const topY = centerY - appleSize * 0.38;
  const bottomY = centerY + appleSize * 0.43;

  ctx.save();
  ctx.shadowColor = "#ff4b4b";
  ctx.shadowBlur = 16;
  ctx.fillStyle = "#e9313f";
  ctx.beginPath();
  ctx.moveTo(centerX, topY + 2);
  ctx.bezierCurveTo(
    centerX - appleSize * 0.48,
    topY - 2,
    centerX - appleSize * 0.66,
    centerY + appleSize * 0.08,
    centerX - appleSize * 0.5,
    centerY + appleSize * 0.36,
  );
  ctx.bezierCurveTo(
    centerX - appleSize * 0.34,
    bottomY,
    centerX - appleSize * 0.08,
    bottomY + 1,
    centerX,
    bottomY - 1,
  );
  ctx.bezierCurveTo(
    centerX + appleSize * 0.08,
    bottomY + 1,
    centerX + appleSize * 0.34,
    bottomY,
    centerX + appleSize * 0.5,
    centerY + appleSize * 0.36,
  );
  ctx.bezierCurveTo(
    centerX + appleSize * 0.66,
    centerY + appleSize * 0.08,
    centerX + appleSize * 0.48,
    topY - 2,
    centerX,
    topY + 2,
  );
  ctx.fill();

  ctx.shadowBlur = 0;
  ctx.fillStyle = "#ff6d63";
  ctx.beginPath();
  ctx.ellipse(
    centerX - appleSize * 0.22,
    centerY - appleSize * 0.08,
    appleSize * 0.16,
    appleSize * 0.22,
    0.7,
    0,
    Math.PI * 2,
  );
  ctx.fill();

  ctx.fillStyle = "#5d3b20";
  ctx.fillRect(centerX - 1.1, topY - 5, 2.2, 7);

  ctx.fillStyle = "#78d94b";
  ctx.beginPath();
  ctx.ellipse(centerX + 4, topY - 3, 4.2, 2.4, -0.45, 0, Math.PI * 2);
  ctx.fill();

  ctx.shadowBlur = 0;
  ctx.fillStyle = "#7a101c";
  ctx.beginPath();
  ctx.arc(centerX, topY + 2, 2.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawSnake() {
  snake.forEach((part, index) => {
    const pad = index === 0 ? 2 : 3.2;
    const x = part.x * gridSize + pad;
    const y = part.y * gridSize + pad;
    const size = gridSize - pad * 2;
    const fill = ctx.createLinearGradient(x, y, x + size, y + size);

    if (index === 0) {
      fill.addColorStop(0, "#f1ff7a");
      fill.addColorStop(0.5, "#a8ff5f");
      fill.addColorStop(1, "#48f7b1");
      ctx.shadowColor = "#c7ff4f";
      ctx.shadowBlur = 14;
    } else {
      const fade = Math.max(0.46, 1 - index / snake.length);
      fill.addColorStop(0, `rgba(98, 255, 156, ${fade})`);
      fill.addColorStop(1, `rgba(91, 235, 255, ${Math.max(0.34, fade - 0.1)})`);
      ctx.shadowColor = "#62ff9c";
      ctx.shadowBlur = 8;
    }

    ctx.fillStyle = fill;
    ctx.beginPath();
    ctx.roundRect(x, y, size, size, index === 0 ? 7 : 5);
    ctx.fill();

    if (index === 0) {
      drawSnakeEyes(part);
    }
  });

  ctx.shadowBlur = 0;
}

function drawSnakeEyes(head) {
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
  ctx.restore();
}

function setDirection(newDirection) {
  const reversing =
    newDirection.x + direction.x === 0 && newDirection.y + direction.y === 0;
  if (!reversing) {
    nextDirection = newDirection;
  }
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

bestScore = loadBestScore();
bestEl.textContent = String(bestScore);
resetGame();
