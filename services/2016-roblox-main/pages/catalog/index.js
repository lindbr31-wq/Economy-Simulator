import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { createUseStyles } from 'react-jss';
import Theme2016 from '../../components/theme2016';
import ItemArt from '../../components/itemArt';
import { CATEGORIES } from '../../lib/catalogItems';
import { getCatalog, getInventory } from '../../lib/webStore';
import { getItemUrl } from '../../services/catalog';

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
    display: 'flex',
    alignItems: 'center',
    gap: '14px',
    flexWrap: 'wrap',
  },
  wallet: {
    background: '#eef7ee',
    border: '1px solid #bcdcbc',
    borderRadius: '4px',
    padding: '3px 10px',
    fontSize: '13px',
    color: '#2c6b2c',
    fontWeight: 700,
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
      background: '#e84393',
      borderColor: '#e84393',
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
    display: 'block',
    color: 'inherit',
    textDecoration: 'none',
    '&:hover': { boxShadow: '0 2px 10px rgba(0,0,0,0.18)' },
  },
  tile: {
    width: '100%',
    aspectRatio: '1 / 1',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'linear-gradient(#fff, #dfe7ee)',
    '& svg': { width: '78%', height: '78%' },
  },
  cardBody: {
    padding: '8px 10px 10px',
    borderTop: '1px solid #eee',
  },
  itemName: {
    fontWeight: 700,
    fontSize: '14px',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  price: {
    marginTop: '4px',
    fontSize: '13px',
    fontWeight: 700,
    color: '#2c7fd0',
  },
  tix: {
    color: '#c0392b',
  },
  ownedBadge: {
    float: 'right',
    fontSize: '10px',
    background: '#2ecc71',
    color: '#fff',
    borderRadius: '3px',
    padding: '1px 6px',
  },
  empty: {
    padding: '40px 0',
    textAlign: 'center',
    color: '#888',
  },
});

const CatalogPage = () => {
  const s = useStyles();
  const [items, setItems] = useState(null);
  const [category, setCategory] = useState('all');
  const [query, setQuery] = useState('');
  const [owned, setOwned] = useState(new Set());
  const [wallet, setWallet] = useState(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const c = params.get('category');
    if (c && CATEGORIES.some((x) => x.key === c)) setCategory(c);
  }, []);

  useEffect(() => {
    let cancelled = false;
    getCatalog({ category, q: query }).then((r) => {
      if (!cancelled) setItems(r.items || []);
    });
    return () => {
      cancelled = true;
    };
  }, [category, query]);

  useEffect(() => {
    getInventory().then((r) => {
      if (r && r.items) setOwned(new Set(r.items.map((i) => Number(i.id))));
      if (r && r.wallet) setWallet(r.wallet);
    });
  }, []);

  return (
    <Theme2016>
      <div className="container">
        <h1 className={s.header}>Catalog</h1>
        <div className={s.sub}>
          <span>Hats, faces, shirts, pants and gear for your avatar.</span>
          {wallet && (
            <span className={s.wallet}>
              R$ {Number(wallet.robux).toLocaleString()} · {Number(wallet.tix).toLocaleString()} Tix
            </span>
          )}
          <Link href="/My/Character.aspx"><a>Edit avatar →</a></Link>
        </div>

        <div className={s.toolbar}>
          {CATEGORIES.map((c) => (
            <span
              key={c.key}
              className={s.chip + (category === c.key ? ' ' + s.chipActive : '')}
              onClick={() => setCategory(c.key)}
              role="button"
              tabIndex={0}
              onKeyPress={() => setCategory(c.key)}
            >
              {c.label}
            </span>
          ))}
          <input
            className={s.search}
            placeholder="Search catalog"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>

        {items === null && <div className={s.empty}>Loading catalog…</div>}
        {items !== null && items.length === 0 && <div className={s.empty}>No items found.</div>}

        <div className="row">
          {(items || []).map((item) => (
            <div className="col-6 col-sm-4 col-md-3 col-lg-2" key={item.id}>
              <Link href={getItemUrl({ assetId: item.id, name: item.name })}>
                <a className={s.card}>
                  <div className={s.tile}>
                    <ItemArt item={item} size={160} />
                  </div>
                  <div className={s.cardBody}>
                    {owned.has(Number(item.id)) && <span className={s.ownedBadge}>Owned</span>}
                    <div className={s.itemName} title={item.name}>{item.name}</div>
                    <div className={s.price + (item.currency === 'tix' ? ' ' + s.tix : '')}>
                      {item.currency === 'robux' ? `R$ ${Number(item.price).toLocaleString()}` : `${Number(item.price).toLocaleString()} Tix`}
                    </div>
                  </div>
                </a>
              </Link>
            </div>
          ))}
        </div>
      </div>
    </Theme2016>
  );
};

export const getStaticProps = () => ({
  props: {
    title: 'Catalog - ROBLOX',
  },
});

export default CatalogPage;
