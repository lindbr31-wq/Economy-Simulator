import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { createUseStyles } from 'react-jss';
import Theme2016 from '../../../components/theme2016';
import ItemArt from '../../../components/itemArt';
import { getItemDetail, buy, getInventory } from '../../../lib/webStore';

const useStyles = createUseStyles({
  breadcrumb: {
    fontSize: '12px',
    color: '#888',
    margin: '10px 0',
    '& a': { color: '#2c7fd0' },
  },
  panel: {
    background: '#fff',
    border: '1px solid #ddd',
    borderRadius: '4px',
    padding: '18px',
  },
  title: {
    fontWeight: 700,
    fontSize: '24px',
    marginBottom: '2px',
  },
  creator: {
    color: '#777',
    fontSize: '13px',
    marginBottom: '12px',
  },
  price: {
    fontSize: '20px',
    fontWeight: 700,
    color: '#2c7fd0',
    margin: '10px 0',
  },
  tix: {
    color: '#c0392b',
  },
  desc: {
    fontSize: '13.5px',
    color: '#333',
    lineHeight: 1.6,
    marginTop: '12px',
    borderTop: '1px solid #eee',
    paddingTop: '12px',
    whiteSpace: 'pre-wrap',
  },
  buyBtn: {
    background: '#2ecc71',
    color: '#fff',
    border: 'none',
    borderRadius: '4px',
    padding: '10px 28px',
    fontSize: '16px',
    fontWeight: 700,
    cursor: 'pointer',
    width: '100%',
    '&:disabled': { background: '#95c9a3', cursor: 'default' },
  },
  wearBtn: {
    background: '#3fc1c9',
    display: 'block',
    textAlign: 'center',
    color: '#fff',
    borderRadius: '4px',
    padding: '10px 28px',
    fontSize: '16px',
    fontWeight: 700,
    cursor: 'pointer',
    width: '100%',
    textDecoration: 'none',
    marginTop: '8px',
  },
  msg: {
    marginTop: '8px',
    fontSize: '12.5px',
    padding: '6px 8px',
    borderRadius: '4px',
  },
  msgOk: { background: '#e8f8ee', color: '#2c6b2c', border: '1px solid #bcdcbc' },
  msgErr: { background: '#fdeaea', color: '#a33', border: '1px solid #e5b8b8' },
  tileBig: {
    background: 'linear-gradient(#fff, #dfe7ee)',
    border: '1px solid #ddd',
    borderRadius: '6px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '18px',
    '& svg': { width: '100%', height: 'auto', maxWidth: '320px' },
  },
});

const ItemPage = () => {
  const s = useStyles();
  const router = useRouter();
  const assetId = router && router.query ? Number(router.query.assetId) : null;

  const [detail, setDetail] = useState(null);
  const [wallet, setWallet] = useState(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);

  useEffect(() => {
    if (!assetId) return;
    getItemDetail(assetId).then(setDetail);
    getInventory().then((r) => {
      if (r && r.wallet) setWallet(r.wallet);
    });
  }, [assetId]);

  const onBuy = async () => {
    setBusy(true);
    setMsg(null);
    const r = await buy(assetId);
    setBusy(false);
    if (r.error) {
      setMsg({ ok: false, text: r.error });
    } else {
      setMsg({
        ok: true,
        text:
          r.mode === 'local'
            ? r.notLoggedIn
              ? 'Purchased locally. Log in to keep it on your account!'
              : 'Purchased locally (server unreachable).'
            : 'Purchased! It is now in your inventory.',
      });
      setDetail({ ...detail, owned: true });
      getInventory().then((inv) => {
        if (inv && inv.wallet) setWallet(inv.wallet);
      });
    }
  };

  if (!detail || !detail.item) {
    return (
      <Theme2016>
        <div className="container" style={{ padding: '30px 0', color: '#888' }}>Loading item…</div>
      </Theme2016>
    );
  }

  const { item, owned } = detail;

  return (
    <Theme2016>
      <div className="container">
        <div className={s.breadcrumb}>
          <Link href="/catalog"><a>Catalog</a></Link> › <span>{item.category}</span> › <span>{item.name}</span>
        </div>
        <div className="row">
          <div className="col-12 col-md-6">
            <div className={s.tileBig}>
              <ItemArt item={item} size={320} />
            </div>
          </div>
          <div className="col-12 col-md-6">
            <div className={s.panel}>
              <div className={s.title}>{item.name}</div>
              <div className={s.creator}>By <strong>ROBLOX</strong> · {item.category}</div>
              <div className={s.price + (item.currency === 'tix' ? ' ' + s.tix : '')}>
                {item.currency === 'robux' ? `R$ ${Number(item.price).toLocaleString()}` : `${Number(item.price).toLocaleString()} Tix`}
              </div>
              {wallet && (
                <div style={{ fontSize: 12, color: '#888', marginBottom: 8 }}>
                  Your balance: R$ {Number(wallet.robux).toLocaleString()} · {Number(wallet.tix).toLocaleString()} Tix
                </div>
              )}
              {owned ? (
                <>
                  <div className={s.msg + ' ' + s.msgOk}>You own this item.</div>
                  <Link href="/My/Character.aspx"><a className={s.wearBtn}>Wear it in the Avatar Editor</a></Link>
                </>
              ) : (
                <button type="button" className={s.buyBtn} onClick={onBuy} disabled={busy}>
                  {busy ? 'Buying…' : 'Buy Now'}
                </button>
              )}
              {msg && <div className={s.msg + ' ' + (msg.ok ? s.msgOk : s.msgErr)}>{msg.text}</div>}
              <div className={s.desc}>{item.description}</div>
            </div>
          </div>
        </div>
      </div>
    </Theme2016>
  );
};

export const getServerSideProps = () => ({
  props: {
    title: 'Catalog Item - ROBLOX',
  },
});

export default ItemPage;
