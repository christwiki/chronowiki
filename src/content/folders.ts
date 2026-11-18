/**
 * Whether a wiki has a folder of entries at all. Quotations are the one kind
 * of entry a wiki may do without; asking for a folder that is not there would
 * fill the build with warnings.
 */
import { existsSync } from 'node:fs';

export const hasEntries = (collection: string): boolean => existsSync(`./src/content/${collection}`);
