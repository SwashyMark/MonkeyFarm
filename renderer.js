// ─────────────────────────────────────────────
// 1. CONSTANTS
// ─────────────────────────────────────────────
const PURIFY_DURATION   = 120_000;  // 2 min
const PREGNANCY  = [240_000, 420_000]; // 4–7 min
const MATING_COOLDOWN   = 180_000;  // 3 min

// Growth time ranges [min, max] ms
const EGG_HATCH   = [  45_000,   90_000]; // 45s–90s
const BABY_GROW   = [ 120_000,  240_000]; // 2–4 min
const JUV_GROW    = [ 240_000,  420_000]; // 4–7 min
const ADULT_LIFE  = [1_200_000, 2_400_000]; // 20–40 min

function randRange(min, max) { return min + Math.random() * (max - min); }

// Per-monkey per-second depletion (scales with alive count)
const FOOD_DRAIN_PER   = 0.004;  // per alive non-egg monkey
const OXYGEN_DRAIN_PER = 0.002;
const CLEAN_DRAIN_PER  = 0.001;
const DEAD_DRAIN_PER   = 0.008;  // extra cleanliness drain per dead body

// Base passive regen always active (independent of addons)
const BASE_OXYGEN_REGEN = 0.05;  // balances ~25 monkeys; addons needed for larger colonies
const BASE_CLEAN_REGEN  = 0.03;  // balances ~30 monkeys; addons needed for larger colonies

// Per-second health damage when needs unmet
const DMG_NO_OXYGEN = 0.3;
const DMG_NO_FOOD   = 0.1;
const DMG_DIRTY     = 0.05;
const REGEN_RATE    = 0.01;

const ACTION_FEED_BASE  = 50;
const ACTION_AERATE_AMT = 50;
const ACTION_CLEAN_AMT  = 40;

const OFFLINE_CAP_MS    = 4 * 60 * 60 * 1000; // 4 hours
const OFFLINE_CHUNK_MS  = 10_000;              // simulate in 10s chunks

// Automated aeration upgrade levels (index = level 0-5)
const AERATION_LEVELS = [
  { name: 'None',       upgradeCost: 5,   durationMin:        0, durationMax:        0, maxOxygenBonus:  0, passiveRegen: 0   },
  { name: 'Basic',      upgradeCost: 15,  durationMin:   60_000, durationMax:  120_000, maxOxygenBonus: 10, passiveRegen: 0.3 },
  { name: 'Standard',   upgradeCost: 30,  durationMin:  120_000, durationMax:  240_000, maxOxygenBonus: 20, passiveRegen: 0.7 },
  { name: 'Advanced',   upgradeCost: 60,  durationMin:  180_000, durationMax:  360_000, maxOxygenBonus: 30, passiveRegen: 1.5 },
  { name: 'Premium',    upgradeCost: 100, durationMin:  240_000, durationMax:  480_000, maxOxygenBonus: 40, passiveRegen: 2.5 },
  { name: 'Industrial', upgradeCost: 150, durationMin:  300_000, durationMax:  600_000, maxOxygenBonus: 50, passiveRegen: 4.0 },
];

// Automated skimmer upgrade levels (index = level 0-5)
const SKIMMER_LEVELS = [
  { name: 'None',       upgradeCost: 5,   durationMin:        0, durationMax:        0, maxCleanBonus:  0, passiveRegen: 0   },
  { name: 'Basic',      upgradeCost: 15,  durationMin:   60_000, durationMax:  120_000, maxCleanBonus: 10, passiveRegen: 0.2 },
  { name: 'Standard',   upgradeCost: 30,  durationMin:  120_000, durationMax:  240_000, maxCleanBonus: 20, passiveRegen: 0.5 },
  { name: 'Advanced',   upgradeCost: 60,  durationMin:  180_000, durationMax:  360_000, maxCleanBonus: 30, passiveRegen: 1.0 },
  { name: 'Premium',    upgradeCost: 100, durationMin:  240_000, durationMax:  480_000, maxCleanBonus: 40, passiveRegen: 2.0 },
  { name: 'Industrial', upgradeCost: 150, durationMin:  300_000, durationMax:  600_000, maxCleanBonus: 50, passiveRegen: 3.5 },
];

// Automated feeder upgrade levels (index = level 0-5)
const FEEDER_LEVELS = [
  { name: 'None',       upgradeCost: 5,   durationMin:        0, durationMax:        0, maxFoodBonus:  0, passiveRegen: 0   },
  { name: 'Basic',      upgradeCost: 15,  durationMin:   60_000, durationMax:  120_000, maxFoodBonus: 10, passiveRegen: 0.2 },
  { name: 'Standard',   upgradeCost: 30,  durationMin:  120_000, durationMax:  240_000, maxFoodBonus: 20, passiveRegen: 0.5 },
  { name: 'Advanced',   upgradeCost: 60,  durationMin:  180_000, durationMax:  360_000, maxFoodBonus: 30, passiveRegen: 1.0 },
  { name: 'Premium',    upgradeCost: 100, durationMin:  240_000, durationMax:  480_000, maxFoodBonus: 40, passiveRegen: 2.0 },
  { name: 'Industrial', upgradeCost: 150, durationMin:  300_000, durationMax:  600_000, maxFoodBonus: 50, passiveRegen: 3.0 },
];

const NAMES = [
  'Bubbles','Splash','Coral','Sandy','Finn','Nemo','Dory','Pearl',
  'Shelly','Wave','Marina','Crest','Ripple','Tide','Zara','Rex',
  'Luna','Sol','Mist','Brook','Pebble','Drift','Cove','Bay',
];

// ── GENE DATA ────────────────────────────────
const GENE_DATA = [
  { id: 'body_color', category: 'cosmetic', alleles: [
    { code: 'C_VOID',  name: 'Void Black',       dominance_level: 100, mutation_chance: 0.001 },
    { code: 'C_BIO',   name: 'Bioluminescent',   dominance_level: 15,  mutation_chance: 0.008 },
    { code: 'C_PINK',  name: 'Standard Pink',    dominance_level: 10,  mutation_chance: 0.0   },
    { code: 'C_GRN',   name: 'Algae Green',      dominance_level: 8,   mutation_chance: 0.0   },
    { code: 'C_TRANS', name: 'Transparent',      dominance_level: 1,   mutation_chance: 0.005 },
    { code: 'C_BLU',   name: 'Deep Blue',        dominance_level: 1,   mutation_chance: 0.05  },
    { code: 'C_GOLD',  name: 'Midas Gold',       dominance_level: 0,   mutation_chance: 0.01  },
  ]},
  { id: 'tail_shape', category: 'cosmetic', alleles: [
    { code: 'T_STD', name: 'Standard Tail', dominance_level: 10, mutation_chance: 0.0  },
    { code: 'T_FAN', name: 'Fan Tail',      dominance_level: 5,  mutation_chance: 0.03 },
    { code: 'T_DBL', name: 'Twin Tail',     dominance_level: 1,  mutation_chance: 0.02 },
  ]},
  { id: 'metabolism', category: 'functional', alleles: [
    { code: 'M_NRM',  name: 'Normal Metabolism', dominance_level: 10, mutation_chance: 0.0,
      stat_modifiers: { hunger_rate: 1.0, growth_speed: 1.0, movement_speed: 1.0 } },
    { code: 'M_FAST', name: 'Hyperactive',       dominance_level: 5,  mutation_chance: 0.02,
      stat_modifiers: { hunger_rate: 1.5, growth_speed: 1.5, movement_speed: 1.3 } },
    { code: 'M_SLOW', name: 'Sloth Mode',        dominance_level: 2,  mutation_chance: 0.015,
      stat_modifiers: { hunger_rate: 0.6, growth_speed: 0.7, movement_speed: 0.5 } },
  ]},
  { id: 'constitution', category: 'functional', alleles: [
    { code: 'H_AVG',  name: 'Average Health', dominance_level: 10, mutation_chance: 0.0,
      stat_modifiers: { max_health: 100, pollution_resistance: 0.0  } },
    { code: 'H_SENS', name: 'Sensitive',      dominance_level: 4,  mutation_chance: 0.02,
      stat_modifiers: { max_health: 80,  pollution_resistance: -0.5 } },
    { code: 'H_IRON', name: 'Iron Gut',       dominance_level: 1,  mutation_chance: 0.03,
      stat_modifiers: { max_health: 120, pollution_resistance: 0.8  } },
  ]},
  { id: 'longevity', category: 'functional', alleles: [
    { code: 'L_STD', name: 'Standard Life', dominance_level: 10, mutation_chance: 0.0,
      stat_modifiers: { life_mult: 1.0 } },
    { code: 'L_FLY', name: 'Mayfly',        dominance_level: 3,  mutation_chance: 0.015,
      stat_modifiers: { life_mult: 0.6 } },
    { code: 'L_ANC', name: 'Ancient One',   dominance_level: 0,  mutation_chance: 0.01,
      stat_modifiers: { life_mult: 2.5 } },
  ]},
];

// ── COLOR STARTER WEIGHTS ──────────────────────
const STARTER_ALLELE_WEIGHTS = [
  { allele: 'C_PINK', weight: 0.40 },
  { allele: 'C_GRN',  weight: 0.40 },
  { allele: 'C_BLU',  weight: 0.05 },
  { allele: 'C_GOLD', weight: 0.05 },
];

const PHENOTYPE_DEFS = {
  C_PINK:  { name: 'Standard Pink',  tier: 1, filterStr: 'hue-rotate(300deg)',                      shadow: '' },
  C_GRN:   { name: 'Algae Green',    tier: 1, filterStr: 'hue-rotate(120deg) saturate(1.5)',        shadow: '' },
  purple:  { name: 'Purple',         tier: 2, filterStr: 'hue-rotate(260deg) saturate(2)',          shadow: '' },
  C_BLU:   { name: 'Deep Blue',      tier: 2, filterStr: 'hue-rotate(200deg)',                      shadow: '' },
  C_TRANS: { name: 'Transparent',    tier: 3, filterStr: 'saturate(0)',                             shadow: '', opacity: 0.35 },
  C_BIO:   { name: 'Bioluminescent', tier: 3, filterStr: 'hue-rotate(150deg) saturate(3)',          shadow: '0 0 8px 3px rgba(100,255,200,0.6)' },
  C_GOLD:  { name: 'Midas Gold',     tier: 3, filterStr: 'sepia(1) saturate(4) hue-rotate(10deg)', shadow: '0 0 6px 2px rgba(255,200,0,0.5)' },
  C_VOID:  { name: 'Void Black',     tier: 3, filterStr: 'grayscale(1) brightness(0.2)',            shadow: '0 0 10px 3px rgba(120,120,255,0.7)' },
};

const MASTERY_THRESHOLD_COLOR = 10;
const MASTERY_THRESHOLD_FUNC  = 5;
const FILTER_FEED_RATE = 0.0008;  // cleanliness gained/sec per Filter Feeder monkey

// ── DEX VARIANT DEFINITIONS ──────────────────
const DEX_COLOR_VARIANTS = [
  { key: 'C_PINK',  name: 'Standard Pink',  tier: 1, masteryDesc: 'Feed gives +10 more food' },
  { key: 'C_GRN',   name: 'Algae Green',    tier: 1, masteryDesc: 'Filter Feeders 2× effective' },
  { key: 'purple',  name: 'Purple',         tier: 2, masteryDesc: '+1 max egg per birth' },
  { key: 'C_BLU',   name: 'Deep Blue',      tier: 2, masteryDesc: 'Adults live 10% longer' },
  { key: 'C_TRANS', name: 'Transparent',    tier: 3, masteryDesc: 'Cleanliness drains 20% slower' },
  { key: 'C_BIO',   name: 'Bioluminescent', tier: 3, masteryDesc: 'Oxygen depletes 15% slower' },
  { key: 'C_GOLD',  name: 'Midas Gold',     tier: 3, masteryDesc: 'Food depletes 15% slower' },
  { key: 'C_VOID',  name: 'Void Black',     tier: 3, masteryDesc: 'Food depletes 25% slower' },
];
const DEX_TAIL_VARIANTS = [
  { key: 'T_STD', name: 'Standard Tail', masteryDesc: 'No bonus' },
  { key: 'T_FAN', name: 'Fan Tail',      masteryDesc: '+1 extra egg per birth' },
  { key: 'T_DBL', name: 'Twin Tail',     masteryDesc: '+1 extra egg per birth (stacks)' },
];
const DEX_METAB_VARIANTS = [
  { key: 'M_NRM',  name: 'Normal Metabolism', masteryDesc: 'No bonus' },
  { key: 'M_FAST', name: 'Hyperactive',       masteryDesc: 'Growth speed 1.7× (was 1.5×)' },
  { key: 'M_SLOW', name: 'Sloth Mode',        masteryDesc: 'Hunger rate 0.5× (was 0.6×)' },
];
const DEX_CONST_VARIANTS = [
  { key: 'H_AVG',  name: 'Average Health', masteryDesc: 'No bonus' },
  { key: 'H_SENS', name: 'Sensitive',      masteryDesc: 'No bonus' },
  { key: 'H_IRON', name: 'Iron Gut',       masteryDesc: 'Corpse drain ×0.5' },
];
const DEX_LONGEV_VARIANTS = [
  { key: 'L_STD', name: 'Standard Life', masteryDesc: 'No bonus' },
  { key: 'L_FLY', name: 'Mayfly',        masteryDesc: 'No bonus' },
  { key: 'L_ANC', name: 'Ancient One',   masteryDesc: 'Life multiplier 3.5× (was 2.5×)' },
];
const DEX_FUNC_VARIANTS = [
  { key: 'filterFeeder', name: 'Filter Feeder', masteryDesc: 'Filter Feeders also boost oxygen' },
];

const MILESTONES_DEF = [
  { key: 'firstAdult',         emoji: '🌟', name: 'First Adult',         desc: 'A sea monkey reaches adulthood.',              reward: '+50 XP',                          progress: () => [state.monkeys.filter(m=>m.alive&&m.stage==='adult').length, 1] },
  { key: 'firstDeath',         emoji: '😢', name: 'First Loss',           desc: 'A sea monkey passes away.',                   reward: null,                              progress: () => [state.stats?.totalDied||0, 1] },
  { key: 'pop5',               emoji: '🐠', name: 'Growing Tank',         desc: 'Reach a population of 5.',                    reward: '+25 XP',                          progress: () => [state.monkeys.filter(m=>m.alive).length, 5] },
  { key: 'pop10',              emoji: '🎉', name: 'Busy Tank',            desc: 'Reach a population of 10.',                   reward: '+100 XP, +1 🥚 Egg Pack',         progress: () => [state.monkeys.filter(m=>m.alive).length, 10] },
  { key: 'pop25',              emoji: '🏆', name: 'Thriving Colony',      desc: 'Reach a population of 25.',                   reward: '+200 XP, +1 🧪 Life Booster',     progress: () => [state.monkeys.filter(m=>m.alive).length, 25] },
  { key: 'pop50',              emoji: '👑', name: 'Mega Colony',          desc: 'Reach a population of 50.',                   reward: '+500 XP, +1 🧪 Life Booster',     progress: () => [state.monkeys.filter(m=>m.alive).length, 50] },
  { key: 'gen2',               emoji: '🧬', name: 'New Generation',       desc: 'Breed a second generation.',                  reward: '+75 XP, +1 🧪 Life Booster',      progress: () => [state.stats?.totalGenerations||1, 2] },
  { key: 'gen5',               emoji: '🧬', name: 'Fifth Generation',     desc: 'Reach the fifth generation.',                 reward: '+150 XP, +1 🥚 Egg Pack',         progress: () => [state.stats?.totalGenerations||1, 5] },
  { key: 'gen10',              emoji: '🧬', name: 'Dynasty',              desc: 'Reach the tenth generation.',                 reward: '+300 XP, +2 🥚 Egg Packs',        progress: () => [state.stats?.totalGenerations||1, 10] },
  { key: 'totalBorn50',        emoji: '🥚', name: 'Prolific Breeders',    desc: '50 sea monkeys have been born.',               reward: '+100 XP',                         progress: () => [state.stats?.totalBorn||0, 50] },
  { key: 'totalBorn100',       emoji: '🥚', name: 'Century Hatch',        desc: '100 sea monkeys have been born.',              reward: '+200 XP, +1 ✨ Glowing Flakes',   progress: () => [state.stats?.totalBorn||0, 100] },
  { key: 'firstRareVariant',   emoji: '✨', name: 'Rare Discovery',       desc: 'Discover a rare colour variant.',              reward: '+100 XP, +1 ✨ Glowing Flakes',   progress: () => [['purple','C_BLU','C_TRANS','C_GOLD','C_BIO','C_VOID'].filter(k=>state.dex[k]?.discovered).length, 1] },
  { key: 'firstFunctionalGene',emoji: '🔍', name: 'Genetic Discovery',   desc: 'Discover a functional gene variant.',          reward: '+100 XP, +1 🔍 Magnifying Glass', progress: () => [['M_FAST','M_SLOW','H_SENS','H_IRON','L_FLY','L_ANC','filterFeeder'].filter(k=>state.dex[k]?.discovered).length, 1] },
  { key: 'firstMastery',       emoji: '⭐', name: 'First Mastery',        desc: 'Achieve mastery of any variant.',              reward: '+150 XP',                         progress: () => [Object.values(state.dex||{}).filter(e=>e.mastered).length, 1] },
];

// ─────────────────────────────────────────────
// 2. DNA HELPER FUNCTIONS
// ─────────────────────────────────────────────

function pickStarterAllele() {
  const total = STARTER_ALLELE_WEIGHTS.reduce((s, w) => s + w.weight, 0);
  let r = Math.random() * total;
  for (const w of STARTER_ALLELE_WEIGHTS) {
    r -= w.weight;
    if (r <= 0) return w.allele;
  }
  return STARTER_ALLELE_WEIGHTS[STARTER_ALLELE_WEIGHTS.length - 1].allele;
}

function defaultDNA() {
  return {
    body_color:   [pickStarterAllele(), pickStarterAllele()],
    tail_shape:   ['T_STD', 'T_STD'],
    metabolism:   ['M_NRM', 'M_NRM'],
    constitution: ['H_AVG', 'H_AVG'],
    longevity:    ['L_STD', 'L_STD'],
    filt:         ['f', 'f'],
  };
}

function hasDominant(pair, dominant) {
  return pair[0] === dominant || pair[1] === dominant;
}

function resolveAllele(pair, geneId) {
  const gene = GENE_DATA.find(g => g.id === geneId);
  const dom = code => gene?.alleles.find(a => a.code === code)?.dominance_level ?? 10;
  const [a, b] = pair;
  if (dom(a) > dom(b)) return a;
  if (dom(b) > dom(a)) return b;
  return Math.random() < 0.5 ? a : b;  // equal dominance: random
}

function resolveColorPhenotype(pair) {
  const [a, b] = pair;
  // Special co-dominance: C_PINK + C_GRN = purple
  if ((a === 'C_PINK' && b === 'C_GRN') || (a === 'C_GRN' && b === 'C_PINK')) return 'purple';
  return resolveAllele(pair, 'body_color');
}

function resolveStats(m) {
  if (!m.dna) return { hungerRate: 1, growthSpeed: 1, moveSpeed: 1, maxHealth: 100, pollutionRes: 0, lifeMult: 1, isFF: false };
  const mb = getMasteryBonuses();
  const getMods = (geneId, pair) => {
    const code = resolveAllele(pair, geneId);
    return GENE_DATA.find(g => g.id === geneId)?.alleles.find(a => a.code === code)?.stat_modifiers || {};
  };
  const getCode = (geneId, pair) => resolveAllele(pair, geneId);

  const metCode = getCode('metabolism',   m.dna.metabolism);
  const lonCode = getCode('longevity',    m.dna.longevity);
  const met = getMods('metabolism',   m.dna.metabolism);
  const con = getMods('constitution', m.dna.constitution);
  const lon = getMods('longevity',    m.dna.longevity);

  let hungerRate  = met.hunger_rate    ?? 1.0;
  let growthSpeed = met.growth_speed   ?? 1.0;
  let lifeMult    = lon.life_mult      ?? 1.0;

  // Mastery overrides
  if (metCode === 'M_FAST' && mb.fastGrowthMult) growthSpeed = 1.7;
  if (metCode === 'M_SLOW' && mb.slowHungerMult) hungerRate  = 0.5;
  if (lonCode === 'L_ANC'  && mb.ancientLifeMult) lifeMult   = 3.5;

  return {
    hungerRate,
    growthSpeed,
    moveSpeed:    met.movement_speed      ?? 1.0,
    maxHealth:    con.max_health          ?? 100,
    pollutionRes: con.pollution_resistance ?? 0.0,
    lifeMult,
    isFF: m.dna.filt && hasDominant(m.dna.filt, 'F'),
  };
}

function getMaxOxygen() {
  const level = state.aeration?.level || 0;
  return 100 + (AERATION_LEVELS[level]?.maxOxygenBonus || 0);
}

function getMaxCleanliness() {
  const level = state.skimmer?.level || 0;
  return 100 + (SKIMMER_LEVELS[level]?.maxCleanBonus || 0);
}

function getMaxFood() {
  const level = state.feeder?.level || 0;
  return 100 + (FEEDER_LEVELS[level]?.maxFoodBonus || 0);
}

// ── Tank Level / XP ─────────────────────────────
// Cumulative XP required to reach level N: 100*(N-1)*N/2
// Level 1=0xp, Level 2=100xp, Level 3=300xp, Level 4=600xp, Level 5=1000xp …
function xpToLevel(xp) {
  return Math.max(1, Math.floor((1 + Math.sqrt(1 + 8 * (xp || 0) / 100)) / 2));
}
function xpForLevel(level) {
  return level <= 1 ? 0 : Math.floor(100 * (level - 1) * level / 2);
}
function addXP(amount) {
  if (!amount || amount <= 0) return;
  const prev = xpToLevel(state.tankXP || 0);
  state.tankXP = (state.tankXP || 0) + amount;
  const next = xpToLevel(state.tankXP);
  if (next > prev) {
    addLog(`⭐ Tank reached Level ${next}!`);
    addNotification(`⭐ Tank Level Up! Now Level ${next}`);
  }
}

function alleleName(geneId, code) {
  const gene = GENE_DATA.find(g => g.id === geneId);
  if (!gene) return code;
  const allele = gene.alleles.find(a => a.code === code);
  return allele ? allele.name : code;
}

function genotypeString(dna) {
  if (!dna) return '';
  const fmt = (geneId, pair) => pair.map(c => alleleName(geneId, c)).join('/');
  return `Body: ${fmt('body_color', dna.body_color)} | Tail: ${fmt('tail_shape', dna.tail_shape)} | Met: ${fmt('metabolism', dna.metabolism)} | Con: ${fmt('constitution', dna.constitution)} | Lon: ${fmt('longevity', dna.longevity)} | Filt: ${fmt('filt', dna.filt)}`;
}

function genotypeCardHTML(dna) {
  if (!dna) return '';
  const genes = [
    { key: 'body_color',   emoji: '🎨', title: 'Body Color — determines the appearance and color phenotype of the sea monkey' },
    { key: 'tail_shape',   emoji: '🐠', title: 'Tail Shape — affects the form of the tail fin (standard, double, fan, etc.)' },
    { key: 'metabolism',   emoji: '⚡', title: 'Metabolism — affects how quickly food is consumed and energy is processed' },
    { key: 'constitution', emoji: '💪', title: 'Constitution — determines maximum health points and physical resilience' },
    { key: 'longevity',    emoji: '⏳', title: 'Longevity — affects natural lifespan and how quickly the sea monkey ages' },
    { key: 'filt',         emoji: '💧', title: 'Filter Feeding — ability to absorb nutrients directly from the water' },
  ];
  const rows = genes.map(g => {
    const display = dna[g.key].map(c => alleleName(g.key, c)).join(' / ');
    return `<tr title="${g.title}"><td class="gene-emoji">${g.emoji}</td><td class="gene-alleles">${display}</td></tr>`;
  }).join('');
  return `<table class="gene-table">${rows}</table>`;
}

// ───────────────────────────────────���─────────
// 3. DEFAULT STATE
// ─────────────────────────────────────────────
const DEFAULT_STATE = {
  version: 3,
  lastSave: null,
  lastTick: null,
  tankCreatedAt: null,
  playTimeMs: 0,
  totalOfflineMs: 0,
  gameStarted: false,
  fpsStressPop: null,
  tankXP: 0,
  tank: {
    waterAdded: false,
    purifying: false,
    purifyStartTime: null,
    purifyDuration: PURIFY_DURATION,
    waterPure: false,
    eggsAdded: false,
    food: 100,
    oxygen: 100,
    cleanliness: 100,
  },
  monkeys: [],
  nextMonkeyId: 1,
  molts: [],
  nextMoltId: 1,
  currency: 0,
  aeration: { level: 0, startedAt: null, duration: null },
  skimmer:  { level: 0, startedAt: null, duration: null },
  feeder:   { level: 0, startedAt: null, duration: null },
  stats: {
    totalBorn: 0,
    totalDied: 0,
    totalMatingEvents: 0,
    totalGenerations: 1,
    peakPopulation: 0,
  },
  milestones: {},
  log: [],
  dex: {
    C_PINK:       { discovered: true,  count: 0, mastered: false },
    C_GRN:        { discovered: true,  count: 0, mastered: false },
    purple:       { discovered: false, count: 0, mastered: false },
    C_BLU:        { discovered: false, count: 0, mastered: false },
    C_GOLD:       { discovered: false, count: 0, mastered: false },
    C_VOID:       { discovered: false, count: 0, mastered: false },
    C_BIO:        { discovered: false, count: 0, mastered: false },
    C_TRANS:      { discovered: false, count: 0, mastered: false },
    T_STD:        { discovered: true,  count: 0, mastered: false },
    T_FAN:        { discovered: false, count: 0, mastered: false },
    T_DBL:        { discovered: false, count: 0, mastered: false },
    M_NRM:        { discovered: true,  count: 0, mastered: false },
    M_FAST:       { discovered: false, count: 0, mastered: false },
    M_SLOW:       { discovered: false, count: 0, mastered: false },
    H_AVG:        { discovered: true,  count: 0, mastered: false },
    H_SENS:       { discovered: false, count: 0, mastered: false },
    H_IRON:       { discovered: false, count: 0, mastered: false },
    L_STD:        { discovered: true,  count: 0, mastered: false },
    L_FLY:        { discovered: false, count: 0, mastered: false },
    L_ANC:        { discovered: false, count: 0, mastered: false },
    filterFeeder: { discovered: false, count: 0, mastered: false },
  },
  glowingFlakesActive: false,
  magnifyingGlassMode: false,
  inventory: {
    lifeBooster: 0,
    boosterEggPack: 0,
    glowingFlakes: 0,
    magnifyingGlass: 0,
  },
};

// ─────────────────────────────────────────────
// 4. LIVE STATE + NOTIFICATIONS
// ───────────��─────────────────────────────────
let state = {};
let notifications = [];
let debugMode = false;
let debugSpeed = 1;
let debugLocks = { food: 'normal', oxygen: 'normal', clean: 'normal', aer: 'normal', skim: 'normal', feeder: 'normal' };
let showTimers = false;
let fpsLastTime = 0;
let fpsFrameCount = 0;
let fpsWindowStart = 0;
let renderDt = 25; // ms since last render frame, used for delta-time movement
let fpsLowSince = null;        // timestamp when FPS first dropped below 30
let fpsStressPopulation = null; // population recorded when FPS stayed low for 5s

// ─────────────────────────────────────────────
// 5. PERSISTENCE
// ─────────────────────────────────────────────
function saveState() {
  state.lastSave = Date.now();
  try {
    localStorage.setItem('seamonkeyfarm_v3', JSON.stringify(state));
  } catch (e) {
    console.warn('Save failed:', e);
  }
}

function loadState() {
  try {
    const rawV3 = localStorage.getItem('seamonkeyfarm_v3');
    if (rawV3) return migrateState(JSON.parse(rawV3));
    const rawV2 = localStorage.getItem('seamonkeyfarm_v2');
    if (rawV2) return migrateState(JSON.parse(rawV2));
    const rawV1 = localStorage.getItem('seamonkeyfarm_v1');
    if (rawV1) return migrateState(JSON.parse(rawV1));
  } catch (e) {
    console.warn('Load failed:', e);
  }
  return JSON.parse(JSON.stringify(DEFAULT_STATE));
}

function migrateState(loaded) {
  const s = Object.assign({}, JSON.parse(JSON.stringify(DEFAULT_STATE)), loaded);
  s.tank  = Object.assign({}, DEFAULT_STATE.tank,  loaded.tank  || {});
  s.stats = Object.assign({}, DEFAULT_STATE.stats, loaded.stats || {});
  s.milestones   = loaded.milestones || {};
  s.log          = loaded.log || [];
  s.nextMonkeyId = loaded.nextMonkeyId || 1;

  // ── Inventory migration ──────────────────────
  const inv = Object.assign({}, DEFAULT_STATE.inventory, loaded.inventory || {});
  if (inv.geneSplicer !== undefined) {
    inv.glowingFlakes = (inv.glowingFlakes || 0) + (inv.geneSplicer || 0);
    delete inv.geneSplicer;
  }
  if (inv.magnifyingGlass === undefined) inv.magnifyingGlass = DEFAULT_STATE.inventory.magnifyingGlass;
  s.inventory = inv;

  // ── Flags migration ──────────────────────────
  s.glowingFlakesActive = loaded.glowingFlakesActive || loaded.splicerActive || false;
  s.magnifyingGlassMode = loaded.magnifyingGlassMode || false;

  // ── Dex migration ────────────────────────────
  const loadedDex = loaded.dex || {};
  const defaultDexCopy = JSON.parse(JSON.stringify(DEFAULT_STATE.dex));
  const dexKeys = Object.keys(loadedDex);
  const isV3Dex = dexKeys.some(k => k.startsWith('C_') || k.startsWith('T_') || k.startsWith('M_') || k.startsWith('H_') || k.startsWith('L_'));
  const dexVals = Object.values(loadedDex);
  const isV1Dex = !isV3Dex && (dexVals.length === 0 || dexVals.some(v => typeof v === 'boolean'));

  if (isV3Dex) {
    // Already v3 dex — merge into defaults
    for (const [key, entry] of Object.entries(loadedDex)) {
      if (defaultDexCopy[key] && typeof entry === 'object' && entry !== null) {
        Object.assign(defaultDexCopy[key], entry);
      }
    }
  } else if (isV1Dex) {
    // V1 dex migration
    defaultDexCopy.C_PINK.discovered = true;
    defaultDexCopy.C_GRN.discovered  = true;
    const keyMap = { albino: 'C_TRANS', longtail: 'L_ANC', twoheaded: 'filterFeeder', bioluminescent: 'C_BIO', gold: 'C_GOLD', blue: 'C_BLU' };
    for (const [oldKey, discovered] of Object.entries(loadedDex)) {
      if (!discovered) continue;
      const newKey = keyMap[oldKey] || oldKey;
      if (defaultDexCopy[newKey]) defaultDexCopy[newKey].discovered = true;
    }
  } else {
    // V2 dex migration → v3 keys
    const v2ToV3 = {
      bioluminescent: 'C_BIO', gold: 'C_GOLD', transparent: 'C_TRANS', albino: 'C_TRANS',
      blue: 'C_BLU', pink: 'C_PINK', green: 'C_GRN', purple: 'purple',
      methuselah: 'L_ANC', longtail: 'L_ANC', ironStomach: 'H_IRON', twoheaded: 'H_IRON',
      filterFeeder: 'filterFeeder', default: 'C_PINK',
    };
    for (const [oldKey, entry] of Object.entries(loadedDex)) {
      if (typeof entry !== 'object' || entry === null) continue;
      const newKey = v2ToV3[oldKey];
      if (newKey && defaultDexCopy[newKey]) {
        defaultDexCopy[newKey].discovered = defaultDexCopy[newKey].discovered || !!entry.discovered;
        defaultDexCopy[newKey].count = Math.max(defaultDexCopy[newKey].count, entry.count || 0);
        defaultDexCopy[newKey].mastered = defaultDexCopy[newKey].mastered || !!entry.mastered;
      }
    }
  }
  s.dex = defaultDexCopy;

  // ── Monkey migration ─────────────────────────
  const colorCodeMap = { Pk: 'C_PINK', Gr: 'C_GRN', bl: 'C_BLU', Au: 'C_GOLD', Bi: 'C_BIO', Tr: 'C_TRANS', d: 'C_PINK' };
  const v1ColorMap = {
    pink: ['C_PINK','C_PINK'], green: ['C_GRN','C_GRN'], blue: ['C_BLU','C_BLU'],
    purple: ['C_PINK','C_GRN'], gold: ['C_GOLD','C_PINK'], bioluminescent: ['C_BIO','C_PINK'],
    transparent: ['C_TRANS','C_TRANS'], albino: ['C_TRANS','C_TRANS'], default: ['C_PINK','C_PINK'],
  };

  s.monkeys = (loaded.monkeys || []).map(m => {
    if (m.dna && m.dna.body_color) return m;  // already v3

    if (m.dna) {
      // V2 DNA → v3
      const body_color = (m.dna.color || ['d','d']).map(c => colorCodeMap[c] || 'C_PINK');
      const longevity  = (m.dna.meth  || ['m','m']).map(c => c === 'M' ? 'L_ANC' : 'L_STD');
      const constitution = (m.dna.iron || ['i','i']).map(c => c === 'I' ? 'H_IRON' : 'H_AVG');
      m.dna = { body_color, tail_shape: ['T_STD','T_STD'], metabolism: ['M_NRM','M_NRM'], constitution, longevity, filt: m.dna.filt || ['f','f'] };
    } else {
      // V1: no DNA at all
      const body_color = v1ColorMap[m.colorGene || 'default'] || ['C_PINK','C_PINK'];
      const longevity  = m.bodyGene === 'longtail'  ? ['L_ANC','L_STD'] : ['L_STD','L_STD'];
      const filt       = m.bodyGene === 'twoheaded' ? ['F','f']         : ['f','f'];
      m.dna = { body_color, tail_shape: ['T_STD','T_STD'], metabolism: ['M_NRM','M_NRM'], constitution: ['H_AVG','H_AVG'], longevity, filt };
      delete m.colorGene; delete m.bodyGene; delete m.color;
    }
    m.health = Math.min(100, m.health || 100);
    return m;
  });

  return s;
}

// ─────────────────────────────────────────────
// 6. STATE HELPERS
// ─────────────────────────────────────────────
function addLog(msg) {
  const now = new Date();
  const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  state.log.unshift({ msg, time: timeStr, isNew: true });
  if (state.log.length > 80) state.log.pop();
}

function pickName() {
  const used = new Set(state.monkeys.map(m => m.name));
  const available = NAMES.filter(n => !used.has(n));
  if (available.length > 0) return available[Math.floor(Math.random() * available.length)];
  return 'Monkey #' + state.nextMonkeyId;
}

function createMonkey(opts = {}) {
  const id = state.nextMonkeyId++;
  const now = Date.now();
  const dna = opts.dna || defaultDNA();
  const monkey = {
    id,
    name: opts.name || pickName(),
    sex: opts.sex || (Math.random() < 0.5 ? 'M' : 'F'),
    generation: opts.generation || 1,
    stage: opts.stage || 'egg',
    bornAt: now,
    stageStartTime: now,
    stageDuration: randRange(...EGG_HATCH),
    health: resolveStats({ dna }).maxHealth,
    alive: true,
    diedAt: null,
    deathCause: null,
    pregnant: false,
    pregnantSince: null,
    pregnancyDuration: 0,
    mateId: null,
    lastMatedAt: null,
    dna,
    size: 1,
    _phase: Math.random() * Math.PI * 2,
    _x: 0, _y: 0, _targetX: 0, _targetY: 0,
  };
  state.monkeys.push(monkey);
  state.stats.totalBorn++;
  return monkey;
}

function killMonkey(monkey, cause) {
  monkey.alive = false;
  monkey.diedAt = Date.now();
  monkey.ageAtDeath = (monkey.diedAt - monkey.bornAt) * (debugMode ? debugSpeed : 1);
  monkey.deathCause = cause;
  monkey.stage = 'dead';
  monkey.pregnant = false;
  state.stats.totalDied++;
  if (cause === 'old age') addXP(15);
  addLog(`💀 ${monkey.name} died (${cause})`);
}

function createMolt(m, fromStage) {
  const emojiMap = { egg: '🥚', baby: '🐠', juvenile: '🐟' };
  const emoji = emojiMap[fromStage];
  if (!emoji) return;
  if (!state.molts) state.molts = [];
  const id = state.nextMoltId++;
  state.molts.push({
    id,
    x: m._x ?? 50,
    y: m._y ?? 50,
    surfaceY: 10 + (id * 13 % 18), // slightly varied surface position
    fromStage,
    emoji,
    monkeyName: m.name,
    createdAt: Date.now(),
  });
}

// ─────────────────────────────────────────────
// 7. MASTERY BONUSES (replaces getActiveDexBuffs)
// ─────────────────────────────────────────────
function getMasteryBonuses() {
  const dex = state.dex || {};
  const mastered = key => !!(dex[key]?.mastered);
  return {
    foodMult:         mastered('C_GOLD')       ? 0.85 : 1,
    voidHungerMult:   mastered('C_VOID')       ? 0.75 : 1,
    oxygenMult:       mastered('C_BIO')        ? 0.85 : 1,
    cleanMult:        mastered('C_TRANS')      ? 0.80 : 1,
    lifespanMult:     mastered('C_BLU')        ? 1.10 : 1,
    extraEgg:         mastered('purple')       ? 1    : 0,
    feedBonus:        mastered('C_PINK')       ? 10   : 0,
    greenFFMult:      mastered('C_GRN')        ? 2.0  : 1.0,
    twinExtraEgg:     mastered('T_DBL')        ? 1    : 0,
    fanMult:          mastered('T_FAN')        ? 1    : 0,
    fastGrowthMult:   mastered('M_FAST'),
    slowHungerMult:   mastered('M_SLOW'),
    ironReduceCorpse: mastered('H_IRON'),
    ancientLifeMult:  mastered('L_ANC'),
    ffOxygenBoost:    mastered('filterFeeder'),
  };
}

// ─────────────────────────────────────────────
// 8. GENETICS
// ─────────────────────────────────────────────
function inheritGenes(parentA, parentB) {
  const mutMult = state.glowingFlakesActive ? 10 : 1;

  function inheritLocus(pA, pB, geneId) {
    const gene = GENE_DATA.find(g => g.id === geneId);
    let a = pA[Math.floor(Math.random() * 2)];
    let b = pB[Math.floor(Math.random() * 2)];
    function maybeMutate(allele) {
      for (const al of gene.alleles) {
        if (!al.mutation_chance || al.code === allele) continue;
        if (Math.random() < al.mutation_chance * mutMult) return al.code;
      }
      return allele;
    }
    return [maybeMutate(a), maybeMutate(b)];
  }

  function mutateFunctional(pair, dom) {
    if (Math.random() < 0.02 * mutMult) {
      const p = [...pair]; p[Math.floor(Math.random() * 2)] = dom; return p;
    }
    return pair;
  }

  const dA = parentA.dna || defaultDNA();
  const dB = parentB.dna || defaultDNA();
  return {
    body_color:   inheritLocus(dA.body_color,   dB.body_color,   'body_color'),
    tail_shape:   inheritLocus(dA.tail_shape,   dB.tail_shape,   'tail_shape'),
    metabolism:   inheritLocus(dA.metabolism,   dB.metabolism,   'metabolism'),
    constitution: inheritLocus(dA.constitution, dB.constitution, 'constitution'),
    longevity:    inheritLocus(dA.longevity,    dB.longevity,    'longevity'),
    filt: mutateFunctional(
      [dA.filt[Math.floor(Math.random() * 2)], dB.filt[Math.floor(Math.random() * 2)]],
      'F'
    ),
  };
}

// ─────────────────────────────────────────────
// 9. TICK LOGIC
// ─────────────────────────────────────────────

function gameTick(dtMs) {
  const dtSec = dtMs / 1000;
  const t = state.tank;
  state.playTimeMs = (state.playTimeMs || 0) + dtMs;

  // --- Purification countdown ---
  if (t.purifying && !t.waterPure) {
    const elapsed = Date.now() - t.purifyStartTime;
    const effectivePurifyElapsed = debugMode ? elapsed * debugSpeed : elapsed;
    if (effectivePurifyElapsed >= t.purifyDuration) {
      t.waterPure = true;
      t.purifying = false;
      addLog('🌊 Water is pure! Ready to release eggs.');
    }
  }

  if (!t.eggsAdded) return;

  // --- Per-monkey resource drain ---
  const alive       = state.monkeys.filter(m => m.alive);
  const aliveNonEgg = alive.filter(m => m.stage !== 'egg');
  const deadCount   = state.monkeys.filter(m => !m.alive).length;
  const mb = getMasteryBonuses();

  // --- Continuous XP for keeping monkeys alive ---
  const xpAdults    = alive.filter(m => m.stage === 'adult').length;
  const xpJuveniles = alive.filter(m => m.stage === 'juvenile').length;
  addXP((xpAdults * 1 + xpJuveniles * 0.5) * dtSec / 60);

  let foodDrain = 0, cleanGain = 0, oxygenGain = 0;
  for (const m of aliveNonEgg) {
    const stats = resolveStats(m);
    foodDrain += FOOD_DRAIN_PER * stats.hungerRate;
    if (stats.isFF) {
      cleanGain  += FILTER_FEED_RATE * mb.greenFFMult;
      if (mb.ffOxygenBoost) oxygenGain += FILTER_FEED_RATE * 0.3;
    }
  }

  // --- Aeration expiry/downgrade ---
  const aer = state.aeration || (state.aeration = { level: 0, startedAt: null, duration: null });
  if (aer.level > 0 && aer.startedAt != null) {
    const aerElapsed = (Date.now() - aer.startedAt) * (debugMode ? debugSpeed : 1);
    if (aerElapsed >= aer.duration) {
      aer.level--;
      addLog(`💨 Aeration downgraded to ${AERATION_LEVELS[aer.level].name}.`);
      if (aer.level > 0) {
        const lvl = AERATION_LEVELS[aer.level];
        aer.startedAt = Date.now();
        aer.duration  = randRange(lvl.durationMin, lvl.durationMax);
      } else {
        aer.startedAt = null;
        aer.duration  = null;
      }
      generateBubbles(AERATION_BUBBLE_COUNTS[aer.level]);
    }
  }

  // --- Skimmer expiry/downgrade ---
  const skim = state.skimmer || (state.skimmer = { level: 0, startedAt: null, duration: null });
  if (skim.level > 0 && skim.startedAt != null) {
    const skimElapsed = (Date.now() - skim.startedAt) * (debugMode ? debugSpeed : 1);
    if (skimElapsed >= skim.duration) {
      skim.level--;
      addLog(`🧹 Skimmer downgraded to ${SKIMMER_LEVELS[skim.level].name}.`);
      if (skim.level > 0) {
        const lvl = SKIMMER_LEVELS[skim.level];
        skim.startedAt = Date.now();
        skim.duration  = randRange(lvl.durationMin, lvl.durationMax);
      } else {
        skim.startedAt = null;
        skim.duration  = null;
      }
    }
  }

  // --- Feeder expiry/downgrade ---
  const feeder = state.feeder || (state.feeder = { level: 0, startedAt: null, duration: null });
  if (feeder.level > 0 && feeder.startedAt != null) {
    const feederElapsed = (Date.now() - feeder.startedAt) * (debugMode ? debugSpeed : 1);
    if (feederElapsed >= feeder.duration) {
      feeder.level--;
      addLog(`🍽️ Feeder downgraded to ${FEEDER_LEVELS[feeder.level].name}.`);
      if (feeder.level > 0) {
        const lvl = FEEDER_LEVELS[feeder.level];
        feeder.startedAt = Date.now();
        feeder.duration  = randRange(lvl.durationMin, lvl.durationMax);
      } else {
        feeder.startedAt = null;
        feeder.duration  = null;
      }
    }
  }

  if (feeder.level > 0) {
    if (!feeder.lastFoodSpawn || (Date.now() - feeder.lastFoodSpawn) >= 30_000) {
      feeder.lastFoodSpawn = Date.now();
      spawnFoodFlakes();
    }
  }

  const aerRegen    = AERATION_LEVELS[aer.level]?.passiveRegen    || 0;
  const skimRegen   = SKIMMER_LEVELS[skim.level]?.passiveRegen    || 0;
  const feederRegen = FEEDER_LEVELS[feeder.level]?.passiveRegen   || 0;
  const corpseRate = mb.ironReduceCorpse ? DEAD_DRAIN_PER * 0.5 : DEAD_DRAIN_PER;
  t.food        = Math.max(0, Math.min(getMaxFood(),        t.food        - foodDrain * dtSec * mb.foodMult * mb.voidHungerMult + feederRegen * dtSec));
  t.oxygen      = Math.max(0, Math.min(getMaxOxygen(),      t.oxygen      - OXYGEN_DRAIN_PER * aliveNonEgg.length * dtSec * mb.oxygenMult + (oxygenGain + aerRegen + BASE_OXYGEN_REGEN) * dtSec));
  t.cleanliness = Math.max(0, Math.min(getMaxCleanliness(), t.cleanliness - (CLEAN_DRAIN_PER * aliveNonEgg.length + corpseRate * deadCount) * dtSec * mb.cleanMult + (cleanGain + skimRegen + BASE_CLEAN_REGEN) * dtSec));
  if (debugMode) {
    if (debugLocks.food   !== 'normal') t.food        = debugLocks.food   === '0' ? 0 : 100;
    if (debugLocks.oxygen !== 'normal') t.oxygen      = debugLocks.oxygen === '0' ? 0 : 100;
    if (debugLocks.clean  !== 'normal') t.cleanliness = debugLocks.clean  === '0' ? 0 : 100;
    const _lockLS = (obj, key) => {
      const lvl = parseInt(key);
      obj.level = lvl;
      if (lvl > 0) { obj.startedAt = Date.now(); obj.duration = 999_999_999; }
      else         { obj.startedAt = null; obj.duration = null; }
    };
    if (debugLocks.aer    !== 'normal') _lockLS(state.aeration, debugLocks.aer);
    if (debugLocks.skim   !== 'normal') _lockLS(state.skimmer,  debugLocks.skim);
    if (debugLocks.feeder !== 'normal') _lockLS(state.feeder,   debugLocks.feeder);
  }

  // --- Update each monkey ---
  for (const m of alive) {
    updateMonkeyHealth(m, dtSec, t);
    if (!m.alive) continue;
    updateMonkeyStage(m);
    if (!m.alive) continue;
    if (m.stage === 'adult' && m.sex === 'F') {
      updateMonkeyReproduction(m, alive);
    }
  }

  // --- Process births ---
  processBirths(alive);

  // --- Auto-remove corpses after 5 minutes, penalise cleanliness ---
  const CORPSE_TTL = 5 * 60 * 1000;
  const now = Date.now();
  const before = state.monkeys.length;
  state.monkeys = state.monkeys.filter(m => {
    if (m.alive || !m.diedAt) return true;
    if (now - m.diedAt >= CORPSE_TTL) {
      t.cleanliness = Math.max(0, t.cleanliness - 5);
      return false;
    }
    return true;
  });
  if (state.monkeys.length < before) {
    addLog(`🧹 Corpse${before - state.monkeys.length > 1 ? 's' : ''} decayed. -${(before - state.monkeys.length) * 5} cleanliness.`);
  }

  // --- Update stats ---
  const livePop = state.monkeys.filter(m => m.alive).length;
  if (livePop > state.stats.peakPopulation) state.stats.peakPopulation = livePop;

  checkMilestones();
  saveState();
}

function updateMonkeyHealth(m, dtSec, t) {
  let dmg = 0;
  let regen = 0;

  if (m.stage === 'egg') return; // eggs don't need food/oxygen

  if (t.oxygen <= 0) dmg += DMG_NO_OXYGEN * dtSec;
  if (t.food   <= 0) dmg += DMG_NO_FOOD   * dtSec;

  // Constitution-based dirty water damage: H_IRON (0.8 res) takes far less; H_SENS (-0.5 res) takes more
  const stats = resolveStats(m);
  if (t.cleanliness < 20) dmg += DMG_DIRTY * (1 - stats.pollutionRes) * dtSec;

  if (dmg === 0 && t.food > 50 && t.oxygen > 50 && t.cleanliness > 50) {
    regen = REGEN_RATE * dtSec;
  }

  m.health = Math.min(stats.maxHealth, Math.max(0, m.health - dmg + regen));

  if (m.health <= 0) {
    const cause = t.oxygen <= 0 ? 'suffocation' : t.food <= 0 ? 'starvation' : 'poor water quality';
    killMonkey(m, cause);
  }
}

function updateMonkeyStage(m) {
  const now = Date.now();
  const elapsed = now - m.stageStartTime;
  const effectiveElapsed = debugMode ? elapsed * debugSpeed : elapsed;
  const dur = m.stageDuration || 0;
  const stats = resolveStats(m);

  if (m.stage === 'egg' && effectiveElapsed >= dur) {
    if (Math.random() < 0.2) createMolt(m, 'egg');
    m.stage = 'baby';
    m.stageStartTime = now;
    m.stageDuration = randRange(...BABY_GROW) / stats.growthSpeed;
    checkDexDiscovery(m);
    addXP(5);
    addLog(`🐠 ${m.name} hatched!`);
  } else if (m.stage === 'baby' && effectiveElapsed >= dur) {
    if (Math.random() < 0.2) createMolt(m, 'baby');
    m.stage = 'juvenile';
    m.stageStartTime = now;
    m.stageDuration = randRange(...JUV_GROW) / stats.growthSpeed;
    addXP(10);
    addLog(`🐟 ${m.name} grew into a juvenile!`);
  } else if (m.stage === 'juvenile' && effectiveElapsed >= dur) {
    if (Math.random() < 0.2) createMolt(m, 'juvenile');
    m.stage = 'adult';
    m.stageStartTime = now;
    const mb = getMasteryBonuses();
    m.stageDuration = randRange(...ADULT_LIFE) * stats.lifeMult * mb.lifespanMult;
    addXP(20);
    addLog(`🦐 ${m.name} is now an adult ${m.sex === 'M' ? '(male)' : '(female)'}!`);
  } else if (m.stage === 'adult' && effectiveElapsed >= dur) {
    killMonkey(m, 'old age');
  }
}

function updateMonkeyReproduction(female, aliveMonkeys) {
  if (female.pregnant) return;
  if (fpsStressPopulation !== null && state.monkeys.length >= fpsStressPopulation) return;
  const now = Date.now();
  const cooldownElapsed = (now - (female.lastMatedAt || 0)) * (debugMode ? debugSpeed : 1);
  if (female.lastMatedAt && cooldownElapsed < MATING_COOLDOWN) return;

  const males = aliveMonkeys.filter(m => m.alive && m.stage === 'adult' && m.sex === 'M');
  if (males.length === 0) return;

  const mate = males[Math.floor(Math.random() * males.length)];
  female.pregnant = true;
  female.pregnantSince = now;
  female.pregnancyDuration = randRange(...PREGNANCY);
  female.mateId = mate.id;
  female.lastMatedAt = now;
  state.stats.totalMatingEvents++;
  addXP(5);
  addLog(`💕 ${female.name} & ${mate.name} mated!`);
}

function processBirths(aliveMonkeys) {
  const now = Date.now();
  for (const m of aliveMonkeys) {
    if (!m.pregnant || !m.pregnantSince) continue;
    const pregElapsed = (now - m.pregnantSince) * (debugMode ? debugSpeed : 1);
    if (pregElapsed < m.pregnancyDuration) continue;

    m.pregnant = false;
    m.pregnantSince = null;
    const gen = m.generation + 1;
    if (gen > state.stats.totalGenerations) state.stats.totalGenerations = gen;

    const father = state.monkeys.find(mp => mp.id === m.mateId);

    // Glowing Flakes: boost mutations, deal damage to parents
    const usedFlakes = state.glowingFlakesActive;
    if (usedFlakes) {
      m.health = Math.max(1, m.health - 20);
      if (father?.alive) father.health = Math.max(1, father.health - 10);
      state.glowingFlakesActive = false;
    }

    const mb = getMasteryBonuses();
    const count = 1 + Math.floor(Math.random() * 3) + mb.extraEgg + mb.twinExtraEgg + mb.fanMult;
    for (let i = 0; i < count; i++) {
      if (fpsStressPopulation !== null && state.monkeys.length >= fpsStressPopulation) break;
      const dna = inheritGenes(m, father || m);
      const baby = createMonkey({ generation: gen, dna });
      // Build log tag: phenotype + expressed functional traits
      const phenotype = resolveColorPhenotype(dna.body_color);
      const def = PHENOTYPE_DEFS[phenotype];
      let tag = def ? def.name : phenotype;
      const traits = [];
      const metCode = resolveAllele(dna.metabolism,   'metabolism');
      const conCode = resolveAllele(dna.constitution, 'constitution');
      const lonCode = resolveAllele(dna.longevity,    'longevity');
      const tailCode = resolveAllele(dna.tail_shape,  'tail_shape');
      const findName = (geneId, code) => GENE_DATA.find(g => g.id === geneId).alleles.find(a => a.code === code).name;
      if (metCode  !== 'M_NRM') traits.push(findName('metabolism',   metCode));
      if (conCode  !== 'H_AVG') traits.push(findName('constitution', conCode));
      if (lonCode  !== 'L_STD') traits.push(findName('longevity',    lonCode));
      if (tailCode !== 'T_STD') traits.push(findName('tail_shape',   tailCode));
      if (hasDominant(dna.filt, 'F')) traits.push('Filter Feeder');
      if (traits.length) tag += '+' + traits.join('+');
      addXP(10);
      addLog(`🥚 ${m.name} laid egg: ${baby.name} [${tag}]!`);
    }
    if (usedFlakes) addLog('✨ Glowing Flakes boosted mutation rates for this birth! (parents took damage)');
  }
}

// ─────────────────────────────────────────────
// 10. DEX DISCOVERY & MASTERY
// ─────────────────────────────────────────────

function checkDexDiscovery(monkey) {
  if (!state.dex) state.dex = {};
  if (!monkey.dna) return;

  // Color phenotype
  const phenotype = resolveColorPhenotype(monkey.dna.body_color);
  const colorEntry = state.dex[phenotype];
  if (colorEntry) {
    colorEntry.count++;
    if (!colorEntry.discovered) {
      colorEntry.discovered = true;
      const def = PHENOTYPE_DEFS[phenotype];
      addXP(50);
      addLog(`🔬 NEW VARIANT DISCOVERED: ${def?.name || phenotype}!`);
      addNotification(`🔬 ${def?.name || phenotype} discovered!`);
    }
    checkMastery(phenotype);
  }

  // Tail shape
  const tailCode = resolveAllele(monkey.dna.tail_shape, 'tail_shape');
  const tailEntry = state.dex[tailCode];
  if (tailEntry) {
    tailEntry.count++;
    if (!tailEntry.discovered) {
      tailEntry.discovered = true;
      const name = GENE_DATA.find(g => g.id === 'tail_shape').alleles.find(a => a.code === tailCode).name;
      addXP(50);
      addLog(`🔬 NEW VARIANT DISCOVERED: ${name}!`);
      addNotification(`🔬 ${name} discovered!`);
    }
    checkMastery(tailCode);
  }

  // Functional loci: metabolism, constitution, longevity
  for (const geneId of ['metabolism', 'constitution', 'longevity']) {
    const code = resolveAllele(monkey.dna[geneId], geneId);
    const entry = state.dex[code];
    if (!entry) continue;
    entry.count++;
    if (!entry.discovered) {
      entry.discovered = true;
      const name = GENE_DATA.find(g => g.id === geneId).alleles.find(a => a.code === code).name;
      addXP(75);
      addLog(`🔬 NEW GENE DISCOVERED: ${name}!`);
      addNotification(`🔬 ${name} gene discovered!`);
    }
    checkMastery(code);
  }

  // Filter Feeder
  if (hasDominant(monkey.dna.filt, 'F')) {
    const entry = state.dex['filterFeeder'];
    if (entry) {
      entry.count++;
      if (!entry.discovered) {
        entry.discovered = true;
        addXP(75);
        addLog('🔬 NEW GENE DISCOVERED: Filter Feeder!');
        addNotification('🔬 Filter Feeder gene discovered!');
      }
      checkMastery('filterFeeder');
    }
  }
}

function checkMastery(key) {
  const entry = state.dex[key];
  if (!entry || entry.mastered) return;
  const colorOrTailKeys = ['C_PINK','C_GRN','purple','C_BLU','C_GOLD','C_VOID','C_BIO','C_TRANS','T_STD','T_FAN','T_DBL'];
  const threshold = colorOrTailKeys.includes(key) ? MASTERY_THRESHOLD_COLOR : MASTERY_THRESHOLD_FUNC;
  if (entry.count >= threshold) {
    entry.mastered = true;
    const allVariants = [...DEX_COLOR_VARIANTS, ...DEX_TAIL_VARIANTS, ...DEX_METAB_VARIANTS, ...DEX_CONST_VARIANTS, ...DEX_LONGEV_VARIANTS, ...DEX_FUNC_VARIANTS];
    const variant = allVariants.find(v => v.key === key);
    const name = variant?.name || key;
    const desc = variant?.masteryDesc || '';
    addXP(100);
    addLog(`⭐ MASTERY UNLOCKED: ${name}! ${desc}`);
    addNotification(`⭐ ${name} Mastery!`);
  }
}

function checkMilestones() {
  const ms = state.milestones;
  const alive = state.monkeys.filter(m => m.alive);
  const adults = alive.filter(m => m.stage === 'adult');
  const pop = alive.length;

  if (!ms.firstAdult && adults.length >= 1) {
    ms.firstAdult = true;
    addXP(50);
    addLog('🌟 Milestone: First adult sea monkey!');
  }
  if (!ms.pop5 && pop >= 5) {
    ms.pop5 = true;
    addXP(25);
    addLog('🐠 Milestone: Population reached 5!');
  }
  if (!ms.pop10 && pop >= 10) {
    ms.pop10 = true;
    state.inventory.boosterEggPack++;
    addXP(100);
    addLog('🎉 Milestone: Population reached 10! +1 🥚 Booster Egg Pack');
  }
  if (!ms.pop25 && pop >= 25) {
    ms.pop25 = true;
    state.inventory.lifeBooster++;
    addXP(200);
    addLog('🏆 Milestone: Population reached 25! +1 🧪 Life Booster');
  }
  if (!ms.pop50 && pop >= 50) {
    ms.pop50 = true;
    state.inventory.lifeBooster++;
    addXP(500);
    addLog('👑 Milestone: Population reached 50! +1 🧪 Life Booster');
  }
  if (!ms.gen2 && state.stats.totalGenerations >= 2) {
    ms.gen2 = true;
    state.inventory.lifeBooster++;
    addXP(75);
    addLog('🧬 Milestone: Second generation born! +1 🧪 Life Booster');
  }
  if (!ms.gen5 && state.stats.totalGenerations >= 5) {
    ms.gen5 = true;
    state.inventory.boosterEggPack++;
    addXP(150);
    addLog('🧬 Milestone: Fifth generation! +1 🥚 Booster Egg Pack');
  }
  if (!ms.gen10 && state.stats.totalGenerations >= 10) {
    ms.gen10 = true;
    state.inventory.boosterEggPack += 2;
    addXP(300);
    addLog('🧬 Milestone: Tenth generation — Dynasty! +2 🥚 Booster Egg Packs');
  }
  if (!ms.firstDeath && state.stats.totalDied >= 1) {
    ms.firstDeath = true;
    addLog('😢 Milestone: First death...');
  }
  if (!ms.totalBorn50 && state.stats.totalBorn >= 50) {
    ms.totalBorn50 = true;
    addXP(100);
    addLog('🥚 Milestone: 50 sea monkeys have been born!');
  }
  if (!ms.totalBorn100 && state.stats.totalBorn >= 100) {
    ms.totalBorn100 = true;
    state.inventory.glowingFlakes++;
    addXP(200);
    addLog('🥚 Milestone: 100 sea monkeys born! +1 ✨ Glowing Flakes');
  }

  // First rare variant (Tier 2 or 3 color, or any rare gene)
  const rareFound = ['purple','C_BLU','C_TRANS','C_GOLD','C_BIO','C_VOID']
    .some(k => state.dex[k]?.discovered);
  if (!ms.firstRareVariant && rareFound) {
    ms.firstRareVariant = true;
    state.inventory.glowingFlakes++;
    addXP(100);
    addLog('✨ Milestone: First rare variant discovered! +1 ✨ Glowing Flakes');
  }

  // First functional gene
  const funcFound = ['M_FAST','M_SLOW','H_SENS','H_IRON','L_FLY','L_ANC','filterFeeder']
    .some(k => state.dex[k]?.discovered);
  if (!ms.firstFunctionalGene && funcFound) {
    ms.firstFunctionalGene = true;
    state.inventory.magnifyingGlass++;
    addXP(100);
    addLog('🔍 Milestone: First functional gene discovered! +1 🔍 Magnifying Glass');
  }

  // First mastery
  const anyMastered = Object.values(state.dex || {}).some(e => e.mastered);
  if (!ms.firstMastery && anyMastered) {
    ms.firstMastery = true;
    addXP(150);
    addLog('⭐ Milestone: First mastery unlocked!');
  }
}

function applyOfflineProgress() {
  if (!state.lastTick) return;
  let offlineMs = Date.now() - state.lastTick;
  if (offlineMs <= 1000) return;
  offlineMs = Math.min(offlineMs, OFFLINE_CAP_MS);
  state.totalOfflineMs = (state.totalOfflineMs || 0) + offlineMs;

  addLog(`⏰ Applied ${Math.round(offlineMs / 60000)} min of offline progress`);

  let remaining = offlineMs;
  while (remaining > 0) {
    const chunk = Math.min(remaining, OFFLINE_CHUNK_MS);
    state.lastTick = Date.now() - remaining + chunk;
    gameTick(chunk);
    remaining -= chunk;
  }
}

// ─────────────────────────────────────────────
// 11. RENDER FUNCTIONS
// ─────────────────────────────────────────────

function fmtMs(ms) {
  const secs = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`;
}

function fmtAge(ms) {
  const secs = Math.floor(ms / 1000);
  if (secs < 60)   return `${secs}s`;
  const mins = Math.floor(secs / 60);
  if (mins < 60)   return `${mins}m ${secs % 60}s`;
  const hrs = Math.floor(mins / 60);
  return `${hrs}h ${mins % 60}m`;
}

function renderDebugPanel() {
  const panel = document.getElementById('debug-timers-panel');
  if (!showTimers) { panel.style.display = 'none'; return; }
  panel.style.display = '';
  const list = document.getElementById('debug-timer-list');

  document.getElementById('debug-speed-label').textContent = `${debugSpeed}×`;

  const now = Date.now();
  const t = state.tank;
  const rows = [];

  if (t.purifying && !t.waterPure) {
    const eff = (now - t.purifyStartTime) * debugSpeed;
    const rem = (t.purifyDuration - eff) / debugSpeed;
    rows.push({ rem, next: '💧 Water pure — eggs unlock' });
  }

  for (const m of state.monkeys) {
    if (!m.alive) continue;
    const stageElapsed = (now - m.stageStartTime) * debugSpeed;
    const stageRem = (m.stageDuration - stageElapsed) / debugSpeed;

    const stageNext = {
      egg:      `🐠 ${m.name} hatches`,
      baby:     `🐟 ${m.name} grows to juvenile`,
      juvenile: `🦐 ${m.name} becomes adult`,
      adult:    `💀 ${m.name} dies of old age`,
    }[m.stage];
    if (stageNext) rows.push({ rem: stageRem, next: stageNext });

    if (m.pregnant && m.pregnantSince) {
      const pregEff = (now - m.pregnantSince) * debugSpeed;
      const pregRem = (m.pregnancyDuration - pregEff) / debugSpeed;
      rows.push({ rem: pregRem, next: `🥚 ${m.name} lays eggs` });
    }

    if (m.sex === 'F' && m.stage === 'adult' && m.lastMatedAt && !m.pregnant) {
      const cdRem = MATING_COOLDOWN - (now - m.lastMatedAt);
      if (cdRem > 0) rows.push({ rem: cdRem, next: `💕 ${m.name} ready to mate` });
    }
  }

  rows.sort((a, b) => a.rem - b.rem);

  list.innerHTML = rows.length
    ? rows.map(r => `<div class="debug-timer"><span class="debug-time">${fmtMs(r.rem)}</span><span class="debug-next">${r.next}</span></div>`).join('')
    : '<div style="color:#3a6a8a;font-size:10px;">No active timers</div>';
}

function renderMonkeydex() {
  const modal = document.getElementById('monkeydex-modal');
  if (!modal || !modal.classList.contains('open')) return;

  const grid = document.getElementById('dex-grid');
  const dex = state.dex || {};

  const COLOR_OR_TAIL_KEYS = ['C_PINK','C_GRN','purple','C_BLU','C_GOLD','C_VOID','C_BIO','C_TRANS','T_STD','T_FAN','T_DBL'];

  function makeCard(v) {
    const entry = dex[v.key] || { discovered: false, count: 0, mastered: false };
    const threshold = COLOR_OR_TAIL_KEYS.includes(v.key) ? MASTERY_THRESHOLD_COLOR : MASTERY_THRESHOLD_FUNC;
    const def = PHENOTYPE_DEFS[v.key];

    let styleAttr = '';
    if (entry.discovered && def) {
      if (def.opacity) {
        styleAttr = ` style="opacity:${def.opacity}; filter:${def.filterStr};"`;
      } else {
        const filterPart = def.filterStr ? `filter:${def.filterStr};` : '';
        const shadowPart = def.shadow ? `text-shadow:${def.shadow};` : '';
        if (filterPart || shadowPart) styleAttr = ` style="${filterPart}${shadowPart}"`;
      }
    }

    const tierLabel = v.tier ? `Tier ${v.tier}` : '';
    const masteredStar = entry.mastered ? ' ⭐' : '';
    const countStr = `${entry.count}/${threshold}`;

    return `<div class="dex-card ${entry.discovered ? '' : 'undiscovered'}">
      <div class="dex-emoji"${styleAttr}>${entry.discovered ? '🦐' : '❓'}</div>
      <div class="dex-name">${entry.discovered ? v.name + masteredStar : '???'}</div>
      ${tierLabel ? `<div class="dex-rarity">${tierLabel}</div>` : ''}
      <div class="dex-count">${entry.discovered ? countStr : '?/?'}</div>
      <div class="dex-desc">${entry.discovered ? v.masteryDesc : 'Not yet discovered'}</div>
    </div>`;
  }

  grid.innerHTML = `
    <div class="dex-section-header">Color Variants</div>
    <div class="dex-grid-4">${DEX_COLOR_VARIANTS.map(v => makeCard(v)).join('')}</div>
    <div class="dex-section-header">Tail Variants</div>
    <div class="dex-grid-3">${DEX_TAIL_VARIANTS.map(v => makeCard(v)).join('')}</div>
    <div class="dex-section-header">Metabolism</div>
    <div class="dex-grid-3">${DEX_METAB_VARIANTS.map(v => makeCard(v)).join('')}</div>
    <div class="dex-section-header">Constitution</div>
    <div class="dex-grid-3">${DEX_CONST_VARIANTS.map(v => makeCard(v)).join('')}</div>
    <div class="dex-section-header">Longevity</div>
    <div class="dex-grid-3">${DEX_LONGEV_VARIANTS.map(v => makeCard(v)).join('')}</div>
    <div class="dex-section-header">Functional Genes</div>
    <div class="dex-grid-3">${DEX_FUNC_VARIANTS.map(v => makeCard(v)).join('')}</div>
  `;

  const ms = state.milestones || {};
  const milestonePanel = document.getElementById('dex-milestones');
  milestonePanel.innerHTML = MILESTONES_DEF.map(m => {
    const done = !!ms[m.key];
    const [cur, max] = m.progress();
    const pct = Math.min(100, Math.round((cur / max) * 100));
    const statusHtml = done
      ? `<span class="ms-done">✅ Complete</span>`
      : `<div class="ms-progress-bar"><div class="ms-progress-fill" style="width:${pct}%"></div></div>
         <div class="ms-progress-label">${cur} / ${max}</div>`;
    const rewardHtml = m.reward ? `<div class="ms-reward">${m.reward}</div>` : '';
    return `<div class="ms-card ${done ? 'ms-complete' : ''}">
      <div class="ms-top">
        <span class="ms-emoji">${m.emoji}</span>
        <span class="ms-name">${m.name}</span>
      </div>
      <div class="ms-desc">${m.desc}</div>
      ${rewardHtml}
      ${statusHtml}
    </div>`;
  }).join('');
}

let _popSignature = '';

function buildPopCard(m, now, hasMagnifier) {
  const stats = resolveStats(m);
  const filled = Math.max(0, Math.round((m.health / stats.maxHealth) * 10));
  const healthBar = '█'.repeat(filled) + '░'.repeat(10 - filled);

  let timeStr = '';
  if (m.alive && m.stageDuration) {
    const eff = (now - m.stageStartTime) * (debugMode ? debugSpeed : 1);
    const rem = Math.max(0, m.stageDuration - eff);
    timeStr = fmtMs(rem / (debugMode ? debugSpeed : 1));
  }

  let traitsStr = '—';
  let traitsHtml = null;
  if (m.dna) {
    if (hasMagnifier) {
      traitsStr = genotypeString(m.dna);
      traitsHtml = genotypeCardHTML(m.dna);
    } else {
      const phen = resolveColorPhenotype(m.dna.body_color);
      const parts = [PHENOTYPE_DEFS[phen]?.name || phen];
      const fn = (geneId, code) =>
        GENE_DATA.find(g => g.id === geneId).alleles.find(a => a.code === code).name;
      const metCode  = resolveAllele(m.dna.metabolism,   'metabolism');
      const conCode  = resolveAllele(m.dna.constitution, 'constitution');
      const lonCode  = resolveAllele(m.dna.longevity,    'longevity');
      const tailCode = resolveAllele(m.dna.tail_shape,   'tail_shape');
      if (metCode  !== 'M_NRM') parts.push(fn('metabolism',   metCode));
      if (conCode  !== 'H_AVG') parts.push(fn('constitution', conCode));
      if (lonCode  !== 'L_STD') parts.push(fn('longevity',    lonCode));
      if (tailCode !== 'T_STD') parts.push(fn('tail_shape',   tailCode));
      if (stats.isFF) parts.push('Filter Feeder');
      traitsStr = parts.join(', ');
    }
  }

  let pregTimerStr = '';
  if (m.pregnant && m.pregnantSince) {
    const eff = (now - m.pregnantSince) * (debugMode ? debugSpeed : 1);
    const rem = Math.max(0, m.pregnancyDuration - eff);
    pregTimerStr = fmtMs(rem / (debugMode ? debugSpeed : 1));
  }

  const phenotype = m.dna ? resolveColorPhenotype(m.dna.body_color) : 'C_PINK';
  const def = PHENOTYPE_DEFS[phenotype];
  let emojiStyle = '';
  if (m.alive && def) {
    if (def.opacity) {
      emojiStyle = `style="opacity:${def.opacity}; filter:${def.filterStr};"`;
    } else {
      const fp = def.filterStr ? `filter:${def.filterStr};` : '';
      const sp = def.shadow    ? `text-shadow:${def.shadow};` : '';
      if (fp || sp) emojiStyle = `style="${fp}${sp}"`;
    }
  }

  const baseEmoji = m.alive
    ? ({ egg:'🥚', baby:'🐠', juvenile:'🐟', adult:'🦐' }[m.stage] || '🦐')
    : '💀';
  const tailCode2 = m.dna ? resolveAllele(m.dna.tail_shape, 'tail_shape') : 'T_STD';
  const displayEmoji = (tailCode2 === 'T_DBL' && m.alive) ? baseEmoji + baseEmoji : baseEmoji;
  const stageLabel = { egg:'🥚 Egg', baby:'🐠 Baby', juvenile:'🐟 Juvenile', adult:'🦐 Adult' }[m.stage] || m.stage;
  const ageMs = m.alive
    ? (now - m.bornAt) * (debugMode ? debugSpeed : 1)
    : (m.ageAtDeath ?? (m.diedAt - m.bornAt));

  return `<div class="pop-card ${m.alive ? m.stage : 'dead'}">
    ${pregTimerStr ? `<span class="pop-preg" id="pop-preg-${m.id}">🤰 ${pregTimerStr}</span>` : ''}
    <span class="pop-card-emoji" ${emojiStyle}>${displayEmoji}</span>
    <div class="pop-card-name">${m.name} <span class="pop-sex">(${m.sex})</span></div>
    <div class="pop-card-badges">
      <span class="pop-stage">${stageLabel}</span>
      <span class="pop-gen">Gen ${m.generation}</span>
    </div>
    <span class="pop-age" id="pop-age-${m.id}">${fmtAge(ageMs)}</span>
    <div class="pop-card-health">❤ <span class="pop-bar" id="pop-bar-${m.id}">${healthBar}</span> <span class="pop-hp" id="pop-hp-${m.id}">${Math.round(m.health)}/${stats.maxHealth}</span></div>
    <div class="pop-traits">${traitsHtml !== null ? traitsHtml : traitsStr}</div>
    ${timeStr ? `<div class="pop-card-timer">${{egg:'🐠',baby:'🐟',juvenile:'🦐',adult:'💀'}[m.stage]||'⏱'} <span id="pop-stg-${m.id}">${timeStr}</span></div>` : ''}
  </div>`;
}

function updatePopCard(m, now) {
  if (!m.alive) return; // dead cards are static

  const stats = resolveStats(m);
  const filled = Math.max(0, Math.round((m.health / stats.maxHealth) * 10));
  document.getElementById(`pop-bar-${m.id}`).textContent = '█'.repeat(filled) + '░'.repeat(10 - filled);
  document.getElementById(`pop-hp-${m.id}`).textContent  = `${Math.round(m.health)}/${stats.maxHealth}`;

  const ageMs = (now - m.bornAt) * (debugMode ? debugSpeed : 1);
  document.getElementById(`pop-age-${m.id}`).textContent = fmtAge(ageMs);

  const stgEl = document.getElementById(`pop-stg-${m.id}`);
  if (stgEl && m.stageDuration) {
    const eff = (now - m.stageStartTime) * (debugMode ? debugSpeed : 1);
    stgEl.textContent = fmtMs(Math.max(0, m.stageDuration - eff) / (debugMode ? debugSpeed : 1));
  }

  const pregEl = document.getElementById(`pop-preg-${m.id}`);
  if (pregEl && m.pregnantSince) {
    const eff = (now - m.pregnantSince) * (debugMode ? debugSpeed : 1);
    pregEl.textContent = `🤰 ${fmtMs(Math.max(0, m.pregnancyDuration - eff) / (debugMode ? debugSpeed : 1))}`;
  }
}

function renderPopulation() {
  const view = document.getElementById('population-view');
  if (!view || !view.classList.contains('active')) return;

  const now        = Date.now();
  const aliveCount = state.monkeys.filter(m => m.alive).length;
  const deadCount  = state.monkeys.filter(m => !m.alive).length;
  document.getElementById('population-view-title').textContent =
    `📋 Population — ${aliveCount} alive${deadCount ? ', ' + deadCount + ' dead' : ''}`;

  const list = document.getElementById('population-list');

  if (!state.monkeys.length) {
    list.innerHTML = '<div class="pop-empty">No sea monkeys yet.</div>';
    _popSignature = '';
    return;
  }

  const sorted = [...state.monkeys].sort((a, b) => {
    if (a.alive !== b.alive) return a.alive ? -1 : 1;
    return (a.bornAt ?? 0) - (b.bornAt ?? 0);
  });

  const hasMagnifier = state.magnifyingGlassMode && state.inventory.magnifyingGlass > 0;
  const sig = sorted.map(m => `${m.id}:${m.stage}:${m.alive?1:0}:${m.pregnant?1:0}`).join('|')
    + `|m:${hasMagnifier ? 1 : 0}`;

  if (sig !== _popSignature) {
    _popSignature = sig;
    const stageOrder  = ['adult', 'juvenile', 'baby', 'egg'];
    const stageLabels = { egg: '🥚 Eggs', baby: '🐠 Babies', juvenile: '🐟 Juveniles', adult: '🦐 Adults' };
    const byStage = {};
    const dead = [];
    for (const m of sorted) {
      if (!m.alive) { dead.push(m); continue; }
      (byStage[m.stage] = byStage[m.stage] || []).push(m);
    }
    let html = '';
    for (const stage of stageOrder) {
      const group = byStage[stage];
      if (!group?.length) continue;
      html += `<div class="pop-section-header">${stageLabels[stage]}<span class="pop-section-count">${group.length}</span></div>`;
      html += group.map(m => buildPopCard(m, now, hasMagnifier)).join('');
    }
    if (dead.length) {
      html += `<div class="pop-section-header">💀 Deceased<span class="pop-section-count">${dead.length}</span></div>`;
      html += dead.map(m => buildPopCard(m, now, hasMagnifier)).join('');
    }
    list.innerHTML = html;
  } else {
    for (const m of sorted) updatePopCard(m, now);
  }
}

let _lsAerLevel = -1;
let _lsSkimLevel = -1;
let _lsFeederLevel = -1;

function buildLsPanel(prefix, title, levels, cur) {
  const nodes = [1,2,3,4,5].map(i =>
    `<div class="ls-level-node${i <= cur.level ? ' active' : ''}"></div>${i < 5 ? '<div class="ls-level-line"></div>' : ''}`
  ).join('');
  const lvl = levels[cur.level];
  const statLabel = prefix === 'aer' ? 'Max O₂' : prefix === 'skim' ? 'Max Clean' : 'Max Food';
  const statVal   = prefix === 'aer' ? 100 + lvl.maxOxygenBonus : prefix === 'skim' ? 100 + lvl.maxCleanBonus : 100 + lvl.maxFoodBonus;
  const nextLevel = cur.level + 1;
  const btnLabel  = nextLevel > 5 ? 'Max Level' : `Upgrade to ${levels[nextLevel].name} (£${levels[nextLevel].upgradeCost})`;
  return `
    <div class="ls-panel" id="ls-panel-${prefix}">
      <div class="ls-panel-title">${title}</div>
      <div class="ls-level-track">${nodes}</div>
      <div class="ls-info-grid">
        <div class="ls-info-row"><span>Level</span><span>${lvl.name}</span></div>
        <div class="ls-info-row"><span>${statLabel}</span><span>${statVal}</span></div>
        <div class="ls-info-row"><span>Regen</span><span>${lvl.passiveRegen > 0 ? `+${lvl.passiveRegen}/s` : '—'}</span></div>
        <div class="ls-info-row"><span>Time Left</span><span id="ls-timer-${prefix}">—</span></div>
      </div>
      <div class="ls-duration-track"><div class="ls-duration-bar" id="ls-bar-${prefix}" style="width:0%"></div></div>
      <button class="btn primary" id="ls-btn-${prefix}">${btnLabel}</button>
    </div>`;
}

function renderLifeSupport() {
  const view = document.getElementById('life-support-view');
  if (!view || !view.classList.contains('active')) return;

  const now = Date.now();
  const currency = state.currency || 0;
  const aer    = state.aeration || { level: 0, startedAt: null, duration: null };
  const skim   = state.skimmer  || { level: 0, startedAt: null, duration: null };
  const feeder = state.feeder   || { level: 0, startedAt: null, duration: null };
  const content = document.getElementById('life-support-content');

  // Rebuild structure only when levels change (preserves button DOM nodes between frames)
  if (aer.level !== _lsAerLevel || skim.level !== _lsSkimLevel || feeder.level !== _lsFeederLevel) {
    content.innerHTML =
      buildLsPanel('aer',    '💨 Automated Aeration', AERATION_LEVELS, aer)    +
      buildLsPanel('skim',   '🧹 Automated Skimmer',  SKIMMER_LEVELS,  skim)   +
      buildLsPanel('feeder', '🍽️ Automated Feeder',   FEEDER_LEVELS,   feeder);
    _lsAerLevel    = aer.level;
    _lsSkimLevel   = skim.level;
    _lsFeederLevel = feeder.level;

    document.getElementById('ls-btn-aer').addEventListener('click', () => {
      const nextLevel = state.aeration.level + 1;
      if (nextLevel > 5) return;
      const cost = AERATION_LEVELS[nextLevel].upgradeCost;
      if ((state.currency || 0) < cost) return;
      state.currency -= cost;
      state.aeration.level = nextLevel;
      const lvl = AERATION_LEVELS[nextLevel];
      state.aeration.startedAt = Date.now();
      state.aeration.duration  = randRange(lvl.durationMin, lvl.durationMax);
      generateBubbles(AERATION_BUBBLE_COUNTS[nextLevel]);
      addXP(10);
      addLog(`💨 Aeration upgraded to ${lvl.name}!`);
      addNotification(`💨 ${lvl.name} aeration active!`);
    });

    document.getElementById('ls-btn-skim').addEventListener('click', () => {
      const nextLevel = state.skimmer.level + 1;
      if (nextLevel > 5) return;
      const cost = SKIMMER_LEVELS[nextLevel].upgradeCost;
      if ((state.currency || 0) < cost) return;
      state.currency -= cost;
      state.skimmer.level = nextLevel;
      const lvl = SKIMMER_LEVELS[nextLevel];
      state.skimmer.startedAt = Date.now();
      state.skimmer.duration  = randRange(lvl.durationMin, lvl.durationMax);
      addXP(10);
      addLog(`🧹 Skimmer upgraded to ${lvl.name}!`);
      addNotification(`🧹 ${lvl.name} skimmer active!`);
    });

    document.getElementById('ls-btn-feeder').addEventListener('click', () => {
      const nextLevel = state.feeder.level + 1;
      if (nextLevel > 5) return;
      const cost = FEEDER_LEVELS[nextLevel].upgradeCost;
      if ((state.currency || 0) < cost) return;
      state.currency -= cost;
      state.feeder.level = nextLevel;
      const lvl = FEEDER_LEVELS[nextLevel];
      state.feeder.startedAt = Date.now();
      state.feeder.duration  = randRange(lvl.durationMin, lvl.durationMax);
      addXP(10);
      addLog(`🍽️ Feeder upgraded to ${lvl.name}!`);
      addNotification(`🍽️ ${lvl.name} feeder active!`);
    });
  }

  // Update dynamic parts every frame (timers, bar widths, button enabled state)
  function updatePanel(prefix, cur, levels) {
    const nextLevel = cur.level + 1;
    document.getElementById(`ls-btn-${prefix}`).disabled =
      nextLevel > 5 || currency < (levels[nextLevel]?.upgradeCost ?? Infinity);
    let timerText = '—', barPct = 0;
    if (cur.level > 0 && cur.startedAt != null) {
      const elapsed = (now - cur.startedAt) * (debugMode ? debugSpeed : 1);
      const rem = Math.max(0, cur.duration - elapsed);
      timerText = fmtAge(rem);
      barPct = (rem / cur.duration) * 100;
    }
    document.getElementById(`ls-timer-${prefix}`).textContent = timerText;
    document.getElementById(`ls-bar-${prefix}`).style.width   = barPct + '%';
  }

  updatePanel('aer',    aer,    AERATION_LEVELS);
  updatePanel('skim',   skim,   SKIMMER_LEVELS);
  updatePanel('feeder', feeder, FEEDER_LEVELS);
}

const moltEls = {};

function renderMolts() {
  const container = document.getElementById('monkey-container');
  if (!state.molts) state.molts = [];

  const now = Date.now();

  // Remove DOM elements for molts no longer in state
  const moltIds = new Set(state.molts.map(mo => mo.id));
  for (const id of Object.keys(moltEls)) {
    if (!moltIds.has(Number(id))) {
      moltEls[id].remove();
      delete moltEls[id];
    }
  }

  for (const molt of state.molts) {
    const age = now - molt.createdAt;

    // Create element on first render
    if (!moltEls[molt.id]) {
      const el = document.createElement('div');
      el.className = 'molt';
      el.title = `${molt.monkeyName}'s shed skin — click to remove`;
      el.textContent = molt.emoji;
      el.style.left = molt.x + 'px';
      el.style.top  = molt.y + 'px';
      el.addEventListener('click', () => {
        const reward = { egg: 1, baby: 2, juvenile: 3 }[molt.fromStage] || 0;
        if (reward) {
          state.currency = (state.currency || 0) + reward;
          addXP(2);
          addNotification(`£${reward} collected!`);
        }
        state.molts = state.molts.filter(mo => mo.id !== molt.id);
      });
      container.appendChild(el);
      moltEls[molt.id] = el;

      // Float to surface after one paint cycle so transition fires
      requestAnimationFrame(() => requestAnimationFrame(() => {
        if (!moltEls[molt.id]) return;
        el.style.top = molt.surfaceY + 'px';
      }));

      // Start bobbing once the float transition finishes (~2s)
      setTimeout(() => {
        if (moltEls[molt.id]) el.classList.add('molt-bobbing');
      }, 2200);
    }

    const el = moltEls[molt.id];
    if (!el || el.classList.contains('molt-dissolving')) continue;

    // Dissolve after 10 seconds
    if (age >= 10000) {
      el.classList.add('molt-dissolving');
      el.classList.remove('molt-bobbing');
      setTimeout(() => {
        state.molts = state.molts.filter(mo => mo.id !== molt.id);
        state.tank.cleanliness = Math.max(0, state.tank.cleanliness - 2);
        addLog(`🌊 A shed skin dissolved, dirtying the water.`);
      }, 1500);
    }
  }
}

function renderAll() {
  const now = performance.now();
  if (fpsLastTime) {
    renderDt = now - fpsLastTime;
  }
  fpsLastTime = now;
  fpsFrameCount++;
  if (now - fpsWindowStart >= 1000) {
    const currentFps = fpsFrameCount;
    const el = document.getElementById('fps-value');
    if (el) el.textContent = currentFps;
    fpsFrameCount = 0;
    fpsWindowStart = now;

    if (fpsStressPopulation === null) {
      if (currentFps < 38) {
        if (fpsLowSince === null) fpsLowSince = now;
        else if (now - fpsLowSince >= 5000) {
          fpsStressPopulation = state.monkeys.length;
          state.fpsStressPop = fpsStressPopulation;
          const stressEl = document.getElementById('fps-stress-pop');
          if (stressEl) stressEl.textContent = fpsStressPopulation;
        }
      } else {
        fpsLowSince = null;
      }
    }
  }

  renderHeader();
  renderTankLevel();
  renderSetupSection();
  renderGauges();
  renderPopulationCounts();
  renderMonkeys();
  renderMolts();
  renderLifeSupport();
  renderInventory();
  renderDebugPanel();
  renderMonkeydex();
  renderPopulation();
  renderEventLog();
  renderStatusBar();
  renderNotifications();
  renderTimerStats();
}

function renderTankLevel() {
  const xp  = state.tankXP || 0;
  const lvl = xpToLevel(xp);
  const cur = xpForLevel(lvl);
  const nxt = xpForLevel(lvl + 1);
  const pct = nxt > cur ? ((xp - cur) / (nxt - cur)) * 100 : 100;
  document.getElementById('tank-level-val').textContent = lvl;
  document.getElementById('tank-xp-bar').style.width = pct.toFixed(1) + '%';
  document.getElementById('tank-xp-label').textContent =
    `${Math.floor(xp - cur)} / ${nxt - cur} XP`;
}

function renderHeader() {
  const alive = state.monkeys.filter(m => m.alive);
  document.getElementById('stat-pop').textContent  = alive.length;
  document.getElementById('stat-gen').textContent  = state.stats.totalGenerations;
  document.getElementById('stat-born').textContent = state.stats.totalBorn;
  document.getElementById('stat-died').textContent = state.stats.totalDied;
}

function renderSetupSection() {
  const t = state.tank;
  const overlay    = document.getElementById('tank-overlay');
  const overlayBtn = document.getElementById('overlay-btn-water');
  const countdown  = document.getElementById('purify-countdown');
  const progressEl = document.getElementById('purify-progress');
  const barEl      = document.getElementById('purify-bar');

  if (t.eggsAdded) {
    overlay.style.display = 'none';
  } else if (t.waterPure) {
    overlay.style.display = 'flex';
    countdown.style.display = 'none';
    progressEl.style.display = 'none';
    document.getElementById('overlay-emoji').textContent = '🥚';
    overlay.querySelector('h2').textContent = 'Water is Pure!';
    overlay.querySelector('p').textContent = 'Your tank is ready. Release your sea monkey eggs to begin!';
    overlayBtn.textContent = '🥚 Release Eggs';
    overlayBtn.style.display = '';
    overlayBtn.onclick = () => releaseEggs();
  } else if (t.purifying) {
    overlay.style.display = 'flex';
    document.getElementById('overlay-emoji').textContent = '💧';
    overlay.querySelector('h2').textContent = 'Purifying Water...';
    overlay.querySelector('p').textContent = 'Your tank water is being purified. Check back soon!';
    overlayBtn.style.display = 'none';
    const elapsed = Date.now() - t.purifyStartTime;
    const effectiveElapsed = debugMode ? elapsed * debugSpeed : elapsed;
    const remaining = Math.max(0, t.purifyDuration - effectiveElapsed);
    const pct = Math.min(100, (effectiveElapsed / t.purifyDuration) * 100);
    const secs = Math.ceil(remaining / 1000);
    const mins = Math.floor(secs / 60);
    const s = secs % 60;
    countdown.style.display = 'block';
    progressEl.style.display = 'block';
    countdown.textContent = `${mins}:${String(s).padStart(2,'0')} remaining`;
    barEl.style.width = pct + '%';
  } else {
    overlay.style.display = 'flex';
    countdown.style.display = 'none';
    progressEl.style.display = 'none';
    document.getElementById('overlay-emoji').textContent = '🌊';
    overlay.querySelector('h2').textContent = 'Your Tank is Empty';
    overlay.querySelector('p').textContent = 'Add a water packet to begin purification, then release your sea monkey eggs!';
    overlayBtn.textContent = '💧 Add Water Packet';
    overlayBtn.style.display = '';
    overlayBtn.onclick = () => addWater();
  }

  const hasLife = t.eggsAdded;
  document.getElementById('btn-feed').disabled   = !hasLife;
  document.getElementById('btn-aerate').disabled = !hasLife;
  document.getElementById('btn-clean').disabled  = !hasLife;
}

function renderGauges() {
  const t = state.tank;
  const pairs = [
    ['food-bar',   'food-val',   t.food, getMaxFood()],
    ['oxygen-bar', 'oxygen-val', t.oxygen, getMaxOxygen()],
    ['clean-bar',  'clean-val',  t.cleanliness, getMaxCleanliness()],
  ];
  for (const [barId, valId, val, max] of pairs) {
    const bar = document.getElementById(barId);
    const valEl = document.getElementById(valId);
    const cap = max || 100;
    bar.style.width = Math.min(100, (val / cap) * 100).toFixed(1) + '%';
    valEl.textContent = val.toFixed(0);
    if (val < 30) {
      bar.classList.add('danger');
    } else {
      bar.classList.remove('danger');
    }
  }
}

function renderPopulationCounts() {
  const alive = state.monkeys.filter(m => m.alive);
  document.getElementById('cnt-eggs').textContent      = alive.filter(m => m.stage === 'egg').length;
  document.getElementById('cnt-babies').textContent    = alive.filter(m => m.stage === 'baby').length;
  document.getElementById('cnt-juveniles').textContent = alive.filter(m => m.stage === 'juvenile').length;
  document.getElementById('cnt-adults').textContent    = alive.filter(m => m.stage === 'adult').length;
}

function getMonkeyEmoji(m) {
  if (!m.alive) return '💀';
  switch (m.stage) {
    case 'egg':      return '🥚';
    case 'baby':     return '🐠';
    case 'juvenile': return '🐟';
    case 'adult':    return '🦐';
    default:         return '🦐';
  }
}

// Monkey DOM elements keyed by id
const monkeyEls = {};

function renderMonkeys() {
  const container = document.getElementById('monkey-container');
  const tankRect   = document.getElementById('tank').getBoundingClientRect();
  const W = tankRect.width  || 560;
  const H = tankRect.height || 490;

  // Remove DOM els for monkeys no longer in state
  const stateIds = new Set(state.monkeys.map(m => m.id));
  for (const id of Object.keys(monkeyEls)) {
    if (!stateIds.has(Number(id))) {
      monkeyEls[id].remove();
      delete monkeyEls[id];
    }
  }

  for (const m of state.monkeys) {
    let el = monkeyEls[m.id];
    if (!el) {
      el = document.createElement('div');
      el.className = 'monkey';
      el.dataset.id = m.id;

      m._x = ((m.id * 137) % Math.max(1, W - 60)) + 10;
      m._y = ((m.id * 97)  % Math.max(1, H - 60)) + 10;
      m._targetX = 10 + Math.random() * Math.max(1, W - 60);
      m._targetY = 10 + Math.random() * Math.max(1, H - 60);
      m._phase = Math.random() * Math.PI * 2;

      const emojiSpan = document.createElement('span');
      emojiSpan.className = 'monkey-emoji';
      emojiSpan.style.display = 'inline-block';
      el.appendChild(emojiSpan);

      const tip = document.createElement('div');
      tip.className = 'monkey-tooltip';
      el.appendChild(tip);

      container.appendChild(el);
      monkeyEls[m.id] = el;
    }

    // Update class
    el.className = 'monkey ' + (m.alive ? m.stage : 'dead');
    if (m.pregnant) el.className += ' pregnant';

    // Tail shape determines emoji rendering
    const tailCode = m.dna ? resolveAllele(m.dna.tail_shape, 'tail_shape') : 'T_STD';
    const baseEmoji = getMonkeyEmoji(m);
    const emojiSpan = el.querySelector('.monkey-emoji');
    if (emojiSpan) {
      emojiSpan.textContent = (tailCode === 'T_DBL' && m.alive) ? baseEmoji + baseEmoji : baseEmoji;
      if (tailCode === 'T_FAN' && m.alive) {
        const baseSizes = { egg: 18, baby: 16, juvenile: 19, adult: 22, dead: 18 };
        emojiSpan.style.fontSize = ((baseSizes[m.stage] || 20) + 4) + 'px';
      } else {
        emojiSpan.style.fontSize = '';
      }
    }

    // Phenotype visuals
    const phenotype = m.dna ? resolveColorPhenotype(m.dna.body_color) : 'C_PINK';
    const def = PHENOTYPE_DEFS[phenotype];
    if (emojiSpan) {
      if (def?.opacity) {
        el.style.filter      = '';
        el.style.textShadow  = '';
        emojiSpan.style.filter  = def.filterStr || '';
        emojiSpan.style.opacity = String(def.opacity);
      } else {
        el.style.filter      = def?.filterStr || '';
        el.style.textShadow  = def?.shadow    || '';
        emojiSpan.style.filter  = '';
        emojiSpan.style.opacity = '';
      }
    }

    // Tooltip
    const stats = resolveStats(m);
    const tip = el.querySelector('.monkey-tooltip');
    if (tip) {
      const filled = Math.round((m.health / stats.maxHealth) * 10);
      const healthBar = '█'.repeat(Math.max(0, filled)) + '░'.repeat(Math.max(0, 10 - filled));
      const hasMagnifier = state.magnifyingGlassMode && state.inventory.magnifyingGlass > 0;
      let geneInfo = '';
      if (m.dna) {
        if (hasMagnifier) {
          geneInfo = ' | ' + genotypeString(m.dna);
        } else {
          const phen = resolveColorPhenotype(m.dna.body_color);
          const pdef = PHENOTYPE_DEFS[phen];
          const parts = [pdef?.name || phen];
          const findName = (geneId, code) => GENE_DATA.find(g => g.id === geneId).alleles.find(a => a.code === code).name;
          const metCode2  = resolveAllele(m.dna.metabolism,   'metabolism');
          const conCode2  = resolveAllele(m.dna.constitution, 'constitution');
          const lonCode2  = resolveAllele(m.dna.longevity,    'longevity');
          const tailCode2 = resolveAllele(m.dna.tail_shape,   'tail_shape');
          if (metCode2  !== 'M_NRM') parts.push(findName('metabolism',   metCode2));
          if (conCode2  !== 'H_AVG') parts.push(findName('constitution', conCode2));
          if (lonCode2  !== 'L_STD') parts.push(findName('longevity',    lonCode2));
          if (tailCode2 !== 'T_STD') parts.push(findName('tail_shape',   tailCode2));
          if (stats.isFF) parts.push('Filter Feeder');
          geneInfo = ' | ' + parts.join(', ');
        }
      }
      tip.textContent = `${m.name} (${m.sex}) | ❤ ${healthBar} | Gen ${m.generation}${m.pregnant ? ' | 🤰' : ''}${geneInfo}`;
    }

    // Ensure wander state exists (for monkeys loaded from save)
    if (m._x === undefined) {
      m._x = ((m.id * 137) % Math.max(1, W - 60)) + 10;
      m._y = ((m.id * 97)  % Math.max(1, H - 60)) + 10;
      m._targetX = 10 + Math.random() * Math.max(1, W - 60);
      m._targetY = 10 + Math.random() * Math.max(1, H - 60);
      m._phase = Math.random() * Math.PI * 2;
    }

    if (!m.alive) {
      if (!el._fell) {
        el._fell = true;
        el.style.transition = 'top 1.5s ease-in, transform 1.5s ease-in';
        el.style.top  = (H - 38) + 'px';
        el.style.transform = 'rotate(90deg)';
      }
      if (emojiSpan) emojiSpan.style.transform = '';
    } else {
      el.style.transition = '';
      el.style.transform  = '';

      const baseSpeeds = { egg: 0, baby: 40, juvenile: 55, adult: 70 }; // px/sec
      const speed = (baseSpeeds[m.stage] || 0) * stats.moveSpeed * (stats.isFF ? 0.5 : 1);
      const dt = renderDt / 1000; // seconds

      if (speed > 0) {
        const dx = m._targetX - m._x;
        const dy = m._targetY - m._y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < 18) {
          m._targetX = 20 + Math.random() * (W - 70);
          m._targetY = 20 + Math.random() * (H - 70);
        } else {
          const nx = dx / dist;
          const ny = dy / dist;
          m._x += nx * speed * dt;
          m._y += ny * speed * dt;

          m._phase = ((m._phase || 0) + 1.8 * dt) % (2 * Math.PI);
          const wobble = Math.sin(m._phase) * 7;
          const finalX = Math.max(0, Math.min(W - 32, m._x + (-ny) * wobble));
          const finalY = Math.max(0, Math.min(H - 32, m._y + nx * wobble));
          el.style.left = finalX + 'px';
          el.style.top  = finalY + 'px';

          if (emojiSpan) emojiSpan.style.transform = nx > 0 ? 'scaleX(-1)' : '';
        }
      } else {
        el.style.left = (m._x || 50) + 'px';
        el.style.top  = (m._y || 50) + 'px';
        if (emojiSpan) emojiSpan.style.transform = '';
      }
    }
  }
}

function renderEventLog() {
  const container = document.getElementById('event-log');
  const entries = state.log;
  if (!entries.length) {
    container.innerHTML = '<div class="log-entry" style="color:#3a6a8a">Nothing yet...</div>';
    return;
  }
  const firstEntry = entries[0];
  if (container._lastTop === firstEntry.msg + firstEntry.time) return;
  container._lastTop = firstEntry.msg + firstEntry.time;

  container.innerHTML = entries.map((e, i) =>
    `<div class="log-entry ${i === 0 && e.isNew ? 'new' : ''}">
      <span class="log-time">${e.time}</span> ${e.msg}
    </div>`
  ).join('');
  entries.forEach(e => { e.isNew = false; });
}

function renderStatusBar() {
  const bar = document.getElementById('statusbar');
  const msg = document.getElementById('status-msg');
  const t = state.tank;
  const alive = state.monkeys.filter(m => m.alive);

  bar.className = '';

  if (!t.waterAdded) {
    msg.textContent = 'Add a water packet to get started.';
    return;
  }
  if (t.purifying) {
    msg.textContent = 'Water is purifying... please wait.';
    return;
  }
  if (t.waterPure && !t.eggsAdded) {
    msg.textContent = '✨ Water is pure! Release your eggs to begin.';
    return;
  }
  if (!alive.length) {
    msg.textContent = alive.length === 0 && state.stats.totalBorn > 0
      ? '😢 All sea monkeys have died. Release more eggs to try again.'
      : 'Waiting for eggs to hatch...';
    return;
  }

  if (t.oxygen <= 0) {
    bar.className = 'danger';
    msg.textContent = '🚨 NO OXYGEN! Sea monkeys are suffocating! Aerate now!';
    return;
  }
  if (t.food <= 0) {
    bar.className = 'danger';
    msg.textContent = '🚨 NO FOOD! Sea monkeys are starving! Feed now!';
    return;
  }
  if (t.oxygen < 20 || t.food < 20 || t.cleanliness < 20) {
    bar.className = 'warning';
    const warns = [];
    if (t.oxygen < 20)      warns.push('oxygen low');
    if (t.food < 20)        warns.push('food low');
    if (t.cleanliness < 20) warns.push('tank dirty');
    msg.textContent = '⚠️ Warning: ' + warns.join(', ') + '!';
    return;
  }

  const adults = alive.filter(m => m.stage === 'adult').length;
  const pregnant = alive.filter(m => m.pregnant).length;
  if (pregnant > 0) {
    msg.textContent = `🤰 ${pregnant} female${pregnant > 1 ? 's are' : ' is'} pregnant! Babies incoming...`;
  } else if (adults > 1) {
    msg.textContent = `🦐 ${alive.length} sea monkeys are thriving! Population: ${alive.length}`;
  } else {
    msg.textContent = `🌊 Sea monkeys are growing... current population: ${alive.length}`;
  }
}

function renderNotifications() {
  const container = document.getElementById('notifications');
  const now = Date.now();
  notifications = notifications.filter(n => now - n.createdAt < 3000);
  container.innerHTML = notifications.map(n =>
    `<div class="notif">${n.msg}</div>`
  ).join('');
}

function addNotification(msg) {
  notifications.push({ msg, createdAt: Date.now() });
}

function spawnFoodFlakes() {
  const tank = document.getElementById('tank');
  const flakeChars = ['·', '•', '·', '•', '✦'];
  for (let i = 0; i < 12; i++) {
    const f = document.createElement('div');
    f.className = 'food-flake';
    f.textContent = flakeChars[Math.floor(Math.random() * flakeChars.length)];
    f.style.left = (10 + Math.random() * 75) + '%';
    f.style.top  = (2 + Math.random() * 15) + '%';
    f.style.animationDuration = (2.5 + Math.random() * 2) + 's';
    f.style.animationDelay    = (Math.random() * 0.8) + 's';
    tank.appendChild(f);
    setTimeout(() => f.remove(), 5500);
  }
}

// ─────────────────────────────────────────────
// 12. INVENTORY ITEM ACTIONS
// ─────────────────────────────────────────────

function useLifeBooster() {
  if (state.inventory.lifeBooster <= 0) return;
  const adults = state.monkeys.filter(m => m.alive && m.stage === 'adult');
  if (adults.length === 0) {
    addNotification('🧪 No adults to boost!');
    return;
  }
  const bonus = 10 * 60 * 1000; // +10 minutes
  adults.forEach(m => { m.stageDuration += bonus; });
  state.inventory.lifeBooster--;
  addXP(5);
  addLog(`🧪 Life Booster used! ${adults.length} adult${adults.length > 1 ? 's' : ''} gained +10 min lifespan`);
  addNotification('🧪 Life Boosted!');
  saveState();
}

function useGlowingFlakes() {
  if (state.inventory.glowingFlakes <= 0) return;
  if (!state.tank.eggsAdded) { addNotification('✨ Release eggs first!'); return; }
  state.glowingFlakesActive = true;
  state.inventory.glowingFlakes--;
  addXP(5);
  addLog('✨ Glowing Flakes activated! Next birth has 10× mutation rates. (parents will take damage)');
  addNotification('✨ Glowing Flakes active!');
  saveState();
}

function toggleMagnifyingGlass() {
  if (state.inventory.magnifyingGlass <= 0) return;
  state.magnifyingGlassMode = !state.magnifyingGlassMode;
  addNotification(state.magnifyingGlassMode ? '🔍 Genotype view ON' : '🔍 Phenotype view');
  saveState();
}

function useBoosterEggPack() {
  if (state.inventory.boosterEggPack <= 0) return;
  if (!state.tank.eggsAdded) {
    addNotification('🥚 Release eggs first!');
    return;
  }
  const count = 5 + Math.floor(Math.random() * 4); // 5-8 eggs
  for (let i = 0; i < count; i++) createMonkey({ stage: 'egg', generation: state.stats.totalGenerations });
  state.inventory.boosterEggPack--;
  addXP(5);
  addLog(`🥚 Booster Egg Pack used! ${count} new eggs added to the tank`);
  addNotification(`🥚 +${count} eggs!`);
  saveState();
}

function renderInventory() {
  const inv = state.inventory;
  const hasLife = state.tank.eggsAdded;

  document.getElementById('currency-balance').textContent = `£${(state.currency || 0).toLocaleString()}`;

  document.getElementById('inv-life-booster-cnt').textContent = inv.lifeBooster;
  document.getElementById('inv-egg-pack-cnt').textContent     = inv.boosterEggPack;
  document.getElementById('btn-use-life-booster').disabled = inv.lifeBooster <= 0 || !hasLife;
  document.getElementById('btn-use-egg-pack').disabled     = inv.boosterEggPack <= 0 || !hasLife;

  document.getElementById('inv-glowing-flakes-cnt').textContent = inv.glowingFlakes;
  document.getElementById('btn-use-glowing-flakes').disabled = inv.glowingFlakes <= 0 || !hasLife;
  const flakesBadge = document.getElementById('glowing-flakes-active-badge');
  if (flakesBadge) flakesBadge.style.display = state.glowingFlakesActive ? '' : 'none';

  document.getElementById('inv-magnifying-glass-cnt').textContent = inv.magnifyingGlass;
  const mgBtn = document.getElementById('btn-toggle-magnifying-glass');
  mgBtn.disabled = inv.magnifyingGlass <= 0;
  mgBtn.textContent = state.magnifyingGlassMode ? '🔍 Genotype ON' : '🔍 Phenotype';
  mgBtn.classList.toggle('debug-active', state.magnifyingGlassMode);
}

function spawnBurstBubbles() {
  const tank = document.getElementById('tank');
  for (let i = 0; i < 25; i++) {
    const b = document.createElement('div');
    b.className = 'burst-bubble';
    const size = 5 + Math.random() * 14;
    b.style.width  = size + 'px';
    b.style.height = size + 'px';
    b.style.left   = (5 + Math.random() * 90) + '%';
    b.style.bottom = (2 + Math.random() * 20) + '%';
    b.style.animationDuration = (0.8 + Math.random() * 1.5) + 's';
    b.style.animationDelay    = (Math.random() * 0.4) + 's';
    tank.appendChild(b);
    setTimeout(() => b.remove(), 3500);
  }
}

// ─────────────────────────────────────────────
// 13. UI EVENT LISTENERS
// ─────────────────────────────────────────────

function addWater() {
  if (state.tank.waterAdded) return;
  state.tank.waterAdded = true;
  state.tank.purifying = true;
  state.tank.purifyStartTime = Date.now();
  addLog('💧 Water packet added. Purifying...');
  addNotification('💧 Purification started! (~2 min)');
  saveState();
}

function releaseEggs() {
  if (!state.tank.waterPure || state.tank.eggsAdded) return;
  state.tank.eggsAdded = true;
  state.gameStarted = true;
  state.lastTick = Date.now();

  const count = 3 + Math.floor(Math.random() * 3); // 3-5 eggs
  for (let i = 0; i < count; i++) {
    createMonkey({ stage: 'egg', generation: 1 });
  }
  addLog(`🥚 Released ${count} sea monkey eggs into the tank!`);
  addNotification(`🥚 ${count} eggs released!`);
  saveState();
}

function setupEventListeners() {
  document.getElementById('btn-use-life-booster').addEventListener('click', useLifeBooster);
  document.getElementById('btn-use-egg-pack').addEventListener('click', useBoosterEggPack);
  document.getElementById('btn-use-glowing-flakes').addEventListener('click', useGlowingFlakes);
  document.getElementById('btn-toggle-magnifying-glass').addEventListener('click', toggleMagnifyingGlass);

  // Monkeydex modal
  document.getElementById('btn-dex').addEventListener('click', (e) => {
    e.stopPropagation();
    document.getElementById('monkeydex-modal').classList.toggle('open');
  });
  document.getElementById('monkeydex-close').addEventListener('click', () => {
    document.getElementById('monkeydex-modal').classList.remove('open');
  });
  document.getElementById('monkeydex-modal').addEventListener('click', (e) => {
    if (e.target === document.getElementById('monkeydex-modal')) {
      document.getElementById('monkeydex-modal').classList.remove('open');
    }
  });

  document.getElementById('btn-save').addEventListener('click', () => {
    saveState();
    addNotification('💾 Saved!');
  });

  document.getElementById('btn-reload').addEventListener('click', () => {
    location.reload();
  });


  document.getElementById('btn-reset').addEventListener('click', () => {
    if (!confirm('Reset the tank? All sea monkeys and progress will be lost.')) return;
    localStorage.removeItem('seamonkeyfarm_v1');
    localStorage.removeItem('seamonkeyfarm_v2');
    localStorage.removeItem('seamonkeyfarm_v3');
    state = JSON.parse(JSON.stringify(DEFAULT_STATE));
    Object.values(monkeyEls).forEach(el => el.remove());
    Object.keys(monkeyEls).forEach(k => delete monkeyEls[k]);
    Object.values(moltEls).forEach(el => el.remove());
    Object.keys(moltEls).forEach(k => delete moltEls[k]);
    notifications = [];
    addNotification('🗑️ Tank reset');
  });

  document.getElementById('btn-settings').addEventListener('click', (e) => {
    e.stopPropagation();
    document.getElementById('settings-overlay').classList.toggle('open');
  });
  document.getElementById('settings-overlay').addEventListener('click', (e) => {
    if (!document.getElementById('settings-popup').contains(e.target)) {
      document.getElementById('settings-overlay').classList.remove('open');
    }
  });

  document.getElementById('toggle-timers').addEventListener('change', (e) => {
    showTimers = e.target.checked;
  });

  document.getElementById('btn-debug').addEventListener('click', () => {
    debugMode = !debugMode;
    const btn = document.getElementById('btn-debug');
    btn.textContent = debugMode ? '🐛 On' : '🐛 Off';
    btn.classList.toggle('debug-active', debugMode);
    document.getElementById('debug-controls').style.display = debugMode ? '' : 'none';
  });

  document.getElementById('debug-speed-slider').addEventListener('input', (e) => {
    debugSpeed = Number(e.target.value);
    document.getElementById('debug-speed-label').textContent = `${debugSpeed}×`;
  });

  document.getElementById('btn-debug-give-life').addEventListener('click', () => {
    state.inventory.lifeBooster++;
    addNotification('🧪 +1 Life Booster');
  });
  document.getElementById('btn-debug-give-egg').addEventListener('click', () => {
    state.inventory.boosterEggPack++;
    addNotification('🥚 +1 Egg Pack');
  });
  document.getElementById('btn-debug-give-flakes').addEventListener('click', () => {
    state.inventory.glowingFlakes++;
    addNotification('✨ +1 Glowing Flakes');
  });

  document.getElementById('btn-debug-give-currency').addEventListener('click', () => {
    state.currency = (state.currency || 0) + 100;
    addNotification('💷 +£100');
  });

  // Debug condition locks
  const lsLockVals = ['normal', '0', '1', '2', '3', '4', '5'];
  const lockConfigs = [
    { stat: 'food',   ids: ['dbg-food-0',   'dbg-food-nrm',   'dbg-food-100'],   vals: ['0', 'normal', '100'] },
    { stat: 'oxygen', ids: ['dbg-oxygen-0', 'dbg-oxygen-nrm', 'dbg-oxygen-100'], vals: ['0', 'normal', '100'] },
    { stat: 'clean',  ids: ['dbg-clean-0',  'dbg-clean-nrm',  'dbg-clean-100'],  vals: ['0', 'normal', '100'] },
    { stat: 'aer',    ids: ['dbg-aer-nrm',  'dbg-aer-0',  'dbg-aer-1',  'dbg-aer-2',  'dbg-aer-3',  'dbg-aer-4',  'dbg-aer-5'],  vals: lsLockVals },
    { stat: 'skim',   ids: ['dbg-skim-nrm', 'dbg-skim-0', 'dbg-skim-1', 'dbg-skim-2', 'dbg-skim-3', 'dbg-skim-4', 'dbg-skim-5'], vals: lsLockVals },
    { stat: 'feeder', ids: ['dbg-feeder-nrm','dbg-feeder-0','dbg-feeder-1','dbg-feeder-2','dbg-feeder-3','dbg-feeder-4','dbg-feeder-5'], vals: lsLockVals },
  ];
  lockConfigs.forEach(({ stat, ids, vals }) => {
    ids.forEach((id, i) => {
      document.getElementById(id).addEventListener('click', () => {
        debugLocks[stat] = vals[i];
        ids.forEach((bid, j) => document.getElementById(bid).classList.toggle('debug-active', j === i));
      });
    });
  });

  // Tank tabs
  const tankTabs = ['tab-tank', 'tab-life-support', 'tab-population'];
  const tankViews = { 'tab-life-support': 'life-support-view', 'tab-population': 'population-view' };
  function switchTankTab(activeId) {
    tankTabs.forEach(id => {
      document.getElementById(id).classList.toggle('active', id === activeId);
    });
    Object.values(tankViews).forEach(vid => {
      document.getElementById(vid).classList.remove('active');
    });
    if (tankViews[activeId]) {
      document.getElementById(tankViews[activeId]).classList.add('active');
      if (activeId === 'tab-population') renderPopulation();
      if (activeId === 'tab-life-support') { _lsAerLevel = -1; _lsSkimLevel = -1; _lsFeederLevel = -1; }
    }
  }
  tankTabs.forEach(id => {
    document.getElementById(id).addEventListener('click', () => switchTankTab(id));
  });

  document.getElementById('btn-feed').addEventListener('click', () => {
    const mb = getMasteryBonuses();
    const feedAmt = ACTION_FEED_BASE + mb.feedBonus;
    state.tank.food = Math.min(getMaxFood(), state.tank.food + feedAmt);
    addXP(1);
    addLog(`🍔 Tank fed (+${feedAmt} food)`);
    addNotification('🍔 Fed!');
    spawnFoodFlakes();
    saveState();
  });

  document.getElementById('btn-aerate').addEventListener('click', () => {
    state.tank.oxygen = Math.min(getMaxOxygen(), state.tank.oxygen + ACTION_AERATE_AMT);
    addXP(1);
    addLog('💨 Tank aerated (+50 oxygen)');
    addNotification('💨 Aerated!');
    spawnBurstBubbles();
    saveState();
  });

  document.getElementById('btn-clean').addEventListener('click', () => {
    state.tank.cleanliness = Math.min(getMaxCleanliness(), state.tank.cleanliness + ACTION_CLEAN_AMT);
    const corpses = state.monkeys.filter(m => !m.alive);
    state.monkeys = state.monkeys.filter(m => m.alive);
    addXP(1);
    if (corpses.length > 0) {
      addLog(`🧹 Tank cleaned — removed ${corpses.length} dead sea monkey${corpses.length > 1 ? 's' : ''}`);
    } else {
      addLog('🧹 Tank cleaned (+40 cleanliness)');
    }
    addNotification('🧹 Cleaned!');
    saveState();
  });
}

// ─────────────────────────────────────────────
// 14. BUBBLE GENERATION + INIT
// ─────────────────────────────────────────────

const AERATION_BUBBLE_COUNTS = [5, 10, 15, 20, 25, 30];

function generateBubbles(count) {
  const tank = document.getElementById('tank');
  tank.querySelectorAll('.bubble').forEach(b => b.remove());
  const n = count ?? AERATION_BUBBLE_COUNTS[state?.aeration?.level ?? 0] ?? 5;
  for (let i = 0; i < n; i++) {
    const bubble = document.createElement('div');
    bubble.className = 'bubble';
    const size = 4 + Math.random() * 8;
    bubble.style.width  = size + 'px';
    bubble.style.height = size + 'px';
    bubble.style.left   = (5 + Math.random() * 90) + '%';
    bubble.style.animationDuration = (4 + Math.random() * 8) + 's';
    bubble.style.animationDelay    = (-Math.random() * 10) + 's';
    tank.appendChild(bubble);
  }
}

function fmtDuration(ms) {
  if (!ms || ms < 0) return '—';
  const totalSec = Math.floor(ms / 1000);
  const d = Math.floor(totalSec / 86400);
  const h = Math.floor((totalSec % 86400) / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function renderTimerStats() {
  const tankAge = (state.playTimeMs || 0) + (state.totalOfflineMs || 0);
  document.getElementById('stat-tank-age').textContent     = fmtDuration(tankAge);
  document.getElementById('stat-play-time').textContent    = fmtDuration(state.playTimeMs || 0);
  document.getElementById('stat-offline-time').textContent = fmtDuration(state.totalOfflineMs || 0);
}

function initGame() {
  state = loadState();
  if (!state.tankCreatedAt) state.tankCreatedAt = Date.now();
  if (state.fpsStressPop != null) {
    fpsStressPopulation = state.fpsStressPop;
    const el = document.getElementById('fps-stress-pop');
    if (el) el.textContent = fpsStressPopulation;
  }
  applyOfflineProgress();
  state.lastTick = Date.now();

  setupEventListeners();
  generateBubbles();

  // Tick loop: every 1000ms
  setInterval(() => {
    const now = Date.now();
    const dt = now - (state.lastTick || now);
    state.lastTick = now;
    if (state.tank.eggsAdded || state.tank.purifying) {
      gameTick(dt);
    }
  }, 1000);

  // Render loop: every 100ms
  setInterval(renderAll, 25);

  renderAll();
}

document.addEventListener('DOMContentLoaded', initGame);
