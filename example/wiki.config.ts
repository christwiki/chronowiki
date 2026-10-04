/**
 * The wiki's settings. Everything that is this wiki's own is here; the pages,
 * the design and the tools come from the theme.
 */
import { defineWiki, english, german } from 'chronowiki/config';

export default defineWiki({
  /** Shown in the header and in page titles. */
  name: 'Example Wiki',

  /** Where the wiki's files are kept. The footer links here. Leave it out and the link goes too. */
  repository: 'https://github.com/christwiki/chronowiki',

  /** The licence of the text, named in the footer. */
  license: { name: 'CC BY-SA 4.0', url: 'https://creativecommons.org/licenses/by-sa/4.0/' },

  /**
   * The languages. The first is the one the content is written in. `messages`
   * lays the wiki's own wording over the theme's: say here what the wiki is about.
   * A `preview` language is built while developing and left out of a release.
   */
  locales: [
    english({
      messages: {
        site: {
          tagline: 'Judah between the empires, on one timeline.',
          description:
            'An example wiki built with chronowiki: Judah from the fall of Samaria to the Maccabees. Every entry shows when and where it happened, how it connects, and links to the primary sources.',
        },
        home: {
          title: 'Judah between the empires',
          lead: {
            one: '{count} moment from the fall of Samaria to the Maccabees. It shows when and where it happened, how it connects to the rest, and the primary sources it rests on.',
            other:
              '{count} moments from the fall of Samaria to the Maccabees. Each shows when and where it happened, how it connects to the rest, and the primary sources it rests on.',
          },
        },
        // One or two events for each date label, shown on the method page.
        confidence: {
          firm: { example: 'The first deportation to Babylon, 16 March 597 BC.' },
          estimated: { example: 'The fall of Jerusalem to Babylon, 587 or 586 BC.' },
          traditional: { example: 'Daniel at the court of Babylon.' },
          undated: { example: 'The prophecy of Malachi.' },
        },
      },
    }),
    german({
      status: 'preview',
      messages: {
        site: {
          tagline: 'Juda zwischen den Großreichen, auf einem Zeitstrahl.',
          description:
            'Ein Beispielwiki, gebaut mit chronowiki: Juda vom Fall Samarias bis zu den Makkabäern. Jeder Eintrag zeigt, wann und wo etwas geschah und wie es zusammenhängt, und verweist auf die Primärquellen.',
        },
        home: {
          title: 'Juda zwischen den Großreichen',
          lead: {
            one: '{count} Moment vom Fall Samarias bis zu den Makkabäern. Er zeigt, wann und wo etwas geschah, wie es mit dem Übrigen zusammenhängt und auf welchen Primärquellen es beruht.',
            other:
              '{count} Momente vom Fall Samarias bis zu den Makkabäern. Jeder zeigt, wann und wo etwas geschah, wie es mit dem Übrigen zusammenhängt und auf welchen Primärquellen es beruht.',
          },
        },
        confidence: {
          firm: { example: 'Die erste Wegführung nach Babylon, 16. März 597 v. Chr.' },
          estimated: { example: 'Der Fall Jerusalems an Babylon, 587 oder 586 v. Chr.' },
          traditional: { example: 'Daniel am Hof von Babylon.' },
          undated: { example: 'Die Prophetie Maleachis.' },
        },
      },
    }),
  ],

  /**
   * The regions of the map, in the order the filters list them. Every place
   * names one of them in its `region` field. A name is one string, or one per language.
   */
  regions: [
    { id: 'levant', name: { en: 'Levant', de: 'Levante' } },
    { id: 'egypt', name: { en: 'Egypt', de: 'Ägypten' } },
    { id: 'mesopotamia-and-persia', name: { en: 'Mesopotamia and Persia', de: 'Mesopotamien und Persien' } },
    { id: 'italy', name: { en: 'Italy', de: 'Italien' } },
  ],
});
