/** The wiki the unit tests run against: both of the theme's languages, as the theme words them. */
import { defineWiki, english, german } from '../../src/config';

export default defineWiki({
  name: 'Test Wiki',
  repository: 'https://example.org/test-wiki',
  locales: [english(), german()],
  regions: [
    { id: 'levant', name: { en: 'Levant', de: 'Levante' } },
    { id: 'mesopotamia', name: 'Mesopotamia' },
  ],
});
