from flask import Flask, render_template, send_from_directory
from flask_socketio import SocketIO, emit
import math, time, os

app = Flask(__name__)
app.config['SECRET_KEY'] = 'hanoi-secret-2024'
socketio = SocketIO(app, cors_allowed_origins="*")

game_state = {
    'pegs': [[], [], []],
    'num_discs': 0,
    'moves': 0,
    'min_moves': 0,
    'start_time': None,
    'elapsed': 0,
    'solved': False
}

def reset_game(n):
    global game_state
    game_state = {
        'pegs': [[i for i in range(n, 0, -1)], [], []],
        'num_discs': n,
        'moves': 0,
        'min_moves': (2 ** n) - 1,
        'start_time': time.time(),
        'elapsed': 0,
        'solved': False
    }

def is_valid_move(from_peg, to_peg):
    if from_peg == to_peg:
        return False
    if not game_state['pegs'][from_peg]:
        return False
    from_top = game_state['pegs'][from_peg][-1]
    to_top = game_state['pegs'][to_peg][-1] if game_state['pegs'][to_peg] else math.inf
    return from_top < to_top

def make_move(from_peg, to_peg):
    if is_valid_move(from_peg, to_peg):
        disc = game_state['pegs'][from_peg].pop()
        game_state['pegs'][to_peg].append(disc)
        game_state['moves'] += 1

        solved = (
            len(game_state['pegs'][2]) == game_state['num_discs']
        )
        game_state['solved'] = solved

        elapsed = round(time.time() - game_state['start_time'], 1) if game_state['start_time'] else 0

        return True, {
            'pegs': game_state['pegs'],
            'moves': game_state['moves'],
            'min_moves': game_state['min_moves'],
            'num_discs': game_state['num_discs'],
            'won': solved,
            'elapsed': elapsed
        }
    return False, {'error': 'Invalid move', 'pegs': game_state['pegs']}

def solve_hanoi(n, source, target, auxiliary, moves_list):
    if n == 0:
        return
    solve_hanoi(n - 1, source, auxiliary, target, moves_list)
    moves_list.append((source, target))
    solve_hanoi(n - 1, auxiliary, target, source, moves_list)

@socketio.on('connect')
def handle_connect():
    elapsed = round(time.time() - game_state['start_time'], 1) if game_state['start_time'] else 0
    emit('state', {
        'pegs': game_state['pegs'],
        'num_discs': game_state['num_discs'],
        'moves': game_state['moves'],
        'min_moves': game_state['min_moves'],
        'won': game_state['solved'],
        'elapsed': elapsed
    })

@socketio.on('start_game')
def handle_start(data):
    n = max(1, min(6, int(data.get('num_discs', 3))))
    reset_game(n)
    emit('state', {
        'pegs': game_state['pegs'],
        'num_discs': game_state['num_discs'],
        'moves': 0,
        'min_moves': game_state['min_moves'],
        'won': False,
        'elapsed': 0
    }, broadcast=True)

@socketio.on('move')
def handle_move(data):
    valid, result = make_move(int(data['from']), int(data['to']))
    if valid:
        emit('state', result, broadcast=True)
    else:
        emit('invalid_move', {'from': data['from'], 'to': data['to']})

@socketio.on('get_solution')
def handle_solution(data):
    n = game_state['num_discs']
    moves_list = []
    solve_hanoi(n, 0, 2, 1, moves_list)
    emit('solution', {'moves': moves_list})

@socketio.on('reset')
def handle_reset(data):
    n = game_state['num_discs'] or int(data.get('num_discs', 3))
    reset_game(n)
    emit('state', {
        'pegs': game_state['pegs'],
        'num_discs': game_state['num_discs'],
        'moves': 0,
        'min_moves': game_state['min_moves'],
        'won': False,
        'elapsed': 0
    }, broadcast=True)

@app.route('/')
def index():
    return render_template('index.html')

if __name__ == '__main__':
    socketio.run(app, host='0.0.0.0', port=5000, debug=True)
