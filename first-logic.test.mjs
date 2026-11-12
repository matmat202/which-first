// node site/first-logic.test.mjs — the page's pure logic on a made-up pool, then the
// shipped pool against facts read straight out of data/*.raw.json by this file (not by
// build.py). Exit 1 on any failure.
//   test/plant.sh   # mutates a copy of the logic; each mutant must FAIL this suite
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
const L = await import(process.env.LOGIC ? pathToFileURL(process.env.LOGIC).href : './first-logic.js');
const here = (p) => fileURLToPath(new URL(p, import.meta.url));

let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => { if (cond) pass++; else { fail++; console.log(`FAIL ${name} ${extra}`); } };
const eq = (name, a, b) => ok(name, JSON.stringify(a) === JSON.stringify(b), `got ${JSON.stringify(a)} want ${JSON.stringify(b)}`);

// --- small pieces ----------------------------------------------------------------------
eq('hash is FNV-1a', [L.hash(''), L.hash('a')], [0x811c9dc5, 0xe40c292c]);
const r1 = L.rng(1), r2 = L.rng(1);
eq('rng repeats for a seed', [r1(), r1(), r1()], [r2(), r2(), r2()]);
ok('rng in [0,1)', Array.from({ length: 1000 }, L.rng(7)).every((x) => x >= 0 && x < 1));
eq('years', [L.fmtYear(1876), L.fmtYear(-140), L.fmtYear(5)], ['1876', '140 BC', '5']);
const A = (name, year, kind = 'film') => ({ name, year, kind });
eq('gap', [L.gapWords(A('a', 1876), A('b', 1884)), L.gapWords(A('a', 2000), A('b', 2001))], ['8 years', '1 year']);
eq('no year zero across BC/AD', L.gapWords(A('a', -1), A('b', 1)), '1 year');
eq('big gaps get commas', L.gapWords(A('a', -3000), A('b', 1990)), '4,989 years');
eq('first index both ways', [L.firstIndex(A('a', 1900), A('b', 1950)), L.firstIndex(A('a', 1950), A('b', 1900))], [0, 1]);
eq('right and wrong picks', [L.isRight(A('a', 1900), A('b', 1950), 0), L.isRight(A('a', 1900), A('b', 1950), 1)], [true, false]);
eq('a tie is right either way', [L.isRight(A('a', 1900), A('b', 1900), 0), L.isRight(A('a', 1900), A('b', 1900), 1)], [true, true]);
eq('verdict names the earlier first', L.verdict(A('the car', 1884), A('the telephone', 1876)),
  'the telephone (1876) came 8 years before the car (1884).');
eq('caption', L.caption(A('x', 1, 'company')), 'Company · founded');
eq('fits needs two kinds', [L.fits(A('a', 1900, 'film'), A('b', 1950, 'film'), [1, 100]), L.fits(A('a', 1900, 'film'), A('b', 1950, 'book'), [1, 100])], [false, true]);
eq('fits respects the band', [L.fits(A('a', 1900), A('b', 1950, 'book'), [60, 100]), L.fits(A('a', 1900), A('b', 1950, 'book'), [1, 49])], [false, false]);
eq('fits at both edges', [L.fits(A('a', 1900), A('b', 1950, 'book'), [50, 60]), L.fits(A('a', 1900), A('b', 1950, 'book'), [10, 50])], [true, true]);
eq('day key is local', L.dayKey(new Date(2026, 9, 26, 23, 30)), '2026-10-26');
eq('share', L.shareText('2026-10-26', [true, false, true]), 'Which Came First? 2026-10-26: 2/3\n🟩🟥🟩');
eq('streak', [L.streak(['2026-10-24', '2026-10-25', '2026-10-26'], '2026-10-26'), L.streak(['2026-10-24', '2026-10-25'], '2026-10-26'),
  L.streak(['2026-10-23', '2026-10-25'], '2026-10-26'), L.streak([], '2026-10-26')], [3, 2, 1, 0]);
const sp = L.span(A('a', 1900), A('b', 2000));
eq('timeline pads both ends', [sp.lo, sp.hi, sp.at(1900) > 0, sp.at(2000) < 1, sp.at(1950)], [1885, 2015, true, true, 0.5]);
eq('timeline of a one-year gap still has room', [L.span(A('a', 2000), A('b', 2001)).lo, L.span(A('a', 2000), A('b', 2001)).hi], [1999, 2002]);

// --- a made-up pool ---------------------------------------------------------------------
const kinds = ['film', 'book', 'discovery', 'game'];
const fake = [];
for (let i = 0; i < 400; i++) fake.push([`item${i}`, 1500 + ((i * 37) % 520), kinds[i % 4], 1000 - i, `Q${i}`, '']);
const day = L.pairsFor(fake, '2026-10-26');
eq('ten pairs', day.length, 10);
eq('the same day gives the same ten', L.pairsFor(fake, '2026-10-26'), day);
ok('another day gives another ten', JSON.stringify(L.pairsFor(fake, '2026-10-27')) !== JSON.stringify(day));
const flat = day.flat();
eq('nothing twice in a day', new Set(flat).size, 20);
const C = fake.map(L.item);
eq('every pair is two kinds', day.every(([i, j]) => C[i].kind !== C[j].kind), true);
eq('every pair is in its band', day.every(([i, j], k) => { const d = Math.abs(C[i].year - C[j].year); return d >= L.BANDS[k][0] && d <= L.BANDS[k][1]; }), true);
eq('no ties', day.every(([i, j]) => C[i].year !== C[j].year), true);
const sides = Array.from({ length: 30 }, (_, k) => L.pairsFor(fake, `s${k}`)).flat().map(([i, j]) => L.firstIndex(C[i], C[j]));
ok('the earlier one is on either side', sides.filter((s) => s === 0).length > 90 && sides.filter((s) => s === 1).length > 90, sides.filter((s) => s === 0).length);
const fdays = Array.from({ length: 40 }, (_, k) => L.pairsFor(fake, `f${k}`));
eq('nothing twice in forty days', fdays.filter((d) => new Set(d.flat()).size !== 20).length, 0);
const picks = fdays.flat(2);
const median = picks.slice().sort((a, b) => a - b)[picks.length >> 1];
ok('picks lean famous (median in the top 40%)', median < 160, median);
ok('but reach the tail', Math.max(...picks) > 300, Math.max(...picks));
eq('a long day keeps the last band', L.pairsFor(fake, '2026-10-26', 12).length, 12);
eq('item reads every field', L.item(['n', -5, 'book', 7, 'Q9', 'a novel']), { name: 'n', year: -5, kind: 'book', fame: 7, q: 'Q9', desc: 'a novel' });
eq('item with no description', L.item(['n', 1, 'book', 7, 'Q9']).desc, '');
const tiny = [['a', 1900, 'film', 9, 'Q1', ''], ['b', 1990, 'book', 8, 'Q2', '']];
eq('a pool too small for ten gives what it can', L.pairsFor(tiny, 'x').length, 1);

// --- earlier days (?day=) ----------------------------------------------------------------
eq('prevDay crosses a month', [L.prevDay('2026-11-01'), L.prevDay('2027-01-01')], ['2026-10-31', '2026-12-31']);
eq('pastDay takes an earlier real day', L.pastDay('2026-10-27', '2026-10-30'), '2026-10-27');
eq('pastDay takes the first day', L.pastDay(L.FIRST_DAY, '2026-10-30'), L.FIRST_DAY);
eq('pastDay refuses before the first day', L.pastDay('2026-10-25', '2026-10-30'), null);
eq('pastDay refuses today and later', [L.pastDay('2026-10-30', '2026-10-30'), L.pastDay('2026-10-31', '2026-10-30')], [null, null]);
eq('pastDay refuses non-dates', ['2026-11-31', '2027-02-29', '2026-13-01', '26-10-27', '', null, '2026-10-27x'].map((p) => L.pastDay(p, '2027-06-01')), [null, null, null, null, null, null, null]);
const played = new Set(['2026-10-29', '2026-10-28']);
eq('missedDay skips played days', L.missedDay('2026-10-30', (d) => played.has(d)), '2026-10-27');
eq('missedDay is yesterday when unplayed', L.missedDay('2026-10-30', () => false), '2026-10-29');
eq('missedDay stops at the first day', [L.missedDay('2026-10-30', () => true), L.missedDay(L.FIRST_DAY, () => false)], [null, null]);
eq('missedDay can return the first day', L.missedDay('2026-10-27', () => false), L.FIRST_DAY);

// --- the shipped pool ---------------------------------------------------------------------
const poolFile = here('./data/pool.json');
if (existsSync(poolFile)) {
  const P = JSON.parse(readFileSync(poolFile, 'utf8'));
  const I = P.items.map(L.item);
  ok('shipped: a pool of 1,000+', I.length > 1000, I.length);
  eq('shipped: most famous first', I.every((x, i) => !i || I[i - 1].fame >= x.fame), true);
  eq('shipped: every kind is a known kind', I.every((x) => L.KIND[x.kind]), true);
  eq('shipped: each QID once', new Set(I.map((x) => x.q)).size, I.length);
  eq('shipped: no bare QIDs as names', I.some((x) => /^Q\d+$/.test(x.name)), false);
  const by = Object.fromEntries(I.map((x) => [x.name + '|' + x.kind, x.year]));
  // Read from Wikidata by hand, 2026-10-26 (and in data/*.raw.json).
  // Casablanca's P577s are 1942, 1943 and 1947: the earliest is the year it came out.
  eq('shipped: known years', ['Telephone|discovery', 'Titanic|film', 'The Starry Night|painting', 'Thriller|album', 'Uranus|discovery', 'Casablanca|film', 'Paradise Lost|book']
    .map((k) => by[k]), [1876, 1997, 1889, 1982, 1781, 1942, 1667]);
  // The UDHR: P577 1940, P571 1948. Wikidata contradicts itself, so it is out.
  // Corrected 2026-11-12 (build.py FIX): Sundance 2004; COVID moved the 2019-21 P577s; Cooper, 1826.
  eq('shipped: corrected years', ['Saw|film', 'No Time to Die|film', 'Doctor Strange in the Multiverse of Madness|film', 'The Last of the Mohicans|book']
    .map((k) => by[k]), [2004, 2021, 2022, 1826]);
  eq('shipped: self-contradicting dates are out', by['Universal Declaration of Human Rights|book'], undefined);
  eq('shipped: at most 24 chemical elements', I.filter((x) => /^chemical element/.test(x.desc)).length <= 24, true);
  eq('shipped: no year in any description', I.filter((x) => /\b(1\d{3}|20\d\d)\b/.test(x.desc)).map((x) => x.name), []);
  eq('shipped: the excluded stay out', I.filter((x) => ['Q7341', 'Q42523'].includes(x.q)).length, 0);
  // Wrong on Wikidata, read by hand 2026-10-27 (projects/first-years/): five corrected...
  eq('shipped: corrected years', ['United States Constitution|book', "Coulomb's law|discovery", 'Rugby sevens|discovery', 'The Mysterious Island|book', 'The Avengers|film']
    .map((k) => by[k]), [1787, 1785, 1883, 1875, 2012]);
  // ...and fifteen with no one right year (The Republic "1963", Hammurabi "1853"), out.
  const OUT = ['Q123397', 'Q9190', 'Q682958', 'Q210752', 'Q131546', 'Q36359', 'Q134566', 'Q12757', 'Q11427', 'Q682', 'Q623', 'Q12725', 'Q16338', 'Q163865', 'Q23648408'];
  eq('shipped: cards with no right year are out', I.filter((x) => OUT.includes(x.q)).map((x) => x.name), []);
  eq('shipped: nothing dated after it was fetched', I.filter((x) => x.year > +P.fetched.slice(0, 4)).map((x) => x.name), []);
  // The days dealt before the fix keep the list they were dealt from, byte for byte.
  const old = here('data/pool-1.json');
  const { createHash } = await import('node:crypto');
  eq('pool-1.json is the list as first shipped', existsSync(old) && createHash('sha256').update(readFileSync(old)).digest('hex'),
    'da23207afc7268b470dccac23776a277921021c092469bac4222257dd0cd5e13');
  eq('days before the fix use the old list', ['2026-10-26', '2026-10-27', '2026-10-28', '2027-01-01', 'practice-abc', ''].map(L.poolFile),
    ['data/pool-1.json', 'data/pool-1.json', 'data/pool.json', 'data/pool.json', 'data/pool.json', 'data/pool.json']);
  const P1 = JSON.parse(readFileSync(old, 'utf8')).items.map(L.item);
  eq('the old list still has the year it was played with', P1.find((x) => x.q === 'Q123397')?.year, 1963);
  // The days already served, by name: read 2026-10-27 with first-logic.js and pool-1.json
  // byte-identical to the live site. A change to the hash, rng, bands or draw re-deals them,
  // and every shared score and saved ?day= pick (a side, per round) then marks a different pair.
  const P1raw = JSON.parse(readFileSync(old, 'utf8')).items;
  const served = (d) => L.pairsFor(P1raw, d).map(([i, j]) => [P1raw[i][0], P1raw[j][0]]);
  eq('served: 2026-10-26', served('2026-10-26'), [['The Big Lebowski', 'Second Epistle to the Thessalonians'], ['Neutron', 'BioShock'],
    ['Thor: Ragnarok', 'Internal combustion engine'], ['Nokia', 'Car'], ['Seven', 'Intel'], ['Metal Gear Solid', 'Apocalypto'],
    ['Mobile phone', 'Star Wars: Episode IV – A New Hope'], ['Lost in Translation', 'Harry Potter and the Chamber of Secrets'],
    ['Van Allen radiation belt', 'The Magnificent Seven'], ['Good Will Hunting', 'eBay']]);
  eq('served: 2026-10-27', served('2026-10-27'), [['Nestlé', 'Second Epistle to the Thessalonians'], ['Home Alone', 'Mazda'],
    ["Schindler's List", 'Neutron'], ['Thyristor', 'Man of Steel'], ['Star Wars: Episode V – The Empire Strikes Back', 'Half-Life 2'],
    ['Book of Mormon', 'Silicon'], ['HIV/AIDS', 'Yamaha Motor Company'], ['Memento', 'SpaceX'], ['Born This Way', 'League of Legends'],
    ['Burj Khalifa', 'Apocalypto']]);
  // Served since, from pool.json (bin/mutate survivors, 2026-11-11): first-logic.js, app.js and
  // both pools byte-identical to the live site that day and unchanged in git since 10-27, so
  // these are the tens players got. 11-11 is served east of UTC.
  const SERVED = {
    '2026-10-28': [["Top Gun", "Paper"], ["Microsoft", "Lithium"], ["AFC Ajax", "The Departed"], ["Internet protocol suite", "Toyota"], ["Star Wars: Episode V – The Empire Strikes Back", "eBay"], ["Rocky", "One Hundred Years of Solitude"], ["The Lion, the Witch, and the Wardrobe", "Holography"], ["Amazon", "Life Is Beautiful"], ["Tesla", "Harry Potter and the Goblet of Fire"], ["Eyes Wide Shut", "Google"]],
    '2026-10-29': [["The Communist Manifesto", "Parasite"], ["Ford Motor Company", "Cobalt"], ["Toyota", "Intron"], ["Nestlé", "Battleship Potemkin"], ["World Wide Web", "Catch Me If You Can"], ["Apple Inc.", "Jurassic Park"], ["Clash of Clans", "Borat"], ["Far Cry 3", "The Theory of Everything"], ["Minecraft", "Indiana Jones and the Kingdom of the Crystal Skull"], ["Munich", "Harry Potter and the Order of the Phoenix"]],
    '2026-10-30': [["First Epistle to Timothy", "Microwave oven"], ["Nickel", "Tesla"], ["Angels & Demons", "Rebecca"], ["The Beatles", "Positron"], ["Guinness World Records", "Email"], ["A Brief History of Time", "The Departed"], ["SpaceX", "Quantum of Solace"], ["Grand Theft Auto V", "3 Idiots"], ["AFC Ajax", "Airplane"], ["The Picture of Dorian Gray", "Basketball"]],
    '2026-10-31': [["Terminator 2: Judgment Day", "Fluorine"], ["The Great Gatsby", "The Incredible Hulk"], ["Empire State Building", "Grand Theft Auto III"], ["Team Fortress 2", "Dune"], ["Rashomon", "Angelman syndrome"], ["Guardians of the Galaxy", "The Da Vinci Code"], ["The Godfather", "Apple Inc."], ["Harry Potter and the Order of the Phoenix", "Pirates of the Caribbean: Dead Man's Chest"], ["All Quiet on the Western Front", "Electron microscope"], ["L'Origine du monde", "Helium"]],
    '2026-11-01': [["Phosphorus", "The Big Lebowski"], ["Pride and Prejudice", "Pirates of the Caribbean: On Stranger Tides"], ["Star Wars: Episode V – The Empire Strikes Back", "Special relativity"], ["Harry Potter and the Prisoner of Azkaban", "COVID-19"], ["Huawei", "Eternal Sunshine of the Spotless Mind"], ["Hannah Montana", "Scent of a Woman"], ["Harry Potter and the Half-Blood Prince", "Call of Duty: Advanced Warfare"], ["Constitution of India", "Methylphenidate"], ["Inglourious Basterds", "God of War"], ["Star Wars: Episode II – Attack of the Clones", "Meta Platforms"]],
    '2026-11-02': [["Phosphorus", "Spider-Man 2"], ["Wind turbine", "Moulin Rouge!"], ["Harry Potter and the Chamber of Secrets", "HIV/AIDS"], ["Radio", "Lamborghini"], ["League of Legends", "eBay"], ["Pirates of the Caribbean: Dead Man's Chest", "COVID-19"], ["The Hunger Games", "Minecraft"], ["Spotlight", "Cyberpunk 2077"], ["Quark–gluon plasma", "The Bourne Identity"], ["Crash", "Harry Potter and the Order of the Phoenix"]],
    '2026-11-03': [["The Mask", "Paper"], ["Fiat", "Metal Gear Solid"], ["The Little Prince", "Sunflower oil"], ["Audi AG", "Dr. No"], ["Harry Potter and the Philosopher's Stone", "Parasite"], ["Computer", "All About Eve"], ["Permian", "The Little Mermaid"], ["The Shawshank Redemption", "Google"], ["Empire State Building", "Metropolis"], ["Integrated circuit", "North by Northwest"]],
    '2026-11-04': [["First Epistle to Timothy", "Chlorophyll"], ["The Avengers", "Radio"], ["Toyota", "Twenty Thousand Leagues Under the Sea"], ["300", "The Second Sex"], ["Google", "Joker"], ["Inductor", "Frankenstein; or, The Modern Prometheus"], ["All About Eve", "Animal Farm"], ["Suzuki Motor Corporation", "The Kiss"], ["Star Trek", "Call of Duty 4: Modern Warfare"], ["Harry Potter and the Prisoner of Azkaban", "SpaceX"]],
    '2026-11-05': [["Fahrenheit 451", "Hydrogen"], ["The Brothers Karamazov", "Sherlock Holmes"], ["The Theory of Everything", "The Protocols of the Elders of Zion"], ["Pokémon Go", "Quicksort"], ["Empire State Building", "The Second Sex"], ["Web browser", "The Godfather"], ["COVID-19", "The Social Network"], ["Life Is Beautiful", "Grand Theft Auto: Vice City"], ["Thor", "OpenAI"], ["Higgs boson", "Iron Man 2"]],
    '2026-11-06': [["The Fast and the Furious", "Hydrogen"], ["General Motors", "Saw"], ["Tank", "Burj Khalifa"], ["Hewlett-Packard", "Web browser"], ["Neptune", "Liberty Leading the People"], ["Doctor Zhivago", "Cosmic inflation"], ["The Fame", "Whiplash"], ["Computer", "And Then There Were None"], ["League of Legends", "The Prestige"], ["The Batman", "Genshin Impact"]],
    '2026-11-07': [["League of Legends", "Potassium"], ["The Plague", "Neptune"], ["Jazz", "Basketball"], ["Hormone", "Mein Kampf"], ["Charter of the United Nations", "Mazda"], ["Twilight", "Google"], ["Minecraft", "The Fault in Our Stars"], ["The Hobbit", "Electron microscope"], ["Warcraft III: Reign of Chaos", "Gladiator"], ["Adventures of Huckleberry Finn", "Rugby sevens"]],
    '2026-11-08': [["Hermitage Museum", "Star Wars: Episode IV – A New Hope"], ["Minecraft", "Silicon"], ["BMW", "Predator"], ["Cosmic microwave background", "Pixar"], ["Batman", "Crysis"], ["Living Things", "Harry Potter and the Half-Blood Prince"], ["Resident Evil 4", "Inglourious Basterds"], ["eBay", "Dead Poets Society"], ["Citizen Kane", "Toyota"], ["Xiaomi", "2012"]],
    '2026-11-09': [["Aluminium", "Django Unchained"], ["The Godfather Part II", "Morphine"], ["Moby-Dick", "Electron"], ["Downfall", "Artificial satellite"], ["Spotlight", "M-theory"], ["OpenAI", "No Country for Old Men"], ["Sgt. Pepper's Lonely Hearts Club Band", "Chinatown"], ["Casablanca", "The Grapes of Wrath"], ["The Little Prince", "Computer"], ["eBay", "Petronas Towers"]],
    '2026-11-10': [["Captain America: The Winter Soldier", "Snow White"], ["Batman v Superman: Dawn of Justice", "Brownian motion"], ["The Lord of the Rings: The Return of the King", "Rett syndrome"], ["Hard disk", "Google"], ["The Hunchback of Notre Dame", "Lithium"], ["The Pianist", "Xiaomi"], ["Meteora", "Clash of Clans"], ["Fight Club", "TV Azteca"], ["Steppenwolf", "Adenosine triphosphate"], ["Graphene", "Spider-Man"]],
    '2026-11-11': [["Annie Hall", "Paper"], ["Indiana Jones and the Last Crusade", "Silicon"], ["Citric acid", "The Last of the Mohicans"], ["Amadeus", "Transistor"], ["Computer", "On the Waterfront"], ["Please Please Me", "The Bridge on the River Kwai"], ["Wonder Woman", "Far Cry 3"], ["Grand Theft Auto V", "Inglourious Basterds"], ["Harry Potter and the Philosopher's Stone", "Harry Potter and the Philosopher's Stone"], ["Xiaomi", "Terraria"]],
    // 11-12 and 11-13 being played when Saw etc. were corrected (2026-11-12, 20:50 UTC).
    '2026-11-12': [["AFC Ajax","Forbidden City"],["Grand Theft Auto V","The Old Man and the Sea"],["Harry Potter and the Order of the Phoenix","Baskin-Robbins"],["Constitution of India","Star Wars: Episode IV – A New Hope"],["The Sims 4","Web browser"],["The Last Emperor","Fantastic Beasts and Where to Find Them"],["Argo","League of Legends"],["A Thousand Suns","Higgs boson"],["Appetite for Destruction","Lenovo"],["Assassin's Creed IV: Black Flag","Star Wars: Episode VII – The Force Awakens"]],
    '2026-11-13': [["Pong","Epistle to the Hebrews"],["Hugo","Adenosine triphosphate"],["Mercedes-Benz","Judo"],["The Wonderful Wizard of Oz","Natural selection"],["The Communist Manifesto","Association football"],["Doppler effect","Reuters"],["The Tales of Beedle the Bard","The Avengers"],["Assassin's Creed: Revelations","Birdman"],["The Sixth Sense","eBay"],["Crime and Punishment","Helium"]],
  };
  for (const [d, want] of Object.entries(SERVED)) {
    eq(`served: ${d} from ${L.poolFile(d)}`, L.pairsFor(P.items, d).map(([i, j]) => [P.items[i][0], P.items[j][0]]), want);
  }
  eq('served: those days read pool.json', [...new Set(Object.keys(SERVED).map(L.poolFile))], ['data/pool.json']);
  // The deal is frozen, not just its served days (2026-11-11). Pinning only served days goes
  // stale every midnight: on 10-27 the band constants were left as "re-deal only future days",
  // and 15 days later those days had been played. So two years from launch are hashed. A
  // deliberate retune must start on a date not yet served, the way poolFile() does, and then
  // move this hash in the same commit.
  {
    const days = []; for (let d = '2026-10-26'; days.length < 731; ) { days.push(d); const x = new Date(d + 'T12:00:00Z'); x.setUTCDate(x.getUTCDate() + 1); d = x.toISOString().slice(0, 10); }
    const h = createHash('sha256'), pools = {};
    for (const d of days) { const f = L.poolFile(d); pools[f] ??= JSON.parse(readFileSync(here(f), 'utf8')).items; h.update(d + JSON.stringify(L.pairsFor(pools[f], d))); }
    // Moved 2026-11-12 on purpose: four year corrections (build.py FIX) re-deal nine days,
    // the first 2026-11-14, which no time zone had reached. 11-12 and 11-13 are pinned above.
    eq('two years of tens from launch, unchanged', h.digest('hex'), '2b4754af2ef5df7d203741cbd114b933fe5e68e57cc8b1ecb0e8ee9d0ab94562');
  }
  eq('shipped: names start with a capital, eBay excepted', I.filter((x) => /^[a-z]/.test(x.name) && !/^[a-z][A-Z]/.test(x.name)).map((x) => x.name), []);
  // A year taken out of a description must take its words with it: these read
  // "company established in", "published in Paris, France between and", "India -present)".
  eq('shipped: no description left mid-phrase', I.filter((x) => /\b(in|on|since|from|until|between|and|of|by|the|to|around|established|published|completed|developed|written)(…)?$|\(\s*\)|^[\s\/,;–-]|\s[,.;]|[(][^)]*$|^[^(]*[)]/i.test(x.desc)).map((x) => x.name), []);
  eq('shipped: descriptions fit a card', I.filter((x) => x.desc.length > 91).length, 0);
  eq('shipped: Europe is not a discovery', by['Europe|discovery'], undefined);
  eq('shipped: no asteroids', I.some((x) => /asteroid/i.test(x.desc)), false);
  const days = Array.from({ length: 60 }, (_, k) => L.pairsFor(P.items, `2026-11-${k}`));
  eq('shipped: sixty days of full tens', days.every((d) => d.length === 10), true);
  eq('shipped: nothing twice in any of sixty days', days.filter((d) => new Set(d.flat()).size !== 20).length, 0);
} else ok('shipped: data/pool.json exists (run build.py)', false);

console.log(`${fail ? 'FAILED' : 'ok'}: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
