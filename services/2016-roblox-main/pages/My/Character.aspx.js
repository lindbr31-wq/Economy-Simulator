import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { createUseStyles } from 'react-jss';
import dynamic from 'next/dynamic';
import Theme2016 from '../../components/theme2016';
import ItemArt from '../../components/itemArt';
import { DEFAULT_AVATAR, BODY_COLOR_PALETTE } from '../../lib/catalogItems';
import { getInventory, saveAvatar, getMe } from '../../lib/webStore';

const Avatar3D = dynamic(() => import('../../components/avatar3d'), { ssr: false });

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
    gap: '14px',
    alignItems: 'center',
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
  panel: {
    background: '#fff',
    border: '1px solid #ddd',
    borderRadius: '4px',
    padding: '14px',
    marginBottom: '14px',
  },
  preview: {
    background: 'linear-gradient(#eef4f9, #d5e3ee)',
    border: '1px solid #c4d4e0',
    borderRadius: '6px',
    padding: '18px 10px 8px',
    textAlign: 'center',
  },
  tab: {
    padding: '6px 13px',
    cursor: 'pointer',
    border: '1px solid #ccc',
    borderBottom: 'none',
    background: '#eee',
    fontSize: '13px',
    borderRadius: '4px 4px 0 0',
    '&$tabActive': {
      background: '#fff',
      fontWeight: 700,
    },
  },
  tabActive: {},
  colorRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    marginBottom: '8px',
    fontSize: '13px',
  },
  colorLabel: {
    width: '86px',
    color: '#555',
  },
  swatch: {
    width: '24px',
    height: '24px',
    borderRadius: '4px',
    border: '2px solid transparent',
    cursor: 'pointer',
    '&$swatchActive': {
      borderColor: '#3fc1c9',
    },
  },
  swatchActive: {},
  itemGrid: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '10px',
  },
  itemTile: {
    width: '86px',
    cursor: 'pointer',
    borderRadius: '6px',
    border: '2px solid #ddd',
    padding: '4px',
    textAlign: 'center',
    fontSize: '10.5px',
    color: '#555',
    '&$equipped': {
      borderColor: '#3fc1c9',
      background: '#eafafa',
    },
  },
  equipped: {},
  saveBtn: {
    background: '#2ecc71',
    color: '#fff',
    border: 'none',
    borderRadius: '4px',
    padding: '10px 26px',
    fontSize: '16px',
    fontWeight: 700,
    cursor: 'pointer',
    '&:disabled': { background: '#95c9a3' },
  },
  resetBtn: {
    background: '#e0e0e0',
    color: '#444',
    border: '1px solid #bbb',
    borderRadius: '4px',
    padding: '10px 18px',
    fontSize: '14px',
    cursor: 'pointer',
    marginLeft: '10px',
  },
  msg: {
    marginTop: '10px',
    fontSize: '12.5px',
    padding: '6px 8px',
    borderRadius: '4px',
  },
  msgOk: { background: '#e8f8ee', color: '#2c6b2c', border: '1px solid #bcdcbc' },
  msgErr: { background: '#fdeaea', color: '#a33', border: '1px solid #e5b8b8' },
  note: {
    fontSize: '12px',
    color: '#996c00',
    background: '#fff7dd',
    border: '1px solid #f0e0a0',
    borderRadius: '4px',
    padding: '6px 9px',
    marginBottom: '12px',
  },
  empty: {
    color: '#888',
    fontSize: '13px',
    padding: '12px 0',
  },
});

const BODY_PARTS = [
  ['head', 'Head'],
  ['torso', 'Torso'],
  ['leftArm', 'Left Arm'],
  ['rightArm', 'Right Arm'],
  ['leftLeg', 'Left Leg'],
  ['rightLeg', 'Right Leg'],
];

const TABS = [
  ['body', 'Body'],
  ['hats', 'Hats'],
  ['faces', 'Face'],
  ['shirts', 'Shirts'],
  ['pants', 'Pants'],
  ['gear', 'Gear'],
];

const deepCopy = (o) => JSON.parse(JSON.stringify(o));

const MyCharacterPage = () => {
  const s = useStyles();
  const [inv, setInv] = useState(null);
  const [config, setConfig] = useState(null);
  const [tab, setTab] = useState('body');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const [me, setMe] = useState(undefined);

  useEffect(() => {
    getMe().then(setMe);
    getInventory().then((r) => {
      setInv(r);
      const base = deepCopy(DEFAULT_AVATAR);
      if (r && r.avatar && r.avatar.bodyColors) {
        setConfig({ ...base, ...r.avatar, bodyColors: { ...base.bodyColors, ...(r.avatar.bodyColors || {}) } });
      } else {
        setConfig(base);
      }
    });
  }, []);

  const owned = (inv && inv.items) || [];
  const itemsOf = (category) => owned.filter((i) => i.category === category);

  const equipped = (id) => {
    if (!config) return false;
    const num = Number(id);
    if (config.faceId === num || config.shirtId === num || config.pantsId === num || config.gearId === num) return true;
    return (config.hatIds || []).includes(num);
  };

  const toggleItem = (item) => {
    setConfig((c) => {
      const next = deepCopy(c);
      const num = Number(item.id);
      if (item.category === 'hats') {
        const hats = next.hatIds || [];
        if (hats.includes(num)) next.hatIds = hats.filter((h) => h !== num);
        else if (hats.length < 3) next.hatIds = [...hats, num];
        else {
          setMsg({ ok: false, text: 'You can wear up to 3 hats at a time.' });
          return c;
        }
      } else if (item.category === 'faces') {
        next.faceId = next.faceId === num ? DEFAULT_AVATAR.faceId : num;
      } else if (item.category === 'shirts') {
        next.shirtId = next.shirtId === num ? null : num;
      } else if (item.category === 'pants') {
        next.pantsId = next.pantsId === num ? null : num;
      } else if (item.category === 'gear') {
        next.gearId = next.gearId === num ? null : num;
      }
      return next;
    });
    setMsg(null);
  };

  const setBodyColor = (part, color) => {
    setConfig((c) => ({
      ...c,
      bodyColors: { ...c.bodyColors, [part]: color },
    }));
    setMsg(null);
  };

  const onSave = async () => {
    setBusy(true);
    setMsg(null);
    const r = await saveAvatar(config);
    setBusy(false);
    if (r.error) setMsg({ ok: false, text: r.error });
    else
      setMsg({
        ok: true,
        text:
          r.mode === 'local'
            ? r.notLoggedIn
              ? 'Avatar saved locally. Log in to keep it on your account!'
              : 'Avatar saved locally (server unreachable).'
            : 'Avatar saved!',
      });
  };

  const onReset = () => {
    setConfig(deepCopy(DEFAULT_AVATAR));
    setMsg(null);
  };

  return (
    <Theme2016>
      <div className="container">
        <h1 className={s.header}>Avatar Editor</h1>
        <div className={s.sub}>
          <span>Customize your character — body colors, hats, faces, clothes and gear.</span>
          {inv && inv.wallet && (
            <span className={s.wallet}>
              R$ {Number(inv.wallet.robux).toLocaleString()} · {Number(inv.wallet.tix).toLocaleString()} Tix
            </span>
          )}
          <Link href="/catalog"><a>Get more items in the Catalog →</a></Link>
        </div>

        {me === null && (
          <div className={s.note}>
            You are not logged in — you are editing a <strong>local avatar</strong> stored in this browser.{' '}
            <Link href="/login"><a>Log in</a></Link> or <Link href="/signup"><a>sign up</a></Link> to save it to your account.
          </div>
        )}

        <div className="row">
          <div className="col-12 col-md-5">
            <div className={s.preview}>
              {config ? <Avatar3D config={config} height={430} /> : <div className={s.empty}>Loading…</div>}
            </div>
            <div className={s.panel} style={{ marginTop: 12 }}>
              <button type="button" className={s.saveBtn} onClick={onSave} disabled={!config || busy}>
                {busy ? 'Saving…' : 'Save Avatar'}
              </button>
              <button type="button" className={s.resetBtn} onClick={onReset} disabled={!config}>
                Reset to Noob
              </button>
              {msg && <div className={s.msg + ' ' + (msg.ok ? s.msgOk : s.msgErr)}>{msg.text}</div>}
            </div>
          </div>

          <div className="col-12 col-md-7">
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
              {TABS.map(([key, label]) => (
                <span
                  key={key}
                  className={s.tab + (tab === key ? ' ' + s.tabActive : '')}
                  onClick={() => setTab(key)}
                  role="button"
                  tabIndex={0}
                  onKeyPress={() => setTab(key)}
                >
                  {label}
                </span>
              ))}
            </div>
            <div className={s.panel} style={{ borderTopLeftRadius: 0 }}>
              {tab === 'body' && config && (
                <div>
                  {BODY_PARTS.map(([part, label]) => (
                    <div className={s.colorRow} key={part}>
                      <span className={s.colorLabel}>{label}</span>
                      {BODY_COLOR_PALETTE.map((color) => (
                        <span
                          key={color}
                          className={s.swatch + (config.bodyColors[part] === color ? ' ' + s.swatchActive : '')}
                          style={{ background: color }}
                          onClick={() => setBodyColor(part, color)}
                          role="button"
                          tabIndex={0}
                          title={color}
                          onKeyPress={() => setBodyColor(part, color)}
                        />
                      ))}
                    </div>
                  ))}
                  <div className={s.empty}>Tip: mix and match to recreate the classic 2016 looks.</div>
                </div>
              )}

              {tab !== 'body' && (
                <div>
                  {tab === 'hats' && <div className={s.empty}>Click hats to wear up to 3 at once.</div>}
                  {tab !== 'hats' && <div className={s.empty}>Click an item to wear or take it off.</div>}
                  {itemsOf(tab).length === 0 && (
                    <div className={s.empty}>
                      You do not own any {tab} yet. <Link href={'/catalog?category=' + tab}><a>Buy some in the Catalog</a></Link>.
                    </div>
                  )}
                  <div className={s.itemGrid}>
                    {itemsOf(tab).map((item) => (
                      <div
                        key={item.id}
                        className={s.itemTile + (equipped(item.id) ? ' ' + s.equipped : '')}
                        onClick={() => toggleItem(item)}
                        role="button"
                        tabIndex={0}
                        onKeyPress={() => toggleItem(item)}
                      >
                        <ItemArt item={item} size={76} />
                        <div style={{ marginTop: 2 }}>{item.name}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </Theme2016>
  );
};

export default MyCharacterPage;
