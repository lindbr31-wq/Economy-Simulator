// Catalog item definitions for the self-contained web catalog + avatar editor.
// Seeded into web_catalog_item (see database/schema.sql); the same data powers
// local/offline mode. `art` is the jsonb spec rendered by components/itemArt.

export const CATEGORIES = [
  { key: 'all', label: 'All Items' },
  { key: 'hats', label: 'Hats' },
  { key: 'faces', label: 'Faces' },
  { key: 'shirts', label: 'Shirts' },
  { key: 'pants', label: 'Pants' },
  { key: 'gear', label: 'Gear' },
];

export const CATALOG_ITEMS = [
  // ---- Hats ----
  {
    id: 1001, name: 'Red Baseball Cap', category: 'hats', price: 35, currency: 'tix',
    description: 'A classic red cap. Perfect for sunny days in Robloxia.',
    art: { type: 'hat', shape: 'cap', colors: { main: '#d62d20', accent: '#ffffff' } },
  },
  {
    id: 1002, name: 'Golden Crown', category: 'hats', price: 250, currency: 'robux',
    description: 'Rule the kingdom in style. Solid gold (not actually solid gold).',
    art: { type: 'hat', shape: 'crown', colors: { main: '#f5c518', accent: '#e04343' } },
  },
  {
    id: 1003, name: 'Classic Top Hat', category: 'hats', price: 120, currency: 'tix',
    description: 'A gentleman\'s top hat. Tipping it is optional but encouraged.',
    art: { type: 'hat', shape: 'tophat', colors: { main: '#1c1c22', accent: '#8b1e1e' } },
  },
  {
    id: 1004, name: 'Sparkle Halo', category: 'hats', price: 400, currency: 'robux',
    description: 'A floating ring of light. You are basically an angel now.',
    art: { type: 'hat', shape: 'halo', colors: { main: '#ffe97a', accent: '#fff6cf' } },
  },
  {
    id: 1005, name: 'Rogue Bandana', category: 'hats', price: 60, currency: 'tix',
    description: 'For sky obbies and heists. Mostly sky obbies.',
    art: { type: 'hat', shape: 'bandana', colors: { main: '#b3242c', accent: '#7d1720' } },
  },
  {
    id: 1006, name: 'Party Hat', category: 'hats', price: 25, currency: 'tix',
    description: 'Every day is a birthday in Robloxia.',
    art: { type: 'hat', shape: 'party', colors: { main: '#3fc1c9', accent: '#ff6b6b' } },
  },
  {
    id: 1007, name: 'Antenna Bot', category: 'hats', price: 175, currency: 'tix',
    description: 'It receives signals from outer space. Mostly static.',
    art: { type: 'hat', shape: 'antenna', colors: { main: '#9aa5b1', accent: '#ff6b6b' } },
  },
  {
    id: 1008, name: 'Dragon Wings', category: 'hats', price: 650, currency: 'robux',
    description: 'Majestic dragon wings. You still cannot fly. Sorry.',
    art: { type: 'hat', shape: 'wings', colors: { main: '#2e7d4f', accent: '#1c5233' } },
  },
  // ---- Faces ----
  {
    id: 1010, name: 'Classic Smile', category: 'faces', price: 15, currency: 'tix',
    description: 'The original happy face. A true classic.',
    art: { type: 'face', shape: 'smile', colors: { main: '#222831', accent: '#222831' } },
  },
  {
    id: 1011, name: 'Cool Shades', category: 'faces', price: 90, currency: 'tix',
    description: 'Deal with it. Sunglasses indoors and everything.',
    art: { type: 'face', shape: 'cool', colors: { main: '#111318', accent: '#2b2f36' } },
  },
  {
    id: 1012, name: 'Determined', category: 'faces', price: 75, currency: 'tix',
    description: 'Time to beat the obby. Maximum focus.',
    art: { type: 'face', shape: 'determined', colors: { main: '#222831', accent: '#222831' } },
  },
  {
    id: 1013, name: 'Sleepy', category: 'faces', price: 45, currency: 'tix',
    description: 'Five more minutes, mom...',
    art: { type: 'face', shape: 'sleepy', colors: { main: '#222831', accent: '#222831' } },
  },
  // ---- Shirts ----
  {
    id: 1015, name: 'Blue T-Shirt', category: 'shirts', price: 20, currency: 'tix',
    description: 'A simple blue tee. Goes with everything.',
    art: { type: 'shirt', shape: 'tee', colors: { torso: '#2e6db4', sleeve: '#245a97', accent: '#ffffff' } },
  },
  {
    id: 1016, name: 'Striped Rugby Shirt', category: 'shirts', price: 85, currency: 'tix',
    description: 'Sporty stripes for the athletic type.',
    art: { type: 'shirt', shape: 'striped', colors: { torso: '#ffffff', sleeve: '#c8372d', accent: '#c8372d' } },
  },
  {
    id: 1017, name: 'Black Hoodie', category: 'shirts', price: 150, currency: 'tix',
    description: 'Cozy, mysterious, and great for night obbies.',
    art: { type: 'shirt', shape: 'hoodie', colors: { torso: '#23262b', sleeve: '#23262b', accent: '#3a3f47' } },
  },
  {
    id: 1018, name: 'Executive Suit', category: 'shirts', price: 300, currency: 'robux',
    description: 'Business at the front page, party at the games page.',
    art: { type: 'shirt', shape: 'suit', colors: { torso: '#22262e', sleeve: '#22262e', accent: '#c9302c' } },
  },
  // ---- Pants ----
  {
    id: 1020, name: 'Blue Jeans', category: 'pants', price: 25, currency: 'tix',
    description: 'Denim. Timeless.',
    art: { type: 'pants', shape: 'jeans', colors: { main: '#2b4a8b', accent: '#22396b' } },
  },
  {
    id: 1021, name: 'Cargo Shorts', category: 'pants', price: 55, currency: 'tix',
    description: 'So many pockets. Bring everything.',
    art: { type: 'pants', shape: 'cargo', colors: { main: '#7a6a4f', accent: '#5c503b' } },
  },
  {
    id: 1022, name: 'Executive Slacks', category: 'pants', price: 120, currency: 'robux',
    description: 'Sharp creases. Serious business.',
    art: { type: 'pants', shape: 'slacks', colors: { main: '#22262e', accent: '#171a20' } },
  },
  // ---- Gear ----
  {
    id: 1030, name: 'Pixel Sword', category: 'gear', price: 200, currency: 'tix',
    description: 'A blocky sword for blocky heroes. Foam-safe.',
    art: { type: 'gear', shape: 'sword', colors: { main: '#9aa5b1', accent: '#6b4f2a' } },
  },
  {
    id: 1031, name: 'Boombox', category: 'gear', price: 350, currency: 'robux',
    description: 'Drop some beats wherever you go.',
    art: { type: 'gear', shape: 'boombox', colors: { main: '#3a3f47', accent: '#c8372d' } },
  },
  {
    id: 1032, name: 'Gravity Coil', category: 'gear', price: 500, currency: 'robux',
    description: 'Feel lighter. Jump higher. (Totally scientific.)',
    art: { type: 'gear', shape: 'coil', colors: { main: '#3fc1c9', accent: '#2b8a91' } },
  },
];

export const getItemById = (id) => CATALOG_ITEMS.find((i) => i.id === Number(id)) || null;

// 2016-style avatar defaults (the classic "noob" palette).
export const DEFAULT_AVATAR = {
  bodyColors: {
    head: '#f5cd30',
    torso: '#0d69ac',
    leftArm: '#f5cd30',
    rightArm: '#f5cd30',
    leftLeg: '#4b974b',
    rightLeg: '#4b974b',
  },
  hatIds: [],
  faceId: 1010,
  shirtId: null,
  pantsId: null,
  gearId: null,
};

export const BODY_COLOR_PALETTE = [
  '#f5cd30', '#d62d20', '#0d69ac', '#4b974b', '#9b6a3c',
  '#a3a2a5', '#f2c6a0', '#6b3f2a', '#22262e', '#e8b4c8',
  '#3fc1c9', '#b072e8',
];

export const STARTER_WALLET = { robux: 100, tix: 2500 };
