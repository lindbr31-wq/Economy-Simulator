import { createUseStyles } from "react-jss";
import React from "react";
import dynamic from "next/dynamic";

const ItemPreview3D = dynamic(() => import("../itemPreview3d"), { ssr: false });

// Item images across the site are interactive 3D previews (turntable).
// Keeps the original props ({id, name, className}) so every 2016 component
// that showed an item image now shows the 3D preview.

const useStyles = createUseStyles({
  wrapper: {
    maxWidth: '400px',
    width: '100%',
    margin: '0 auto',
  },
});

const ItemImage = (props) => {
  const s = useStyles();
  return (
    <div className={s.wrapper + ' ' + (props.className || '')} title={props.name}>
      <ItemPreview3D id={props.id} height={props.height || 150} />
    </div>
  );
}

export default ItemImage;
