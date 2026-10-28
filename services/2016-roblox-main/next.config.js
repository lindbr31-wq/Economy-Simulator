const fs = require('fs');
const path = require('path');

// Default feature flags, used for the env-driven config (see below) and as a
// reference for util/create_config.js.
const defaultFlags = {
  myAccountPage2016Enabled: true,
  catalogGenreFilterSupported: false,
  catalogPageLimit: 28,
  catalogSaleCountVisibleFromDetailsEndpoint: false,
  catalogDetailsPageResellerLimit: 10,
  avatarPageInventoryLimit: 10,
  friendsPageLimit: 25,
  settingsPageThemeSelectorEnabled: true,
  tradeWindowInventoryCollectibleLimit: 10,
  moneyPagePromotionTabVisible: false,
  gameGenreFilterMethod: 'keyword',
  gameGenreFilterSupported: true,
  avatarPageOutfitCreatedAtAvailable: false,
  catalogDetailsPageOwnersTabEnabled: false,
  requireLoginThroughCookie: false,
};

// Build a config from environment variables. This is what runs on Vercel (and
// any other CI) where committing config.json is undesirable; set these in the
// Vercel project settings (they are read at build time):
//   BACKEND_BASE_URL             e.g. https://www.yourdomain.com
//   BACKEND_API_FORMAT           e.g. https://backend.yourdomain.com/apisite/{0}{1}
//   BACKEND_CHAT_URL             e.g. https://backend.yourdomain.com/chat (default "/chat")
//   COOKIE_DOMAIN_REWRITE        value to rewrite Set-Cookie Domain= to (empty = strip it)
//   CSRF_KEY                     fixed random string (required with multiple instances)
//   BACKEND_AUTHORIZATION        optional shared auth header value sent to the backend
//   BACKEND_AUTHORIZATION_HEADER optional header name (default "authorization")
//   PROXY_ENABLED                set to "false" to disable the /api/proxy route
const configFromEnv = () => {
  if (!process.env.CSRF_KEY) {
    console.warn('[config] CSRF_KEY is not set; a random key will be generated per instance, which breaks logins across cold starts/instances. Set CSRF_KEY in your environment.');
  }
  return {
    serverRuntimeConfig: {
      backend: {
        csrfKey: process.env.CSRF_KEY,
        authorization: process.env.BACKEND_AUTHORIZATION,
        authorizationHeader: process.env.BACKEND_AUTHORIZATION_HEADER,
      },
    },
    publicRuntimeConfig: {
      backend: {
        proxyEnabled: process.env.PROXY_ENABLED !== 'false',
        flags: defaultFlags,
        baseUrl: process.env.BACKEND_BASE_URL || 'https://www.roblox.com',
        apiFormat: process.env.BACKEND_API_FORMAT || 'https://{0}.roblox.com{1}',
        chatUrl: process.env.BACKEND_CHAT_URL || '/chat',
        cookieDomainRewrite: process.env.COOKIE_DOMAIN_REWRITE,
      },
    },
  };
};

const configPath = path.join(__dirname, 'config.json');
let config;
if (fs.existsSync(configPath)) {
  config = JSON.parse(fs.readFileSync(configPath).toString('utf-8'));
} else if (process.env.VERCEL || process.env.BACKEND_BASE_URL || process.env.BACKEND_API_FORMAT || process.env.CSRF_KEY) {
  config = configFromEnv();
} else {
  throw new Error('Configuration could not be found at location: ' + configPath + ' (run "node ./util/create_config.js" to create one, or set the BACKEND_* environment variables)');
}

module.exports = {
  reactStrictMode: true,
  serverRuntimeConfig: config.serverRuntimeConfig,
  publicRuntimeConfig: config.publicRuntimeConfig,
  async redirects() {
    return [
      {
        source: '/catalog.aspx',
        destination: '/catalog',
        permanent: true,
      },
      /*
      {
        source: '/catalog/:id/:name',
        destination: '/redirect-item?id=:id',
        permanent: false,
      },
       */
      {
        source: '/groups/:id/:name',
        destination: '/My/Groups.aspx?gid=:id',
        permanent: false,
      },
    ]
  },
  webpack: (config, { buildId, dev, isServer, defaultLoaders, webpack }) => {
    return config
  },
}
