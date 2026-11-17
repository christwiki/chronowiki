/**
 * Every word of the interface, in English. This file is the source of truth:
 * its shape is the `Messages` type, so a translation that misses a key or adds
 * one does not compile.
 *
 * The wording is that of a wiki about any stretch of history. A wiki puts its
 * own subject in by overriding messages in `wiki.config.ts`: its tagline, the
 * opening lines of the timeline, the examples for the date labels.
 *
 * `{name}` is filled in by the caller. An object with `one`/`other` (and, for
 * languages that need them, `zero`, `two`, `few`, `many`) is a plural: the form
 * is chosen from `count` by the language's own rules.
 */
export const en = {
  site: {
    tagline: 'History on one timeline, tied to its primary sources.',
    description:
      'A wiki built on a timeline. Every entry shows when and where it happened, how it connects, and links to the primary sources.',
  },

  nav: {
    label: 'Main',
    home: '{site} home',
    skip: 'Skip to content',
    timeline: 'Timeline',
    map: 'Map',
    threads: 'Threads',
    people: 'People',
    places: 'Places',
    sources: 'Sources',
    about: 'About',
    search: 'Search',
    theme: 'Switch colour theme',
    language: 'Language',
    breadcrumb: 'Breadcrumb',
  },

  footer: {
    lead: '{site} ties every entry to primary sources. Found a mistake?',
    correct: 'Tell us how to correct it',
    method: 'Method and sources',
    dates: 'How dates are labelled',
    code: 'Source code and content',
    /** `{license}` is the licence's name, such as CC BY-SA 4.0. */
    license: 'Text under {license}',
  },

  confidence: {
    firm: {
      label: 'Firm date',
      description: 'Fixed by contemporary documentation and not seriously disputed.',
      /** One or two events of the wiki that carry this label. Left empty, no example is shown. */
      example: '',
    },
    estimated: {
      label: 'Estimated date',
      description: 'A scholarly estimate from primary evidence, with a margin of years.',
      example: '',
    },
    traditional: {
      label: 'Traditional date',
      description: 'From later tradition, with no evidence from the time itself to anchor it.',
      example: '',
    },
    undated: {
      label: 'Undated',
      description: 'Narrated by the source with no datable setting.',
      example: '',
    },
  },

  /**
   * How dates are written. `{year}`, `{start}` and `{end}` are plain numbers;
   * `{month}` is the month's name in this language; `{date}` is a finished date.
   */
  date: {
    bc: '{year} BC',
    ad: 'AD {year}',
    /** From the year 1000 the era is not written. */
    plain: '{year}',
    rangeBc: '{start}–{end} BC',
    rangeAd: 'AD {start}–{end}',
    rangePlain: '{start}–{end}',
    /** A range that crosses from BC to AD: both ends are finished dates. */
    rangeAcross: '{start} – {end}',
    monthYear: '{month} {date}',
    dayMonthYear: '{day} {month} {date}',
    circa: 'c. {date}',
    undated: 'Undated',
    /** The same, read aloud by a screen reader. */
    spokenCirca: 'about {date}',
    spokenRange: '{start} to {end}',
    spokenUndated: 'undated',
    spoken: '{date}, {confidence}',
    lifespan: '{born} – {died}',
    born: 'born {date}',
    died: 'died {date}',
  },

  home: {
    title: 'History on one timeline',
    lead: {
      one: '{count} moment. It shows when and where it happened, how it connects to the rest, and the primary sources it rests on.',
      other:
        '{count} moments. Each shows when and where it happened, how it connects to the rest, and the primary sources it rests on.',
    },
    legend: 'How dates are labelled',
    legendMore: 'What these mean',
    end: 'The timeline ends here for now.',
    endLink: 'Read how {site} is made',
    mapPanel: 'Map of the events in view',
    mapClose: 'Close the map',
    mapFull: 'Open the full map',
    mapButton: 'Map',
  },

  filter: {
    label: 'Filter the timeline',
    byWord: 'Filter events by word',
    placeholder: 'Filter by word, person or place',
    era: 'Era',
    thread: 'Thread',
    region: 'Region',
    dating: 'Dating',
    clear: 'Clear filters',
    count: { one: '{count} event', other: '{count} events' },
    countOf: { one: '{matched} of {count} event', other: '{matched} of {count} events' },
  },

  common: {
    events: { one: '{count} event', other: '{count} events' },
    draft: 'Draft',
    notWritten: 'This entry has not been written yet.',
    also: 'Also: {names}',
    primarySources: 'Primary sources',
    showOnTimeline: 'Show on the timeline',
    earlier: 'Earlier',
    later: 'Later',
    range: '{first} to {last}',
  },

  kind: {
    event: 'Event',
    person: 'Person',
    place: 'Place',
    source: 'Source',
    thread: 'Thread',
    era: 'Era',
    page: 'Page',
  },

  eras: {
    rail: 'Eras',
    eventsOf: 'Events of this era',
    others: 'Other eras',
    where: 'Where this era unfolded',
    places: 'The places of this era’s events.',
  },

  event: {
    datingTitle: 'How this is dated',
    reviewed: 'Every citation on this page was independently checked against its source on {date}.',
    awaiting: 'The citations on this page are awaiting an independent check.',
    aside: 'About this event',
    where: 'Where',
    who: 'Who',
    threads: 'Threads',
    context: 'In context',
    growsOutOf: 'Grows out of',
    leadsTo: 'Leads to',
    alongThreads: 'Along the threads',
    before: 'Before · {date}',
    after: 'After · {date}',
    threadBegins: 'This thread begins here',
    threadLatest: 'The latest event on this thread',
    pager: 'Timeline',
    earlier: 'Earlier · {date}',
    later: 'Later · {date}',
  },

  sourceList: {
    scripture: 'Scripture',
    reader: 'Links open the passage in the {version} at {reader}.',
  },

  sourceCard: {
    read: 'Read the passage',
    about: 'About this source',
  },

  /** A source's kind, as a word in running text: "creed", "letter". */
  sourceKind: {
    scripture: 'scripture',
    history: 'history',
    chronicle: 'chronicle',
    letter: 'letter',
    treatise: 'treatise',
    council: 'council',
    creed: 'creed',
    law: 'law',
    liturgy: 'liturgy',
    inscription: 'inscription',
    manuscript: 'manuscript',
    artifact: 'artifact',
  },

  /** The same kinds as headings of the sources index, each with a line of explanation. */
  sourceGroup: {
    scripture: {
      label: 'Scripture and its versions',
      note: 'Sacred texts and their versions, cited as documents in their own right.',
    },
    inscription: {
      label: 'Inscriptions',
      note: 'Texts cut in stone or pressed in clay by the rulers and officials of the time.',
    },
    artifact: { label: 'Artifacts', note: 'Objects that carry evidence: tablets, seals, monuments.' },
    manuscript: { label: 'Manuscripts', note: 'Surviving handwritten copies of texts.' },
    chronicle: { label: 'Chronicles', note: 'Year-by-year records kept close to the events.' },
    history: { label: 'Histories', note: 'Narrative works by ancient and medieval historians.' },
    letter: { label: 'Letters', note: 'Correspondence of the people involved.' },
    treatise: { label: 'Treatises and other writings', note: 'Works that set out an argument or a teaching.' },
    council: { label: 'Councils', note: 'Acts, canons and decrees of councils and synods.' },
    creed: { label: 'Creeds and confessions', note: 'Formal statements of belief.' },
    law: { label: 'Laws, edicts and treaties', note: 'Acts of rulers and states.' },
    liturgy: { label: 'Liturgies and rules', note: 'Texts that order worship and common life.' },
  },

  people: {
    title: 'People',
    description: 'Everyone who appears in the timeline.',
    lead: {
      one: '{count} person who appears in the timeline. The page gathers the events that person took part in.',
      other: '{count} people who appear in the timeline. Each page gathers the events a person took part in.',
    },
    jump: 'Jump to a letter',
    inTimeline: 'In the timeline',
  },

  places: {
    title: 'Places',
    description: 'Every place in the timeline, by region, on one map.',
    lead: {
      one: '{count} place where the events of the timeline happened. Ancient names come first, with the modern name beside them.',
      other:
        '{count} places where the events of the timeline happened. Ancient names come first, with the modern name beside them.',
    },
    count: { one: '{count} place', other: '{count} places' },
    notWritten: 'Not yet written',
    happened: 'What happened here',
    aside: 'Location',
    position: 'Position',
    certainty: 'Certainty',
    /** "37.95° N", "23.72° E". */
    north: '{degrees}° N',
    south: '{degrees}° S',
    east: '{degrees}° E',
    west: '{degrees}° W',
    coordinates: '{lat}, {lon}',
    /** Added after a modern name when the position is not secure: "location traditional". */
    locationTag: 'location {kind}',
    location: {
      known: 'known',
      approximate: 'approximate',
      traditional: 'traditional',
      disputed: 'disputed',
    },
    locationNote: {
      known: 'The site is securely identified.',
      approximate: 'The position shown is approximate.',
      traditional: 'The position shown is the one fixed by later tradition.',
      disputed: 'Scholars disagree about where this place was; the position shown is one proposal.',
    },
  },


  sources: {
    title: 'Sources',
    description:
      'The primary sources behind the timeline: texts, inscriptions and artifacts, each linked to where it can be read or seen.',
    lead: {
      one: 'The {count} primary source cited in the timeline. It links to the full text or to the institution that holds the object.',
      other:
        'The {count} primary sources cited in the timeline. Each links to the full text or to the institution that holds the object.',
    },
    jump: 'Jump to a kind of source',
    readText: 'Read the text at {host}',
    seeObject: 'See the object at {host}',
    citedIn: 'Cited in',
    aside: 'About this source',
    kind: 'Kind',
    author: 'Author',
    written: 'Written',
    language: 'Language',
    heldBy: 'Held by',
    edition: 'Edition',
  },

  /**
   * Names of the languages sources are written in, by the name source records
   * give them. A name that is not listed here is shown as written, and a wiki
   * may add names of its own.
   */
  languages: {
    Latin: 'Latin',
    English: 'English',
    Greek: 'Greek',
    German: 'German',
    Spanish: 'Spanish',
    French: 'French',
    Italian: 'Italian',
    Akkadian: 'Akkadian',
    Russian: 'Russian',
    Chinese: 'Chinese',
    Syriac: 'Syriac',
    Hebrew: 'Hebrew',
    Aramaic: 'Aramaic',
    Portuguese: 'Portuguese',
    Scots: 'Scots',
    Arabic: 'Arabic',
    'Old French': 'Old French',
    Georgian: 'Georgian',
    "Ge'ez": 'Ge’ez',
    Egyptian: 'Egyptian',
    Dutch: 'Dutch',
    'Church Slavonic': 'Church Slavonic',
    'Old Church Slavonic': 'Old Church Slavonic',
    Ukrainian: 'Ukrainian',
    Sabaic: 'Sabaic',
    Polish: 'Polish',
    Japanese: 'Japanese',
    Coptic: 'Coptic',
    'Classical Chinese': 'Classical Chinese',
    Armenian: 'Armenian',
    Korean: 'Korean',
    Persian: 'Persian',
    Czech: 'Czech',
    Hungarian: 'Hungarian',
    Bulgarian: 'Bulgarian',
    Swedish: 'Swedish',
    Danish: 'Danish',
    'Old English': 'Old English',
    'Middle English': 'Middle English',
    'Old Norse': 'Old Norse',
    Nahuatl: 'Nahuatl',
    Tamil: 'Tamil',
    Malayalam: 'Malayalam',
  },

  threads: {
    title: 'Threads',
    description: 'Storylines that run through the whole timeline.',
    lead: 'Storylines that run across the eras. Follow one from start to finish to see how events far apart in time belong together.',
    whole: 'The thread from start to finish',
    others: 'Other threads',
  },

  map: {
    title: 'Map',
    description: 'Where the events of the timeline happened. Step through the eras and watch the story move across the map.',
    heading: 'Where it happened',
    intro: 'Step through the eras to see where the story unfolded. Choose a pin for the events at that place.',
    previousEra: 'Previous era',
    nextEra: 'Next era',
    era: 'Era',
    allEras: 'All eras',
    failed: 'The map could not be loaded. The events are listed below.',
    failedReload: 'The map could not be loaded. Reload the page to try again.',
    showing: 'Map showing {places}',
    plain: 'Map',
    help: 'Map. Arrow keys pan, plus and minus zoom. Pins list the events at each place.',
    zoomIn: 'Zoom in',
    zoomOut: 'Zoom out',
    fit: 'Fit the map to the current events',
    pin: { one: '{place}: {count} event', other: '{place}: {count} events' },
    more: { one: 'and {count} more', other: 'and {count} more' },
  },

  search: {
    label: 'Search',
    input: 'Search events, people, places and sources',
    placeholder: 'Search events, people, places, sources',
    close: 'Close search',
    hint: 'Type to search the whole wiki.',
    unavailable: 'Search is available in the built site (run npm run build, then npm run preview).',
    nothing: 'Nothing found for “{query}”.',
    showing: 'Showing the first {shown} of {count} results.',
    results: { one: '{count} result.', other: '{count} results.' },
  },

  notFound: {
    title: 'Page not found',
    heading: 'This page does not exist',
    lead: 'The address may be mistyped, or the entry may have been renamed.',
    toTimeline: 'Go to the timeline',
    search: 'Search the wiki',
  },

  about: {
    title: 'Method and sources',
    description: 'How {site} is made: what counts as a primary source, how dates are labelled, and how to report a mistake.',
    /** The three names in braces become links. */
    start: 'Start with the {timeline}, follow a {thread}, or browse the {sources}.',
    startTimeline: 'timeline',
    startThread: 'thread',
    startSources: 'sources',
  },

  translation: {
    /** Shown on an entry that exists only in the language the wiki is written in. `{language}` is that language's name. */
    missing: 'This entry has not been translated yet. It is shown in {language}.',
    /** Shown on a translation whose original has changed since. */
    stale: 'This translation was made from an earlier version of the entry in {language}, which has since been revised.',
    original: 'Read the entry in {language}',
    /** Shown above the timeline while a language is only partly translated. */
    partial: '{translated} of {count} entries are available in this language so far. The others are shown in {language}.',
  },
};
