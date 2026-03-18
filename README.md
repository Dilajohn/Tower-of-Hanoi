# Tower of Hanoi

A fully interactive Tower of Hanoi simulation with drag-and-drop, touch support, auto-solve, and a live stats dashboard. Playable as a standalone HTML file **or** served through a Python/Flask backend with real-time WebSocket sync.

---

## 📸 Features

| Feature | Details |
|---|---|
| **1–6 Discs** | Choose your difficulty before each game |
| **Mouse Drag & Drop** | Grab any top disc and drop it onto any peg |
| **Touch Drag & Drop** | Full touch support — works on phones and tablets |
| **Click-to-Move** | Click a disc to select it, then click the target peg |
| **Auto-Solve** | Watch the optimal recursive solution animate step by step |
| **Live Stats** | Moves counter, minimum-move target, elapsed timer, efficiency % |
| **Win Screen** | Trophy overlay with score, time, and Perfect/Great/Good rating |
| **Invalid Move Feedback** | Disc shake animation + toast message on illegal drops |
| **Responsive UI** | Adapts cleanly from desktop down to mobile screens |

---

## 📁 Project Structure

```
hanoi/
├── index.html              # ✅ Standalone — works by opening directly in a browser
├── app.py                  # Flask + SocketIO backend (for server/multiplayer mode)
├── requirements.txt        # Python dependencies
├── templates/
│   └── index.html          # Flask template version (uses external CSS/JS)
├── static/
│   ├── style.css           # All styles (separated from HTML for Flask mode)
│   └── hanoi.js            # All game logic (separated for Flask mode)
└── venv/                   # Python virtual environment (created during setup)
```

> **Two modes, one codebase:**
> - `index.html` (root) — fully self-contained, zero dependencies, open in any browser
> - `app.py` + `templates/index.html` + `static/` — Flask server mode with SocketIO

---

## 🚀 Quick Start

### Option A — Standalone (Recommended for development/preview)

No installation required. Just open the file:

```
double-click  index.html
```

Or from terminal:

```bash
# macOS
open index.html

# Linux
xdg-open index.html

# Windows
start index.html
```

The game runs entirely in your browser — no server, no install.

---

### Option B — Flask Server Mode

Use this for the full backend experience (WebSocket sync, multiplayer-ready).

#### 1. Prerequisites

- Python 3.10 or higher
- pip

Check your versions:

```bash
python3 --version
pip3 --version
```

#### 2. Clone or download the project

```bash
cd path/to/hanoi
```

#### 3. Create a virtual environment

```bash
python3 -m venv Hanoi_env
```

#### 4. Activate the virtual environment

| Platform | Command |
|---|---|
| macOS / Linux | `source Hanoi_env/bin/activate` |
| Windows (CMD) | `Hanoi_env\Scripts\activate.bat` |
| Windows (PowerShell) | `Hanoi_env\Scripts\Activate.ps1` |

You will see `(venv)` prepended to your terminal prompt when active.

#### 5. Install dependencies

```bash
pip install -r requirements.txt
```

This installs:

| Package | Version | Purpose |
|---|---|---|
| Flask | ≥ 3.0.0 | Web framework and routing |
| Flask-SocketIO | ≥ 5.3.6 | Real-time WebSocket events |
| Eventlet | ≥ 0.35.2 | Async server for SocketIO |

#### 6. Run the server

```bash
python app.py
```

#### 7. Open in browser

```
http://localhost:5000
```

#### 8. Deactivate when done

```bash
deactivate
```

---

## 🎮 How to Play

### Game Setup

1. Select the number of discs (1–6) using the numbered buttons
2. Click **▶ Start** to begin — all discs load onto the Source peg (A)
3. Move all discs to the **Target peg (C)**

### The One Rule

> A larger disc can **never** be placed on top of a smaller disc.

### Moving Discs — Three Ways

| Method | How |
|---|---|
| 🖱️ **Mouse drag** | Click and drag the top disc of any peg, drop it onto the destination peg |
| 👆 **Touch drag** | Press and hold a disc, drag your finger to the target peg, release |
| 🖱️ **Click-to-move** | Click a disc to highlight it, then click the destination peg |

### Buttons

| Button | Action |
|---|---|
| **▶ Start** | Begin a new game with the selected disc count |
| **↺ Reset** | Restart the current disc count from scratch |
| **⚡ Auto-Solve** | Reset and animate the optimal solution automatically |

### Scoring

The minimum number of moves to solve an n-disc puzzle is **2ⁿ − 1**.

| Discs | Minimum Moves |
|---|---|
| 1 | 1 |
| 2 | 3 |
| 3 | 7 |
| 4 | 15 |
| 5 | 31 |
| 6 | 63 |

Your **efficiency** is calculated as:

```
Efficiency = (Minimum Moves ÷ Your Moves) × 100%
```

| Rating | Threshold |
|---|---|
| 🌟 Perfect | 100% — optimal solution |
| ✨ Great | 75% or above |
| 👍 Good | Below 75% — keep practising! |

---

## 🔌 SocketIO API Reference (Flask Mode)

The backend communicates via WebSocket events. This is relevant if you extend the app or build a custom client.

### Client → Server

| Event | Payload | Description |
|---|---|---|
| `start_game` | `{ num_discs: number }` | Start a new game with n discs (1–6) |
| `reset` | `{}` | Reset the current game to its starting state |
| `move` | `{ from: number, to: number }` | Attempt to move the top disc from peg `from` to peg `to` (0-indexed) |
| `get_solution` | `{}` | Request the full optimal move sequence for the current disc count |

### Server → Client

| Event | Payload | Description |
|---|---|---|
| `state` | `{ pegs, n, moves, min_moves, won, elapsed }` | Full game state broadcast after every valid action |
| `invalid_move` | `{ from: number, to: number }` | Emitted when a move violates the rules |
| `solution` | `{ moves: [[from, to], ...] }` | Ordered list of moves for the optimal solution |

### State object

```json
{
  "pegs":      [[3,2,1], [], []],
  "n":         3,
  "moves":     4,
  "min_moves": 7,
  "won":       false,
  "elapsed":   12.4
}
```

Each peg is an array of disc sizes, ordered bottom (largest) to top (smallest). Disc sizes are integers 1–n where 1 is the smallest disc.

---

## 🏗️ Architecture

### Standalone Mode (`index.html`)

All game logic runs in the browser. No network calls are made.

```
Browser
  └── index.html
        ├── CSS (embedded <style>)
        └── JavaScript (embedded <script>)
              ├── Game state object (G)
              ├── Move validation
              ├── Disc renderer
              ├── Mouse drag handler
              ├── Touch drag handler
              ├── Click-to-move handler
              ├── Recursive auto-solver
              └── UI (stats, timer, win screen, toasts)
```

### Flask Mode

```
Browser  ←──WebSocket──→  Flask + SocketIO (app.py)
  │                              │
  └── templates/index.html       └── Game state (server-authoritative)
  └── static/style.css               Move validation
  └── static/hanoi.js                Recursive solver
                                     Broadcast to all clients
```

---

## 🧠 Algorithm — Tower of Hanoi Solution

The auto-solver uses the classic recursive algorithm:

```python
def hanoi(n, source, target, auxiliary):
    if n == 0:
        return
    hanoi(n - 1, source, auxiliary, target)   # Move n-1 discs out of the way
    move(source, target)                        # Move the largest disc
    hanoi(n - 1, auxiliary, target, source)   # Stack n-1 discs on top
```

This always produces the optimal solution in exactly **2ⁿ − 1** moves.

---

## 🗂️ File Reference

| File | Language | Role |
|---|---|---|
| `index.html` | HTML / CSS / JS | Fully self-contained standalone game |
| `app.py` | Python | Flask server, SocketIO events, game state, solver |
| `templates/index.html` | HTML | Flask template (links to external CSS and JS) |
| `static/style.css` | CSS | All visual styles — layout, pegs, discs, overlays |
| `static/hanoi.js` | JavaScript | Game logic for Flask mode — drag, touch, socket events |
| `requirements.txt` | Text | Python package list for `pip install` |

---

## 🛠️ Development Notes

### Adding more discs

The maximum is currently capped at 6 in both the UI and `app.py`. To raise the cap:

1. In `index.html` (or `templates/index.html`), add extra `<button>` elements to the `.disc-sel` group
2. In `app.py`, update the clamp: `max(1, min(NEW_MAX, int(...)))`
3. In `style.css`, add a new `.disc[data-s="N"]` rule with a new colour and width

### Running in production

For a production deployment replace the dev server line in `app.py`:

```python
# Development
socketio.run(app, host='0.0.0.0', port=5000, debug=True)

# Production (use gunicorn + eventlet)
# gunicorn --worker-class eventlet -w 1 app:app
```

Install gunicorn:

```bash
pip install gunicorn
```

### `.gitignore` recommendation

```
venv/
__pycache__/
*.pyc
.env
```

---

## 📋 Requirements Summary

| Requirement | Met |
|---|---|
| Interface-based — all functionality in UI | ✅ |
| Maximum 6 discs | ✅ |
| Drag and drop — mouse | ✅ |
| Drag and drop — touch / touchpad | ✅ |
| Frontend: HTML, CSS, JavaScript | ✅ |
| Backend: Python (Flask + SocketIO) | ✅ |
| Interactive (feedback, animation, stats) | ✅ |

---


