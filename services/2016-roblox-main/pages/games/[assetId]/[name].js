import React, { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { createUseStyles } from 'react-jss';
import Theme2016 from '../../../components/theme2016';
import GamePlayer from '../../../components/webGame';
import { getGameDetail, playGame, submitScore, voteGame } from '../../../lib/webStore';

const useStyles = createUseStyles({
  header: {
    fontWeight: 700,
    fontSize: '26px',
    margin: '10px 0 2px',
  },
  sub: {
    color: '#666',
    fontSize: '13px',
    marginBottom: '10px',
  },
  panel: {
    background: '#fff',
    border: '1px solid #ddd',
    borderRadius: '4px',
    padding: '12px 14px',
    marginBottom: '14px',
  },
  panelTitle: {
    fontWeight: 700,
    fontSize: '15px',
    borderBottom: '1px solid #eee',
    paddingBottom: '6px',
    marginBottom: '8px',
  },
  statRow: {
    display: 'flex',
    justifyContent: 'space-between',
    padding: '3px 0',
    fontSize: '13px',
    color: '#444',
  },
  voteRow: {
    display: 'flex',
    gap: '8px',
    marginTop: '10px',
  },
  voteBtn: {
    flex: 1,
    padding: '6px 0',
    border: '1px solid #ccc',
    background: '#f7f7f7',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '14px',
  },
  voteActive: {
    background: '#3fc1c9',
    color: '#fff',
    borderColor: '#3fc1c9',
  },
  lbRow: {
    display: 'flex',
    justifyContent: 'space-between',
    padding: '4px 0',
    fontSize: '13px',
    borderBottom: '1px dotted #eee',
    '&:last-child': { borderBottom: 'none' },
  },
  rank: {
    display: 'inline-block',
    width: '22px',
    color: '#888',
  },
  desc: {
    fontSize: '13.5px',
    color: '#333',
    lineHeight: 1.55,
    whiteSpace: 'pre-wrap',
  },
  tab: {
    padding: '6px 14px',
    cursor: 'pointer',
    border: '1px solid #ccc',
    borderBottom: 'none',
    background: '#eee',
    fontSize: '13px',
    '&$tabActive': {
      background: '#fff',
      fontWeight: 700,
    },
  },
  tabActive: {},
  modeNote: {
    fontSize: '11.5px',
    color: '#996c00',
    background: '#fff7dd',
    border: '1px solid #f0e0a0',
    borderRadius: '4px',
    padding: '5px 8px',
    marginTop: '8px',
  },
});

const fmt = (n) => (typeof n === 'number' ? n.toLocaleString() : '0');

const GamePage = () => {
  const s = useStyles();
  const router = useRouter();
  const assetId = router && router.query ? Number(router.query.assetId) : null;

  const [detail, setDetail] = useState(null);
  const [tab, setTab] = useState('description');
  const [voteMsg, setVoteMsg] = useState('');

  const refresh = useCallback(() => {
    if (!assetId) return;
    getGameDetail(assetId).then(setDetail);
  }, [assetId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const onSubmitScore = useCallback(
    (score) => submitScore(assetId, score).then((r) => {
      setTimeout(refresh, 300);
      return r;
    }),
    [assetId, refresh],
  );

  const onPlayed = useCallback(() => playGame(assetId), [assetId]);

  const onVote = async (vote) => {
    const r = await voteGame(assetId, vote);
    setVoteMsg(
      r.notLoggedIn
        ? 'Log in to vote — your vote was kept locally.'
        : r.mode === 'local'
          ? 'Vote saved locally.'
          : 'Vote saved!',
    );
    refresh();
    setTimeout(() => setVoteMsg(''), 2500);
  };

  if (!detail) {
    return (
      <Theme2016>
        <div className="container" style={{ padding: '30px 0', color: '#888' }}>Loading game…</div>
      </Theme2016>
    );
  }

  const { game, scores, myBest, myVote } = detail;
  const total = (Number(game.likes) || 0) + (Number(game.dislikes) || 0);
  const pct = total > 0 ? Math.round((Number(game.likes) / total) * 100) : 100;

  return (
    <Theme2016>
      <div className="container">
        <h1 className={s.header}>{game.name}</h1>
        <div className={s.sub}>By <strong>{game.creator}</strong> · {game.genre}</div>

        <div className="row">
          <div className="col-12 col-lg-8">
            <GamePlayer game={game} onSubmitScore={onSubmitScore} onPlayed={onPlayed} />
            {detail.mode === 'local' && (
              <div className={s.modeNote}>
                Playing in local mode — the games server API is unreachable, so stats and scores are kept in this browser.
              </div>
            )}

            <div style={{ marginTop: 14, display: 'flex' }}>
              <span className={s.tab + (tab === 'description' ? ' ' + s.tabActive : '')} onClick={() => setTab('description')}>
                Description
              </span>
              <span className={s.tab + (tab === 'instructions' ? ' ' + s.tabActive : '')} onClick={() => setTab('instructions')}>
                Instructions
              </span>
            </div>
            <div className={s.panel} style={{ borderTopLeftRadius: 0 }}>
              <div className={s.desc}>{tab === 'description' ? game.description : game.instructions}</div>
            </div>
          </div>

          <div className="col-12 col-lg-4">
            <div className={s.panel}>
              <div className={s.panelTitle}>Stats</div>
              <div className={s.statRow}><span>Visits</span><strong>{fmt(Number(game.plays))}</strong></div>
              <div className={s.statRow}><span>Like ratio</span><strong style={{ color: pct >= 60 ? '#2ecc71' : '#e67e22' }}>{pct}%</strong></div>
              <div className={s.statRow}><span>Likes</span><strong>{fmt(Number(game.likes))}</strong></div>
              <div className={s.statRow}><span>Dislikes</span><strong>{fmt(Number(game.dislikes))}</strong></div>
              {myBest !== null && myBest !== undefined && (
                <div className={s.statRow}><span>Your best</span><strong style={{ color: '#2c7fd0' }}>{fmt(Number(myBest))}</strong></div>
              )}
              <div className={s.voteRow}>
                <button
                  type="button"
                  className={s.voteBtn + (myVote === 1 ? ' ' + s.voteActive : '')}
                  onClick={() => onVote(myVote === 1 ? 0 : 1)}
                >
                  👍 Like
                </button>
                <button
                  type="button"
                  className={s.voteBtn + (myVote === -1 ? ' ' + s.voteActive : '')}
                  onClick={() => onVote(myVote === -1 ? 0 : -1)}
                >
                  👎 Dislike
                </button>
              </div>
              {voteMsg && <div className={s.modeNote}>{voteMsg}</div>}
            </div>

            <div className={s.panel}>
              <div className={s.panelTitle}>Leaderboard</div>
              {(!scores || scores.length === 0) && (
                <div style={{ fontSize: 13, color: '#888' }}>No scores yet — be the first!</div>
              )}
              {(scores || []).map((row, i) => (
                <div className={s.lbRow} key={i}>
                  <span><span className={s.rank}>{i + 1}.</span> {row.username}</span>
                  <strong>{fmt(Number(row.score))}</strong>
                </div>
              ))}
            </div>

            <div className={s.panel}>
              <div className={s.panelTitle}>More Games</div>
              <div style={{ fontSize: 13 }}>
                <Link href="/games"><a>Browse all games →</a></Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Theme2016>
  );
};

export const getServerSideProps = () => ({
  props: {
    title: 'Play - ROBLOX',
  },
});

export default GamePage;
