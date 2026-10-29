import React, { useEffect } from "react";
import MyAvatar from "../../components/characterCustomizerPage/components/avatar";
import AuthenticationStore from "../../stores/authentication";
import CharacterCustomizationStore from "../../stores/characterPage";
import OldVerticalTabs from "../oldVerticalTabs";
import Color from "./components/color";
import CurrentlyWearing from "./components/currentlyWearing";
import Outfits from "./components/outfits";
import Wardrobe from "./components/wardrobe";
import thumbnailStore from "../../stores/thumbnailStore";

const CharacterPage = props => {
  const auth = AuthenticationStore.useContainer();
  const store = CharacterCustomizationStore.useContainer();
  const thumbs = thumbnailStore.useContainer();

  useEffect(() => {
    store.setUserId(auth.userId);
  }, [auth.userId]);

  useEffect(() => {
    if (!store.userId || !store.thumbnail)
      return;
    thumbs.removeUserThumbnail(store.userId);
  }, [store.thumbnail, store.userId]);

  if (!store.userId) {
    return <div className='row mt-4'>
      <div className='col-12'>
        <p className='mb-1'>Log in to see your avatar preview and headshot, and to customize your character.</p>
        <p className='mb-0 text-muted' style={{fontSize: '13px'}}>Use the <strong>Login</strong> button in the top menu (or <a href='/signup'>Sign Up</a> for a new account).</p>
      </div>
    </div>;
  }
  return <div className='row mt-4'>
    <div className='col-12 col-lg-4'>
      <MyAvatar/>
      <Color/>
    </div>
    <div className='col-12 col-lg-8'>
      <div className='row'>
        <div className='col-12'>
          <OldVerticalTabs options={[
            {
              name: 'Wardrobe',
              element: <Wardrobe/>,
            },
            {
              name: 'Outfits',
              element: <Outfits/>,
            },
          ]}/>
        </div>
      </div>
      <CurrentlyWearing/>
    </div>
  </div>
}

export default CharacterPage;