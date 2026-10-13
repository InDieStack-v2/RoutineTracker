// wrangler `pages deploy` silently skips node_modules paths, so the wasm 404s into index.html.
module.exports = function assetPlugin(asset) {
  asset.httpServerLocation = asset.httpServerLocation.replace(/\/node_modules\//g, '/vendor/').replace(/\/\.pnpm\//g, '/pnpm/');
  return asset;
};
