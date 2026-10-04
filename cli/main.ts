/**
 * The `chronowiki` command: the tools a wiki's editors run from the wiki's folder.
 */
const COMMANDS: Record<string, { file: string; about: string }> = {
  validate: { file: './validate.ts', about: 'check every entry against the schemas and the source policy' },
  'check-links': { file: './check-links.ts', about: 'request every external link and report the ones that fail' },
  i18n: { file: './i18n.ts', about: 'see what is translated, start a translation, mark one as up to date' },
  init: { file: './init.ts', about: 'start a new wiki in a folder, from the example' },
};

const command = process.argv[2];

if (!command || !(command in COMMANDS)) {
  const width = Math.max(...Object.keys(COMMANDS).map((name) => name.length));
  console.log('Usage: chronowiki <command> [options]\n');
  for (const [name, { about }] of Object.entries(COMMANDS)) console.log(`  ${name.padEnd(width)}  ${about}`);
  process.exit(command === undefined || command === 'help' || command === '--help' ? 0 : 2);
}

// Each tool reads its own options from the command line, as if it had been started directly.
process.argv.splice(2, 1);
try {
  await import(COMMANDS[command].file);
} catch (error) {
  console.error((error as Error).message);
  process.exit(2);
}

export {};
