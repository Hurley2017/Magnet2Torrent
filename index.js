#!/usr/bin/env node

'use strict';

const TorrentSearchApi = require('torrent-search-api');
const inquirer = require('inquirer');
const chalk = require('chalk');
const Table = require('cli-table3');
const open = require('open');
const ora = require('ora');
const { program } = require('commander');

// ─── Config ──────────────────────────────────────────────────────────────────

const DEFAULT_LIMIT = 20;

// Map friendly display labels → the exact strings the API accepts.
// The API matches these case-sensitively against each provider's own category list.
// Using 'All' always works; specific categories only work on providers that
// support them. We search with 'All' and let results come from every provider,
// then optionally client-side filter by keyword in the title.
const CATEGORY_MAP = {
  '🌐 All':           'All',
  '🎬 Movies':        'Movies',
  '📺 TV Shows':      'TV',
  '🎵 Music':         'Music',
  '💾 Apps/Software': 'Applications',
  '📚 Books':         'Books',
  '🎮 Games':         'Games',
  '🌸 Anime':         'Anime',
  '🔞 XXX':           'XXX',
};

const CATEGORY_LABELS = Object.keys(CATEGORY_MAP);

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatSize(size) {
  if (!size || size === 'Unknown') return chalk.gray('N/A');
  return chalk.cyan(size);
}

function formatSeeds(seeds) {
  const n = parseInt(seeds, 10);
  if (isNaN(n)) return chalk.gray('?');
  if (n >= 100) return chalk.green(n);
  if (n >= 10)  return chalk.yellow(n);
  return chalk.red(n);
}

function formatLeeches(leeches) {
  const n = parseInt(leeches, 10);
  if (isNaN(n)) return chalk.gray('?');
  return chalk.magenta(n);
}

function truncate(str, len = 60) {
  if (!str) return '';
  return str.length > len ? str.slice(0, len - 1) + '…' : str;
}

function sortBySeeds(results) {
  return [...results].sort((a, b) => {
    const sa = parseInt(a.seeds, 10) || 0;
    const sb = parseInt(b.seeds, 10) || 0;
    return sb - sa;
  });
}

function printBanner() {
  console.log(chalk.bold.cyan('\n ╔══════════════════════════════════════════════════════════════════╗'));
  console.log(chalk.bold.cyan(' ║                    🧲  Magnet2Torrent CLI  🧲                    ║'));
  console.log(chalk.bold.cyan(' ╚══════════════════════════════════════════════════════════════════╝'));
  console.log(chalk.bold.yellow(' ⚠️  ADVISORY: Intended strictly for open-source / legal P2P use.'));
  console.log(chalk.bold.yellow('    Do NOT use this tool for copyright infringement or piracy.\n'));
}

function printTorrentTable(torrents) {
  const table = new Table({
    head: [
      chalk.bold('#'),
      chalk.bold('Title'),
      chalk.bold('Provider'),
      chalk.bold('Size'),
      chalk.bold.green('Seeds'),
      chalk.bold.magenta('Peers'),
      chalk.bold('Age'),
    ],
    colWidths: [4, 60, 16, 10, 7, 7, 14],
    style: { head: [], border: ['gray'] },
    wordWrap: true,
  });

  torrents.forEach((t, i) => {
    table.push([
      chalk.bold(i + 1),
      truncate(t.title, 57),
      chalk.blue(t.provider || '?'),
      formatSize(t.size),
      formatSeeds(t.seeds),
      formatLeeches(t.peers),
      chalk.gray(t.time ? String(t.time).slice(0, 11) : ''),
    ]);
  });

  console.log(table.toString());
  console.log(chalk.gray(`  Showing ${torrents.length} result(s), sorted by seeds ↓\n`));
}

// ─── Core Actions ─────────────────────────────────────────────────────────────

async function getEnabledProviders() {
  TorrentSearchApi.enablePublicProviders();
  const active = TorrentSearchApi.getActiveProviders();
  return active.map((p) => p.name);
}

/**
 * Search strategy:
 * - Always search with 'All' category so every provider returns results.
 * - Sort results by seeds descending.
 * - Multiply limit slightly to compensate for providers that return fewer items.
 */
async function searchTorrents(query, categoryLabel, limit) {
  // Always use 'All' — per-category strings are inconsistent across providers
  const apiCategory = 'All';
  const fetchLimit = Math.min(limit + 5, 50); // fetch a few extra, then trim

  const spinner = ora(
    chalk.cyan(`Searching "${query}" across all providers…`)
  ).start();

  try {
    const results = await TorrentSearchApi.search(query, apiCategory, fetchLimit);

    // Client-side filter: if user picked a specific category, filter by
    // common keywords in title (best-effort, since we can't rely on API categories)
    let filtered = results;
    if (categoryLabel !== '🌐 All') {
      const catKey = CATEGORY_MAP[categoryLabel]; // e.g. 'Movies', 'TV', 'Games'
      // For broad categories just show all results — filtering by title is too lossy
      // but for TV we can look for S0x / E0x patterns as a hint
      if (catKey === 'TV') {
        const tvPattern = /\bS\d{1,2}E\d{1,2}\b|\bSeason\b|\bComplete Series\b/i;
        const tvFiltered = results.filter(r => tvPattern.test(r.title));
        filtered = tvFiltered.length > 0 ? tvFiltered : results; // fall back to all
      }
      // For other categories we show all results (too hard to filter without metadata)
    }

    const sorted = sortBySeeds(filtered).slice(0, limit);
    spinner.succeed(
      chalk.green(`Found ${sorted.length} result(s)`) +
      chalk.gray(` from ${results.length} raw hits`)
    );
    return sorted;
  } catch (err) {
    spinner.fail(chalk.red('Search failed: ' + err.message));
    return [];
  }
}

async function fetchMagnet(torrent) {
  // Many providers already embed the magnet in results (TPB, Yts, etc.)
  if (torrent.magnet && torrent.magnet.startsWith('magnet:')) {
    return torrent.magnet;
  }

  const spinner = ora('Fetching magnet link…').start();
  try {
    const magnet = await TorrentSearchApi.getMagnet(torrent);
    spinner.succeed('Magnet link ready');
    return magnet;
  } catch (err) {
    spinner.fail(chalk.red('Could not fetch magnet: ' + err.message));
    return null;
  }
}

async function launchTorrent(magnet) {
  if (!magnet) {
    console.log(chalk.red('\n✖  No magnet link available for this torrent.\n'));
    return;
  }
  const preview = magnet.length > 90 ? magnet.slice(0, 87) + '…' : magnet;
  console.log(chalk.gray('\nMagnet: ') + chalk.dim(preview));
  const spinner = ora('Opening in your default torrent client…').start();
  try {
    await open(magnet);
    spinner.succeed(chalk.green('Torrent launched! 🚀'));
  } catch (err) {
    spinner.fail(chalk.red('Could not open torrent client: ' + err.message));
    console.log(chalk.yellow('\nCopy this magnet link manually:\n') + magnet);
  }
}

// ─── Interactive Prompts ───────────────────────────────────────────────────────

async function promptSearch() {
  const { query } = await inquirer.prompt([
    {
      type: 'input',
      name: 'query',
      message: chalk.cyan('Search for:'),
      validate: (v) => v.trim().length > 0 || 'Please enter a search term',
    },
  ]);

  const { categoryLabel } = await inquirer.prompt([
    {
      type: 'list',
      name: 'categoryLabel',
      message: chalk.cyan('Category:'),
      choices: CATEGORY_LABELS,
      default: '🌐 All',
    },
  ]);

  const { limit } = await inquirer.prompt([
    {
      type: 'number',
      name: 'limit',
      message: chalk.cyan('Max results:'),
      default: DEFAULT_LIMIT,
      validate: (v) => (v > 0 && v <= 50) || 'Enter a number between 1 and 50',
    },
  ]);

  return { query: query.trim(), categoryLabel, limit };
}

async function promptSelectTorrent(torrents) {
  const choices = torrents.map((t, i) => ({
    name:
      `${chalk.bold(String(i + 1).padStart(2))}. ` +
      `${truncate(t.title, 48)} ` +
      chalk.gray('│') + ` ${chalk.blue(t.provider)} ` +
      chalk.gray('│') + ` 🌱 ${formatSeeds(t.seeds)}`,
    value: i,
    short: truncate(t.title, 40),
  }));

  choices.push(new inquirer.Separator());
  choices.push({ name: chalk.yellow('⬅  New search'), value: -1 });
  choices.push({ name: chalk.red('✕  Quit'), value: -2 });

  const { idx } = await inquirer.prompt([
    {
      type: 'list',
      name: 'idx',
      message: chalk.cyan('Select a torrent to launch:'),
      choices,
      pageSize: 22,
    },
  ]);

  return idx;
}

async function promptAfterLaunch() {
  const { action } = await inquirer.prompt([
    {
      type: 'list',
      name: 'action',
      message: chalk.cyan('What next?'),
      choices: [
        { name: '🔍  New search', value: 'search' },
        { name: '⬅   Back to results', value: 'back' },
        { name: chalk.red('✕   Quit'), value: 'quit' },
      ],
    },
  ]);
  return action;
}

// ─── Provider Info ────────────────────────────────────────────────────────────

function printProviders(providerNames) {
  console.log(chalk.bold('📡 Active providers:'));
  const cols = 3;
  for (let i = 0; i < providerNames.length; i += cols) {
    const row = providerNames.slice(i, i + cols).map(n => `  ${chalk.green('✔')} ${n.padEnd(18)}`).join('');
    console.log(row);
  }
  console.log('');
}

// ─── Main Loop ────────────────────────────────────────────────────────────────

async function mainLoop() {
  printBanner();

  const providerNames = await getEnabledProviders();
  printProviders(providerNames);

  let lastResults = [];
  let state = 'search';

  while (state !== 'quit') {
    if (state === 'search') {
      const { query, categoryLabel, limit } = await promptSearch();
      console.log('');
      lastResults = await searchTorrents(query, categoryLabel, limit);
      console.log('');

      if (lastResults.length === 0) {
        console.log(chalk.yellow('⚠  No results found. Try a broader search term or "🌐 All" category.\n'));
        continue;
      }

      printTorrentTable(lastResults);
      state = 'results';
    }

    if (state === 'results') {
      const idx = await promptSelectTorrent(lastResults);

      if (idx === -2) { state = 'quit'; break; }
      if (idx === -1) { state = 'search'; continue; }

      const chosen = lastResults[idx];
      console.log(chalk.bold(`\n🧲 Selected: ${chalk.white(chosen.title)}\n`));

      const magnet = await fetchMagnet(chosen);
      await launchTorrent(magnet);

      const next = await promptAfterLaunch();
      if (next === 'quit')   state = 'quit';
      else if (next === 'search') state = 'search';
      else state = 'results';
    }
  }

  console.log(chalk.bold.cyan('\nGoodbye! 👋\n'));
  process.exit(0);
}

// ─── CLI Entry ────────────────────────────────────────────────────────────────

program
  .name('magnet2torrent')
  .description('Search torrents across 10+ providers and open them in your torrent client')
  .version('1.0.0')
  .addHelpText(
    'after',
    chalk.yellow('\n⚠️  ADVISORY: Use this tool solely for open-source and legally distributable files.\n   Do NOT use for copyright infringement or piracy.')
  );

program
  .command('search <query>')
  .description('Search torrents directly with a query')
  .option('-c, --category <category>', 'Category (All, Movies, TV, Music, Apps, Books, Games, Anime)', 'All')
  .option('-l, --limit <limit>', 'Max results to return (1-50)', (val) => parseInt(val, 10), DEFAULT_LIMIT)
  .action(async (query, options) => {
    printBanner();
    await getEnabledProviders();

    // Map passed category string to friendly label
    const rawCat = (options.category || 'All').trim().toLowerCase();
    const catChoice =
      CATEGORY_LABELS.find(
        (label) =>
          label.toLowerCase().includes(rawCat) ||
          CATEGORY_MAP[label].toLowerCase() === rawCat
      ) || '🌐 All';

    const limit = Math.max(1, Math.min(options.limit || DEFAULT_LIMIT, 50));
    console.log('');
    const results = await searchTorrents(query, catChoice, limit);
    console.log('');

    if (results.length === 0) {
      console.log(chalk.yellow('⚠  No results found. Try a broader search term or different category.\n'));
      return;
    }

    printTorrentTable(results);
    const idx = await promptSelectTorrent(results);
    if (idx >= 0) {
      const chosen = results[idx];
      console.log(chalk.bold(`\n🧲 Selected: ${chalk.white(chosen.title)}\n`));
      const magnet = await fetchMagnet(chosen);
      await launchTorrent(magnet);
    }
  });

program
  .command('providers')
  .description('List all available torrent providers')
  .action(() => {
    TorrentSearchApi.enablePublicProviders();
    const all = TorrentSearchApi.getProviders();
    console.log(chalk.bold('\nAll supported providers:\n'));
    all.forEach((p) => {
      console.log(`  ${chalk.green('public')} — ${chalk.bold(p.name)}`);
    });
    console.log('');
  });

// Default: interactive mode
if (process.argv.length <= 2) {
  mainLoop().catch((err) => {
    console.error(chalk.red('\nFatal error: ' + err.message));
    process.exit(1);
  });
} else {
  program.parseAsync(process.argv).catch((err) => {
    console.error(chalk.red('\nFatal error: ' + err.message));
    process.exit(1);
  });
}
