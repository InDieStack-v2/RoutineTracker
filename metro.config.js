const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');

const config = getDefaultConfig(__dirname);

config.transformer.minifierConfig = {
  compress: {
    // The option below removes all console logs statements in production.
    drop_console: true,
  },
};

// expo-sqlite web loads wa-sqlite.wasm. Metro must treat it as an asset.
config.resolver.assetExts.push('wasm');
config.resolver.sourceExts = config.resolver.sourceExts.filter((ext) => ext !== 'wasm');

config.transformer.assetPlugins = [require.resolve('./scripts/asset-plugin.js')];

const nativeWindConfig = withNativeWind(config, { input: './global.css' });

// SharedArrayBuffer, required by wa-sqlite, is only available on an isolated page.
const previousEnhance = nativeWindConfig.server?.enhanceMiddleware;
nativeWindConfig.server.enhanceMiddleware = (middleware, ...args) => {
  const enhanced = previousEnhance ? previousEnhance(middleware, ...args) : middleware;
  return (req, res, next) => {
    res.setHeader('Cross-Origin-Embedder-Policy', 'credentialless');
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
    return enhanced(req, res, next);
  };
};

module.exports = nativeWindConfig;