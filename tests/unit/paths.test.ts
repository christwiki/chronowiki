import { describe, expect, it } from 'vitest';
import { joinBase } from '../../src/lib/paths';

describe('joinBase', () => {
  it('joins root base', () => expect(joinBase('/', '/events/nicaea')).toBe('/events/nicaea/'));
  it('joins sub-path base', () => expect(joinBase('/wiki/', '/events/nicaea/')).toBe('/wiki/events/nicaea/'));
  it('handles base without trailing slash', () => expect(joinBase('/wiki', 'events/nicaea')).toBe('/wiki/events/nicaea/'));
  it('keeps files untouched', () => expect(joinBase('/wiki/', '/map/world-50m.json')).toBe('/wiki/map/world-50m.json'));
  it('keeps hash and query', () => expect(joinBase('/', '/?era=reformation#e-nicaea')).toBe('/?era=reformation#e-nicaea'));
  it('adds the slash before a query', () => expect(joinBase('/', '/map?from=-600')).toBe('/map/?from=-600'));
  it('root', () => expect(joinBase('/wiki/', '/')).toBe('/wiki/'));
});
