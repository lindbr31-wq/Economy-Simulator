import Head from 'next/head';
import React, { useEffect, useRef, useState } from 'react';
import { createUseStyles } from 'react-jss';
import dynamic from 'next/dynamic';
import { getGameDetail, playGame, submitScore } from '../../lib/webStore';

const GamePlayer = dynamic(() => import('../../components/webGame'), { ssr: false });

// A replica of the 2016 Roblox desktop client join flow and in-game chrome:
// "Joining Game..." screen, the dark in-game top bar with the Roblox logo,
// the player leaderboard, the chat window and the Escape menu.

const useStyles = createUseStyles({
  // ---------- joining ----------
  joinRoot: {
    position: 'fixed',
    inset: 0,
    background: '#191919',
    color: '#fff',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    fontFamily: '"Source Sans Pro", Arial, Helvetica, sans-serif',
    zIndex: 50,
    userSelect: 'none',
  },
  joinLogo: {
    display: 'flex',
    alignItems: 'center',
    gap: 14,
    marginBottom: 34,
  },
  joinWordmark: {
    fontSize: 46,
    fontWeight: 900,
    letterSpacing: 3,
    color: '#fff',
  },
  spinner: {
    width: 46,
    height: 46,
    border: '5px solid rgba(255,255,255,0.18)',
    borderTopColor: '#fff',
    borderRadius: '50%',
    animation: '$spin 0.9s linear infinite',
    marginBottom: 22,
  },
  '@keyframes spin': {
    to: { transform: 'rotate(360deg)' },
  },
  joinTitle: {
    fontSize: 21,
    fontWeight: 700,
    marginBottom: 6,
  },
  joinSub: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.65)',
    marginBottom: 22,
  },
  joinBarOuter: {
    width: 320,
    height: 8,
    background: 'rgba(255,255,255,0.14)',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 26,
  },
  joinBarInner: {
    width: '45%',
    height: '100%',
    background: '#00b06f',
    borderRadius: 4,
    animation: '$slide 1.2s ease-in-out infinite alternate',
  },
  '@keyframes slide': {
    from: { marginLeft: '-40%' },
    to: { marginLeft: '95%' },
  },
  joinCancel: {
    background: 'none',
    border: '1px solid rgba(255,255,255,0.4)',
    color: 'rgba(255,255,255,0.8)',
    borderRadius: 4,
    padding: '7px 26px',
    fontSize: 14,
    cursor: 'pointer',
    '&:hover': { background: 'rgba(255,255,255,0.1)', color: '#fff' },
  },

  // ---------- client ----------
  clientRoot: {
    position: 'fixed',
    inset: 0,
    background: '#0c0c10',
    display: 'flex',
    flexDirection: 'column',
    fontFamily: '"Source Sans Pro", Arial, Helvetica, sans-serif',
    overflow: 'hidden',
  },
  topbar: {
    height: 38,
    background: '#232527',
    borderBottom: '1px solid #000',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0 10px',
    flexShrink: 0,
    zIndex: 10,
  },
  topbarLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  topbarWord: {
    color: '#fff',
    fontSize: 17,
    fontWeight: 900,
    letterSpacing: 1.5,
  },
  topbarRight: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
  },
  iconBtn: {
    background: 'transparent',
    border: 'none',
    color: '#cfcfcf',
    width: 32,
    height: 28,
    borderRadius: 3,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    '&:hover': { background: 'rgba(255,255,255,0.12)', color: '#fff' },
    '& svg': { width: 18, height: 18, fill: 'currentColor' },
  },
  stage: {
    flex: 1,
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    background: 'radial-gradient(ellipse at 50% 30%, #1d2229 0%, #0c0c10 75%)',
  },
  gameWrap: {
    width: 'min(96vw, 860px)',
    boxShadow: '0 0 0 1px rgba(255,255,255,0.08), 0 12px 42px rgba(0,0,0,0.55)',
    borderRadius: 4,
    overflow: 'hidden',
    position: 'relative',
    zIndex: 1,
  },

  // leaderboard
  leaderboard: {
    position: 'absolute',
    top: 10,
    right: 12,
    width: 190,
    background: 'rgba(29, 29, 33, 0.82)',
    border: '1px solid rgba(255,255,255,0.14)',
    borderRadius: 4,
    color: '#fff',
    fontSize: 13,
    zIndex: 5,
    overflow: 'hidden',
    '@media (max-width: 760px)': { display: 'none' },
  },
  lbHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    padding: '6px 10px',
    fontWeight: 700,
    borderBottom: '1px solid rgba(255,255,255,0.2)',
    color: '#fff',
  },
  lbRow: {
    display: 'flex',
    justifyContent: 'space-between',
    padding: '4px 10px',
    color: 'rgba(255,255,255,0.85)',
    '&:nth-child(odd)': { background: 'rgba(255,255,255,0.04)' },
  },
  lbMe: {
    color: '#8fd8ff',
    fontWeight: 700,
  },

  // chat
  chatWrap: {
    position: 'absolute',
    left: 12,
    bottom: 12,
    width: 280,
    zIndex: 6,
    '@media (max-width: 760px)': { display: 'none' },
  },
  chatToggle: {
    background: 'rgba(29,29,33,0.82)',
    border: '1px solid rgba(255,255,255,0.2)',
    color: '#cfcfcf',
    borderRadius: 4,
    padding: '6px 12px',
    fontSize: 12.5,
    cursor: 'pointer',
    '&:hover': { color: '#fff' },
  },
  chatPanel: {
    background: 'rgba(29,29,33,0.9)',
    border: '1px solid rgba(255,255,255,0.2)',
    borderRadius: 4,
    marginBottom: 8,
    overflow: 'hidden',
  },
  chatLines: {
    height: 148,
    overflowY: 'auto',
    padding: '8px 10px',
    fontSize: 12.5,
    color: '#ddd',
    '& b': { color: '#8fd8ff' },
  },
  chatInput: {
    display: 'flex',
    borderTop: '1px solid rgba(255,255,255,0.15)',
  },
  chatInputField: {
    flex: 1,
    background: 'transparent',
    border: 'none',
    color: '#fff',
    padding: '7px 10px',
    fontSize: 12.5,
    outline: 'none',
  },

  // escape menu
  escBackdrop: {
    position: 'absolute',
    inset: 0,
    background: 'rgba(0,0,0,0.55)',
    zIndex: 20,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  escPanel: {
    width: 300,
    background: '#fff',
    borderRadius: 8,
    padding: '22px 22px 18px',
    textAlign: 'center',
    boxShadow: '0 18px 60px rgba(0,0,0,0.5)',
    color: '#393b3d',
  },
  escLogo: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
    marginBottom: 18,
  },
  escWord: {
    fontSize: 26,
    fontWeight: 900,
    letterSpacing: 2,
    color: '#232527',
  },
  escBtn: {
    display: 'block',
    width: '100%',
    border: 'none',
    borderRadius: 6,
    padding: '11px 0',
    fontSize: 15,
    fontWeight: 700,
    color: '#fff',
    cursor: 'pointer',
    marginBottom: 9,
  },
  escResume: { background: '#00b06f', '&:hover': { background: '#009a61' } },
  escRestart: { background: '#9aa5b1', '&:hover': { background: '#848f9b' } },
  escLeave: { background: '#dd2e2e', '&:hover': { background: '#c42727' } },
  escSettings: {
    marginTop: 12,
    fontSize: 12.5,
    color: '#666',
    '& button': {
      border: '1px solid #c9cdd2',
      background: '#f2f4f5',
      borderRadius: 4,
      padding: '3px 10px',
      margin: '0 3px',
      cursor: 'pointer',
      fontSize: 12,
      '&.on': { background: '#232527', color: '#fff', borderColor: '#232527' },
    },
  },
  gfxTag: {
    position: 'absolute',
    left: 12,
    top: 10,
    color: 'rgba(255,255,255,0.45)',
    fontSize: 11,
    zIndex: 4,
  },
});

const RobloxLogo = ({ size = 28, color = '#fff', hole = '#232527' }) => (
  <svg width={size} height={size} viewBox="0 0 100 100" style={{ display: 'block' }}>
    <rect x="14" y="14" width="72" height="72" rx="10" transform="rotate(-15 50 50)" fill={color} />
    <rect x="38" y="38" width="24" height="24" transform="rotate(-15 50 50)" fill={hole} />
  </svg>
);

const PlayPage = () => {
  const s = useStyles();
  const [phase, setPhase] = useState('joining'); // joining | client
  const [game, setGame] = useState(null);
  const [placeId, setPlaceId] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatLines, setChatLines] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [quality, setQuality] = useState('Auto');
  const [board, setBoard] = useState([]);
  const [myScore, setMyScore] = useState(0);
  const [username, setUsername] = useState('You');
  const chatEndRef = useRef(null);

  const loadBoard = (id) => {
    fetch('/api/web/games/' + id + '/score')
      .then(r => r.json())
      .then(d => setBoard((d.data || []).map(v => ({ name: v.username, score: v.score }))))
      .catch(() => {});
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const id = Number(params.get('placeId')) || 101;
    setPlaceId(id);
    fetch('/api/auth/me')
      .then(r => r.json())
      .then(d => {
        const u = (d && d.data) || d || {};
        setUsername(u.username || u.name || 'You');
      })
      .catch(() => {});
    getGameDetail(id).then(d => {
      const row = (d && (d.data || d)) || {};
      setGame({
        id,
        name: row.name || 'Game',
        tagline: row.tagline || '',
        instructions: row.instructions || '',
        slug: row.slug || 'Game',
        thumb_key: row.thumb_key || row.thumbKey || { 101: 'skyObby', 102: 'brickBusters', 103: 'crossyCanyon' }[id] || 'skyObby',
      });
    }).catch(() => {
      setGame({ id, name: 'Game', slug: 'Game', thumb_key: { 101: 'skyObby', 102: 'brickBusters', 103: 'crossyCanyon' }[id] || 'skyObby' });
    });
    loadBoard(id);
    setChatLines([{ sys: true, text: 'Welcome to the server! Say hi.' }]);
    const t = setTimeout(() => setPhase('client'), 2400);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (chatEndRef.current) chatEndRef.current.scrollTop = chatEndRef.current.scrollHeight;
  }, [chatLines, chatOpen]);

  const sendChat = () => {
    const text = chatInput.trim();
    if (!text) return;
    setChatLines(lines => [...lines, { name: username || 'You', text }]);
    setChatInput('');
  };

  const leave = () => {
    if (placeId && game && game.slug) {
      window.location.href = '/games/' + placeId + '/' + encodeURIComponent(String(game.slug).replace(/ /g, '-'));
    } else {
      window.location.href = '/games';
    }
  };

  return (
    <>
      <Head>
        <title>{(game && game.name) || 'Game'} - ROBLOX</title>
      </Head>

      {phase === 'joining' && (
        <div className={s.joinRoot}>
          <div className={s.joinLogo}>
            <RobloxLogo size={62} color="#fff" hole="#191919" />
            <div className={s.joinWordmark}>ROBLOX</div>
          </div>
          <div className={s.spinner} />
          <div className={s.joinTitle}>Joining Game...</div>
          <div className={s.joinSub}>Waiting for an available server &middot; {(game && game.name) || ''}</div>
          <div className={s.joinBarOuter}><div className={s.joinBarInner} /></div>
          <button type="button" className={s.joinCancel} onClick={leave}>Cancel</button>
        </div>
      )}

      {phase === 'client' && (
        <div className={s.clientRoot}>
          <div className={s.topbar}>
            <div className={s.topbarLeft}>
              <RobloxLogo size={22} color="#fff" hole="#232527" />
              <span className={s.topbarWord}>ROBLOX</span>
            </div>
            <div className={s.topbarRight}>
              <button type="button" className={s.iconBtn} title="Chat" onClick={() => setChatOpen(v => !v)}>
                <svg viewBox="0 0 24 24"><path d="M20 2H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h4l4 4 4-4h4a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2z"/></svg>
              </button>
              <button type="button" className={s.iconBtn} title="Players" onClick={() => setMenuOpen(false)}>
                <svg viewBox="0 0 24 24"><path d="M16 11a4 4 0 1 0-4-4 4 4 0 0 0 4 4zm-8 1a3 3 0 1 0-3-3 3 3 0 0 0 3 3zm0 2c-2.7 0-8 1.3-8 4v3h9v-2.4c0-1 .4-2.7 2.4-3.9A15 15 0 0 0 8 14zm8 0c-2.7 0-8 1.3-8 4v3h16v-3c0-2.7-5.3-4-8-4z"/></svg>
              </button>
              <button type="button" className={s.iconBtn} title="Menu" onClick={() => setMenuOpen(v => !v)}>
                <svg viewBox="0 0 24 24"><path d="M3 6h18v2H3zM3 11h18v2H3zM3 16h18v2H3z"/></svg>
              </button>
            </div>
          </div>

          <div className={s.stage}>
            <div className={s.gfxTag}>Graphics: {quality}</div>

            <div className={s.gameWrap}>
              {game && (
                <GamePlayer
                  game={game}
                  onEscape={() => setMenuOpen(v => !v)}
                  onScoreChange={setMyScore}
                  onPlayed={() => {
                    playGame(placeId).catch(() => {});
                    setChatLines(lines => [...lines, { sys: true, text: (username || 'You') + ' joined the game.' }]);
                  }}
                  onSubmitScore={(score) =>
                    submitScore(placeId, score)
                      .then(r => {
                        loadBoard(placeId);
                        return { best: (r && (r.best || (r.data && r.data.best))) || score, score };
                      })
                      .catch(() => ({ best: score, score }))
                  }
                />
              )}
            </div>

            <div className={s.leaderboard}>
              <div className={s.lbHeader}><span>Players</span><span>Points</span></div>
              <div className={`${s.lbRow} ${s.lbMe}`}><span>{username || 'You'}</span><span>{myScore}</span></div>
              {board.slice(0, 9).map((v, i) => (
                <div key={i} className={s.lbRow}><span>{v.name}</span><span>{v.score}</span></div>
              ))}
              {board.length === 0 && (
                <div className={s.lbRow}><span style={{ opacity: 0.55 }}>No scores yet</span><span></span></div>
              )}
            </div>

            <div className={s.chatWrap}>
              {chatOpen && (
                <div className={s.chatPanel}>
                  <div className={s.chatLines}>
                    {chatLines.map((l, i) => (
                      <div key={i}>{l.sys ? <em style={{ color: '#9aa5b1' }}>{l.text}</em> : <span><b>{l.name}:</b> {l.text}</span>}</div>
                    ))}
                    <div ref={chatEndRef} />
                  </div>
                  <div className={s.chatInput}>
                    <input
                      className={s.chatInputField}
                      value={chatInput}
                      placeholder="Say something..."
                      onChange={e => setChatInput(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') { e.preventDefault(); sendChat(); }
                        if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); setChatOpen(false); }
                      }}
                    />
                  </div>
                </div>
              )}
              <button type="button" className={s.chatToggle} onClick={() => setChatOpen(v => !v)}>
                {chatOpen ? 'Close Chat' : 'To chat click here or press "/" key'}
              </button>
            </div>

            {menuOpen && (
              <div className={s.escBackdrop} onClick={() => setMenuOpen(false)}>
                <div className={s.escPanel} onClick={e => e.stopPropagation()}>
                  <div className={s.escLogo}>
                    <RobloxLogo size={30} color="#232527" hole="#fff" />
                    <span className={s.escWord}>ROBLOX</span>
                  </div>
                  <button type="button" className={`${s.escBtn} ${s.escResume}`} onClick={() => setMenuOpen(false)}>Resume Game</button>
                  <button type="button" className={`${s.escBtn} ${s.escRestart}`} onClick={() => { setMenuOpen(false); window.location.reload(); }}>Rejoin Game</button>
                  <button type="button" className={`${s.escBtn} ${s.escLeave}`} onClick={leave}>Leave Game</button>
                  <div className={s.escSettings}>
                    Graphics Mode:
                    <div style={{ marginTop: 6 }}>
                      {['Auto', 'Low', 'High'].map(q => (
                        <button key={q} type="button" className={quality === q ? 'on' : ''} onClick={() => setQuality(q)}>{q}</button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
};

export default PlayPage;
