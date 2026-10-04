/**
 * Checks every content file against the schemas and the source policy.
 *
 *   chronowiki validate                    all content; warnings do not fail
 *   chronowiki validate --strict           release check: drafts, orphans and unreviewed entries fail
 *   chronowiki validate --era <era-id>     only that era's events and what they reference
 *
 * Translations (src/content/i18n/) are checked with everything else (see
 * src/lib/validate-i18n.ts), and so are the languages in wiki.config.ts.
 */
import { loadWikiConfig } from '../src/config/load';
import { checkLocale } from '../src/i18n/check';
import { CONTENT_ROOT, loadContent, loadPages, loadTranslations } from '../src/lib/load';
import { validateContent, type Issue, type RawContent } from '../src/lib/validate';
import { validateTranslations } from '../src/lib/validate-i18n';

const args = process.argv.slice(2);
const strict = args.includes('--strict');
const eraIndex = args.indexOf('--era');
const era = eraIndex === -1 ? undefined : args[eraIndex + 1];

if (eraIndex !== -1 && !era) {
  console.error('Usage: chronowiki validate [--strict] [--era <era-id>]');
  process.exit(2);
}

/** The files an era owns: its events plus the people, places and sources they reference. */
function filesOfEra(content: RawContent, eraId: string): Set<string> {
  const files = new Set<string>();
  const wanted = { people: new Set<string>(), places: new Set<string>(), sources: new Set<string>() };

  for (const event of content.events) {
    const data = (event.data ?? {}) as Record<string, any>;
    if (data.era !== eraId && !event.file.startsWith(`events/${eraId}/`)) continue;
    files.add(event.file);
    for (const id of data.people ?? []) wanted.people.add(id);
    for (const id of data.places ?? []) wanted.places.add(id);
    for (const def of Object.values(data.citations ?? {}) as { source?: string }[]) {
      if (def?.source) wanted.sources.add(def.source);
    }
  }
  for (const kind of ['people', 'places'] as const) {
    for (const entry of content[kind]) {
      if (!wanted[kind].has(entry.id)) continue;
      files.add(entry.file);
      const citations = ((entry.data ?? {}) as Record<string, any>).citations ?? {};
      for (const def of Object.values(citations) as { source?: string }[]) {
        if (def?.source) wanted.sources.add(def.source);
      }
    }
  }
  for (const entry of content.sources) if (wanted.sources.has(entry.id)) files.add(entry.file);
  return files;
}

/** Problems with the languages are reported against the wiki's settings, not against a content file. */
const CONFIG_FILE = 'wiki.config.ts';

const config = await loadWikiConfig();
const content = loadContent();
const translations = loadTranslations();
const pages = loadPages();
let issues: Issue[] = [
  // The footer of every page links to the method page and to two of its sections.
  ...(pages.some((page) => page.id === 'about')
    ? []
    : [{ level: 'error', code: 'page', file: 'pages/about.md', message: 'The page that says how the wiki is made is missing' } as Issue]),
  ...config.locales.flatMap((locale) =>
    checkLocale(locale).map(
      (message): Issue => ({ level: 'error', code: 'language', file: CONFIG_FILE, message: `${locale.code}: ${message}` }),
    ),
  ),
  ...validateContent(content, { strict, regions: config.regions }),
  ...validateTranslations(content, pages, translations, { locales: config.locales, defaultLocale: config.defaultLocale }),
];

if (era) {
  if (!content.eras.some((e) => e.id === era)) {
    console.error(`There is no era "${era}". Eras: ${content.eras.map((e) => e.id).join(', ')}`);
    process.exit(2);
  }
  const files = filesOfEra(content, era);
  issues = issues.filter((issue) => files.has(issue.file));
}

const colour = process.stdout.isTTY && !process.env.NO_COLOR;
const paint = (code: number, text: string) => (colour ? `\x1b[${code}m${text}\x1b[0m` : text);

const byFile = new Map<string, Issue[]>();
for (const issue of issues) byFile.set(issue.file, [...(byFile.get(issue.file) ?? []), issue]);

for (const [file, list] of byFile) {
  console.log(`\n${paint(1, file === CONFIG_FILE ? file : `${CONTENT_ROOT}/${file}`)}`);
  for (const issue of list) {
    const tag = issue.level === 'error' ? paint(31, 'error  ') : paint(33, 'warning');
    console.log(`  ${tag} ${paint(2, issue.code.padEnd(16))} ${issue.message}`);
  }
}

const errors = issues.filter((i) => i.level === 'error').length;
const warnings = issues.length - errors;
const total = Object.values(content).reduce((sum, entries) => sum + entries.length, 0);
const scope = era ? `era ${era}` : `${total} entries${translations.length > 0 ? ` and ${translations.length} translations` : ''}`;
console.log(`\n${scope}: ${errors} error${errors === 1 ? '' : 's'}, ${warnings} warning${warnings === 1 ? '' : 's'}`);

process.exit(errors > 0 ? 1 : 0);
