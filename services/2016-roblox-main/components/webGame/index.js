import React, { useCallback, useEffect, useRef, useState } from 'react';
import createSkyObby from './games/skyObby';
import createBrickBusters from './games/brickBusters';
import createCrossyCanyon from './games/crossyCanyon';

const FACTORIES = {
  skyObby: createSkyObby,
  brickBusters: createBrickBusters,
  crossyCanyon: createCrossyCanyon,
};

const W = 800;
const H = 450;

// The web game client: canvas + input + HUD + pause/game-over flow.
// No game server - the game loop runs entirely in the browser and scores
// are handed to the page via onSubmitScore (Supabase or localStorage).
const GamePlayer = ({ game, onSubmitScore, onPlayed, onScoreChange, onEscape }) => {
  const canvasRef = useRef(null);
  const gameRef = useRef(null);
  const inputRef = useRef(null);
  const stateRef = useRef('menu'); // menu | playing | paused | over
  const scoreRef = useRef(0);
  const rafRef = useRef(0);

  const [state, setState] = useState('menu');
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [result, setResult] = useState(null); // { score, best, mode }

  const thumbKey = (game && (game.thumb_key || game.thumbKey)) || 'skyObby';
  const factory = FACTORIES[thumbKey] || createSkyObby;

  const setStateBoth = (s) => {
    stateRef.current = s;
    setState(s);
  };

  const gameApi = {
    setScore: (n) => {
      scoreRef.current = n;
      setScore(n);
      if (onScoreChange) onScoreChange(n);
    },
    addScore: (n) => {
      scoreRef.current += n;
      setScore(scoreRef.current);
      if (onScoreChange) onScoreChange(scoreRef.current);
    },
    setLives: (n) => setLives(n),
    gameOver: () => {
      setStateBoth('over');
    },
  };

  const buildInput = () => ({
    held: { left: false, right: false, up: false, down: false, jump: false },
    pressed: { left: false, right: false, up: false, down: false, jump: false, pointer: false },
    pointer: { x: null, y: null, down: false },
    tapped: null,
  });

  const startGame = useCallback(() => {
    if (!gameRef.current) return;
    gameRef.current.reset();
    setResult(null);
    setScore(0);
    setLives(3);
    scoreRef.current = 0;
    if (onPlayed) onPlayed();
    setStateBoth('playing');
  }, [onPlayed]);

  // set up the game instance + canvas + loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    inputRef.current = buildInput();
    gameRef.current = factory(gameApi, canvas);
    const ctx = gameRef.current && gameRef.current.draw ? canvas.getContext('2d') : null;

    const clearPressed = () => {
      const p = inputRef.current.pressed;
      p.left = p.right = p.up = p.down = p.jump = p.pointer = false;
      inputRef.current.tapped = null;
    };

    let last = performance.now();
    const loop = (now) => {
      rafRef.current = requestAnimationFrame(loop);
      let dt = (now - last) / 1000;
      last = now;
      if (dt > 0.05) dt = 0.05;
      const g = gameRef.current;
      if (!g) return;
      if (stateRef.current === 'playing') {
        g.update(dt, inputRef.current);
      }
      if (g.draw) g.draw(ctx);
      clearPressed();
    };
    rafRef.current = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // keyboard
  useEffect(() => {
    const keymap = {
      ArrowLeft: 'left', a: 'left', A: 'left',
      ArrowRight: 'right', d: 'right', D: 'right',
      ArrowUp: 'up', w: 'up', W: 'up', ' ': 'jump',
      ArrowDown: 'down', s: 'down', S: 'down',
    };
    const onKeyDown = (e) => {
      const k = keymap[e.key];
      if (!k) {
        if (e.key === 'Escape' && onEscape) {
          e.preventDefault();
          onEscape();
          return;
        }
        if (e.key === 'Escape' || e.key === 'p' || e.key === 'P') {
          if (stateRef.current === 'playing') setStateBoth('paused');
          else if (stateRef.current === 'paused') setStateBoth('playing');
        }
        return;
      }
      if (stateRef.current === 'playing') e.preventDefault();
      const inp = inputRef.current;
      if (!inp) return;
      if (!inp.held[k]) inp.pressed[k] = true;
      inp.held[k] = true;
      if (k === 'up') {
        if (!inp.held.jump) inp.pressed.jump = true;
        inp.held.jump = true;
      }
    };
    const onKeyUp = (e) => {
      const k = keymap[e.key];
      const inp = inputRef.current;
      if (!k || !inp) return;
      inp.held[k] = false;
      if (k === 'up') inp.held.jump = false;
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, []);

  // pointer / touch
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    const toLocal = (e) => {
      const rect = canvas.getBoundingClientRect();
      const src = e.touches && e.touches[0] ? e.touches[0] : e;
      return {
        x: ((src.clientX - rect.left) / rect.width) * W,
        y: ((src.clientY - rect.top) / rect.height) * H,
      };
    };
    const onDown = (e) => {
      const p = toLocal(e);
      const inp = inputRef.current;
      if (!inp) return;
      inp.pointer = { x: p.x, y: p.y, down: true };
      inp.pressed.pointer = true;
      inp.tapped = { x: p.x, y: p.y };
    };
    const onMove = (e) => {
      const p = toLocal(e);
      const inp = inputRef.current;
      if (!inp) return;
      inp.pointer = { x: p.x, y: p.y, down: inp.pointer.down };
    };
    const onUp = () => {
      const inp = inputRef.current;
      if (!inp) return;
      inp.pointer = { x: inp.pointer.x, y: inp.pointer.y, down: false };
    };
    canvas.addEventListener('mousedown', onDown);
    canvas.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    canvas.addEventListener('touchstart', onDown, { passive: true });
    canvas.addEventListener('touchmove', onMove, { passive: true });
    window.addEventListener('touchend', onUp);
    return () => {
      canvas.removeEventListener('mousedown', onDown);
      canvas.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      canvas.removeEventListener('touchstart', onDown);
      canvas.removeEventListener('touchmove', onMove);
      window.removeEventListener('touchend', onUp);
    };
  }, []);

  // auto-pause when tab hidden
  useEffect(() => {
    const onVis = () => {
      if (document.hidden && stateRef.current === 'playing') setStateBoth('paused');
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, []);

  // when the game ends: submit score
  useEffect(() => {
    if (state !== 'over') return undefined;
    let cancelled = false;
    (async () => {
      const s = scoreRef.current;
      const r = onSubmitScore ? await onSubmitScore(s) : { best: s };
      if (!cancelled) setResult({ score: s, ...r });
    })();
    return () => {
      cancelled = true;
    };
  }, [state, onSubmitScore]);

  return (
    <div style={{ position: 'relative', background: '#000', borderRadius: 4, overflow: 'hidden' }}>
      {/* HUD */}
      <div
        style={{
          position: 'absolute', top: 0, left: 0, right: 0, height: 36,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '0 12px', background: 'rgba(0,0,0,0.55)', color: '#fff',
          fontFamily: 'Arial, Helvetica, sans-serif', fontSize: 15, zIndex: 3,
        }}
      >
        <div><strong>Score:</strong> {score}</div>
        <div>{lives > 0 && state !== 'menu' ? '❤ '.repeat(Math.min(lives, 6)) : ''}</div>
        <div style={{ display: 'flex', gap: 8 }}>
          {state === 'playing' && (
            <button
              type="button"
              onClick={() => setStateBoth('paused')}
              style={btnStyle}
            >
              Pause
            </button>
          )}
        </div>
      </div>

      <canvas
        ref={canvasRef}
        width={W}
        height={H}
        style={{ display: 'block', width: '100%', height: 'auto', touchAction: 'none' }}
      />

      {/* Menu overlay */}
      {state === 'menu' && (
        <div style={overlayStyle}>
          <div style={{ fontSize: 26, fontWeight: 700, marginBottom: 6 }}>{game ? game.name : 'Game'}</div>
          <div style={{ opacity: 0.85, marginBottom: 18 }}>{game ? game.tagline : ''}</div>
          <button type="button" onClick={startGame} style={bigPlayStyle}>
            ▶ Play
          </button>
          <div style={{ marginTop: 14, fontSize: 13, opacity: 0.8, maxWidth: 460 }}>
            {game ? game.instructions : ''}
          </div>
        </div>
      )}

      {/* Paused overlay */}
      {state === 'paused' && (
        <div style={overlayStyle}>
          <div style={{ fontSize: 24, fontWeight: 700, marginBottom: 14 }}>Paused</div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button type="button" onClick={() => setStateBoth('playing')} style={bigPlayStyle}>
              Resume
            </button>
            <button type="button" onClick={startGame} style={{ ...bigPlayStyle, background: '#7f8c8d' }}>
              Restart
            </button>
          </div>
        </div>
      )}

      {/* Game over overlay */}
      {state === 'over' && (
        <div style={overlayStyle}>
          <div style={{ fontSize: 26, fontWeight: 700, marginBottom: 4 }}>Game Over!</div>
          <div style={{ fontSize: 18, marginBottom: 8 }}>
            Score: <strong>{result ? result.score : score}</strong>
            {result && typeof result.best === 'number' ? (
              <span style={{ marginLeft: 12, color: '#f5c518' }}>Best: {result.best}</span>
            ) : null}
          </div>
          {result && result.mode === 'local' && (
            <div style={{ fontSize: 12, color: '#ffe97a', marginBottom: 8 }}>
              {result.notLoggedIn
                ? 'Log in to save your score to the leaderboard (kept locally for now).'
                : 'Saved locally (server unreachable).'}
            </div>
          )}
          <button type="button" onClick={startGame} style={bigPlayStyle}>
            Play Again
          </button>
        </div>
      )}
    </div>
  );
};

const overlayStyle = {
  position: 'absolute',
  inset: 0,
  zIndex: 4,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  background: 'rgba(10, 16, 28, 0.78)',
  color: '#fff',
  textAlign: 'center',
  padding: 16,
  fontFamily: 'Arial, Helvetica, sans-serif',
};

const bigPlayStyle = {
  background: '#2ecc71',
  color: '#fff',
  border: 'none',
  borderRadius: 6,
  padding: '12px 34px',
  fontSize: 19,
  fontWeight: 700,
  cursor: 'pointer',
};

const btnStyle = {
  background: 'rgba(255,255,255,0.18)',
  color: '#fff',
  border: '1px solid rgba(255,255,255,0.35)',
  borderRadius: 4,
  padding: '2px 10px',
  fontSize: 13,
  cursor: 'pointer',
};

export default GamePlayer;
