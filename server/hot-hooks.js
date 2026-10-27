// Module-loader hook for hot swapping. Owned by: Integration.
//
// Node caches ES modules forever, so to load a new version of
// modules/<team>/server.js we import it with a fresh query string
// (server.js?hot=3). This hook passes that version on to every file that
// server.js imports from inside modules/, so helper files reload too.
// shared.js files and the manifest are never re-versioned: they register
// tiles and types, and registering those twice would break tile ids.
const MODULES = new URL('../modules/', import.meta.url).href;

export async function resolve(specifier, context, next) {
  const result = await next(specifier, context);
  if (!context.parentURL) return result;
  const version = new URL(context.parentURL).searchParams.get('hot');
  const url = result.url;
  if (version && url.startsWith(MODULES) && !url.includes('?') &&
      !url.endsWith('/shared.js') && !url.endsWith('/manifest.js')) {
    return { ...result, url: `${url}?hot=${version}` };
  }
  return result;
}
