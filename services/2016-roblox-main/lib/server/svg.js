// Server-side SVG rendering for avatar/item/game images.
// Renders the same React art components used on the client to static SVG
// markup so the whole site can load real pictures through plain <img> tags.
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import AvatarArt from '../../components/avatarArt';
import ItemArt from '../../components/itemArt';
import GameThumb from '../../components/webGame/thumbs';
import { getItemById, DEFAULT_AVATAR } from '../catalogItems';

const h = React.createElement;

export const renderUserAvatarSvg = (config, { full = true } = {}) => {
  const cfg = config && config.bodyColors ? config : DEFAULT_AVATAR;
  const viewBox = full ? '0 0 260 360' : '72 -48 116 158';
  return renderToStaticMarkup(h(AvatarArt, { config: cfg, size: 260, viewBox }));
};

export const renderItemSvg = (item) => {
  const def = item && item.art ? item : getItemById(item && item.id) || item;
  return renderToStaticMarkup(h(ItemArt, { item: def, size: 160 }));
};

export const renderGameThumbSvg = (game) => {
  const svg = renderToStaticMarkup(h(GameThumb, { game }));
  return svg
    .replace('width="100%"', 'width="320"')
    .replace('height="100%"', 'height="180"');
};
