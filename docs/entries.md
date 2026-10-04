# Entries

A wiki's content is Markdown with YAML front matter in `src/content/`. This guide describes each kind of entry, the syntax for links and citations, and what the validator checks.

```
eras/<id>.md            the chapters of the timeline
events/<era>/<id>.md    what happened
people/<id>.md
places/<id>.md
sources/<id>.md         the texts and objects that are cited
threads/<id>.md         storylines across the eras
pages/about.md          how the wiki is made
i18n/<language>/…       translations (see languages.md)
```

An entry's id is its file name without `.md`: lower-case words joined by hyphens (`council-of-nicaea`). Ids appear in addresses and in links between entries, so choose them once.

## Eras

```yaml
---
title: "Exile and Return"
short: "Exile & Return"   # optional: a shorter title for the rail beside the timeline
order: 6                  # the era's place in the timeline
start: -597               # optional: signed years, negative is BC
end: -400
span: "597–c. 400 BC"     # the era's dates as readers see them
colour: era-6             # optional: one of sixteen hues, era-1 to era-16
summary: "One or two sentences, at most 280 characters."
---

A paragraph that introduces the era.
```

Without `colour` the eras are spread evenly across the sixteen hues. `start` and `end` are used to warn about an event whose year lies far outside its era.

## Events

File: `src/content/events/<era-id>/<event-id>.md`. The folder must be the event's era.

```yaml
---
title: The First Deportation to Babylon
summary: One or two sentences, at most 280 characters, shown on the timeline card. No citations here.
era: exile-and-return
date:
  start: -597          # signed year: negative is BC. There is no year 0.
  end: -586            # optional, for events with duration
  month: 3             # optional, only with confidence firm or estimated
  day: 16              # optional
  circa: true          # optional, shown as "c."
  display: "587/586 BC" # optional, replaces the generated label
  confidence: firm     # firm | estimated | traditional | undated
order: 0               # settles the order of events in the same year
places: [jerusalem, babylon]      # the main place first
people: [jehoiachin, nebuchadnezzar-ii]
threads: [kingship-and-messiah]
follows: [battle-of-carchemish]   # earlier events this one grows out of
citations:
  chronicle:                      # a key you choose: lower-case letters, digits, hyphens
    source: babylonian-chronicle-abc-5   # id of a file in sources/
    at: "rev. 11–13"                     # the passage, as a reader would cite it
    url: https://…                       # link to the passage; left out, the source's own url is used
dating: |
  Markdown. Required unless confidence is firm: what fixes the date, and what remains disputed.
reviewed: 2026-10-03   # the day someone who did not write the entry checked every citation
draft: true            # an unfinished entry: shown while developing, left out of a build
---

The narrative, in Markdown.
```

**YAML quoting.** Put a value in double quotes whenever it contains a colon followed by a space, starts with a quotation mark, bracket or `@`, or contains ` #`. `summary: Paul sets him beside Christ: through Adam came sin` breaks the file; `summary: "Paul sets him beside Christ: through Adam came sin"` does not. The validator reports this as a `yaml` error.

### The four date labels

| Value | Use when |
|---|---|
| `firm` | The year is fixed by documents of the time and not seriously disputed. |
| `estimated` | The year is worked out from primary evidence, with a margin of a few years or two competing years. |
| `traditional` | The date comes from later tradition, with no evidence from the time to anchor it. |
| `undated` | The source gives no datable setting. Leave `start` out. |

`follows` is the editors' reading of how events hang together. Each event page lists what it grows out of and what it leads to.

## People

```yaml
---
name: Jehoiachin
altNames: [Jeconiah, Coniah]        # optional: other names a reader might search for
role: King of Judah, 597 BC         # a few words
born: { start: -615, circa: true, confidence: estimated }   # optional
died: { start: -562, confidence: firm }                     # optional
summary: At most 280 characters.
citations: {}                       # as in events, if the text cites sources
---

One or two short paragraphs. The page gathers the events the person appears in.
```

## Places

```yaml
---
name: Babylon
altNames: [Babel]
modern: Near Hillah, Iraq           # the modern name and country
lat: 32.542                         # decimal degrees
lon: 44.421
kind: city                          # city | region | mountain | river | sea | island | site
region: mesopotamia-and-persia      # one of the regions in wiki.config.ts
location: known                     # known | approximate | traditional | disputed
summary: At most 280 characters.
---

One paragraph.
```

`location` says how well the position is known. Anything but `known` is drawn as a hollow, dashed pin and explained on the place's page.

## Sources

One file per work or object, shared by every entry that cites it.

```yaml
---
title: Annals
author: Tacitus                     # leave out for anonymous works and objects
cite: "Tacitus, Annals"             # short form; the passage from `at` is added: "Tacitus, Annals 15.44"
kind: history                       # scripture | history | chronicle | letter | treatise | council | creed | law | liturgy | inscription | manuscript | artifact
written:
  start: 115
  end: 120
  circa: true
  display: "c. AD 115–120"          # optional
language: Latin
url: https://…                      # the whole work online, or the holding institution's record of the object
links:                              # optional: a translation, the original text, images
  - label: Latin text (Perseus)
    url: https://…
edition: "Translation by A. J. Church and W. J. Brodribb (1876), public domain."
holding: British Museum, London (BM 21946)   # objects and manuscripts
summary: At most 280 characters: what it is and why it counts as evidence.
---

Who wrote it, when, how close to the events, and anything a reader needs in order to weigh it.
```

Every `url` must be `https`. For a work in many books, make one source and give each citation its own `url` to the book or chapter.

## Threads

```yaml
---
title: "Temple and Worship"
order: 2                  # the thread's place in lists; threads with the same number are sorted by title
summary: "At most 280 characters."
---

A paragraph on what the thread follows.
```

## The method page

`pages/about.md` says how the wiki is made. The footer of every page links to it and to two of its sections.

```markdown
---
title: Method and sources
summary: "What the wiki is and what it sets out to do."
citations: {}
---

At present it holds {events} events, {people} people, {places} places and {sources} source records.

## [sources] Every claim is tied to a primary source

## [confidence] How dates are labelled

{confidence-list}

## [corrections] Corrections
```

The name in square brackets after `##` is the heading's anchor. `[confidence]` and `[corrections]` are the two the footer links to. `{events}`, `{people}`, `{places}` and `{sources}` are replaced by the counts, and a paragraph that holds only `{confidence-list}` by the four date labels with their marks, descriptions and the examples from the wiki's settings.

## Links and citations in the text

| Write | The reader sees |
|---|---|
| `[[cite:chronicle]]` | (Babylonian Chronicle 5 rev. 11–13), linked to the passage |
| `[[bible:2 Kings 25:8-10]]` | (2 Kings 25:8–10), linked to the passage in a Bible reader |
| `[[bible:Jer 52:12-30; 2 Chr 36:17-21]]` | one citation of two passages |
| `[[person:jeremiah]]` | Jeremiah, linked to his page |
| `[[place:babylon\|the city]]` | "the city", linked to Babylon |
| `[[event:edict-of-cyrus]]`, `[[thread:covenant]]`, `[[source:cyrus-cylinder]]`, `[[era:reformation]]` | links to those pages |

- Put a citation after the sentence or clause it supports, before the full stop. The brackets are added for you.
- A link without a label shows the target's own name or title. An event's title rarely fits in the middle of a sentence, so give event links a label: `the [[event:council-of-nicaea|council of 325]]`.
- Bible references are written in English in every language (`Gen`, `2 Kgs`, `Ps`, `Matt`, `1 Cor`, `1 Macc`, `Sir`) and checked: the book, chapter and verses must exist.
- Ordinary Markdown works: `*emphasis*`, `> quotation`, lists, links. Raw HTML does not.
- Write plain quotation marks (`"…"`). They are turned into the marks of the entry's language.

## What the validator checks

`npx chronowiki validate` runs before every build. An error stops the build; a warning does not. With `--strict`, the release rules are errors too.

| Code | Rule |
|---|---|
| `yaml`, `schema`, `id` | The front matter is valid and has the fields above; the file name is an id and is not used twice. |
| `ref` | Every person, place, thread, era, event and source an entry names exists. |
| `token` | Every `[[…]]` in the text is well formed, every `[[cite:key]]` is defined in the entry's `citations`, every Bible reference exists. |
| `primary` | An event's narrative cites at least one source. |
| `dating` | An event whose date is not firm has a dating note. |
| `place` | A dated event has at least one place, and no place is still at 0, 0. |
| `era-folder` | An event's file is in the folder of its era. |
| `follows` | No event follows itself, and `follows` does not run in a circle. |
| `duplicate` | No two people, or two places, share a name. |
| `language`, `page` | Every language has every message, and the method page exists. |
| `length`, `era-range`, `follows-order` (warnings) | The narrative has 80 to 700 words; the year lies within its era; an event does not follow a later one. |
| `draft`, `orphan`, `reviewed`, `unused-citation` (release rules) | No drafts; no person, place or source that no event refers to; every event independently checked; no citation defined but not used. |

Translations have rules of their own, described in [languages.md](languages.md).

While developing, a broken link or citation is logged and the page still renders. In a build it is an error, with the entry's name.
