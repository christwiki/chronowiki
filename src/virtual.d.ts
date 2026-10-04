/** The wiki's settings, as `defineWiki()` in its `wiki.config.ts` returned them. Provided by the integration. */
/** The wiki's own stylesheets, named in the integration's `css` option. */
declare module 'virtual:chronowiki/css' {}

declare module 'virtual:chronowiki/config' {
  const config: import('./config/types').WikiConfig;
  export default config;
}
