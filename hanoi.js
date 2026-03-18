/* ================================================================
   Tower of Hanoi — hanoi.js
   Handles: SocketIO, rendering, mouse drag-drop, touch drag-drop,
            auto-solve, timer, stats, win screen, toasts.
   ================================================================ */

const socket = io();

// ─── State ────────────────────────────────────────────────────────
let state = { pegs: [[], [], []], num_discs: 0, moves: 0, min_moves: 0, won: false, elapsed: 0 };
let selectedDiscs = 3;
let solveQueue    = [];
let solveTimer    = null;
let isSolving     = false;
let gameStarted   = false;
let timerInterval = null;
let localTime     = 0;

// Drag state
let dragFromPeg   = -1;
let dragGhost     = null;   // floating clone during touch drag
let touchDiscEl   = null;
let touchFromPeg  = -1;

// ─── Socket events ────────────────────────────────────────────────
socket.on('connect',      ()       => { /* initial state sent by server on connect event */ });
socket.on('state',        (s)      => { applyState(s); });
socket.on('invalid_move', (data)   => { shakeDisc(data.from); showToast('Invalid move! Smaller disc must go on top.'); });
socket.on('solution',     (data)   => { runAutoSolve(data.moves); });

// ─── Apply state from server ─────────────────────────────────────
function applyState(s) {
  state = s;
  renderAll();
  updateStats();
  if (s.won) { showWin(); }
}

// ─── Rendering ───────────────────────────────────────────────────
const DISC_HEIGHTS  = { 1:22, 2:24, 3:26, 4:28, 5:30, 6:32 };
const BASE_PADDING  = 18; // px from base

function renderAll() {
  for (let p = 0; p < 3; p++) {
    const pegEl = document.getElementById(`peg${p}`);
    pegEl.innerHTML = '';

    state.pegs[p].forEach((size, stackIdx) => {
      const disc = document.createElement('div');
      disc.className  = 'disc';
      disc.dataset.size    = size;
      disc.dataset.fromPeg = p;

      // Stack position (bottom offset)
      let bottom = BASE_PADDING;
      for (let k = 0; k < stackIdx; k++) {
        bottom += (DISC_HEIGHTS[state.pegs[p][k]] || 24) + 2;
      }
      disc.style.bottom = `${bottom}px`;

      // Only the top disc of each peg is draggable
      const isTop = (stackIdx === state.pegs[p].length - 1);
      if (isTop && gameStarted && !isSolving) {
        disc.classList.add('can-drag');
        disc.draggable = true;
        disc.addEventListener('dragstart', onDragStart);
        addTouchListeners(disc, p);
      }

      pegEl.appendChild(disc);
    });
  }
}

// ─── Stats display ────────────────────────────────────────────────
function updateStats() {
  document.getElementById('statMoves').textContent = state.moves;
  document.getElementById('statMin').textContent   = state.min_moves || '—';
  const eff = state.min_moves && state.moves
    ? Math.round((state.min_moves / state.moves) * 100)
    : (state.moves === 0 && state.num_discs ? 100 : null);
  document.getElementById('statEff').textContent   = eff != null ? `${eff}%` : '—';
}

// ─── Timer ───────────────────────────────────────────────────────
function startTimer() {
  stopTimer();
  localTime = 0;
  document.getElementById('statTime').textContent = '0s';
  timerInterval = setInterval(() => {
    localTime++;
    document.getElementById('statTime').textContent = formatTime(localTime);
  }, 1000);
}

function stopTimer() {
  if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
}

function formatTime(sec) {
  if (sec < 60) return `${sec}s`;
  return `${Math.floor(sec/60)}m ${sec%60}s`;
}

// ─── Game controls ────────────────────────────────────────────────
function selectDiscs(n) {
  selectedDiscs = n;
  document.querySelectorAll('.disc-btn').forEach(b => {
    b.classList.toggle('active', parseInt(b.dataset.n) === n);
  });
}

function startGame() {
  cancelAutoSolve();
  socket.emit('start_game', { num_discs: selectedDiscs });
  gameStarted = true;
  document.getElementById('btnReset').disabled = false;
  document.getElementById('btnSolve').disabled = false;
  startTimer();
  hideWin();
}

function resetGame() {
  cancelAutoSolve();
  socket.emit('reset', { num_discs: selectedDiscs });
  gameStarted = true;
  startTimer();
  hideWin();
}

// ─── Mouse Drag & Drop ────────────────────────────────────────────
function onDragStart(e) {
  dragFromPeg = parseInt(e.currentTarget.dataset.fromPeg);
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('text/plain', dragFromPeg);
  setTimeout(() => e.currentTarget.classList.add('dragging'), 0);
}

function onDragOver(e) {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
  e.currentTarget.classList.add('drag-over');
}

function onDragLeave(e) {
  e.currentTarget.classList.remove('drag-over');
}

function onDrop(e) {
  e.preventDefault();
  e.currentTarget.classList.remove('drag-over');
  const toPeg = parseInt(e.currentTarget.dataset.peg);
  if (dragFromPeg !== -1 && dragFromPeg !== toPeg) {
    socket.emit('move', { from: dragFromPeg, to: toPeg });
  }
  dragFromPeg = -1;
  // Remove dragging class from any disc
  document.querySelectorAll('.disc.dragging').forEach(d => d.classList.remove('dragging'));
}

// Also clean up if drop happens outside
document.addEventListener('dragend', () => {
  dragFromPeg = -1;
  document.querySelectorAll('.disc.dragging').forEach(d => d.classList.remove('dragging'));
  document.querySelectorAll('.peg.drag-over').forEach(p => p.classList.remove('drag-over'));
});

// ─── Touch Drag & Drop ────────────────────────────────────────────
function addTouchListeners(discEl, pegIdx) {
  discEl.addEventListener('touchstart',  (e) => handleTouchStart(e, discEl, pegIdx), { passive: false });
  discEl.addEventListener('touchmove',   handleTouchMove, { passive: false });
  discEl.addEventListener('touchend',    handleTouchEnd,  { passive: false });
  discEl.addEventListener('touchcancel', handleTouchEnd,  { passive: false });
}

function handleTouchStart(e, discEl, pegIdx) {
  if (!discEl.classList.contains('can-drag')) return;
  e.preventDefault();

  touchDiscEl  = discEl;
  touchFromPeg = pegIdx;

  // Build floating ghost
  const rect = discEl.getBoundingClientRect();
  dragGhost   = discEl.cloneNode(true);
  dragGhost.classList.remove('can-drag');
  dragGhost.classList.add('dragging');
  dragGhost.style.position = 'fixed';
  dragGhost.style.width    = rect.width + 'px';
  dragGhost.style.height   = rect.height + 'px';
  dragGhost.style.left     = rect.left + 'px';
  dragGhost.style.top      = rect.top  + 'px';
  dragGhost.style.bottom   = 'auto';
  dragGhost.style.margin   = '0';
  dragGhost.style.transform= 'none';
  document.body.appendChild(dragGhost);

  discEl.style.opacity = '0.3';
}

function handleTouchMove(e) {
  if (!dragGhost) return;
  e.preventDefault();
  const t = e.touches[0];
  const w = parseFloat(dragGhost.style.width);
  const h = parseFloat(dragGhost.style.height);
  dragGhost.style.left = `${t.clientX - w / 2}px`;
  dragGhost.style.top  = `${t.clientY - h / 2}px`;

  // Highlight peg under finger
  dragGhost.style.pointerEvents = 'none';
  const under = document.elementFromPoint(t.clientX, t.clientY);
  dragGhost.style.pointerEvents = '';

  document.querySelectorAll('.peg').forEach(p => p.classList.remove('drag-over'));
  const pegEl = under ? under.closest('.peg') : null;
  if (pegEl) pegEl.classList.add('drag-over');
}

function handleTouchEnd(e) {
  if (!dragGhost) return;
  e.preventDefault();

  const t = (e.changedTouches || e.touches)[0];
  dragGhost.style.pointerEvents = 'none';
  const under  = document.elementFromPoint(t.clientX, t.clientY);
  const pegEl  = under ? under.closest('.peg') : null;

  if (pegEl) {
    const toPeg = parseInt(pegEl.dataset.peg);
    if (touchFromPeg !== -1 && touchFromPeg !== toPeg) {
      socket.emit('move', { from: touchFromPeg, to: toPeg });
    }
  }

  // Clean up
  document.body.removeChild(dragGhost);
  dragGhost = null;
  if (touchDiscEl) { touchDiscEl.style.opacity = ''; touchDiscEl = null; }
  touchFromPeg = -1;
  document.querySelectorAll('.peg.drag-over').forEach(p => p.classList.remove('drag-over'));
}

// ─── Auto-Solve ───────────────────────────────────────────────────
function autoSolve() {
  if (isSolving || !gameStarted) return;
  socket.emit('get_solution', {});
}

function runAutoSolve(moves) {
  cancelAutoSolve();
  isSolving  = true;
  solveQueue = [...moves];
  setSolveStatus(true);
  document.getElementById('btnSolve').disabled = true;

  // Reset to fresh state before solving
  socket.emit('reset', { num_discs: selectedDiscs });
  setTimeout(executeNextSolveStep, 600);
}

function executeNextSolveStep() {
  if (solveQueue.length === 0) {
    isSolving = false;
    setSolveStatus(false);
    document.getElementById('btnSolve').disabled = false;
    return;
  }
  const [from, to] = solveQueue.shift();
  socket.emit('move', { from, to });
  const delay = Math.max(250, 750 - state.num_discs * 60);
  solveTimer = setTimeout(executeNextSolveStep, delay);
}

function cancelAutoSolve() {
  if (solveTimer) { clearTimeout(solveTimer); solveTimer = null; }
  solveQueue = [];
  isSolving  = false;
  setSolveStatus(false);
  if (gameStarted) document.getElementById('btnSolve').disabled = false;
}

function setSolveStatus(active) {
  const el = document.getElementById('solveStatus');
  el.textContent = active ? `⚡ Auto-solving ${state.num_discs}-disc puzzle…` : '';
  el.classList.toggle('active', active);
}

// ─── Win screen ───────────────────────────────────────────────────
function showWin() {
  stopTimer();
  const moves = state.moves;
  const min   = state.min_moves;
  const eff   = min ? Math.round((min / moves) * 100) : 100;
  const time  = localTime;

  document.getElementById('winStats').innerHTML =
    `Discs: <strong>${state.num_discs}</strong> &nbsp;|&nbsp; ` +
    `Moves: <strong>${moves}</strong> &nbsp;|&nbsp; ` +
    `Time: <strong>${formatTime(time)}</strong><br>` +
    `Minimum possible moves: <strong>${min}</strong>`;

  const effEl = document.getElementById('winEfficiency');
  if (eff === 100) {
    effEl.textContent = '🌟 Perfect Solution!';
    effEl.className   = 'win-efficiency perfect';
  } else if (eff >= 75) {
    effEl.textContent = `✨ Great — ${eff}% efficient`;
    effEl.className   = 'win-efficiency great';
  } else {
    effEl.textContent = `👍 ${eff}% efficient — try again for perfection!`;
    effEl.className   = 'win-efficiency good';
  }

  document.getElementById('winOverlay').classList.add('show');
}

function hideWin() {
  document.getElementById('winOverlay').classList.remove('show');
}

// ─── Invalid move feedback ────────────────────────────────────────
function shakeDisc(pegIdx) {
  const pegEl = document.getElementById(`peg${pegIdx}`);
  if (!pegEl) return;
  const discs = pegEl.querySelectorAll('.disc');
  const top   = discs[discs.length - 1];
  if (top) {
    top.classList.add('invalid');
    setTimeout(() => top.classList.remove('invalid'), 450);
  }
}

// ─── Toast ────────────────────────────────────────────────────────
let toastTimeout = null;
function showToast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  if (toastTimeout) clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => el.classList.remove('show'), 2500);
}

// ─── Init ─────────────────────────────────────────────────────────
// Highlight default disc count
selectDiscs(3);
