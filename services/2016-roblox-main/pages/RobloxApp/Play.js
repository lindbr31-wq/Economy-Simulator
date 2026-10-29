import Head from 'next/head';
import Link from 'next/link';
import React, { useEffect, useState } from 'react';
import { createUseStyles } from 'react-jss';
import dynamic from 'next/dynamic';
import Theme2016 from '../../components/theme2016';
import { getGameDetail, playGame, submitScore } from '../../lib/webStore';

const GamePlayer = dynamic(() => import('../../components/webGame'), { ssr: false });

const useStyles = createUseStyles({
  page: {
    background: '#fff',
    padding: '10px 14px 24px',
  },
  header: {
    fontWeight: 700,
    fontSize: '26px',
    margin: '6px 0 2px',
    color: '#343434',
  },
  sub: {
    color: '#666',
    fontSize: '13px',
    marginBottom: '12px',
    '& a': {
      color: '#00a2ff',
    },
  },
  frame: {
    maxWidth: '800px',
    margin: '0 auto',
  },
});

const DEFAULT_THUMBS = { 101: 'skyObby', 102: 'brickBusters', 103: 'crossyCanyon' };

const PlayPage = () => {
  const s = useStyles();
  const [game, setGame] = useState(null);
  const [placeId, setPlaceId] = useState(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const id = Number(params.get('placeId')) || 101;
    setPlaceId(id);
    getGameDetail(id).then(d => {
      const row = (d && (d.data || d)) || {};
      setGame({
        id,
        name: row.name || 'Game',
        thumb_key: row.thumb_key || row.thumbKey || DEFAULT_THUMBS[id] || 'skyObby',
      });
    }).catch(() => {
      setGame({ id, name: 'Game', thumb_key: DEFAULT_THUMBS[id] || 'skyObby' });
    });
  }, []);

  return (
    <Theme2016>
      <Head>
        <title>{(game && game.name) || 'Play'} - ROBLOX</title>
      </Head>
      <div className={'container ' + s.page}>
        <div className={s.frame}>
          <h1 className={s.header}>{game ? game.name : 'Loading…'}</h1>
          <p className={s.sub}>
            <Link href="/games"><a>← Back to Games</a></Link>
            {' · '}Play with arrow keys / WASD, Space to jump or launch. Press Esc to pause.
          </p>
          {game && placeId ? (
            <GamePlayer
              game={game}
              onPlayed={() => { playGame(placeId).catch(() => {}); }}
              onSubmitScore={(score) => submitScore(placeId, score).then(r => ({ best: (r && (r.best || r.data && r.data.best)) || score, score })).catch(() => ({ best: score, score }))}
            />
          ) : null}
        </div>
      </div>
    </Theme2016>
  );
};

export default PlayPage;
