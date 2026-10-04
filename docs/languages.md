# Languages

A wiki is written in one language and can be read in any number. This guide says how the pieces fit together, how to add a language, and how to translate entries.

## How it works

- **Addresses.** The language the wiki is written in sits at the root (`/events/council-of-nicaea/`). Every other language sits under its code (`/de/events/council-of-nicaea/`). Entry ids and the words `events`, `people`, `places` in an address are the same in every language, so a link can be turned into any language by changing its prefix.
- **Interface.** Every word of the interface is a message. The theme holds them per language in `src/i18n/messages/`; the English file is the source of truth, and its shape is a TypeScript type, so a translation that misses a key or adds one does not compile. No template and no script holds a word of its own.
- **Content.** A translation of an entry is an *overlay*: a file that holds only the entry's words. Dates, places, people, citations and links stay in the original entry and are shared by all languages, so the facts cannot drift apart.
- **Fallback.** An entry that has no translation yet is shown in the original language, marked with that language's `lang` attribute for screen readers and hyphenation, with a line saying so. The interface around it stays in the reader's language.
- **What follows the language automatically:** dates (`16 March 597 BC`, `16. März 597 v. Chr.`), numbers, plurals, lists, alphabetical order, quotation marks, Bible references (`2 Kings 25:8–10`, `2 Könige 25,8–10`) and the Bible reader they link to, names of source languages, the search index, `lang` and `dir` attributes, `hreflang` links, the sitemap, and the page for a missing address.

## The languages of a wiki

They are listed in `wiki.config.ts`. The first is the one the content is written in.

```ts
locales: [english(), german({ status: 'preview' })],
```

A `preview` language is built by `npm run dev` and when `PREVIEW_LOCALES=true`; a release build leaves it out. Without `status` a language is live: the language switch appears in the header, every page names its counterparts with `hreflang`, and the sitemap lists them.

`messages` lays the wiki's own wording over the theme's, in each language:

```ts
german({ messages: { site: { tagline: 'Rom auf einem Zeitstrahl.' } } })
```

Region names are given per language in the same file: `{ id: 'italy', name: { en: 'Italy', de: 'Italien' } }`.

`npx chronowiki validate` checks every language of the wiki with the wiki's wording laid over it: the same keys as the English messages, the same `{placeholders}`, nothing empty.

## Adding a language the theme does not have

The theme comes with English and German. Another language is written out in the wiki, or better, added to the theme so that every wiki can use it.

1. **Messages.** Copy the theme's `src/i18n/messages/en.ts` to a file in the wiki, say `src/i18n/fr.ts`, type it as `Messages` (from `chronowiki/config`), and translate every value. Keep the `{placeholders}`. Where a message is a plural (`{ one, other }`), give the forms the language needs: `zero`, `one`, `two`, `few`, `many`, `other`, as `Intl.PluralRules` names them. The `date` block holds the patterns for years and days; month names come from the browser's own tables.
2. **The language itself**, in `wiki.config.ts`:

   ```ts
   import { fr } from './src/i18n/fr';

   locales: [
     english(),
     {
       code: 'fr',                 // the BCP 47 tag, which is also the address prefix
       name: 'Français',           // the language's own name, for the language switch
       dir: 'ltr',                 // or 'rtl'
       status: 'preview',
       quotes: ['« ', ' »', '‹ ', ' ›'],   // double marks, then single; a space inside the marks is part of them
       messages: fr,
     },
   ],
   ```
3. **Bible references**, if the wiki cites the Bible: `bible` names the reader to link to, the version, the public-domain version entries quote, how references are written (the mark between chapter and verse, and between verses), and the name of every book. The German definition in the theme's `src/i18n/packs.ts` and `src/i18n/bible/de.ts` is the model. Where the reader writes a book's name differently in its addresses, give `query`; where it lacks a book, give `query: null` and links to that book fall back to the English reader. Without `bible`, references are written the English way.
4. **Run the checks.** `npx chronowiki validate` compares the messages with the English ones key by key and placeholder by placeholder, and checks that every Bible book has a name. `npm run dev` shows the new language under its prefix.

### Two kinds of Bible reader

`link: 'biblegateway'` sends a whole reference, however many passages, in one address. `link: 'bibleserver'` takes one passage at a time, so a citation of two passages becomes two links inside one pair of brackets. Another reader needs a few lines in the theme's `src/lib/bible.ts`. Check a new reader with `npx chronowiki check-links --bible`, which requests one Bible link per event in every language.

### Right-to-left languages

The stylesheets use logical properties throughout (`inset-inline-start`, `border-inline-start`, `text-align: start`), arrows in pagers turn round, and the browser tests turn the direction round on real pages to show that the layout mirrors and nothing overflows. A right-to-left language needs `dir: 'rtl'` and nothing else. The map itself is a picture of the world and does not mirror.

### Scripts other than Latin

The theme's typefaces cover Latin, and Inter also Greek and Cyrillic. Other scripts fall back to the reader's system fonts, which is the right default. To choose a face, add a rule for the language to the wiki's own stylesheet, for example `:lang(el) { --font-serif: … }`.

## Translating entries

```bash
npx chronowiki i18n status de --missing              # what is done, what is out of date, what is left
npx chronowiki i18n new de events/council-of-nicaea  # start a translation
npx chronowiki i18n stamp de                         # after revising out-of-date translations
```

`new` writes `src/content/i18n/<code>/<collection>/<id>.md` with the original words in it. Replace them. What an overlay may hold depends on the kind of entry:

| Kind | Fields |
|---|---|
| events | `title`, `summary`, `dating`, `dateDisplay`, and the text |
| people | `name`, `altNames`, `role`, `summary`, `bornDisplay`, `diedDisplay`, and the text |
| places | `name`, `altNames`, `modern`, `summary`, and the text |
| sources | `title`, `author`, `cite`, `language`, `edition`, `holding`, `summary`, `writtenDisplay`, `links` (labels, in the original's order), and the text |
| threads | `title`, `summary`, and the text |
| eras | `title`, `short`, `span`, `summary`, and the text |
| pages | `title`, `summary`, and the text |

`citations: { key: { at: … } }` may restate a passage that contains words ("Session 6, canon 9"). `altNames`, `author`, `cite`, `language` and `holding` may be left out where they are the same; everything else that the original entry has must be translated.

### Rules for the translator

- **Leave `[[…]]` references as they are.** `[[bible:2 Kings 25:8-10]]` is written in English in every language; the site shows it as the reader's language writes it. `[[cite:key]]` keeps its key. `[[person:id]]` keeps its id.
- **Cite exactly what the original cites.** The validator compares the two: a translation that drops a citation, or adds one, does not pass. Keep each citation with the sentence it supports.
- **Give links a label where the target is not translated yet.** `[[person:nebuchadnezzar-ii]]` shows that entry's name, which is in the original language until it is translated. Write `[[person:nebuchadnezzar-ii|Nebukadnezzar II.]]`.
- **Quotations.** Quote a source only from a translation you are free to use, and name it in the source's overlay. Otherwise paraphrase.
- **Write plain quotation marks** (`"…"`). The site turns them into the language's own.
- **Do not translate what is not words:** dates, coordinates, ids, URLs.

### When the original entry changes

Each overlay records the version of the entry it was made from (`source`, a hash of that entry's words). When the original is corrected, the hash no longer matches: `chronowiki validate` warns, `chronowiki i18n status` lists the entry as out of date, and readers of the translation see a line saying that the original has since been revised, with a link to it. Revise the translation, then run `npx chronowiki i18n stamp <code> <collection>/<id>`.

Changes to facts (a date, a place, a link) need no action: they are shared.

## What is not translated

- The words in an address: `/de/events/…`, `/de/people/…`. Entry ids are the same in every language, which is what lets a link be turned into another language by its prefix alone.
- The wiki's name.
- The messages of the build tools and the validator, which are for the people working on the wiki.

## Where things are in the theme

| | |
|---|---|
| `src/i18n/packs.ts` | the languages the theme comes with |
| `src/i18n/messages/` | the interface, one file per language |
| `src/i18n/bible/` | Bible book names |
| `src/i18n/index.ts` | `useI18n(Astro)`: messages, links, dates, numbers, sorting for the page's language |
| `src/i18n/overlay.ts` | how a translation is laid over an entry, and the hash |
| `src/i18n/check.ts` | the check of a language against the English messages |
| `src/lib/validate-i18n.ts` | the rules a translation must pass |
| `cli/i18n.ts` | `status`, `new`, `stamp` |
| `src/routes/` | every page, once, for all languages |
| `tests/e2e/i18n.spec.ts` | browser tests, including one that looks for English left in another language's interface |
