// Game definitions for the self-contained web games client.
// These rows are seeded into the web_game table (see database/schema.sql);
// the same data powers local/offline mode when the API is unreachable.
// thumbKey maps to components/webGame/thumbs.js art.

export const GAMES = [
  {
    id: 101,
    name: 'Sky Obby: Tower Trials',
    slug: 'Sky-Obby-Tower-Trials',
    genre: 'Adventure',
    thumbKey: 'skyObby',
    creator: 'EconomySim Games',
    tagline: 'Climb the floating towers. Do not look down.',
    description:
      'Welcome to Sky Obby: Tower Trials! Jump your way up an endless tower of floating platforms, vanishing bricks and moving danger. Grab coins for bonus points, reach the checkpoint flags, and see how high you can climb before you run out of lives. Beat your friends on the leaderboard!',
    instructions:
      'Move with the arrow keys or A/D. Jump with Space, W or Up arrow. You can also tap the left/right side of the game to move and tap the top to jump. Land on platforms, collect coins, avoid falling. 3 lives per run.',
    genreId: 1,
  },
  {
    id: 102,
    name: 'Brick Busters',
    slug: 'Brick-Busters',
    genre: 'Arcade',
    thumbKey: 'brickBusters',
    creator: 'EconomySim Games',
    tagline: 'Smash every brick. Classic arcade, 2016 style.',
    description:
      'The classic brick-busting arcade game, rebuilt for the web client! Keep the ball in play, clear every colorful brick, and climb through the levels as the ball gets faster. Catch the wide-paddle power-up, and try to set a high score!',
    instructions:
      'Move the paddle with your mouse, arrow keys or A/D. Click or press Space to launch the ball. Break every brick to advance a level. You have 3 lives — do not let the ball past the paddle!',
    genreId: 2,
  },
  {
    id: 103,
    name: 'Crossy Canyon',
    slug: 'Crossy-Canyon',
    genre: 'Classic',
    thumbKey: 'crossyCanyon',
    creator: 'EconomySim Games',
    tagline: 'Cross the canyon. Dodge traffic. Ride the logs.',
    description:
      'How far can you get? Hop across the busy canyon road, dodge speeding cars and trucks, then ride the floating logs across the river. Every row you cross scores a point — but one wrong hop and it is back to the start!',
    instructions:
      'Use the arrow keys or WASD to hop one tile at a time (tap or swipe on touch screens). Get run over by a car or fall in the river and you lose. Score 1 point per row crossed — keep going for a new record!',
    genreId: 3,
  },
];

export const getGameById = (id) => GAMES.find((g) => g.id === Number(id)) || null;

// Local-mode stand-in stats so the grid feels alive without a server.
export const LOCAL_GAME_STATS = {
  101: { plays: 18204, likes: 1291, dislikes: 87 },
  102: { plays: 12660, likes: 954, dislikes: 61 },
  103: { plays: 24517, likes: 1832, dislikes: 102 },
};
