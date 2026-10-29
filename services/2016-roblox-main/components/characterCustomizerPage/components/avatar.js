import { createUseStyles } from "react-jss";
import React, { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import CharacterCustomizationStore from "../../../stores/characterPage";
import useButtonStyles from "../../../styles/buttonStyles";
import ActionButton from "../../actionButton";
import PlayerImage from "../../playerImage";
import { getMyAvatarConfig } from "../../../services/avatar";

const Avatar3D = dynamic(() => import("../../avatar3d"), { ssr: false });

const useMyAvatarStyles = createUseStyles({
  header: {
    fontSize: '24px',
  },
  renderButtonWrapper: {
    float: 'left',
    marginBottom: '20px',
  },
  renderButton: {
    fontSize: '14px',
  },
  slotLabel: {
    fontWeight: 600,
    fontSize: '13px',
    color: '#666',
    marginBottom: '4px',
  },
  headshot: {
    maxWidth: '140px',
  },
});

const MyAvatar = props => {
  const s = useMyAvatarStyles();
  const characterStore = CharacterCustomizationStore.useContainer();
  const buttonStyles = useButtonStyles();
  const [config, setConfig] = useState(null);

  useEffect(() => {
    if (!characterStore.userId) return;
    let cancelled = false;
    getMyAvatarConfig().then(cfg => {
      if (!cancelled) setConfig(cfg);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [characterStore.userId, characterStore.thumbnail]);

  return <div className='row'>
    <div className='col-12'>
      <h2 className={s.header}>Avatar</h2>
    </div>
    <div className='col-12 col-md-7'>
      <p className={s.slotLabel}>Preview</p>
      <Avatar3D config={config} userId={characterStore.userId} height={300}/>
    </div>
    <div className='col-12 col-md-5'>
      <p className={s.slotLabel}>Headshot</p>
      {characterStore.isRendering ? <p>Loading...</p> : <PlayerImage url={characterStore.thumbnail} id={characterStore.userId} className={s.headshot}/>}
      <div className={s.renderButtonWrapper}>
        {characterStore.isModified && <ActionButton disabled={characterStore.isRendering} label='Save Changes' className={s.renderButton + ' ' + buttonStyles.continueButton} onClick={() => {
          characterStore.requestRender(false);
        }}/>}
      </div>
    </div>
    <div className='col-12'>
      <p className='mb-0'>Something wrong with your Avatar?</p>
      <p className='mb-0'><a href='#' onClick={(e) => {
        e.preventDefault();
        characterStore.requestRender(true);
      }}>Click here to re-draw it!</a></p>
    </div>
  </div>
}

export default MyAvatar;
