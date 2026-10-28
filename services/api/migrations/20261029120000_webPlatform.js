// Self-contained web platform tables: games + leaderboards, catalog items,
// user inventory/wallet/avatar. Powers the Next.js frontend's web client
// (games, catalog, avatar editor) without a game server.
const webTables = async (knex) => {
  await knex.schema.createTable('web_game', (table) => {
    table.bigInteger('id').primary();
    table.string('name', 128).notNullable();
    table.string('slug', 160).notNullable();
    table.string('genre', 64).notNullable();
    table.string('thumb_key', 64).notNullable();
    table.string('creator', 64).notNullable().defaultTo('EconomySim Games');
    table.string('tagline', 256).notNullable().defaultTo('');
    table.text('description').notNullable().defaultTo('');
    table.text('instructions').notNullable().defaultTo('');
    table.bigInteger('plays').notNullable().defaultTo(0);
    table.bigInteger('likes').notNullable().defaultTo(0);
    table.bigInteger('dislikes').notNullable().defaultTo(0);
    table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.index('genre', 'web_game_genre_index');
  });

  await knex.schema.createTable('web_game_score', (table) => {
    table.bigIncrements('id').primary();
    table.bigInteger('game_id').notNullable();
    table.bigInteger('user_id').notNullable();
    table.string('username', 64).notNullable();
    table.bigInteger('score').notNullable();
    table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.index(['game_id', 'score'], 'web_game_score_leaderboard_index');
    table.index('user_id', 'web_game_score_user_id_index');
    table.unique(['game_id', 'user_id'], 'web_game_score_game_id_user_id_unique');
  });

  await knex.schema.createTable('web_game_vote', (table) => {
    table.bigInteger('user_id').notNullable();
    table.bigInteger('game_id').notNullable();
    table.smallint('vote').notNullable();
    table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.unique(['user_id', 'game_id'], 'web_game_vote_user_id_game_id_unique');
  });

  await knex.schema.createTable('web_catalog_item', (table) => {
    table.bigInteger('id').primary();
    table.string('name', 128).notNullable();
    table.text('description').notNullable().defaultTo('');
    table.string('category', 32).notNullable();
    table.integer('price').notNullable();
    table.string('currency', 16).notNullable();
    table.jsonb('art').nullable();
    table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.index('category', 'web_catalog_item_category_index');
  });

  await knex.schema.createTable('web_user_item', (table) => {
    table.bigIncrements('id').primary();
    table.bigInteger('user_id').notNullable();
    table.bigInteger('item_id').notNullable();
    table.integer('price').notNullable();
    table.string('currency', 16).notNullable();
    table.timestamp('purchased_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.index('user_id', 'web_user_item_user_id_index');
    table.unique(['user_id', 'item_id'], 'web_user_item_user_id_item_id_unique');
  });

  await knex.schema.createTable('web_user_avatar', (table) => {
    table.bigInteger('user_id').primary();
    table.jsonb('config').notNullable().defaultTo({});
    table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
  });

  await knex.schema.createTable('web_user_wallet', (table) => {
    table.bigInteger('user_id').primary();
    table.integer('robux').notNullable().defaultTo(0);
    table.integer('tix').notNullable().defaultTo(0);
    table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
  });
};

const webSeeds = async (knex) => {
  const games = [
    [101, 'Sky Obby: Tower Trials', 'Sky-Obby-Tower-Trials', 'Adventure', 'skyObby', 'EconomySim Games', 'Climb the floating towers. Do not look down.'],
    [102, 'Brick Busters', 'Brick-Busters', 'Arcade', 'brickBusters', 'EconomySim Games', 'Smash every brick. Classic arcade, 2016 style.'],
    [103, 'Crossy Canyon', 'Crossy-Canyon', 'Classic', 'crossyCanyon', 'EconomySim Games', 'Cross the canyon. Dodge traffic. Ride the logs.'],
  ];
  for (const [id, name, slug, genre, thumb_key, creator, tagline] of games) {
    await knex('web_game').insert({ id, name, slug, genre, thumb_key, creator, tagline, description: tagline, instructions: '' })
      .onConflict('id').ignore();
  }
};

exports.up = async (knex) => {
  await webTables(knex);
  await webSeeds(knex);
};

exports.down = async (knex) => {
  await knex.schema.dropTableIfExists('web_user_wallet');
  await knex.schema.dropTableIfExists('web_user_avatar');
  await knex.schema.dropTableIfExists('web_user_item');
  await knex.schema.dropTableIfExists('web_catalog_item');
  await knex.schema.dropTableIfExists('web_game_vote');
  await knex.schema.dropTableIfExists('web_game_score');
  await knex.schema.dropTableIfExists('web_game');
};
