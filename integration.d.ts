import type { AstroIntegration } from 'astro';

export interface ChronowikiOptions {
  /** Where the wiki's settings are, if not `wiki.config.ts` beside `astro.config.mjs`. */
  config?: string;
  /**
   * The wiki's own stylesheets, loaded after the theme's: paths from the
   * wiki's folder, such as `./src/styles/custom.css`. This is where a wiki
   * sets its colours and typefaces by redefining the theme's custom properties.
   */
  css?: string[];
  /** Set to false to build without the search index. */
  search?: boolean;
}

/** Adds the wiki's pages to an Astro site and builds its search index. */
export default function chronowiki(options?: ChronowikiOptions): AstroIntegration;
