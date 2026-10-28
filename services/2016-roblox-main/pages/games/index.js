import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { createUseStyles } from 'react-jss';
import Theme2016 from '../../components/theme2016';
import GameThumb from '../../components/webGame/thumbs';
import { getGames } from '../../lib/webStore';
import { getGameUrl } from '../../services/games';

const useStyles = createUseStyles({
  header: {
    fontWeight: 700,
    fontSize: '30px',
    margin: '10px 0 4px',
  },
  sub: {
    color: '#666',
    marginBottom: '12px',
    fontSize: '13px',
  },
  toolbar: {
    background: '#e3e3e3',
    padding: '8px 12px',
    borderRadius: '4px',
    marginBottom: '12px',
    display: 'flex',
    flexWrap: 'wrap',
    gap: '8px',
    alignItems: 'center',
  },
  chip: {
    border: '1px solid #aaa',
    background: '#f8f8f8',
    borderRadius: '14px',
    padding: '3px 12px',
    fontSize: '13px',
    cursor: 'pointer',
    '&$chipActive': {
      background: '#3fc1c9',
      borderColor: '#3fc1c9',
      color: '#fff',
    },
  },
  chipActive: {},
  search: {
    marginLeft: 'auto',
    padding: '4px 10px',
    border: '1px solid #aaa',
    borderRadius: '4px',
    minWidth: '180px',
    fontSize: '13px',
  },
  card: {
    background: '#fff',
    border: '1px solid #ddd',
    borderRadius: '4px',
    overflow: 'hidden',
    marginBottom: '16px',
    transition: 'box-shadow 0.15s',
    display: 'block',
    color: 'inherit',
    textDecoration: 'none',
    '&:hover': {
      boxShadow: '0 2px 10px rgba(0,0,0,0.18)',
    },
  },
  thumb: {
    width: '100%',
    aspectRatio: '16 / 9',
    overflow: 'hidden',
    background: '#cde4f5',
    '& svg': {
      display: 'block',
      width: '100%',
      height: '100%',
    },
  },
  cardBody: {
    padding: '8px 10px 10px',
  },
  gameName: {
    fontWeight: 700,
    fontSize: '15px',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  tagline: {
    color: '#777',
    fontSize: '12px',
    height: '32px',
    overflow: 'hidden',
    margin: '2px 0 6px',
  },
  stats: {
    display: 'flex',
    justifyContent: 'space-between',
    color: '#555',
    fontSize: '12px',
  },
  empty: {
    padding: '40px 0',
    textAlign: 'center',
    color: '#888',
  },
});

const GENRES = ['All', 'Adventure', 'Arcade', 'Classic'];

const fmt = (n) => (typeof n === 'number' ? n.toLocaleString() : '0');

const GamesPage = () => {
  const s = useStyles();
  const [games, setGames] = useState(null);
  const [genre, setGenre] = useState('All');
  const [query, setQuery] = useState('');

  useEffect(() => {
    let cancelled = false;
    getGames().then((r) => {
      if (!cancelled) setGames(r.games || []);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = (games || []).filter((g) => {
    if (genre !== 'All' && g.genre !== genre) return false;
    if (query && !(`${g.name} ${g.tagline || ''}`.toLowerCase().includes(query.toLowerCase()))) return false;
    return true;
  });

  return (
    <Theme2016>
      <div className="container">
        <h1 className={s.header}>Games</h1>
        <div className={s.sub}>
          Play instant web games — no game server required. Scores save to your account (or locally).
        </div>
        <div className={s.toolbar}>
          {GENRES.map((g) => (
            <span
              key={g}
              className={s.chip + (genre === g ? ' ' + s.chipActive : '')}
              onClick={() => setGenre(g)}
              role="button"
              tabIndex={0}
              onKeyPress={() => setGenre(g)}
            >
              {g}
            </span>
          ))}
          <input
            className={s.search}
            placeholder="Search games"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>

        {games === null && <div className={s.empty}>Loading games…</div>}
        {games !== null && filtered.length === 0 && (
          <div className={s.empty}>No games match your search.</div>
        )}

        <div className="row">
          {filtered.map((g) => {
            const total = (Number(g.likes) || 0) + (Number(g.dislikes) || 0);
            const pct = total > 0 ? Math.round((Number(g.likes) / total) * 100) : 100;
            return (
              <div className="col-12 col-sm-6 col-md-4 col-lg-3" key={g.id}>
                <Link href={getGameUrl({ placeId: g.id, name: g.name })}>
                  <a className={s.card}>
                    <div className={s.thumb}>
                      <GameThumb game={g} />
                    </div>
                    <div className={s.cardBody}>
                      <div className={s.gameName}>{g.name}</div>
                      <div className={s.tagline}>{g.tagline}</div>
                      <div className={s.stats}>
                        <span>▶ {fmt(Number(g.plays))} visits</span>
                        <span style={{ color: pct >= 60 ? '#2ecc71' : '#e67e22' }}>👍 {pct}%</span>
                      </div>
                    </div>
                  </a>
                </Link>
              </div>
            );
          })}
        </div>
      </div>
    </Theme2016>
  );
};

export const getStaticProps = () => ({
  props: {
    title: 'Games - ROBLOX',
  },
});

export default GamesPage;
