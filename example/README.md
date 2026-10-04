# A wiki built with chronowiki

This is the example that comes with [chronowiki](https://github.com/christwiki/chronowiki), a theme for history wikis built on a timeline. It is the starting point for a wiki of your own.

```bash
npm install
npm run dev        # http://localhost:4321
```

| | |
|---|---|
| `wiki.config.ts` | the wiki's name, languages and map regions |
| `astro.config.mjs` | the address the wiki is published at |
| `src/content/` | the entries: eras, events, people, places, sources, threads, and the page that says how the wiki is made |
| `src/styles/custom.css` | the wiki's own colours and typefaces |

| Command | |
|---|---|
| `npm run dev` | development server |
| `npm run build` | check every entry, then build the site into `dist/` |
| `npm run validate` | check every entry |
| `npm run check:links` | request every external link in the entries |
| `npm run i18n -- status` | what is translated and what is out of date |

The theme's documentation says how entries are written ([entries](https://github.com/christwiki/chronowiki/blob/main/docs/entries.md)) and how languages work ([languages](https://github.com/christwiki/chronowiki/blob/main/docs/languages.md)).

## The entries that come with it

The entries in `src/content/` tell a stretch of the history of ancient Judah, from the fall of Samaria to the Maccabees. They are from [Christwiki](https://christwiki.org) and are under [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/). Delete them when your own are in place; a wiki that keeps any of them keeps that licence for them.
