// ─────────────────────────────────────────────
// 1. CONSTANTS
// ─────────────────────────────────────────────
const PURIFY_DURATION   = 20_000;  // 2 min
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
const POP_LEVELS        = [100, 150, 200, 250, 300, 350, 400, 450, 500];  // alive monkey cap per upgrade level
const POP_UPGRADE_COSTS = [750, 1000, 1400, 1900, 2500, 3200, 4000, 5000]; // cost to reach levels 1–8
function getMaxPop(tank) { return POP_LEVELS[tank?.popLevel ?? 0]; }

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

const SNAIL_COST           = 1500;
const SNAIL_EAT_INTERVAL   = 30_000; // eat one corpse every 30s
const SNAIL_EGG_CHANCE     = 0.10;   // 10% chance per eat to accidentally snag a live egg
const HYDRA_HUNT_MIN       = 3_000;  // minimum ms between attacks
const HYDRA_HUNT_MAX       = 5_000;  // maximum ms between attacks
const HYDRA_SPAWN_CHANCE   = 0.00025;// per game-second (~66 min average between spawns)
const HYDRA_HP             = 25;     // clicks required to kill

// ── SCIENTIFIC GRANTS ─────────────────────────────────────────────────────────
// type: 'snapshot'       — progress computed live from state
// type: 'relative_count' — progress = current stat minus value at grant creation
// type: 'timer'          — accumulate qualifying ms in gameTick
const GRANT_POOL = [
  { id:'iron_gut',        title:'Pollution Study',         type:'snapshot', difficulty:1,
    desc:'Provide 3 Iron Gut adults for our toxicity research. Specimens will be collected.',
    target:3,  reward:{ cash:1500, shells:1 },
    progress:()=> state.monkeys.filter(m=> m.alive&&!m.inStorage&&m.stage==='adult'&&resolveAllele(m.dna?.constitution,'constitution')==='H_IRON').length,
    sacrifice:()=> state.monkeys.filter(m=> m.alive&&!m.inStorage&&m.stage==='adult'&&resolveAllele(m.dna?.constitution,'constitution')==='H_IRON').slice(0,3) },
  { id:'hyperactive',     title:'Velocity Trials',         type:'snapshot', difficulty:1,
    desc:'Provide 2 Hyperactive adults for our speed study. Specimens will be collected.',
    target:2,  reward:{ cash:1200, shells:1 },
    progress:()=> state.monkeys.filter(m=> m.alive&&!m.inStorage&&m.stage==='adult'&&resolveAllele(m.dna?.metabolism,'metabolism')==='M_FAST').length,
    sacrifice:()=> state.monkeys.filter(m=> m.alive&&!m.inStorage&&m.stage==='adult'&&resolveAllele(m.dna?.metabolism,'metabolism')==='M_FAST').slice(0,2) },
  { id:'filter_feeders',  title:'Biofiltration Contract',  type:'snapshot', difficulty:2,
    desc:'Provide 3 Filter Feeder adults for lab tank trials. Specimens will be collected.',
    target:3,  reward:{ cash:1800, shells:1 },
    progress:()=> state.monkeys.filter(m=> m.alive&&!m.inStorage&&m.stage==='adult'&&hasDominant(m.dna?.filt,'F')).length,
    sacrifice:()=> state.monkeys.filter(m=> m.alive&&!m.inStorage&&m.stage==='adult'&&hasDominant(m.dna?.filt,'F')).slice(0,3) },
  { id:'fan_tail',        title:'Hydrodynamics Study',     type:'snapshot', difficulty:3,
    desc:'Provide a Fan Tail sea monkey for swimming-force analysis. Specimen will be collected.',
    target:1,  reward:{ cash:900, shells:1 },
    progress:()=> state.monkeys.filter(m=> m.alive&&!m.inStorage&&resolveAllele(m.dna?.tail_shape,'tail_shape')==='T_FAN').length,
    sacrifice:()=> state.monkeys.filter(m=> m.alive&&!m.inStorage&&resolveAllele(m.dna?.tail_shape,'tail_shape')==='T_FAN').slice(0,1) },
  { id:'twin_tail',       title:'Twin Tail Specimen',      type:'snapshot', difficulty:3,
    desc:'Provide a Twin Tail sea monkey for comparative locomotion research. Specimen will be collected.',
    target:1,  reward:{ cash:1100, shells:1 },
    progress:()=> state.monkeys.filter(m=> m.alive&&!m.inStorage&&resolveAllele(m.dna?.tail_shape,'tail_shape')==='T_DBL').length,
    sacrifice:()=> state.monkeys.filter(m=> m.alive&&!m.inStorage&&resolveAllele(m.dna?.tail_shape,'tail_shape')==='T_DBL').slice(0,1) },
  { id:'ancient_one',     title:'Longevity Research',      type:'snapshot', difficulty:4,
    desc:'Discover an Ancient One for exceptional lifespan research. Specimen will be collected.',
    target:1,  reward:{ cash:2000, shells:3 },
    progress:()=> state.monkeys.filter(m=> m.alive&&!m.inStorage&&resolveAllele(m.dna?.longevity,'longevity')==='L_ANC').length,
    sacrifice:()=> state.monkeys.filter(m=> m.alive&&!m.inStorage&&resolveAllele(m.dna?.longevity,'longevity')==='L_ANC').slice(0,1) },
  { id:'purple_specimen', title:'Chromatic Anomaly',       type:'snapshot', difficulty:4,
    desc:'Provide a rare Purple sea monkey for pigmentation study. Specimen will be collected.',
    target:1,  reward:{ cash:2000, shells:2 },
    progress:()=> state.monkeys.filter(m=> m.alive&&!m.inStorage&&resolveColorPhenotype(m.dna?.body_color)==='purple').length,
    sacrifice:()=> state.monkeys.filter(m=> m.alive&&!m.inStorage&&resolveColorPhenotype(m.dna?.body_color)==='purple').slice(0,1) },
  { id:'bioluminescent',  title:'Deep-Sea Glow Project',   type:'snapshot', difficulty:6,
    desc:'Provide a Bioluminescent sea monkey for light-organ analysis. Specimen will be collected.',
    target:1,  reward:{ cash:2500, shells:3 },
    progress:()=> state.monkeys.filter(m=> m.alive&&!m.inStorage&&resolveColorPhenotype(m.dna?.body_color)==='C_BIO').length,
    sacrifice:()=> state.monkeys.filter(m=> m.alive&&!m.inStorage&&resolveColorPhenotype(m.dna?.body_color)==='C_BIO').slice(0,1) },
  { id:'void_black',      title:'Void Specimen Needed',    type:'snapshot', difficulty:8,
    desc:'Provide a Void Black sea monkey for optical absorption tests. Specimen will be collected.',
    target:1,  reward:{ cash:3000, shells:5 },
    progress:()=> state.monkeys.filter(m=> m.alive&&!m.inStorage&&resolveColorPhenotype(m.dna?.body_color)==='C_VOID').length,
    sacrifice:()=> state.monkeys.filter(m=> m.alive&&!m.inStorage&&resolveColorPhenotype(m.dna?.body_color)==='C_VOID').slice(0,1) },
  { id:'fan_and_green',   title:'Compound Specimen',       type:'snapshot', difficulty:6,
    desc:'Provide a sea monkey with Fan Tail AND Algae Green colouration. Specimen will be collected.',
    target:1,  reward:{ cash:2500, shells:4 },
    progress:()=> state.monkeys.filter(m=>
      m.alive&&!m.inStorage&&
      resolveAllele(m.dna?.tail_shape,'tail_shape')==='T_FAN'&&
      resolveColorPhenotype(m.dna?.body_color)==='C_GRN').length,
    sacrifice:()=> state.monkeys.filter(m=>
      m.alive&&!m.inStorage&&
      resolveAllele(m.dna?.tail_shape,'tail_shape')==='T_FAN'&&
      resolveColorPhenotype(m.dna?.body_color)==='C_GRN').slice(0,1) },
  { id:'colony_size',     title:'Colony Census',           type:'snapshot', difficulty:2,
    desc:'Grow a single tank to 20 living sea monkeys.',
    target:20, reward:{ cash:1000, shells:1 },
    progress:()=> Math.max(0,...state.tanks.map(t=> state.monkeys.filter(m=> m.alive&&!m.inStorage&&m.tankId===t.id).length)) },
  { id:'big_adults',      title:'Adult Survey',            type:'snapshot', difficulty:3,
    desc:'Maintain 10 adult sea monkeys across all your tanks.',
    target:10, reward:{ cash:2000, shells:2 },
    progress:()=> state.monkeys.filter(m=> m.alive&&!m.inStorage&&m.stage==='adult').length },
  { id:'generation_climb',title:'Generational Study',      type:'relative_count', difficulty:9,
    desc:'Breed 3 new generations from the point this grant was issued.',
    target:3,  reward:{ cash:5500, shells:3 },
    progress:(g)=> Math.max(0, state.stats.totalGenerations-(g.baseValue??state.stats.totalGenerations)) },
  { id:'hatch_quota',     title:'Egg Hatching Quota',      type:'relative_count', difficulty:2,
    desc:'Hatch 20 eggs for population density research.',
    target:20, reward:{ cash:1000, shells:1 },
    progress:(g)=> Math.max(0, state.stats.totalBorn-(g.baseValue??state.stats.totalBorn)) },
  { id:'survival_study',  title:'Survivability Study',     type:'timer', difficulty:3,
    desc:'Keep your tanks running with no deaths for 5 minutes straight.',
    target:5*60_000, reward:{ cash:2500, shells:2 },
    progress:(g)=> g.accumMs||0 },
  { id:'water_quality',   title:'Optimal Conditions Trial',type:'timer', difficulty:2,
    desc:'Keep food, oxygen & cleanliness all above 70% for 3 minutes in any tank.',
    target:3*60_000, reward:{ cash:2000, shells:1 },
    progress:(g)=> g.accumMs||0 },
  { id:'golden_one',      title:'Midas Project',           type:'snapshot', difficulty:5,
    desc:'Provide a Midas Gold sea monkey for precious metal research. Specimen will be collected.',
    target:1,  reward:{ cash:2500, shells:4 },
    progress:()=> state.monkeys.filter(m=> m.alive&&!m.inStorage&&resolveColorPhenotype(m.dna?.body_color)==='C_GOLD').length,
    sacrifice:()=> state.monkeys.filter(m=> m.alive&&!m.inStorage&&resolveColorPhenotype(m.dna?.body_color)==='C_GOLD').slice(0,1) },
  { id:'sloth_squad',     title:'Torpor Study',            type:'snapshot', difficulty:2,
    desc:'Provide 3 Sloth Mode adults for metabolic efficiency research. Specimens will be collected.',
    target:3,  reward:{ cash:2200, shells:2 },
    progress:()=> state.monkeys.filter(m=> m.alive&&!m.inStorage&&m.stage==='adult'&&resolveAllele(m.dna?.metabolism,'metabolism')==='M_SLOW').length,
    sacrifice:()=> state.monkeys.filter(m=> m.alive&&!m.inStorage&&m.stage==='adult'&&resolveAllele(m.dna?.metabolism,'metabolism')==='M_SLOW').slice(0,3) },
  { id:'twin_tail_trio',  title:'Triple Fin Exhibition',   type:'snapshot', difficulty:5,
    desc:'Provide 3 Twin Tail sea monkeys for our locomotion collection. Specimens will be collected.',
    target:3,  reward:{ cash:2800, shells:3 },
    progress:()=> state.monkeys.filter(m=> m.alive&&!m.inStorage&&resolveAllele(m.dna?.tail_shape,'tail_shape')==='T_DBL').length,
    sacrifice:()=> state.monkeys.filter(m=> m.alive&&!m.inStorage&&resolveAllele(m.dna?.tail_shape,'tail_shape')==='T_DBL').slice(0,3) },
  { id:'purple_duo',      title:'Double Chromatic Anomaly',type:'snapshot', difficulty:6,
    desc:'Provide 2 Purple sea monkeys for pigmentation analysis. Specimens will be collected.',
    target:2,  reward:{ cash:3500, shells:4 },
    progress:()=> state.monkeys.filter(m=> m.alive&&!m.inStorage&&resolveColorPhenotype(m.dna?.body_color)==='purple').length,
    sacrifice:()=> state.monkeys.filter(m=> m.alive&&!m.inStorage&&resolveColorPhenotype(m.dna?.body_color)==='purple').slice(0,2) },
  { id:'bio_and_void',    title:'Light & Dark Contrast',   type:'snapshot', difficulty:9,
    desc:'Provide both a Bioluminescent and a Void Black sea monkey. Both specimens will be collected.',
    target:2,  reward:{ cash:5000, shells:6 },
    progress:()=> (state.monkeys.some(m=>m.alive&&!m.inStorage&&resolveColorPhenotype(m.dna?.body_color)==='C_BIO')?1:0)
               +(state.monkeys.some(m=>m.alive&&!m.inStorage&&resolveColorPhenotype(m.dna?.body_color)==='C_VOID')?1:0),
    sacrifice:()=> [
      state.monkeys.find(m=>m.alive&&!m.inStorage&&resolveColorPhenotype(m.dna?.body_color)==='C_BIO'),
      state.monkeys.find(m=>m.alive&&!m.inStorage&&resolveColorPhenotype(m.dna?.body_color)==='C_VOID'),
    ].filter(Boolean) },
  { id:'mega_colony',     title:'Population Surge',        type:'snapshot', difficulty:5,
    desc:'Grow a single tank to 30 living sea monkeys.',
    target:30, reward:{ cash:2000, shells:2 },
    progress:()=> Math.max(0,...state.tanks.map(t=> state.monkeys.filter(m=> m.alive&&!m.inStorage&&m.tankId===t.id).length)) },
  { id:'filter_army',     title:'Biofiltration Fleet',     type:'snapshot', difficulty:4,
    desc:'Provide 6 Filter Feeder adults for large-scale lab trials. Specimens will be collected.',
    target:6,  reward:{ cash:3500, shells:3 },
    progress:()=> state.monkeys.filter(m=> m.alive&&!m.inStorage&&m.stage==='adult'&&hasDominant(m.dna?.filt,'F')).length,
    sacrifice:()=> state.monkeys.filter(m=> m.alive&&!m.inStorage&&m.stage==='adult'&&hasDominant(m.dna?.filt,'F')).slice(0,6) },
  { id:'ancient_trio',    title:'Elder Council',           type:'snapshot', difficulty:8,
    desc:'Provide 3 Ancient One sea monkeys for our longevity research panel. Specimens will be collected.',
    target:3,  reward:{ cash:6000, shells:6 },
    progress:()=> state.monkeys.filter(m=> m.alive&&!m.inStorage&&resolveAllele(m.dna?.longevity,'longevity')==='L_ANC').length,
    sacrifice:()=> state.monkeys.filter(m=> m.alive&&!m.inStorage&&resolveAllele(m.dna?.longevity,'longevity')==='L_ANC').slice(0,3) },
  { id:'mass_hatch',      title:'Hatchery Overdrive',       type:'relative_count', difficulty:4,
    desc:'Hatch 50 eggs for our population density records.',
    target:50, reward:{ cash:2500, shells:2 },
    progress:(g)=> Math.max(0, state.stats.totalBorn-(g.baseValue??state.stats.totalBorn)) },
  { id:'century_hatch',   title:'Century Hatch',            type:'relative_count', difficulty:6,
    desc:'Hatch 100 eggs — a landmark in reproduction rate research.',
    target:100,reward:{ cash:6000, shells:4 },
    progress:(g)=> Math.max(0, state.stats.totalBorn-(g.baseValue??state.stats.totalBorn)) },
  { id:'generation_marathon', title:'Evolutionary Sprint', type:'relative_count', difficulty:10,
    desc:'Breed 10 new generations from the point this grant was issued.',
    target:10, reward:{ cash:8000, shells:5 },
    progress:(g)=> Math.max(0, state.stats.totalGenerations-(g.baseValue??state.stats.totalGenerations)) },
  { id:'long_survival',   title:'Extended Survivability',   type:'timer', difficulty:5,
    desc:'Keep your tanks running with no deaths for 10 minutes straight.',
    target:10*60_000, reward:{ cash:5000, shells:3 },
    progress:(g)=> g.accumMs||0 },
  { id:'peak_conditions', title:'Peak Performance Protocol',type:'timer', difficulty:4,
    desc:'Keep food, oxygen & cleanliness all above 80% for 5 minutes in any tank.',
    target:5*60_000, reward:{ cash:4500, shells:3 },
    progress:(g)=> g.accumMs||0 },
];
const GRANT_MAP = new Map(GRANT_POOL.map(g => [g.id, g]));

// ── GRANT LOGIC ───────────────────────────────────────────────────────────────
function generateGrants() {
  if (!state.grants) state.grants = { active: [] };
  if (state.grants.active.length > 0) return; // only refresh when all grants have been claimed
  const need = 3;
  const activeIds = new Set(state.grants.active.map(g => g.id));
  const eligible  = GRANT_POOL.filter(g => !activeIds.has(g.id));
  const shuffled  = [...eligible].sort(() => Math.random() - 0.5);
  const picks     = shuffled.slice(0, need);
  for (const g of picks) {
    const entry = { id: g.id, done: false };
    if (g.id === 'generation_climb')    entry.baseValue = state.stats.totalGenerations;
    if (g.id === 'hatch_quota')         entry.baseValue = state.stats.totalBorn;
    if (g.id === 'mass_hatch')          entry.baseValue = state.stats.totalBorn;
    if (g.id === 'century_hatch')       entry.baseValue = state.stats.totalBorn;
    if (g.id === 'generation_marathon') entry.baseValue = state.stats.totalGenerations;
    if (g.id === 'survival_study')  { entry.accumMs = 0; entry.lastDeathCount = state.stats.totalDied; }
    if (g.id === 'long_survival')   { entry.accumMs = 0; entry.lastDeathCount = state.stats.totalDied; }
    if (g.id === 'water_quality')   entry.accumMs = 0;
    if (g.id === 'peak_conditions') entry.accumMs = 0;
    state.grants.active.push(entry);
  }
}

function checkGrantsInTick(dtMs) {
  const grants = state.grants?.active;
  if (!grants?.length) return;
  let anyNewDone = false;
  for (const g of grants) {
    if (g.done) continue;
    const def = GRANT_MAP.get(g.id);
    if (!def) continue;
    if (def.type === 'timer') {
      if (g.id === 'survival_study') {
        if (state.stats.totalDied > (g.lastDeathCount ?? state.stats.totalDied)) {
          g.accumMs = 0;
          g.lastDeathCount = state.stats.totalDied;
        } else {
          g.accumMs = (g.accumMs || 0) + dtMs;
        }
      } else if (g.id === 'long_survival') {
        if (state.stats.totalDied > (g.lastDeathCount ?? state.stats.totalDied)) {
          g.accumMs = 0;
          g.lastDeathCount = state.stats.totalDied;
        } else {
          g.accumMs = (g.accumMs || 0) + dtMs;
        }
      } else if (g.id === 'water_quality') {
        const anyGood = state.tanks.some(t =>
          t.eggsAdded && t.food >= 70 && t.oxygen >= 70 && t.cleanliness >= 70);
        if (anyGood) g.accumMs = (g.accumMs || 0) + dtMs;
      } else if (g.id === 'peak_conditions') {
        const anyPeak = state.tanks.some(t =>
          t.eggsAdded && t.food >= 80 && t.oxygen >= 80 && t.cleanliness >= 80);
        if (anyPeak) g.accumMs = (g.accumMs || 0) + dtMs;
      }
    }
    if (def.progress(g) >= def.target) {
      g.done = true;
      anyNewDone = true;
      addNotification(`📋 Grant complete: "${def.title}"!`);
      AudioEngine.play('grant');
    }
  }
  if (anyNewDone) _grantsSig = '';
}

function claimGrant(id) {
  const grants = state.grants?.active || [];
  const g = grants.find(g => g.id === id && g.done);
  if (!g) return;
  const def = GRANT_MAP.get(id);
  if (!def) return;
  const cashMult  = skOn('trust_fund')    ? 5 : 1;
  const shellMult = skOn('shell_bounty')  ? 3 : 1;
  const cashAmt   = def.reward.cash   * cashMult;
  const shellsAmt = def.reward.shells * shellMult;
  state.currency += cashAmt;
  state.shells = (state.shells || 0) + shellsAmt;
  const shellStr = shellsAmt ? ` +${shellsAmt} 🐚` : '';
  if (cashMult > 1)  addNotification(`💰 Trust Fund: ${cashMult}× cash!`);
  if (shellMult > 1) addNotification(`🐚 Shell Bounty: ${shellMult}× shells!`);
  addLog(`📋 Grant claimed: "${def.title}" — +£${cashAmt}${shellStr}`);
  addNotification(`📋 +£${cashAmt}${shellStr}`);
  state.stats.grantsCompleted = (state.stats.grantsCompleted || 0) + 1;
  if (def.sacrifice) {
    const victims = def.sacrifice();
    for (const m of victims) killMonkey(m, 'grant collection');
  }
  state.grants.active = state.grants.active.filter(g => g.id !== id);
  generateGrants(); // top back up to 3
  _grantsSig = '';
  saveState();
}

let _grantsSig = '';
function renderGrants() {
  const grants = state.grants?.active || [];
  const anyDone = grants.some(g => g.done);
  const dot = document.getElementById('grants-notify-dot');
  if (dot) dot.style.display = anyDone ? 'block' : 'none';

  const modal = document.getElementById('grants-modal');
  if (!modal?.classList.contains('open')) return;

  const sig = JSON.stringify(grants.map(g => {
    const def = GRANT_MAP.get(g.id);
    return { id: g.id, done: g.done, prog: def ? def.progress(g) : 0 };
  }));
  if (sig === _grantsSig) return;
  _grantsSig = sig;

  const list = document.getElementById('grants-list');
  const refreshRow = document.getElementById('grants-refresh-row');
  list.innerHTML = grants.map(g => {
    const def = GRANT_MAP.get(g.id);
    if (!def) return '';
    const prog   = Math.min(def.progress(g), def.target);
    const pct    = Math.min(100, (prog / def.target) * 100);
    let progressLabel;
    if (def.type === 'timer') {
      const secProg   = Math.floor(prog / 1000);
      const secTarget = Math.floor(def.target / 1000);
      const minP = Math.floor(secProg / 60),  secP = secProg % 60;
      const minT = Math.floor(secTarget / 60), secT = secTarget % 60;
      progressLabel = `${minP}:${String(secP).padStart(2,'0')} / ${minT}:${String(secT).padStart(2,'0')}`;
    } else {
      progressLabel = `${prog} / ${def.target}`;
    }
    const rewardHTML =
      `<span class="grant-reward-cash">+$${def.reward.cash}</span>` +
      (def.reward.shells ? ` <span class="grant-reward-shells">+${def.reward.shells} 🐚</span>` : '');
    const typeLabel = def.type === 'snapshot' ? 'Live' : def.type === 'relative_count' ? 'Count' : 'Timer';
    const cardClass = g.done ? 'grant-card complete' : 'grant-card';
    const badgeClass = g.done ? 'grant-badge complete' : 'grant-badge active';
    return `<div class="${cardClass}">
      <div class="grant-card-top">
        <span class="${badgeClass}">${typeLabel}</span>
        <span class="grant-title">${def.title}</span>
      </div>
      <div class="grant-desc">${def.desc}</div>
      <div class="grant-progress-wrap">
        <div class="grant-progress-bar" style="width:${pct}%"></div>
      </div>
      <div class="grant-footer">
        <span class="grant-progress-text">${progressLabel}</span>
        <span class="grant-reward">${rewardHTML}</span>
        ${g.done ? `<button class="grant-claim-btn" data-claim-grant="${g.id}">Claim</button>` : ''}
      </div>
    </div>`;
  }).join('');
  refreshRow.innerHTML = '';
}

// ── SKILL TREE ────────────────────────────────────────────────────────────────
const SKILL_TREE = [
  { id:'genetics',   icon:'🧬', label:'Geneticist', nodes:[
    { id:'mendels_luck',       title:"Mendel's Luck",      maxLevel:5, costs:[10,15,15,20,20], cashCosts:[1000,2000,3000,4000,5000],
      desc:n=>`+${n}% to all mutation rates.` },
    { id:'dominant_recessive', title:'Dominant Recessive', maxLevel:1, costs:[15], cashCosts:[2500],
      desc:()=>'Rare recessive genes have a 10% chance to express as dominant.' },
    { id:'mitosis',            title:'Mitosis',            maxLevel:1, costs:[25], cashCosts:[5000],
      desc:()=>'5% chance for an egg to hatch as identical twins.' },
    { id:'radiant_glow',       title:'Radiant Glow',       maxLevel:1, costs:[40], cashCosts:[10000],
      desc:()=>'Bioluminescent & Gold variants take 50% less pollution damage.' },
    { id:'dna_archive',        title:'DNA Archive',        maxLevel:1, costs:[60], cashCosts:[25000], capstone:true,
      desc:()=>"Store one sea monkey's DNA. New hatchlings have a 15% chance to inherit it." },
  ]},
  { id:'automator',  icon:'⚙️', label:'Automator',  nodes:[
    { id:'teflon_glass',    title:'Teflon Glass',    maxLevel:1, costs:[10], cashCosts:[1000],
      desc:()=>'Cleanliness drains 15% slower.' },
    { id:'preservatives',   title:'Preservatives',   maxLevel:1, costs:[15], cashCosts:[2500],
      desc:()=>'Corpses take 20% longer to decay.' },
    { id:'phantom_siphon',  title:'Phantom Siphon',  maxLevel:1, costs:[25], cashCosts:[5000],
      desc:()=>'A ghostly baster automatically removes one corpse every 60 seconds.' },
    { id:'aerobic_bacteria',title:'Aerobic Bacteria',maxLevel:1, costs:[40], cashCosts:[10000],
      desc:()=>'Tanks passively regenerate a small amount of oxygen on their own.' },
    { id:'circle_of_life',  title:'Circle of Life',  maxLevel:1, costs:[60], cashCosts:[25000], capstone:true,
      desc:()=>'Dead bodies no longer pollute the tank — they dissolve into food instead.' },
  ]},
  { id:'capitalist', icon:'💰', label:'Capitalist', nodes:[
    { id:'bulk_discount',    title:'Bulk Discount',    maxLevel:1, costs:[10], cashCosts:[1000],
      desc:()=>'All shop items cost 10% less.' },
    { id:'shell_bounty',     title:'Shell Bounty',     maxLevel:1, costs:[15], cashCosts:[2500],
      desc:()=>'Golden Shell rewards from grants are tripled.' },
    { id:'viral_marketing',  title:'Viral Marketing',  maxLevel:1, costs:[25], cashCosts:[5000],
      desc:()=>'Selling a rare variant doubles molt income for 3 minutes.' },
    { id:'angel_investor',   title:'Angel Investor',   maxLevel:1, costs:[40], cashCosts:[10000],
      desc:()=>'First time each tank reaches 50 sea monkeys, receive a £3,000 cash bonus.' },
    { id:'trust_fund',       title:'Trust Fund',       maxLevel:1, costs:[60], cashCosts:[25000], capstone:true,
      desc:()=>'Scientific grants pay 5× more cash.' },
  ]},
  { id:'caretaker',  icon:'💚', label:'Caretaker',  nodes:[
    { id:'incubator',         title:'Incubator',         maxLevel:1, costs:[10], cashCosts:[1000],
      desc:()=>'Eggs hatch 30% faster.' },
    { id:'iron_lungs',        title:'Iron Lungs',        maxLevel:1, costs:[15], cashCosts:[2500],
      desc:()=>'Sea monkeys consume oxygen 15% slower.' },
    { id:'fountain_of_youth', title:'Fountain of Youth', maxLevel:1, costs:[25], cashCosts:[5000],
      desc:()=>'Adult life expectancy increased by 20%.' },
    { id:'dietary_efficiency',title:'Dietary Efficiency',maxLevel:1, costs:[40], cashCosts:[10000],
      desc:()=>'Sea monkeys consume food 20% slower.' },
    { id:'cryo_pod',          title:'Cryo-Pod',          maxLevel:1, costs:[60], cashCosts:[25000], capstone:true,
      desc:()=>'Designate one tank: sea monkeys in it never die of old age.' },
  ]},
];

function sk(id)  { return state.skills?.[id] || 0; }
function skOn(id){ return !!sk(id); }

function canBuySkill(branchId, nodeId) {
  const branch = SKILL_TREE.find(b => b.id === branchId);
  if (!branch) return false;
  const idx  = branch.nodes.findIndex(n => n.id === nodeId);
  if (idx < 0) return false;
  const node = branch.nodes[idx];
  const cur  = sk(nodeId);
  if (cur >= node.maxLevel) return false;           // already maxed
  if (idx > 0) {                                    // previous node must be maxed
    const prev = branch.nodes[idx - 1];
    if (sk(prev.id) < prev.maxLevel) return false;
  }
  const cost     = node.costs[cur]     ?? node.costs[node.costs.length - 1];
  const cashCost = node.cashCosts?.[cur] ?? node.cashCosts?.[node.cashCosts.length - 1] ?? 0;
  return (state.shells || 0) >= cost && (state.currency || 0) >= cashCost;
}

function buySkill(branchId, nodeId) {
  if (!canBuySkill(branchId, nodeId)) return;
  const branch   = SKILL_TREE.find(b => b.id === branchId);
  const node     = branch.nodes.find(n => n.id === nodeId);
  const cur      = sk(nodeId);
  const cost     = node.costs[cur]     ?? node.costs[node.costs.length - 1];
  const cashCost = node.cashCosts?.[cur] ?? node.cashCosts?.[node.cashCosts.length - 1] ?? 0;
  state.shells   -= cost;
  state.currency -= cashCost;
  if (!state.skills) state.skills = {};
  state.skills[nodeId] = cur + 1;
  const lvlStr = node.maxLevel > 1 ? ` (Level ${cur + 1})` : '';
  addLog(`🌿 Skill unlocked: ${node.title}${lvlStr}`);
  addNotification(`🌿 ${node.title}${lvlStr} unlocked!`);
  AudioEngine.play('skill');
  _skillSig = '';
  saveState();
}

let _skillSig = '';
function renderSkillTree() {
  const modal = document.getElementById('skills-modal');
  if (!modal?.classList.contains('open')) return;

  const sig = JSON.stringify(state.skills) + (state.shells || 0) + (state.currency || 0);
  if (sig === _skillSig) return;
  _skillSig = sig;

  document.getElementById('skills-shells-val').textContent = state.shells || 0;
  document.getElementById('skills-currency-val').textContent = '£' + (state.currency || 0).toLocaleString();

  const container = document.getElementById('skills-branches');
  container.innerHTML = SKILL_TREE.map(branch => {
    const nodes = branch.nodes.map((node, idx) => {
      const cur     = sk(node.id);
      const maxed   = cur >= node.maxLevel;
      const prevOk  = idx === 0 || sk(branch.nodes[idx - 1].id) >= branch.nodes[idx - 1].maxLevel;
      const locked  = !prevOk;
      const cost     = node.costs[cur]     ?? node.costs[node.costs.length - 1];
      const cashCost = node.cashCosts?.[cur] ?? node.cashCosts?.[node.cashCosts.length - 1] ?? 0;
      const canAffd  = !locked && !maxed && (state.shells || 0) >= cost && (state.currency || 0) >= cashCost;
      const levelStr = node.maxLevel > 1 ? ` <span class="skill-level">Lv ${cur}/${node.maxLevel}</span>` : '';
      const desc    = typeof node.desc === 'function' ? node.desc(Math.max(1, cur)) : node.desc;
      let stateClass = maxed ? 'skill-node owned' : locked ? 'skill-node locked' : 'skill-node available';
      if (node.capstone) stateClass += ' capstone';
      const statusBadge = maxed ? '<span class="skill-badge owned">✓</span>'
        : locked ? '<span class="skill-badge locked">🔒</span>'
        : '';
      const costRow = (!maxed && !locked)
        ? `<div class="skill-cost-row">🐚${cost} · £${cashCost.toLocaleString()}</div>`
        : '';
      const btn = maxed ? ''
        : `<button class="skill-buy-btn${canAffd ? '' : ' disabled'}" data-buy-skill="${branch.id}:${node.id}" ${canAffd ? '' : 'disabled'}>
            ${locked ? 'Locked' : 'Unlock'}
           </button>`;
      // Cryo-Pod: show tank selector when owned
      let extra = '';
      if (node.id === 'cryo_pod' && maxed) {
        const opts = state.tanks.map(t =>
          `<option value="${t.id}" ${state.skills.cryoPodTankId === t.id ? 'selected' : ''}>${t.name}</option>`
        ).join('');
        extra = `<select class="skill-cryo-select" id="cryo-pod-tank-select"><option value="">— Pick a tank —</option>${opts}</select>`;
      }
      // DNA Archive: show stored DNA info when owned
      if (node.id === 'dna_archive' && maxed) {
        const stored = state.skills.storedDNA;
        extra = stored
          ? `<div class="skill-dna-stored">Archived: <b>${stored.name}</b></div>`
          : `<div class="skill-dna-stored dna-empty">No DNA stored. Archive a sea monkey from the Population view.</div>`;
      }
      return `<div class="${stateClass}">
        <div class="skill-node-top">${statusBadge}<span class="skill-title">${node.title}${levelStr}</span></div>
        ${costRow}
        <div class="skill-desc">${desc}</div>
        ${extra}
        ${btn}
      </div>`;
    }).join('<div class="skill-connector"></div>');
    return `<div class="skill-branch">
      <div class="skill-branch-header">${branch.icon} ${branch.label}</div>
      ${nodes}
    </div>`;
  }).join('');
}

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

const NAMES_M = [
  'Finn','Nemo','Rex','Sol','Tide','Drift','Crest','Bay','Atlas','Cove',
  'Reef','Marlin','Kelp','Sting','Blaze','Pike','Crag','Triton','Comet','Flint',
  'Surge','Brine','Torrent','Squall','Eddy','Mako','Spire','Dune','Halo','Silt',
  'Zale','Nereid','Shoal','Gyre','Atoll','Cay','Firth','Weir','Comber','Billow',
  'Spume','Wake','Keel','Helm','Prow','Capstan','Anchor','Lagoon','Riffle','Swash',
  'Breaker','Swell','Spray','Froth','Trough','Jib','Boom','Flume','Fathom','Depth',
  'Ridge','Cliff','Bluff','Channel','Gorge','Glen','Vale','Dell','Hollow','Fell',
  'Tor','Scree','Dingle','Beck','Burn','Rill','Fen','Marsh','Moor','Heath',
  'Pool','Tarn','Rapid','Cascade','Canyon','Ravine','Shore','Strand','Ford','Fjord',
  'Zephyr','Gust','Gale','Storm','Thunder','Bolt','Flash','Spark','Ember','Char',
  'Coal','Cinder','Slag','Ore','Gravel','Shale','Basalt','Shard','Flake','Spar',
  'Beam','Stave','Rod','Shaft','Hub','Crown','Peak','Summit','Apex','Tine',
  'Prong','Barb','Talon','Claw','Fang','Tusk','Horn','Spike','Quill','Gill',
  'Briar','Thorn','Sedge','Reed','Alder','Birch','Elm','Oak','Rowan','Yew',
  'Holly','Hazel','Cedar','Spruce','Fir','Larch','Gorse','Ajax','Boreas','Barnacle',
  'Beluga','Boulder','Brack','Brant','Buoy','Calder','Caleb','Camden','Castor','Cepheus',
  'Chrome','Cipher','Cirque','Clam','Cobalt','Colm','Conch','Cormorant','Corsair','Cray',
  'Creek','Crix','Crux','Curlew','Cyprian','Dagger','Dalton','Damien','Darby','Darius',
  'Dawson','Declan','Delmar','Dexter','Dipper','Dirk','Dorado','Dover','Drax','Dredge',
  'Dunmore','Earl','Easton','Ebb','Eel','Egret','Eldon','Eldric','Elgin','Emmet',
  'Emrys','Eoin','Ethan','Everett','Falcon','Farrow','Fenwick','Ferric','Finch','Finley',
  'Fleck','Fleet','Floe','Floyd','Fluke','Foxton','Frith','Fulmar','Gannet','Garnet',
  'Gavin','Gideon','Glaucus','Godwit','Grampus','Grebe','Gregor','Griffin','Gunnar','Gwaine',
  'Gwydion','Hadley','Halyard','Hamble','Haran','Harding','Harlock','Harold','Hawse','Hawthorn',
  'Haydon','Hazard','Helford','Henning','Heriot','Herring','Holt','Hooper','Hornby','Hudson',
  'Humboldt','Huxley','Hydrus','Idris','Ingram','Inver','Irvine','Isham','Iver','Jackal',
  'Jagger','Jarvis','Jasper','Jetsam','Jolly','Jonah','Jules','Junco','Kale','Kestrel',
  'Kite','Knox','Koan','Kombu','Kraken','Laird','Lance','Landis','Langley','Lanyard',
  'Larne','Latimer','Leach','Ledger','Leighton','Leland','Lennox','Leo','Lichen','Loch',
  'Lomond','Lorimer','Lorne','Lucas','Lupin','Luther','Lyndon','Mace','Madoc','Magnus',
  'Malin','Maltby','Manx','Marcus','Marden','Malkin','Marlow','Mason','Maxim','Merrow',
  'Minnow','Miro','Montague','Morgan','Morton','Muir','Murdoch','Murray','Nautilus','Nero',
  'Newton','Nils','Ninian','Niven','Norris','Oarsman','Oberon','Oceanus','Oliver','Olm',
  'Orion','Ormsby','Osbert','Oscar','Ossian','Oswald','Otter','Padstow','Parr','Paxton',
  'Pemberton','Peregrine','Perrin','Phin','Picton','Pipit','Plover','Pollack','Poseidon','Prawn',
  'Preston','Probus','Puffin','Quincy','Quinn','Quint','Raider','Raleigh','Rampart','Ransome',
  'Rayner','Redstart','Rhys','Ridley','Rigo','Rimmer','Ripon','Riven','Roach','Robart',
  'Robson','Rock','Rogan','Roland','Romsey','Rook','Ross','Rother','Rudd','Rupert',
  'Ruskin','Rutland','Ryburn','Salter','Salmon','Sandpiper','Sark','Scallop','Scute','Seabird',
  'Seaton','Selby','Selkirk','Sennon','Severn','Shearwater','Sherman','Sherwood','Sholto','Silas',
  'Simon','Sinclair','Sirdar','Skerry','Skua','Slade','Slater','Smew','Snipe','Solomon',
  'Sparrowhawk','Spencer','Spinner','Stour','Striker','Strome','Sullivan','Svensson','Syme','Talbot',
  'Tanner','Tarbert','Taran','Tarquin','Tavish','Tenby','Thane','Thistle','Thorne','Thornton',
  'Thurston','Tierce','Tilbury','Tintagel','Tobias','Tolan','Tomas','Torbin','Torque','Torrin',
  'Tredegar','Tremaine','Trevelyan','Trevise','Trevithick','Tristram','Troon','Tulloch','Tunny','Turbot',
  'Ulric','Upton','Urquhart','Usk','Valor','Vanquish','Veryan','Victor','Viking','Vince',
  'Vulcan','Warwick','Wendell','Wesley','Whitby','Wicker','Wilbur','Wilmott','Wilton','Winn',
  'Woodger','Worden','Wrayburn','Wymark','Wymond','Yarrow','Yates','Yorick','Yorke','Zachary',
  'Zebedee','Zennor','Zephyros','Zinzan','Zoran','Zorro','Amos','Bale','Calum','Donal',
  'Ewan','Fergus','Hamish','Iain','Jock','Liam','Niall','Ruari','Seamus','Tavita',
];
const NAMES_F = [
  'Bubbles','Splash','Coral','Sandy','Dory','Pearl','Shelly','Wave','Marina','Ripple',
  'Zara','Luna','Mist','Brook','Pebble','Nixie','Selene','Calypso','Azura','Briny',
  'Tempest','Celia','Ondine','Mira','Sable','Luma','Vesper','Aqua','Siren','Nerissa',
  'Coraline','Tidal','Cleo','Soleil','Shimmer','Naiad','Muriel','Oceana','Opaline','Orla',
  'Pacifica','Pamina','Pelagic','Perla','Petra','Phoebe','Pippa','Pixie','Polaris','Portia',
  'Posie','Prism','Questa','Rada','Raina','Rania','Rapture','Raya','Reina','Rhea',
  'Rhiannon','Riona','Rissa','Robyn','Rona','Rosaline','Rowena','Roxane','Ruby','Runa',
  'Saffron','Sage','Saline','Samara','Saoirse','Sapphire','Sarai','Savannah','Scarlett','Seabright',
  'Seana','Sela','Selkie','Seraphina','Serena','Shae','Shanna','Shannon','Shara','Shasta',
  'Sheen','Shona','Sierra','Silka','Silver','Silvia','Simone','Sinead','Siobhan','Skye',
  'Skylar','Sloane','Sofia','Sonja','Sora','Soraya','Sorcha','Starla','Stella','Stormie',
  'Sulis','Sunna','Sunny','Sunray','Surya','Svala','Sylva','Sylvie','Tahlia','Talia',
  'Talitha','Tamsin','Tara','Taryn','Tassie','Teagan','Teal','Teale','Tessa','Thalia',
  'Thea','Thetis','Tiana','Tilda','Tilly','Tinuiel','Tiona','Tirza','Topaz','Tora',
  'Tracina','Trine','Triona','Triss','Trix','Tully','Tundra','Tyra','Ula','Ulva',
  'Undine','Una','Ursula','Vada','Valeria','Valkyr','Vanna','Vega','Velvet','Vera',
  'Verity','Verna','Vesna','Vesta','Viola','Violet','Vivienne','Vonni','Wanda','Waverly',
  'Wendy','Willa','Willow','Winifred','Winona','Wren','Xanthe','Xara','Xena','Yael',
  'Yara','Yeva','Yola','Yuki','Yvaine','Yvette','Zarya','Zelda','Zena','Zephyra',
  'Zinnia','Ziva','Zofia','Zorah','Aelwen','Aerin','Agave','Ailbhe','Ailen','Ailish',
  'Aine','Ainsley','Airlie','Aislinn','Alara','Alba','Alcyone','Aldea','Aleena','Aleria',
  'Alessa','Aletta','Alexa','Allure','Alma','Almira','Alona','Alosa','Aluna','Alva',
  'Alwen','Alys','Amara','Amaris','Amber','Amina','Amira','Anala','Anara','Andromeda',
  'Aneira','Anela','Anemone','Anessa','Angharad','Anise','Anita','Anmer','Anna','Annalise',
  'Annelie','Annette','Annis','Annora','Anona','Anwyn','Aoife','April','Arabella','Araceli',
  'Araya','Arcadia','Ardea','Arethusa','Aria','Ariadne','Ariane','Ariel','Arina','Arista',
  'Arla','Arlene','Arona','Arran','Arrosa','Aruna','Arwen','Arwyn','Aspen','Astra',
  'Astrid','Atara','Athena','Audra','Aurela','Aurelie','Aurora','Aurore','Avelina','Avena',
  'Avery','Aviana','Ayanna','Aylin','Azalea','Azaria','Azella','Azolla','Azrine','Baile',
  'Bairbre','Bala','Balena','Barra','Bathea','Beatha','Beira','Belinda','Bena','Berit',
  'Berla','Bessa','Bethan','Bianca','Blair','Blanche','Blayne','Blossom','Blythe','Bonny',
  'Branwen','Brea','Brede','Breia','Brenna','Briallen','Brianna','Brigid','Brigit','Brina',
  'Britta','Bronagh','Bronwen','Bryn','Bryna','Brynja','Bryony','Cailin','Calantha','Calista',
  'Calla','Callista','Cally','Caltha','Cambria','Camille','Candice','Candra','Capella','Cariosa',
  'Carlin','Carlow','Carys','Cashla','Cass','Ceara','Cerise','Cerys','Chara','Charis',
  'Ciara','Cinnabar','Circe','Clara','Claribel','Cliona','Colette','Constance','Cordelia','Corinna',
  'Cosima','Cressida','Crysta','Dahlia','Daisy','Dalila','Damaris','Damia','Dara','Darcy',
  'Daria','Darrow','Davina','Dawn','Deirdre','Delphine','Deryn','Deva','Diana','Diantha',
  'Dina','Dolores','Dominica','Donna','Dorcha','Dove','Dulce','Dwyn','Dwynwen','Dysis',
  'Eala','Eartha','Eibhlin','Eilidh','Eilinora','Eire','Eirene','Eirian','Eithne','Elena',
  'Elene','Elika','Elora','Elspeth','Elva','Elvina','Elwen','Embla','Emerald','Emlyn',
  'Emrynn','Enid','Enna','Enya','Eola','Eolande','Epona','Erinn','Erla','Esme',
  'Ethna','Evaine','Evaline','Evanna','Evara','Eveleen','Eveline','Evelyn','Evenna','Evony',
  'Fainche','Fala','Fallon','Fana','Fand','Fara','Faye','Feena','Fern','Ffion',
  'Fiadh','Fiana','Finola','Fionnuala','Flavia','Fleur','Florae','Florin','Floss','Freya',
  'Gaela','Galatea','Galia','Gelsey','Gemma','Genna','Ginevra','Glenna','Glenys','Gloria',
  'Gloriana','Goldie','Grainne','Grania','Guinevere','Gwen','Gweneira','Gwendolyn','Gwenllian','Gwynn',
  'Halcyon','Halla','Hana','Heather','Hedra','Heloise','Hespera','Hilde','Himari','Honora',
  'Hypatia','Ida','Ildana','Ilena','Imara','Imogen','Ina','Inara','Inessa','Inga',
  'Ingrid','Iolanthe','Iona','Iora','Irena','Iris','Isadora','Isolde','Ita','Ivy',
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
  C_PINK:  { name: 'Standard Pink',  tier: 1, filterStr: 'hue-rotate(300deg)',                      cbFilterStr: 'hue-rotate(30deg) saturate(1.8)',           shadow: '' },
  C_GRN:   { name: 'Algae Green',    tier: 1, filterStr: 'hue-rotate(120deg) saturate(1.5)',        cbFilterStr: 'hue-rotate(185deg) saturate(2)',            shadow: '' },
  purple:  { name: 'Purple',         tier: 2, filterStr: 'hue-rotate(260deg) saturate(2)',          shadow: '' },
  C_BLU:   { name: 'Deep Blue',      tier: 2, filterStr: 'hue-rotate(200deg)',                      shadow: '' },
  C_TRANS: { name: 'Transparent',    tier: 3, filterStr: 'saturate(0)',                             shadow: '', opacity: 0.35 },
  C_BIO:   { name: 'Bioluminescent', tier: 3, filterStr: 'hue-rotate(150deg) saturate(3)',          cbFilterStr: 'hue-rotate(205deg) saturate(3)',            shadow: '0 0 8px 3px rgba(100,255,200,0.6)' },
  C_GOLD:  { name: 'Midas Gold',     tier: 3, filterStr: 'sepia(1) saturate(4) hue-rotate(10deg)', shadow: '0 0 6px 2px rgba(255,200,0,0.5)' },
  C_VOID:  { name: 'Void Black',     tier: 3, filterStr: 'grayscale(1) brightness(0.2)',            shadow: '0 0 10px 3px rgba(120,120,255,0.7)' },
};

const MASTERY_THRESHOLD_COLOR = 1000; // fallback only
const MASTERY_THRESHOLD_FUNC  = 1000; // fallback only
const FILTER_FEED_RATE = 0.0008;  // cleanliness gained/sec per Filter Feeder monkey

// ── DEX VARIANT DEFINITIONS ──────────────────
const DEX_COLOR_VARIANTS = [
  { key: 'C_PINK',  name: 'Standard Pink',  tier: 1, masteryThreshold:  1_000, masteryDesc: 'Feed gives +10 more food' },
  { key: 'C_GRN',   name: 'Algae Green',    tier: 1, masteryThreshold:  1_000, masteryDesc: 'Filter Feeders 2× effective' },
  { key: 'purple',  name: 'Purple',         tier: 2, masteryThreshold:  5_000, masteryDesc: '+1 max egg per birth' },
  { key: 'C_BLU',   name: 'Deep Blue',      tier: 2, masteryThreshold:  3_000, masteryDesc: 'Adults live 10% longer' },
  { key: 'C_TRANS', name: 'Transparent',    tier: 3, masteryThreshold: 10_000, masteryDesc: 'Cleanliness drains 20% slower' },
  { key: 'C_BIO',   name: 'Bioluminescent', tier: 3, masteryThreshold:  7_500, masteryDesc: 'Oxygen depletes 15% slower' },
  { key: 'C_GOLD',  name: 'Midas Gold',     tier: 3, masteryThreshold:  7_500, masteryDesc: 'Food depletes 15% slower' },
  { key: 'C_VOID',  name: 'Void Black',     tier: 3, masteryThreshold: 15_000, masteryDesc: 'Food depletes 25% slower' },
];
const DEX_TAIL_VARIANTS = [
  { key: 'T_STD', name: 'Standard Tail', masteryThreshold: 1_000, masteryDesc: 'No bonus' },
  { key: 'T_FAN', name: 'Fan Tail',      masteryThreshold: 2_500, masteryDesc: '+1 extra egg per birth' },
  { key: 'T_DBL', name: 'Twin Tail',     masteryThreshold: 4_000, masteryDesc: '+1 extra egg per birth (stacks)' },
];
const DEX_METAB_VARIANTS = [
  { key: 'M_NRM',  name: 'Normal Metabolism', masteryThreshold: 1_000, masteryDesc: 'No bonus' },
  { key: 'M_FAST', name: 'Hyperactive',       masteryThreshold: 2_500, masteryDesc: 'Growth speed 1.7× (was 1.5×)' },
  { key: 'M_SLOW', name: 'Sloth Mode',        masteryThreshold: 2_500, masteryDesc: 'Hunger rate 0.5× (was 0.6×)' },
];
const DEX_CONST_VARIANTS = [
  { key: 'H_AVG',  name: 'Average Health', masteryThreshold: 1_000, masteryDesc: 'No bonus' },
  { key: 'H_SENS', name: 'Sensitive',      masteryThreshold: 1_500, masteryDesc: 'No bonus' },
  { key: 'H_IRON', name: 'Iron Gut',       masteryThreshold: 3_000, masteryDesc: 'Corpse drain ×0.5' },
];
const DEX_LONGEV_VARIANTS = [
  { key: 'L_STD', name: 'Standard Life', masteryThreshold: 1_000, masteryDesc: 'No bonus' },
  { key: 'L_FLY', name: 'Mayfly',        masteryThreshold: 1_500, masteryDesc: 'No bonus' },
  { key: 'L_ANC', name: 'Ancient One',   masteryThreshold: 7_500, masteryDesc: 'Life multiplier 3.5× (was 2.5×)' },
];
const DEX_FUNC_VARIANTS = [
  { key: 'filterFeeder', name: 'Filter Feeder', masteryThreshold: 3_000, masteryDesc: 'Filter Feeders also boost oxygen' },
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
  { key: 'firstHydra',         emoji: '🪸', name: 'Hydra Slayer',          desc: 'Defeat a Hydra micro-predator.',               reward: '+150 XP, +1 🧴 Chemical Drop',    progress: () => [state.stats?.hydrasDefeated||0, 1] },
  // Storage & trading
  { key: 'firstEggStored',     emoji: '📦', name: 'Cold Storage',           desc: 'Store your first egg.',                        reward: '+50 XP',                          progress: () => [state.monkeys.some(m=>m.inStorage)?1:0, 1] },
  { key: 'firstEggSold',       emoji: '💰', name: 'First Egg Sale',         desc: 'Sell a sea monkey egg.',                       reward: '+25 XP',                          progress: () => [state.milestones?.firstEggSold?1:0, 1] },
  { key: 'firstBabySold',      emoji: '💰', name: 'Baby Broker',            desc: 'Sell your first baby sea monkey.',             reward: '+25 XP',                          progress: () => [state.milestones?.firstBabySold?1:0, 1] },
  { key: 'firstJuvenileSold',  emoji: '💰', name: 'Juvenile Trade',         desc: 'Sell your first juvenile sea monkey.',         reward: '+50 XP',                          progress: () => [state.milestones?.firstJuvenileSold?1:0, 1] },
  { key: 'firstAdultSold',     emoji: '💰', name: 'Adult Auction',          desc: 'Sell your first adult sea monkey.',            reward: '+75 XP',                          progress: () => [state.milestones?.firstAdultSold?1:0, 1] },
  // Shop
  { key: 'firstShopPurchase',  emoji: '🛒', name: 'First Purchase',         desc: 'Buy your first item from the shop.',           reward: '+25 XP',                          progress: () => [state.stats?.totalShopPurchases?1:0, 1] },
  // Grants
  { key: 'grants1',   emoji: '📋', name: 'Grant Recipient',       desc: 'Complete 1 scientific grant.',                 reward: '+50 XP',                          progress: () => [state.stats?.grantsCompleted||0, 1]   },
  { key: 'grants5',   emoji: '📋', name: 'Active Researcher',     desc: 'Complete 5 scientific grants.',                reward: '+100 XP, +1 🥚 Egg Pack',         progress: () => [state.stats?.grantsCompleted||0, 5]   },
  { key: 'grants10',  emoji: '📋', name: 'Senior Scientist',      desc: 'Complete 10 scientific grants.',               reward: '+200 XP, +1 🧪 Life Booster',     progress: () => [state.stats?.grantsCompleted||0, 10]  },
  { key: 'grants25',  emoji: '📋', name: 'Principal Investigator',desc: 'Complete 25 scientific grants.',               reward: '+300 XP, +1 🧴 Chemical Drop',    progress: () => [state.stats?.grantsCompleted||0, 25]  },
  { key: 'grants50',  emoji: '📋', name: 'Research Director',     desc: 'Complete 50 scientific grants.',               reward: '+500 XP, +1 ✨ Glowing Flakes',   progress: () => [state.stats?.grantsCompleted||0, 50]  },
  { key: 'grants100', emoji: '📋', name: 'Nobel Laureate',        desc: 'Complete 100 scientific grants.',              reward: '+1,000 XP, +2 🥚 Egg Packs',      progress: () => [state.stats?.grantsCompleted||0, 100] },
  // Skill tree
  { key: 'skillTier1',      emoji: '🌿', name: 'First Skill',        desc: 'Unlock your first skill.',                     reward: '+50 XP',                          progress: () => [SKILL_TREE.some(b=>sk(b.nodes[0]?.id))?1:0, 1] },
  { key: 'skillTier2',      emoji: '🌿', name: 'Skill Tier 2',       desc: 'Unlock any tier-2 skill.',                    reward: '+75 XP',                          progress: () => [SKILL_TREE.some(b=>sk(b.nodes[1]?.id))?1:0, 1] },
  { key: 'skillTier3',      emoji: '🌿', name: 'Skill Tier 3',       desc: 'Unlock any tier-3 skill.',                    reward: '+100 XP',                         progress: () => [SKILL_TREE.some(b=>sk(b.nodes[2]?.id))?1:0, 1] },
  { key: 'skillTier4',      emoji: '🌿', name: 'Skill Tier 4',       desc: 'Unlock any tier-4 skill.',                    reward: '+150 XP',                         progress: () => [SKILL_TREE.some(b=>sk(b.nodes[3]?.id))?1:0, 1] },
  { key: 'skillTier5',      emoji: '🌿', name: 'Capstone Skill',     desc: 'Unlock any capstone skill.',                  reward: '+200 XP',                         progress: () => [SKILL_TREE.some(b=>sk(b.nodes[4]?.id))?1:0, 1] },
  { key: 'skillFullBranch', emoji: '🌳', name: 'Completed Branch',   desc: 'Fully complete any one skill branch.',        reward: '+300 XP',                         progress: () => [SKILL_TREE.some(b=>b.nodes.every(n=>sk(n.id)))?1:0, 1] },
  { key: 'skillAllUnlocked',emoji: '🏅', name: 'Master of All',      desc: 'Unlock every skill in the tree.',             reward: '+1,000 XP, +2 🧴 Chemical Drops', progress: () => { const t=SKILL_TREE.reduce((s,b)=>s+b.nodes.length,0); return [SKILL_TREE.reduce((s,b)=>s+b.nodes.filter(n=>sk(n.id)).length,0),t]; } },
];

// ── AUDIO ENGINE ─────────────────────────────────────────────────────────────
const AudioEngine = (() => {
  let _ctx      = null;
  let _sfxBus   = null;
  let _musicBus = null;
  let _loopTimer = null;
  let _playing  = false;
  let _musicVol = parseFloat(localStorage.getItem('sfm_musicVol') || 0.45);
  let _sfxVol   = parseFloat(localStorage.getItem('sfm_sfxVol')   || 0.70);

  function _ensure() {
    if (!_ctx) {
      _ctx = new AudioContext();
      _sfxBus = _ctx.createGain(); _sfxBus.gain.value = _sfxVol; _sfxBus.connect(_ctx.destination);
      _musicBus = _ctx.createGain(); _musicBus.gain.value = _musicVol; _musicBus.connect(_ctx.destination);
    }
    if (_ctx.state === 'suspended') _ctx.resume();
    return _ctx;
  }

  function setMusicVol(v) { _musicVol = v; localStorage.setItem('sfm_musicVol', v); if (_musicBus) _musicBus.gain.value = v; }
  function setSfxVol(v)   { _sfxVol   = v; localStorage.setItem('sfm_sfxVol',   v); if (_sfxBus)   _sfxBus.gain.value   = v; }
  function getMusicVol()  { return _musicVol; }
  function getSfxVol()    { return _sfxVol;   }

  function _osc(freq, type, tStart, dur, peakGain, bus) {
    const o = _ctx.createOscillator(), e = _ctx.createGain();
    o.type = type; o.frequency.value = freq;
    e.gain.setValueAtTime(0, tStart);
    e.gain.linearRampToValueAtTime(peakGain, tStart + Math.min(0.015, dur * 0.1));
    e.gain.exponentialRampToValueAtTime(0.0001, tStart + dur);
    o.connect(e); e.connect(bus); o.start(tStart); o.stop(tStart + dur + 0.05);
  }
  function _sweep(fA, fB, type, tStart, dur, peakGain, bus) {
    const o = _ctx.createOscillator(), e = _ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(fA, tStart);
    o.frequency.exponentialRampToValueAtTime(fB, tStart + dur);
    e.gain.setValueAtTime(peakGain, tStart);
    e.gain.exponentialRampToValueAtTime(0.0001, tStart + dur);
    o.connect(e); e.connect(bus); o.start(tStart); o.stop(tStart + dur + 0.05);
  }

  const SFX = {
    birth:     (b, t) => { _sweep(320, 720, 'sine', t, 0.14, 0.26, b); },
    death:     (b, t) => { _sweep(180, 55, 'triangle', t, 0.32, 0.45, b); },
    mate:      (b, t) => { _osc(659, 'sine', t, 0.18, 0.22, b); _osc(831, 'sine', t + 0.11, 0.18, 0.22, b); },
    molt:      (b, t) => { _osc(1047, 'sine', t, 0.16, 0.30, b); },
    sell:      (b, t) => { _osc(523, 'sine', t, 0.10, 0.24, b); _osc(784, 'sine', t + 0.10, 0.14, 0.24, b); },
    levelup:   (b, t) => { [523, 659, 784, 1047].forEach((f, i) => _osc(f, 'sine', t + i * 0.11, 0.22, 0.30, b)); },
    grant:     (b, t) => { [392, 494, 587, 784].forEach((f, i) => _osc(f, 'sine', t + i * 0.10, 0.35, 0.26, b)); },
    skill:     (b, t) => { _sweep(220, 880, 'triangle', t, 0.26, 0.26, b); _osc(880, 'sine', t + 0.24, 0.14, 0.18, b); },
    discovery: (b, t) => { [1047, 1319, 1047, 1568].forEach((f, i) => _osc(f, 'sine', t + i * 0.10, 0.18, 0.24, b)); },
    feed:      (b, t) => { _sweep(400, 660, 'sine', t, 0.08, 0.20, b); },
    aerate:    (b, t) => { [0, 0.07, 0.14].forEach((d, i) => _sweep(360 + i * 60, 700 + i * 60, 'sine', t + d, 0.07, 0.18, b)); },
    clean:     (b, t) => { _sweep(620, 180, 'triangle', t, 0.22, 0.26, b); },
    alarm:     (b, t) => { [0, 0.22, 0.44].forEach(d => _sweep(480, 160, 'sawtooth', t + d, 0.38, 0.18, b)); },
  };

  function play(name) {
    if (_calculatingOfflineProgress) return;  // Suppress sounds during offline progress calculation
    if (_sfxVol < 0.01) return;
    const ctx = _ensure();
    const fn = SFX[name];
    if (fn) fn(_sfxBus, ctx.currentTime + 0.01);
  }

  // ── Background Music ─────────────────────────────────────────────────────────
  // Ambient aquatic loop: Am → Fmaj7 → C → Gsus2 (4 beats each, 72 BPM, ~13.3s)
  const BPM  = 72;
  const BEAT = 60 / BPM;
  const LOOP = BEAT * 16;

  // [freq, gain] pairs per chord
  const CHORDS = [
    [[110,0.10],[165,0.06],[220,0.06],[262,0.05]], // Am:   A2 E3 A3 C4
    [[ 87,0.10],[131,0.06],[175,0.06],[220,0.05]], // F:    F2 C3 F3 A3
    [[131,0.10],[196,0.06],[262,0.06],[330,0.05]], // C:    C3 G3 C4 E4
    [[ 98,0.10],[147,0.06],[196,0.06],[262,0.05]], // Gsus: G2 D3 G3 C4
  ];

  // 16-beat sparse melody (null = rest); one octave up, pentatonic A-minor
  const MEL = [440,null,392,null, 330,392,null,440, null,262,294,null, 262,null,220,null];

  function _scheduleLoop(t0) {
    if (!_playing || !_ctx) return;
    const bus = _musicBus;

    // Sub-bass drone — fades in/out across the full loop
    const dOsc = _ctx.createOscillator(), dEnv = _ctx.createGain();
    dOsc.type = 'sine'; dOsc.frequency.value = 55;
    dEnv.gain.setValueAtTime(0, t0);
    dEnv.gain.linearRampToValueAtTime(0.13, t0 + 0.6);
    dEnv.gain.setValueAtTime(0.13, t0 + LOOP - 0.5);
    dEnv.gain.linearRampToValueAtTime(0, t0 + LOOP);
    dOsc.connect(dEnv); dEnv.connect(bus); dOsc.start(t0); dOsc.stop(t0 + LOOP + 0.1);

    // Chord pads
    CHORDS.forEach((chord, ci) => {
      const cs = t0 + ci * BEAT * 4, cd = BEAT * 4.1;
      chord.forEach(([freq, g]) => {
        const o = _ctx.createOscillator(), e = _ctx.createGain();
        o.type = 'sine'; o.frequency.value = freq;
        e.gain.setValueAtTime(0, cs);
        e.gain.linearRampToValueAtTime(g, cs + BEAT * 0.9);
        e.gain.setValueAtTime(g, cs + cd - BEAT * 0.5);
        e.gain.linearRampToValueAtTime(0, cs + cd);
        o.connect(e); e.connect(bus); o.start(cs); o.stop(cs + cd + 0.1);
      });
    });

    // Sparse melody (triangle, one octave above MEL values)
    MEL.forEach((freq, bi) => {
      if (!freq) return;
      const ns = t0 + bi * BEAT;
      _osc(freq * 2, 'triangle', ns, BEAT * 0.65, 0.052, bus);
    });

    // Queue next loop slightly before this one ends
    const msUntilNext = Math.max(0, (t0 + LOOP - _ctx.currentTime - 0.15) * 1000);
    _loopTimer = setTimeout(() => _scheduleLoop(t0 + LOOP), msUntilNext);
  }

  function startMusic() {
    if (_playing) return;
    _ensure(); _playing = true;
    _scheduleLoop(_ctx.currentTime + 0.2);
  }

  function stopMusic() {
    _playing = false;
    if (_loopTimer) { clearTimeout(_loopTimer); _loopTimer = null; }
  }

  return { play, startMusic, stopMusic, setMusicVol, setSfxVol, getMusicVol, getSfxVol };
})();

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

function getMaxOxygen(tank) {
  const level = (tank || activeTank())?.aeration?.level || 0;
  return 100 + (AERATION_LEVELS[level]?.maxOxygenBonus || 0);
}

function getMaxCleanliness(tank) {
  const level = (tank || activeTank())?.skimmer?.level || 0;
  return 100 + (SKIMMER_LEVELS[level]?.maxCleanBonus || 0);
}

function getMaxFood(tank) {
  const level = (tank || activeTank())?.feeder?.level || 0;
  return 100 + (FEEDER_LEVELS[level]?.maxFoodBonus || 0);
}

// ── Tank Level / XP ─────────────────────────────
// XP per level grows exponentially: each level costs XP_FACTOR × the previous.
// XP_BASE = XP to reach level 2; XP_FACTOR = per-level multiplier.
// Cumulative XP for level N: XP_BASE * (XP_FACTOR^(N-1) - 1) / (XP_FACTOR - 1)
// e.g. L2=100, L3=230, L4=399, L5=619, L10≈3200, L20≈18350, L30≈98600
const XP_BASE   = 100;
const XP_FACTOR = 1.3;
function xpForLevel(level) {
  if (level <= 1) return 0;
  return Math.floor(XP_BASE * (Math.pow(XP_FACTOR, level - 1) - 1) / (XP_FACTOR - 1));
}
function xpToLevel(xp) {
  if (!xp || xp <= 0) return 1;
  return Math.max(1, Math.floor(1 + Math.log(xp * (XP_FACTOR - 1) / XP_BASE + 1) / Math.log(XP_FACTOR)));
}
function addXP(amount) {
  if (!amount || amount <= 0) return;
  const prev = xpToLevel(state.playerXP || 0);
  state.playerXP = (state.playerXP || 0) + amount;
  const next = xpToLevel(state.playerXP);
  if (next > prev) {
    state.currency += 250;
    addLog(`⭐ Player reached Level ${next}! (+£250)`);
    addNotification(`⭐ Player Level Up! Now Level ${next} (+£250)`);
    AudioEngine.play('levelup');
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
// Per-tank defaults — each bought tank gets a deep copy of this
const DEFAULT_TANK = {
  id: 0,
  name: 'Tank 1',
  waterAdded: false,
  purifying: false,
  purifyStartTime: null,
  purifyDuration: PURIFY_DURATION,
  waterPure: false,
  eggsAdded: false,
  food: 100,
  oxygen: 100,
  cleanliness: 100,
  aeration:  { level: 0, startedAt: null, duration: null },
  skimmer:   { level: 0, startedAt: null, duration: null },
  feeder:    { level: 0, startedAt: null, duration: null },
  tankCreatedAt: null,
  glowingFlakesActive: 0,
  popLevel: 0,
  eggSkimmer: false,
  eggSkimmerActive: false,
  mutationInhibitorUntil: 0,
  snail: false,
  snailLastEat: null,
  hydra: null,   // null | { hp, lastHunt, x } — active hydra on the glass
};

const DEFAULT_STATE = {
  version: 3,
  lastSave: null,
  lastTick: null,
  playTimeMs: 0,
  totalOfflineMs: 0,
  gameStarted: false,
  fpsStressPop: null,
  playerXP: 0,
  activeTankId: 0,
  tanks: [ { ...JSON.parse(JSON.stringify(DEFAULT_TANK)), id: 0, name: 'Tank 1', tankCreatedAt: null } ],
  monkeys: [],
  nextMonkeyId: 1,
  molts: [],
  nextMoltId: 1,
  currency: 0,
  stats: {
    totalBorn: 0,
    totalDied: 0,
    totalMatingEvents: 0,
    totalGenerations: 1,
    peakPopulation: 0,
    hydrasDefeated: 0,
    grantsCompleted: 0,
    totalShopPurchases: 0,
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
  magnifyingGlassMode: false,
  inventory: {
    lifeBooster: 0,
    boosterEggPack: 0,
    glowingFlakes: 0,
    magnifyingGlass: 0,
    mutationInhibitor: 0,
    hydraKiller: 0,
  },
  offlineProtectionExpiry: 0,
  gracePeriodUntil: 0,
  shop: {
    rationBoostExpiry:  0,
    waterTreatExpiry:   0,
    eggSurgeExpiry:     0,
    autoFeeder:         false,
    mutationCatalyst:   false,
  },
  shells: 0,
  grants: { active: [] },
  skills: {
    mendels_luck:0, dominant_recessive:false, mitosis:false, radiant_glow:false, dna_archive:false,
    storedDNA:null,
    teflon_glass:false, preservatives:false, phantom_siphon:false, aerobic_bacteria:false, circle_of_life:false,
    phantomLastEat:null,
    bulk_discount:false, shell_bounty:false, viral_marketing:false, angel_investor:false, trust_fund:false,
    viralMarketingExpiry:0, angelInvestorUsedTanks:[],
    incubator:false, iron_lungs:false, fountain_of_youth:false, dietary_efficiency:false, cryo_pod:false,
    cryoPodTankId:null,
  },
};

// ─────────────────────────────────────────────
// 4. LIVE STATE + NOTIFICATIONS
// ───────────��─────────────────────────────────
let state = {};
let notifications = [];
let _suppressDeaths = false; // transient: true during offline-protected catchup
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
let paused = false;
let pausedAt = 0;
let limitViewToCap    = localStorage.getItem('limitViewToCap')    !== '0';  // default on
let bioGlowAnimation  = localStorage.getItem('bioGlowAnimation')  !== '0';  // default on
let colorTheme        = localStorage.getItem('colorTheme') || 'dark';
let _calculatingOfflineProgress = false;  // flag to suppress sounds and hydra spawns during offline calc
// Apply immediately so loading screen inherits the saved theme
if (colorTheme === 'light')      document.body.classList.add('theme-light');
if (colorTheme === 'colorblind') document.body.classList.add('theme-colorblind');

// Returns the currently-viewed tank object
function activeTank() { return state.tanks[state.activeTankId]; }

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
  // ── Multi-tank: wrap old single-tank format ──────────────────────────────
  if (!loaded.tanks) {
    loaded.tanks = [{
      ...JSON.parse(JSON.stringify(DEFAULT_TANK)),
      id: 0, name: 'Tank 1',
      ...(loaded.tank || {}),
      aeration:            loaded.aeration || JSON.parse(JSON.stringify(DEFAULT_TANK.aeration)),
      skimmer:             loaded.skimmer  || JSON.parse(JSON.stringify(DEFAULT_TANK.skimmer)),
      feeder:              loaded.feeder   || JSON.parse(JSON.stringify(DEFAULT_TANK.feeder)),
      tankCreatedAt:       loaded.tankCreatedAt       || null,
      glowingFlakesActive: Number(loaded.glowingFlakesActive || loaded.splicerActive || 0),
    }];
    loaded.activeTankId = 0;
  }
  // Migrate per-tank XP to global playerXP
  if (loaded.playerXP == null) {
    loaded.playerXP = (loaded.tanks || []).reduce((s, t) => s + (t.tankXP || 0), 0);
  }
  // Backfill tankId on monkeys / molts from old saves
  (loaded.monkeys || []).forEach(m => { if (m.tankId == null) m.tankId = 0; });
  (loaded.molts   || []).forEach(m => { if (m.tankId == null) m.tankId = 0; });

  const s = Object.assign({}, JSON.parse(JSON.stringify(DEFAULT_STATE)), loaded);
  // Merge each tank with DEFAULT_TANK to fill in missing fields
  s.tanks = (loaded.tanks || []).map(t => {
    const tank = Object.assign({}, JSON.parse(JSON.stringify(DEFAULT_TANK)), t);
    // Normalise boolean glowingFlakesActive from old saves
    if (typeof tank.glowingFlakesActive === 'boolean') tank.glowingFlakesActive = tank.glowingFlakesActive ? 1 : 0;
    return tank;
  });
  s.activeTankId = loaded.activeTankId ?? 0;
  s.stats   = Object.assign({}, DEFAULT_STATE.stats,  loaded.stats   || {});
  // Reset skill purchases once for v1.5.5 cost restructure
  if (loaded.skillsResetV155) {
    s.skills = Object.assign({}, DEFAULT_STATE.skills, loaded.skills || {});
  } else {
    s.skills = JSON.parse(JSON.stringify(DEFAULT_STATE.skills));
    s.skillsResetV155 = true;
  }
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
  // glowingFlakesActive is now per-tank (handled in tanks migration above)
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

  // Un-master dex entries whose count is below the new per-variant threshold
  const _allDexVariants = [...DEX_COLOR_VARIANTS, ...DEX_TAIL_VARIANTS, ...DEX_METAB_VARIANTS, ...DEX_CONST_VARIANTS, ...DEX_LONGEV_VARIANTS, ...DEX_FUNC_VARIANTS];
  const _colorOrTailKeys = ['C_PINK','C_GRN','purple','C_BLU','C_GOLD','C_VOID','C_BIO','C_TRANS','T_STD','T_FAN','T_DBL'];
  for (const v of _allDexVariants) {
    const entry = s.dex[v.key];
    if (!entry || !entry.mastered) continue;
    const thr = v.masteryThreshold ?? (_colorOrTailKeys.includes(v.key) ? MASTERY_THRESHOLD_COLOR : MASTERY_THRESHOLD_FUNC);
    if (entry.count < thr) entry.mastered = false;
  }

  // ── Monkey migration ─────────────────────────
  const colorCodeMap = { Pk: 'C_PINK', Gr: 'C_GRN', bl: 'C_BLU', Au: 'C_GOLD', Bi: 'C_BIO', Tr: 'C_TRANS', d: 'C_PINK' };
  const v1ColorMap = {
    pink: ['C_PINK','C_PINK'], green: ['C_GRN','C_GRN'], blue: ['C_BLU','C_BLU'],
    purple: ['C_PINK','C_GRN'], gold: ['C_GOLD','C_PINK'], bioluminescent: ['C_BIO','C_PINK'],
    transparent: ['C_TRANS','C_TRANS'], albino: ['C_TRANS','C_TRANS'], default: ['C_PINK','C_PINK'],
  };

  // Shop migration
  if (!s.shop) s.shop = {};
  const defaultShop = { rationBoostExpiry: 0, waterTreatExpiry: 0, eggSurgeExpiry: 0, autoFeeder: false, mutationCatalyst: false };
  s.shop = Object.assign({}, defaultShop, s.shop);
  // Backfill popLevel — old saves had 500 cap = level 8
  for (const t of s.tanks) {
    if (t.popLevel == null) t.popLevel = 8;
  }
  if (!s.offlineProtectionExpiry) s.offlineProtectionExpiry = 0;
  if (!s.gracePeriodUntil) s.gracePeriodUntil = 0;

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
function addLog(msg, group = null, tankId = undefined) {
  state.log.unshift({ msg, isNew: true, group: group ?? msg, tankId });
  if (state.log.length > 500) state.log.pop();
}

// ── SELL PRICING ─────────────────────────────────────────────────────────────
const SELL_COLOR_VALUE = {
  C_PINK: 5, C_GRN: 5, purple: 80, C_BLU: 60,
  C_TRANS: 120, C_BIO: 150, C_GOLD: 400, C_VOID: 300,
};

function calcSellPrice(m) {
  if (!m.dna) return 1;
  let price = 5;
  // Colour
  price += SELL_COLOR_VALUE[resolveColorPhenotype(m.dna.body_color)] ?? 5;
  // Tail
  const tail = resolveAllele(m.dna.tail_shape, 'tail_shape');
  if (tail === 'T_FAN') price += 20;
  if (tail === 'T_DBL') price += 70;
  // Metabolism
  const met = resolveAllele(m.dna.metabolism, 'metabolism');
  if (met === 'M_FAST') price += 25;
  if (met === 'M_SLOW') price += 30;
  // Constitution
  const con = resolveAllele(m.dna.constitution, 'constitution');
  if (con === 'H_IRON') price += 60;
  if (con === 'H_SENS') price += 15;
  // Longevity
  const lon = resolveAllele(m.dna.longevity, 'longevity');
  if (lon === 'L_ANC') price += 200;
  if (lon === 'L_FLY') price += 20;
  // Filter feeder
  if (hasDominant(m.dna.filt, 'F')) price += 80;
  // Generation bonus
  if (m.generation > 1) price += Math.min((m.generation - 1) * 2, 40);
  // Stage multiplier
  const mult = { egg: 0.5, baby: 0.7, juvenile: 0.9, adult: 1.0 }[m.stage] ?? 1.0;
  return Math.max(1, Math.round(price * mult));
}

function sellMonkey(id) {
  const m = state.monkeys.find(m => m.id === id);
  if (!m || !m.alive) return;
  const price = calcSellPrice(m);
  state.currency += price;
  // Sell-stage milestones (trigger before monkey is removed)
  const ms = state.milestones;
  if (m.stage === 'egg'      && !ms.firstEggSold)      { ms.firstEggSold      = true; addXP(25);  addLog('💰 Milestone: First Egg Sale!');    addNotification('💰 Milestone: First Egg Sale!');    AudioEngine.play('levelup'); }
  if (m.stage === 'baby'     && !ms.firstBabySold)     { ms.firstBabySold     = true; addXP(25);  addLog('💰 Milestone: Baby Broker!');       addNotification('💰 Milestone: Baby Broker!');       AudioEngine.play('levelup'); }
  if (m.stage === 'juvenile' && !ms.firstJuvenileSold) { ms.firstJuvenileSold = true; addXP(50);  addLog('💰 Milestone: Juvenile Trade!');    addNotification('💰 Milestone: Juvenile Trade!');    AudioEngine.play('levelup'); }
  if (m.stage === 'adult'    && !ms.firstAdultSold)    { ms.firstAdultSold    = true; addXP(75);  addLog('💰 Milestone: Adult Auction!');     addNotification('💰 Milestone: Adult Auction!');     AudioEngine.play('levelup'); }
  state.monkeys = state.monkeys.filter(m2 => m2.id !== id);
  if (monkeyEls[id]) { monkeyEls[id].remove(); delete monkeyEls[id]; }
  _popSignature = '';
  addLog(`💰 ${m.name} sold for £${price}.`, null, m.tankId);
  AudioEngine.play('sell');
  // Viral Marketing: selling a rare variant starts a 3-min molt-income boost
  if (skOn('viral_marketing') && m.dna) {
    const color = resolveColorPhenotype(m.dna.body_color);
    const tail  = resolveAllele(m.dna.tail_shape, 'tail_shape');
    const isRare = !['C_PINK','C_GRN'].includes(color) || tail !== 'T_STD';
    if (isRare) {
      state.skills.viralMarketingExpiry = Date.now() + 3 * 60_000;
      addNotification('📣 Viral Marketing! Molt income ×2 for 3 min!');
    }
  }
  saveState();
}
// ─────────────────────────────────────────────────────────────────────────────

// ── SHOP ─────────────────────────────────────────────────────────────────────
const SHOP_ITEMS = {
  // Time-limited
  offlineProtection: { label: '🛡 Offline Protection', desc: 'Prevent deaths while offline. Stackable in 6h blocks (max 24h).', cost: 75,  type: 'timed'     },
  rationBoost:       { label: '🍖 Ration Boost',       desc: 'Halves food drain for 2 hours.',                                  cost: 50,  type: 'timed'     },
  waterTreatment:    { label: '💧 Water Treatment',    desc: 'Halves pollution gain for 2 hours.',                              cost: 60,  type: 'timed'     },
  eggSurge:          { label: '🥚 Egg Surge',          desc: 'Doubles eggs per pregnancy for 1 hour.',                          cost: 120, type: 'timed'     },
  // Permanent
  autoFeeder:        { label: '🤖 Auto-Feeder',        desc: 'Passively adds food (+5 every 30s per tank).',       cost: 500, type: 'permanent' },
  mutationCatalyst:  { label: '🧬 Mutation Catalyst',  desc: 'Permanently increases base mutation rate by 1.5×.',  cost: 300, type: 'permanent' },
  // Inventory consumables
  invLifeBooster:      { label: '🧪 Life Booster',       desc: 'Gives all adults in active tank +10 min lifespan.',  cost: 100, type: 'inventory', invKey: 'lifeBooster'      },
  invBoosterEggPack:   { label: '🥚 Booster Egg Pack',   desc: 'Spawns 5 bonus eggs into the active tank.',         cost: 75,  type: 'inventory', invKey: 'boosterEggPack'   },
  invGlowingFlakes:    { label: '✨ Glowing Flakes',     desc: '10× mutation rate for next birth (parents take damage).', cost: 250, type: 'inventory', invKey: 'glowingFlakes' },
  invMutInhibitor:     { label: '🧪 Mutation Inhibitor', desc: 'Stops mutations in active tank for 10 minutes.',    cost: 175, type: 'inventory', invKey: 'mutationInhibitor' },
  invHydraKiller:      { label: '🧴 Chemical Drop',      desc: 'Instantly kills a Hydra lurking on any tank glass.', cost: 800, type: 'inventory', invKey: 'hydraKiller'      },
};

const OFFLINE_PROT_BLOCK  = 6 * 60 * 60 * 1000; // 6 hours per block
const TIMED_BOOST_MS      = 2 * 60 * 60 * 1000; // 2 hours for boosts
const EGG_SURGE_MS        = 1 * 60 * 60 * 1000; // 1 hour for egg surge
const MUT_INHIBITOR_MS    = 10 * 60 * 1000;      // 10 minutes

function buyShopItem(key) {
  const item = SHOP_ITEMS[key];
  if (!item) return;
  const now = Date.now();
  // Apply Bulk Discount skill (10% off all shop purchases)
  const effectiveCost = k => Math.floor(SHOP_ITEMS[k].cost * (skOn('bulk_discount') ? 0.9 : 1));

  // Inventory consumable — just add to stock
  if (item.type === 'inventory') {
    if (state.currency < effectiveCost(key)) { addNotification('Not enough funds!'); return; }
    state.currency -= effectiveCost(key);
    state.inventory[item.invKey] = (state.inventory[item.invKey] || 0) + 1;
    state.stats.totalShopPurchases = (state.stats.totalShopPurchases || 0) + 1;
    addLog(`🛒 Purchased ${item.label}.`);
    saveState();
    renderShop();
    return;
  }

  // Permanent — check not already owned
  if (item.type === 'permanent') {
    if (state.shop[key]) { addNotification('Already purchased!'); return; }
    if (state.currency < effectiveCost(key)) { addNotification('Not enough funds!'); return; }
    state.currency -= effectiveCost(key);
    state.shop[key] = true;
    state.stats.totalShopPurchases = (state.stats.totalShopPurchases || 0) + 1;
    addLog(`🛒 Purchased ${item.label}.`);
    saveState();
    renderShop();
    return;
  }

  // Time-limited
  if (state.currency < effectiveCost(key)) { addNotification('Not enough funds!'); return; }

  if (key === 'offlineProtection') {
    const current = Math.max(now, state.offlineProtectionExpiry || 0);
    const maxExpiry = now + 24 * 60 * 60 * 1000;
    if (current >= maxExpiry) { addNotification('Max protection reached (24h)!'); return; }
    state.currency -= effectiveCost(key);
    state.offlineProtectionExpiry = Math.min(current + OFFLINE_PROT_BLOCK, maxExpiry);
    addLog(`🛡 Offline protection extended to ${fmtProtRemaining()}.`);
  } else if (key === 'rationBoost') {
    state.currency -= effectiveCost(key);
    state.shop.rationBoostExpiry = Math.max(now, state.shop.rationBoostExpiry || 0) + TIMED_BOOST_MS;
    addLog(`🍖 Ration Boost active for 2h.`);
  } else if (key === 'waterTreatment') {
    state.currency -= effectiveCost(key);
    state.shop.waterTreatExpiry = Math.max(now, state.shop.waterTreatExpiry || 0) + TIMED_BOOST_MS;
    addLog(`💧 Water Treatment active for 2h.`);
  } else if (key === 'eggSurge') {
    state.currency -= effectiveCost(key);
    state.shop.eggSurgeExpiry = Math.max(now, state.shop.eggSurgeExpiry || 0) + EGG_SURGE_MS;
    addLog(`🥚 Egg Surge active for 1h — doubled egg counts!`);
  }

  state.stats.totalShopPurchases = (state.stats.totalShopPurchases || 0) + 1;
  saveState();
  renderShop();
}

function buyPopUpgrade(tankId) {
  const tank = state.tanks.find(t => t.id === tankId);
  if (!tank) return;
  const level = tank.popLevel ?? 0;
  if (level >= POP_LEVELS.length - 1) { addNotification('Already at max capacity!'); return; }
  const cost = POP_UPGRADE_COSTS[level];
  if (state.currency < cost) { addNotification('Not enough funds!'); return; }
  state.currency -= cost;
  tank.popLevel = level + 1;
  _tmSig = '';
  addLog(`📊 ${tank.name} capacity upgraded to ${POP_LEVELS[tank.popLevel]}.`);
  saveState();
}

function buyEggSkimmer(tankId) {
  const tank = state.tanks.find(t => t.id === tankId);
  if (!tank) return;
  if (tank.eggSkimmer) { addNotification('Already installed!'); return; }
  const cost = 2000;
  if (state.currency < cost) { addNotification('Not enough funds!'); return; }
  state.currency -= cost;
  tank.eggSkimmer = true;
  tank.eggSkimmerActive = true;
  _tmSig = '';
  addLog(`🫧 ${tank.name} egg skimmer installed — auto-storing eggs.`, null, tank.id);
  saveState();
}

function toggleEggSkimmer(tankId) {
  const tank = state.tanks.find(t => t.id === tankId);
  if (!tank || !tank.eggSkimmer) return;
  tank.eggSkimmerActive = !tank.eggSkimmerActive;
  _tmSig = '';
  addLog(`🫧 ${tank.name} egg skimmer ${tank.eggSkimmerActive ? 'enabled' : 'disabled'}.`, null, tank.id);
  saveState();
}

function buySnail(tankId) {
  const tank = state.tanks.find(t => t.id === tankId);
  if (!tank) return;
  if (tank.snail) { addNotification('Snail already lives here!'); return; }
  if (state.currency < SNAIL_COST) { addNotification('Not enough funds!'); return; }
  state.currency -= SNAIL_COST;
  tank.snail = true;
  tank.snailLastEat = Date.now();
  _tmSig = '';
  addLog(`🐌 Snail companion moved into ${tank.name} — it will eat corpses so you don't have to.`, null, tank.id);
  saveState();
}

function useHydraKiller(tankId) {
  const tank = state.tanks.find(t => t.id === tankId);
  if (!tank) return;
  if (!tank.hydra) { addNotification('No hydra in that tank!'); return; }
  if (!(state.inventory.hydraKiller > 0)) { addNotification('No Chemical Drops in stock!'); return; }
  state.inventory.hydraKiller--;
  tank.hydra = null;
  _tmSig = '';
  state.stats.hydrasDefeated = (state.stats.hydrasDefeated || 0) + 1;
  addLog(`🧴 Chemical Drop used in ${tank.name} — Hydra eliminated!`, null, tank.id);
  addNotification('🪸 Hydra destroyed!');
  AudioEngine.play('grant');
  saveState();
}

function fmtProtRemaining() {
  const rem = Math.max(0, (state.offlineProtectionExpiry || 0) - Date.now());
  if (!rem) return 'None';
  const h = Math.floor(rem / 3600000);
  const m = Math.floor((rem % 3600000) / 60000);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function fmtBoostRemaining(expiry) {
  const rem = Math.max(0, (expiry || 0) - Date.now());
  if (!rem) return null;
  const h = Math.floor(rem / 3600000);
  const m = Math.floor((rem % 3600000) / 60000);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

let _shopSig = '';
function renderShop() {
  const list = document.getElementById('shop-item-list');
  if (!list) return;
  const now = Date.now();
  const grace = now < (state.gracePeriodUntil || 0);
  const graceRem = grace ? Math.ceil((state.gracePeriodUntil - now) / 1000) : 0;

  const protRem  = fmtBoostRemaining(state.offlineProtectionExpiry);
  const rationRem  = fmtBoostRemaining(state.shop.rationBoostExpiry);
  const waterRem   = fmtBoostRemaining(state.shop.waterTreatExpiry);
  const eggSurgeRem = fmtBoostRemaining(state.shop.eggSurgeExpiry);
  const maxProt   = (state.offlineProtectionExpiry || 0) >= now + 24 * 60 * 60 * 1000 - 1000;

  const sig = [state.currency, protRem, rationRem, waterRem, eggSurgeRem,
    state.shop.autoFeeder, state.shop.mutationCatalyst,
    state.inventory.lifeBooster, state.inventory.boosterEggPack,
    state.inventory.glowingFlakes, state.inventory.mutationInhibitor, state.inventory.hydraKiller,
    graceRem > 0 ? Math.floor(graceRem / 5) : 0].join('|');
  if (sig === _shopSig) return;
  _shopSig = sig;

  const balEl = document.getElementById('shop-balance-val');
  if (balEl) balEl.textContent = `£${(state.currency || 0).toLocaleString()}`;

  const canAfford = key => state.currency >= SHOP_ITEMS[key].cost;

  function timedRow(key, remainStr, extra = '') {
    const item = SHOP_ITEMS[key];
    const active = !!remainStr;
    return `<div class="shop-item">
      <div class="shop-item-info">
        <span class="shop-item-label">${item.label}${active ? ` <span class="shop-active-badge">● ACTIVE</span>` : ''}</span>
        <span class="shop-item-desc">${item.desc}${active ? `<br><span class="shop-time-left">⏱ ${remainStr} remaining</span>` : ''}${extra}</span>
      </div>
      <div class="shop-item-action">
        <span class="shop-item-cost">£${item.cost}</span>
        <button class="btn shop-buy-btn" data-shop-buy="${key}" ${canAfford(key) ? '' : 'disabled'}>Buy</button>
      </div>
    </div>`;
  }

  function permRow(key) {
    const item = SHOP_ITEMS[key];
    const owned = !!state.shop[key];
    return `<div class="shop-item${owned ? ' shop-item-owned' : ''}">
      <div class="shop-item-info">
        <span class="shop-item-label">${item.label}${owned ? ' <span class="shop-owned-badge">✓ Owned</span>' : ''}</span>
        <span class="shop-item-desc">${item.desc}</span>
      </div>
      <div class="shop-item-action">
        <span class="shop-item-cost">${owned ? '' : '£' + item.cost}</span>
        <button class="btn shop-buy-btn" data-shop-buy="${key}" ${owned || !canAfford(key) ? 'disabled' : ''}>
          ${owned ? 'Purchased' : 'Buy'}
        </button>
      </div>
    </div>`;
  }

  const protExtra = maxProt ? '<br><span class="shop-time-left">⚠ Maximum 24h reached.</span>' : '';
  const offlineBuyBtn = `<div class="shop-item">
    <div class="shop-item-info">
      <span class="shop-item-label">${SHOP_ITEMS.offlineProtection.label}${protRem ? ` <span class="shop-active-badge">● ACTIVE</span>` : ''}</span>
      <span class="shop-item-desc">${SHOP_ITEMS.offlineProtection.desc}${protRem ? `<br><span class="shop-time-left">⏱ ${protRem} remaining</span>` : ''}${protExtra}</span>
    </div>
    <div class="shop-item-action">
      <span class="shop-item-cost">£${SHOP_ITEMS.offlineProtection.cost}<small> /6h</small></span>
      <button class="btn shop-buy-btn" data-shop-buy="offlineProtection" ${maxProt || !canAfford('offlineProtection') ? 'disabled' : ''}>+6h</button>
    </div>
  </div>`;

  list.innerHTML = `
    ${grace ? `<div class="shop-grace-banner">🛡 Grace period active — deaths paused for ${graceRem}s</div>` : ''}
    <div class="shop-section-header">⏱ Time-Limited</div>
    ${offlineBuyBtn}
    ${timedRow('rationBoost', rationRem)}
    ${timedRow('waterTreatment', waterRem)}
    ${timedRow('eggSurge', eggSurgeRem)}
    <div class="shop-section-header">⭐ Permanent Upgrades</div>
    ${permRow('autoFeeder')}
    ${permRow('mutationCatalyst')}
    <div class="shop-section-header">🎒 Consumables</div>
    ${['invLifeBooster','invBoosterEggPack','invGlowingFlakes','invMutInhibitor','invHydraKiller'].map(key => {
      const item = SHOP_ITEMS[key];
      const stock = state.inventory[item.invKey] || 0;
      return `<div class="shop-item">
        <div class="shop-item-info">
          <span class="shop-item-label">${item.label} <span class="shop-stock-badge">Owned: ${stock}</span></span>
          <span class="shop-item-desc">${item.desc}</span>
        </div>
        <div class="shop-item-action">
          <span class="shop-item-cost">£${item.cost}</span>
          <button class="btn shop-buy-btn" data-shop-buy="${key}" ${canAfford(key) ? '' : 'disabled'}>Buy</button>
        </div>
      </div>`;
    }).join('')}
  `;
}
// ─────────────────────────────────────────────────────────────────────────────

function pickName(sex) {
  const pool = sex === 'M' ? NAMES_M : NAMES_F;
  const used = new Set(state.monkeys.map(m => m.name));
  const available = pool.filter(n => !used.has(n));
  if (available.length > 0) return available[Math.floor(Math.random() * available.length)];
  return 'Monkey #' + state.nextMonkeyId;
}

function createMonkey(opts = {}) {
  const id = state.nextMonkeyId++;
  const now = Date.now();
  const dna = opts.dna || defaultDNA();
  const sex = opts.sex || (Math.random() < 0.5 ? 'M' : 'F');
  const monkey = {
    id,
    name: opts.name || pickName(sex),
    sex,
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
    tankId: opts.tankId ?? state.activeTankId,
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
  addLog(`💀 ${monkey.name} died (${cause})`, `💀 died (${cause})`, monkey.tankId);
  if (cause != 'old age') AudioEngine.play('death');
  const condRow = document.querySelector(`[data-cond-tank="${monkey.tankId}"]`);
  if (condRow && cause !== 'old age') {
    condRow.classList.remove('tank-row-flash');
    void condRow.offsetWidth; // restart animation if row is already flashing
    condRow.classList.add('tank-row-flash');
  }
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
    tankId: m.tankId ?? state.activeTankId,
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
function inheritGenes(parentA, parentB, glowingFlakesActive = false, noMutation = false) {
  const catalystMult  = (!noMutation && state.shop?.mutationCatalyst) ? 1.5 : 1;
  const mendelsBonus  = 1 + (sk('mendels_luck') * 0.01);
  const mutMult = noMutation ? 0 : (glowingFlakesActive ? 10 : 1) * catalystMult * mendelsBonus;

  function inheritLocus(pA, pB, geneId) {
    const gene = GENE_DATA.find(g => g.id === geneId);
    let a = pA[Math.floor(Math.random() * 2)];
    let b = pB[Math.floor(Math.random() * 2)];
    function maybeMutate(allele) {
      // Dominant Recessive: 10% chance to express a higher-dominance allele instead
      if (skOn('dominant_recessive') && Math.random() < 0.10) {
        const cur = gene.alleles.find(al => al.code === allele);
        const higher = gene.alleles.filter(al => (al.dominance_level ?? 10) > (cur?.dominance_level ?? 10) && al.mutation_chance > 0);
        if (higher.length) return higher[Math.floor(Math.random() * higher.length)].code;
      }
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
  const mb = getMasteryBonuses();
  state.playTimeMs = (state.playTimeMs || 0) + dtMs;

  // Process each tank independently
  for (const tank of state.tanks) {
    // --- Purification countdown (runs even before eggs) ---
    if (tank.purifying && !tank.waterPure) {
      const elapsed = Date.now() - tank.purifyStartTime;
      const effectivePurifyElapsed = debugMode ? elapsed * debugSpeed : elapsed;
      if (effectivePurifyElapsed >= tank.purifyDuration) {
        tank.waterPure = true;
        tank.purifying = false;
        addLog('🌊 Water is pure! Ready to release eggs.', null, tank.id);
      }
    }

    if (!tank.eggsAdded) continue;

    const aliveTank   = state.monkeys.filter(m => m.alive && m.tankId === tank.id && !m.inStorage);
    const aliveNonEgg = aliveTank.filter(m => m.stage !== 'egg');
    const deadTank    = state.monkeys.filter(m => !m.alive && m.tankId === tank.id);

    // --- Continuous XP for keeping monkeys alive (active tank only) ---
    if (tank.id === state.activeTankId) {
      const xpAdults    = aliveTank.filter(m => m.stage === 'adult').length;
      const xpJuveniles = aliveTank.filter(m => m.stage === 'juvenile').length;
      addXP((xpAdults * 1 + xpJuveniles * 0.5) * dtSec / 60);
    }

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
    const aer = tank.aeration;
    if (aer.level > 0 && aer.startedAt != null) {
      const aerElapsed = (Date.now() - aer.startedAt) * (debugMode ? debugSpeed : 1);
      if (aerElapsed >= aer.duration) {
        aer.level--;
        addLog(`💨 Aeration downgraded to ${AERATION_LEVELS[aer.level].name}.`, null, tank.id);
        if (aer.level > 0) {
          const lvl = AERATION_LEVELS[aer.level];
          aer.startedAt = Date.now();
          aer.duration  = randRange(lvl.durationMin, lvl.durationMax);
        } else {
          aer.startedAt = null;
          aer.duration  = null;
        }
        if (tank.id === state.activeTankId) generateBubbles(AERATION_BUBBLE_COUNTS[aer.level]);
      }
    }

    // --- Skimmer expiry/downgrade ---
    const skim = tank.skimmer;
    if (skim.level > 0 && skim.startedAt != null) {
      const skimElapsed = (Date.now() - skim.startedAt) * (debugMode ? debugSpeed : 1);
      if (skimElapsed >= skim.duration) {
        skim.level--;
        addLog(`🧹 Skimmer downgraded to ${SKIMMER_LEVELS[skim.level].name}.`, null, tank.id);
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
    const feeder = tank.feeder;
    if (feeder.level > 0 && feeder.startedAt != null) {
      const feederElapsed = (Date.now() - feeder.startedAt) * (debugMode ? debugSpeed : 1);
      if (feederElapsed >= feeder.duration) {
        feeder.level--;
        addLog(`🍽️ Feeder downgraded to ${FEEDER_LEVELS[feeder.level].name}.`, null, tank.id);
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
        if (tank.id === state.activeTankId) spawnFoodFlakes();
      }
    }

    const aerRegen    = AERATION_LEVELS[aer.level]?.passiveRegen    || 0;
    const skimRegen   = SKIMMER_LEVELS[skim.level]?.passiveRegen    || 0;
    const feederRegen = FEEDER_LEVELS[feeder.level]?.passiveRegen   || 0;
    const corpseRate  = mb.ironReduceCorpse ? DEAD_DRAIN_PER * 0.5 : DEAD_DRAIN_PER;
    const now2 = Date.now();
    const rationBoostActive = now2 < (state.shop?.rationBoostExpiry || 0);
    const waterTreatActive  = now2 < (state.shop?.waterTreatExpiry  || 0);
    const foodDrainMult  = rationBoostActive ? 0.5 : 1.0;
    const cleanDrainMult = waterTreatActive  ? 0.5 : 1.0;
    // Auto-feeder: passive +5 food/30s per tank
    let autoFeedBonus = 0;
    if (state.shop?.autoFeeder) {
      state._autoFeedAccum = (state._autoFeedAccum || 0) + dtSec;
      if (state._autoFeedAccum >= 30) { state._autoFeedAccum -= 30; autoFeedBonus = 5; }
    }
    const skillFoodMult  = skOn('dietary_efficiency') ? 0.80 : 1;
    const skillO2Mult    = skOn('iron_lungs')         ? 0.85 : 1;
    const skillCleanMult = skOn('teflon_glass')       ? 0.85 : 1;
    const skillO2Regen   = skOn('aerobic_bacteria')   ? 0.03 : 0;
    tank.food        = Math.max(0, Math.min(getMaxFood(tank),        tank.food        - foodDrain * dtSec * mb.foodMult * mb.voidHungerMult * foodDrainMult * skillFoodMult + feederRegen * dtSec + autoFeedBonus));
    tank.oxygen      = Math.max(0, Math.min(getMaxOxygen(tank),      tank.oxygen      - OXYGEN_DRAIN_PER * aliveNonEgg.length * dtSec * mb.oxygenMult * skillO2Mult + (oxygenGain + aerRegen + BASE_OXYGEN_REGEN + skillO2Regen) * dtSec));
    tank.cleanliness = Math.max(0, Math.min(getMaxCleanliness(tank), tank.cleanliness - (CLEAN_DRAIN_PER * aliveNonEgg.length + corpseRate * deadTank.length) * dtSec * mb.cleanMult * cleanDrainMult * skillCleanMult + (cleanGain + skimRegen + BASE_CLEAN_REGEN) * dtSec));

    if (debugMode) {
      if (debugLocks.food   !== 'normal') tank.food        = debugLocks.food   === '0' ? 0 : 100;
      if (debugLocks.oxygen !== 'normal') tank.oxygen      = debugLocks.oxygen === '0' ? 0 : 100;
      if (debugLocks.clean  !== 'normal') tank.cleanliness = debugLocks.clean  === '0' ? 0 : 100;
      const _lockLS = (obj, key) => {
        const lvl = parseInt(key);
        obj.level = lvl;
        if (lvl > 0) { obj.startedAt = Date.now(); obj.duration = 999_999_999; }
        else         { obj.startedAt = null; obj.duration = null; }
      };
      if (debugLocks.aer    !== 'normal') _lockLS(aer,    debugLocks.aer);
      if (debugLocks.skim   !== 'normal') _lockLS(skim,   debugLocks.skim);
      if (debugLocks.feeder !== 'normal') _lockLS(feeder, debugLocks.feeder);
    }

    // --- Update each monkey in this tank ---
    for (const m of aliveTank) {
      updateMonkeyHealth(m, dtSec, tank);
      if (!m.alive) continue;
      updateMonkeyStage(m, tank);
      if (!m.alive) continue;
      if (m.stage === 'adult' && m.sex === 'F') {
        updateMonkeyReproduction(m, aliveTank, tank);
      }
    }

    // --- Process births for this tank ---
    processBirths(aliveTank, tank);

    // --- Snail companion: eats one corpse on its timer, may snag a live egg ---
    if (tank.snail) {
      if (!tank.snailLastEat) tank.snailLastEat = Date.now();
      const snailElapsed = (Date.now() - tank.snailLastEat) * (debugMode ? debugSpeed : 1);
      if (snailElapsed >= SNAIL_EAT_INTERVAL) {
        tank.snailLastEat = Date.now();
        const corpseIdx = state.monkeys.findIndex(m => m.tankId === tank.id && !m.alive && m.diedAt);
        if (corpseIdx !== -1) {
          state.monkeys.splice(corpseIdx, 1);
          addLog(`🐌 The snail munched a corpse in ${tank.name}.`, null, tank.id);
          // Small chance to accidentally eat a live egg
          if (Math.random() < SNAIL_EGG_CHANCE) {
            const eggIdx = state.monkeys.findIndex(m => m.tankId === tank.id && m.alive && m.stage === 'egg' && !m.inStorage);
            if (eggIdx !== -1) {
              state.monkeys.splice(eggIdx, 1);
              addLog(`🐌 Oops! The snail ate an egg by mistake in ${tank.name}!`, null, tank.id);
              addNotification(`🐌 Snail ate an egg!`);
            }
          }
        }
      }
    }

    // --- Hydra: rare spawn, swims and hunts sea monkeys ---
    const alivePrey = state.monkeys.filter(m => m.tankId === tank.id && m.alive && !m.inStorage);
    if (!tank.hydra && alivePrey.length > 0 && !_calculatingOfflineProgress) {
      const spawnProb = HYDRA_SPAWN_CHANCE * dtSec * (debugMode ? debugSpeed : 1);
      if (Math.random() < spawnProb) {
        tank.hydra = { hp: HYDRA_HP, lastHunt: Date.now(), huntInterval: HYDRA_HUNT_MIN + Math.random() * (HYDRA_HUNT_MAX - HYDRA_HUNT_MIN) };
        _tmSig = '';
        AudioEngine.play('alarm');
        addLog(`🪸 A Hydra appeared in ${tank.name}! Click it to fight it off!`, null, tank.id);
        addNotification(`🪸 Hydra in ${tank.name}!`);
      }
    }
    if (tank.hydra) {
      if (!tank.hydra.lastHunt)    tank.hydra.lastHunt    = Date.now();
      if (!tank.hydra.huntInterval) tank.hydra.huntInterval = HYDRA_HUNT_MIN;
      const hydraElapsed = (Date.now() - tank.hydra.lastHunt) * (debugMode ? debugSpeed : 1);
      if (hydraElapsed >= tank.hydra.huntInterval) {
        tank.hydra.lastHunt    = Date.now();
        tank.hydra.huntInterval = HYDRA_HUNT_MIN + Math.random() * (HYDRA_HUNT_MAX - HYDRA_HUNT_MIN);
        // Prefer eggs (most vulnerable), then babies, then any alive monkey
        const prey =
          state.monkeys.find(m => m.tankId === tank.id && m.alive && !m.inStorage && m.stage === 'egg') ||
          state.monkeys.find(m => m.tankId === tank.id && m.alive && !m.inStorage && m.stage === 'baby') ||
          state.monkeys.find(m => m.tankId === tank.id && m.alive && !m.inStorage);
        if (prey) {
          killMonkey(prey, 'hydra');
          addLog(`🪸 The Hydra devoured ${prey.name} in ${tank.name}!`, null, tank.id);
          addNotification(`🪸 Hydra struck in ${tank.name}!`);
        }
      }
    }

    // --- Auto-remove corpses after 5 minutes, penalise cleanliness ---
    const CORPSE_TTL = 5 * 60 * 1000 * (skOn('preservatives') ? 1.2 : 1);
    const now = Date.now();
    const beforeLen = state.monkeys.filter(m => m.tankId === tank.id).length;
    state.monkeys = state.monkeys.filter(m => {
      if (m.tankId !== tank.id || m.alive || !m.diedAt) return true;
      if (now - m.diedAt >= CORPSE_TTL) {
        if (skOn('circle_of_life')) {
          tank.food = Math.min(100, tank.food + 5); // dissolve into food
        } else {
          tank.cleanliness = Math.max(0, tank.cleanliness - 5);
        }
        return false;
      }
      return true;
    });
    const afterLen = state.monkeys.filter(m => m.tankId === tank.id).length;
    if (afterLen < beforeLen) {
      const removed = beforeLen - afterLen;
      if (skOn('circle_of_life')) {
        addLog(`♻️ Corpse${removed > 1 ? 's' : ''} dissolved into nutrients in ${tank.name}.`, null, tank.id);
      } else {
        addLog(`🧹 Corpse${removed > 1 ? 's' : ''} decayed. -${removed * 5} cleanliness.`, null, tank.id);
      }
    }
  }

  // --- Update global stats ---
  const livePop = state.monkeys.filter(m => m.alive).length;
  if (livePop > state.stats.peakPopulation) state.stats.peakPopulation = livePop;

  // --- Phantom Siphon: remove one corpse globally every 60s ---
  if (skOn('phantom_siphon')) {
    if (!state.skills.phantomLastEat) state.skills.phantomLastEat = Date.now();
    const phElapsed = (Date.now() - state.skills.phantomLastEat) * (debugMode ? debugSpeed : 1);
    if (phElapsed >= 60_000) {
      state.skills.phantomLastEat = Date.now();
      const ci = state.monkeys.findIndex(m => !m.alive && m.diedAt);
      if (ci !== -1) {
        const tankName = state.tanks.find(t => t.id === state.monkeys[ci].tankId)?.name || 'a tank';
        state.monkeys.splice(ci, 1);
        addLog(`👻 The Phantom Siphon removed a corpse from ${tankName}.`);
      }
    }
  }

  // --- Angel Investor: £3,000 bonus first time each tank hits 50 monkeys ---
  if (skOn('angel_investor')) {
    if (!state.skills.angelInvestorUsedTanks) state.skills.angelInvestorUsedTanks = [];
    for (const tank of state.tanks) {
      if (state.skills.angelInvestorUsedTanks.includes(tank.id)) continue;
      const count = state.monkeys.filter(m => m.alive && !m.inStorage && m.tankId === tank.id).length;
      if (count >= 50) {
        state.skills.angelInvestorUsedTanks.push(tank.id);
        state.currency += 3000;
        addLog(`💸 Angel Investor triggered in ${tank.name}! +£3,000`);
        addNotification(`💸 Angel Investor! +£3,000`);
      }
    }
  }

  checkGrantsInTick(dtMs);
  checkMilestones();
  saveState();
}

function updateMonkeyHealth(m, dtSec, t) {
  if (m.stage === 'egg') return; // eggs don't need food/oxygen
  if (_suppressDeaths || Date.now() < (state.gracePeriodUntil || 0)) return;

  let dmg = 0;
  let regen = 0;

  if (t.oxygen <= 0) dmg += DMG_NO_OXYGEN * dtSec;
  if (t.food   <= 0) dmg += DMG_NO_FOOD   * dtSec;

  // Constitution-based dirty water damage: H_IRON (0.8 res) takes far less; H_SENS (-0.5 res) takes more
  const stats = resolveStats(m);
  if (t.cleanliness < 20) {
    const radiantMult = skOn('radiant_glow') &&
      ['C_BIO','C_GOLD'].includes(resolveColorPhenotype(m.dna?.body_color)) ? 0.5 : 1;
    dmg += DMG_DIRTY * (1 - stats.pollutionRes) * radiantMult * dtSec;
  }

  if (dmg === 0 && t.food > 50 && t.oxygen > 50 && t.cleanliness > 50) {
    regen = REGEN_RATE * dtSec;
  }

  m.health = Math.min(stats.maxHealth, Math.max(0, m.health - dmg + regen));

  if (m.health <= 0) {
    const cause = t.oxygen <= 0 ? 'suffocation' : t.food <= 0 ? 'starvation' : 'poor water quality';
    killMonkey(m, cause);
  }
}

function updateMonkeyStage(m, tank) {
  if (m.inStorage) return;
  const now = Date.now();
  const elapsed = now - m.stageStartTime;
  const effectiveElapsed = debugMode ? elapsed * debugSpeed : elapsed;
  const dur = m.stageDuration || 0;
  const stats = resolveStats(m);

  if (m.stage === 'egg' && effectiveElapsed >= dur) {
    if (Math.random() < 0.2) createMolt(m, 'egg');
    m.stage = 'baby';
    m.stageStartTime = now;
    m.stageDuration = randRange(...BABY_GROW) / stats.growthSpeed * (skOn('incubator') ? 0.7 : 1);
    checkDexDiscovery(m);
    addXP(5);
    addLog(`🐠 ${m.name} hatched!`, '🐠 hatched!', m.tankId);
  } else if (m.stage === 'baby' && effectiveElapsed >= dur) {
    if (Math.random() < 0.2) createMolt(m, 'baby');
    m.stage = 'juvenile';
    m.stageStartTime = now;
    m.stageDuration = randRange(...JUV_GROW) / stats.growthSpeed;
    addXP(10);
    addLog(`🐟 ${m.name} grew into a juvenile!`, '🐟 grew into a juvenile!', m.tankId);
  } else if (m.stage === 'juvenile' && effectiveElapsed >= dur) {
    if (Math.random() < 0.2) createMolt(m, 'juvenile');
    m.stage = 'adult';
    m.stageStartTime = now;
    const mb = getMasteryBonuses();
    m.stageDuration = randRange(...ADULT_LIFE) * stats.lifeMult * mb.lifespanMult * (skOn('fountain_of_youth') ? 1.2 : 1);
    addXP(20);
    addLog(`🦐 ${m.name} is now an adult ${m.sex === 'M' ? '(male)' : '(female)'}!`, `🦐 became an adult ${m.sex === 'M' ? '(male)' : '(female)'}!`, m.tankId);
  } else if (m.stage === 'adult' && effectiveElapsed >= dur) {
    if (!_suppressDeaths && Date.now() >= (state.gracePeriodUntil || 0)) {
      // Cryo-Pod: monkeys in the designated tank never die of old age
      if (skOn('cryo_pod') && state.skills.cryoPodTankId === m.tankId) {
        m.stageStartTime = now; // reset the clock — immortal
      } else {
        killMonkey(m, 'old age');
      }
    }
  }
}

function updateMonkeyReproduction(female, aliveMonkeys, tank) {
  if (female.pregnant) return;
  if (aliveMonkeys.length >= getMaxPop(tank)) return;
  const now = Date.now();
  const cooldownElapsed = (now - (female.lastMatedAt || 0)) * (debugMode ? debugSpeed : 1);
  if (female.lastMatedAt && cooldownElapsed < MATING_COOLDOWN) return;

  const males = aliveMonkeys.filter(m => {
    if (!m.alive || m.stage !== 'adult' || m.sex !== 'M') return false;
    const cdElapsed = (now - (m.lastMatedAt || 0)) * (debugMode ? debugSpeed : 1);
    return !m.lastMatedAt || cdElapsed >= MATING_COOLDOWN;
  });
  if (males.length === 0) return;

  const mate = males[Math.floor(Math.random() * males.length)];
  female.pregnant = true;
  female.pregnantSince = now;
  female.pregnancyDuration = randRange(...PREGNANCY);
  female.mateId = mate.id;
  female.lastMatedAt = now;
  mate.lastMatedAt = now;
  state.stats.totalMatingEvents++;
  addXP(5);
  addLog(`💕 ${female.name} & ${mate.name} mated!`, '💕 mated!', female.tankId);
}

function processBirths(aliveMonkeys, tank) {
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

    // Glowing Flakes: boost mutations, deal damage to parents (per-tank, stackable)
    const usedFlakes = (tank.glowingFlakesActive || 0) > 0;
    if (usedFlakes) {
      m.health = Math.max(1, m.health - 20);
      if (father?.alive) father.health = Math.max(1, father.health - 10);
      tank.glowingFlakesActive--;
    }

    const mb = getMasteryBonuses();
    const eggSurgeActive = Date.now() < (state.shop?.eggSurgeExpiry || 0);
    const inhibitorActive = Date.now() < (tank.mutationInhibitorUntil || 0);
    const baseCount = 1 + Math.floor(Math.random() * 3) + mb.extraEgg + mb.twinExtraEgg + mb.fanMult;
    const count = eggSurgeActive ? baseCount * 2 : baseCount;
    for (let i = 0; i < count; i++) {
      if (aliveMonkeys.length >= getMaxPop(tank)) break;
      let dna = inheritGenes(m, father || m, usedFlakes, inhibitorActive);
      // DNA Archive: 15% chance to use stored DNA instead
      if (skOn('dna_archive') && state.skills.storedDNA && Math.random() < 0.15) {
        dna = JSON.parse(JSON.stringify(state.skills.storedDNA.dna));
      }
      const baby = createMonkey({ generation: gen, dna, tankId: tank.id });
      if (tank.eggSkimmerActive) baby.inStorage = true;
      // Mitosis: 5% chance for an identical twin
      if (skOn('mitosis') && Math.random() < 0.05 && aliveMonkeys.length + 1 < getMaxPop(tank)) {
        const twin = createMonkey({ generation: gen, dna: JSON.parse(JSON.stringify(dna)), tankId: tank.id });
        if (tank.eggSkimmerActive) twin.inStorage = true;
        addLog(`🧬 Mitosis! ${baby.name} hatched with an identical twin!`, '🧬 Mitosis!', tank.id);
      }
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
      addLog(`🥚 ${m.name} laid egg: ${baby.name} [${tag}]!`, '🥚 egg laid!', tank.id);
    }
    if (usedFlakes) addLog('✨ Glowing Flakes boosted mutation rates for this birth! (parents took damage)', null, tank.id);
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
      AudioEngine.play('discovery');
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
      AudioEngine.play('discovery');
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
      AudioEngine.play('discovery');
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
        AudioEngine.play('discovery');
      }
      checkMastery('filterFeeder');
    }
  }
}

function checkMastery(key) {
  const entry = state.dex[key];
  if (!entry || entry.mastered) return;
  const allVariants = [...DEX_COLOR_VARIANTS, ...DEX_TAIL_VARIANTS, ...DEX_METAB_VARIANTS, ...DEX_CONST_VARIANTS, ...DEX_LONGEV_VARIANTS, ...DEX_FUNC_VARIANTS];
  const variant = allVariants.find(v => v.key === key);
  const colorOrTailKeys = ['C_PINK','C_GRN','purple','C_BLU','C_GOLD','C_VOID','C_BIO','C_TRANS','T_STD','T_FAN','T_DBL'];
  const threshold = variant?.masteryThreshold ?? (colorOrTailKeys.includes(key) ? MASTERY_THRESHOLD_COLOR : MASTERY_THRESHOLD_FUNC);
  if (entry.count >= threshold) {
    entry.mastered = true;
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
  if (!ms.gen3 && state.stats.totalGenerations >= 3) {
    ms.gen3 = true;
    state.inventory.mutationInhibitor++;
    addXP(75);
    addLog('🧬 Milestone: Third generation! +1 🧪 Mutation Inhibitor');
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

  // First hydra defeated
  if (!ms.firstHydra && (state.stats.hydrasDefeated || 0) >= 1) {
    ms.firstHydra = true;
    state.inventory.hydraKiller++;
    addXP(150);
    addLog('🪸 Milestone: Hydra Slayer! You defeated your first Hydra! +1 🧴 Chemical Drop');
    addNotification('🪸 Milestone: Hydra Slayer!');
  }

  // Convenience helper: set flag, run reward fn, log/notify
  const award = (key, notify, logMsg, rewardFn) => {
    if (ms[key]) return;
    ms[key] = true;
    rewardFn();
    addLog(logMsg);
    addNotification(notify);
    AudioEngine.play('levelup');
  };

  // Egg storage
  if (!ms.firstEggStored && state.monkeys.some(m => m.inStorage)) {
    award('firstEggStored', '📦 Milestone: Cold Storage!',
      '📦 Milestone: Cold Storage — first egg stored! +50 XP',
      () => addXP(50));
  }

  // Shop
  if (!ms.firstShopPurchase && (state.stats.totalShopPurchases || 0) >= 1) {
    award('firstShopPurchase', '🛒 Milestone: First Purchase!',
      '🛒 Milestone: First Purchase — welcome to the shop! +25 XP',
      () => addXP(25));
  }

  // Grants
  const gc = state.stats.grantsCompleted || 0;
  if (!ms.grants1   && gc >=   1) award('grants1',   '📋 Milestone: Grant Recipient!',        '📋 Milestone: Grant Recipient — 1 grant done! +50 XP',                              () => addXP(50));
  if (!ms.grants5   && gc >=   5) award('grants5',   '📋 Milestone: Active Researcher!',      '📋 Milestone: Active Researcher — 5 grants! +100 XP, +1 🥚 Egg Pack',              () => { addXP(100); state.inventory.boosterEggPack++; });
  if (!ms.grants10  && gc >=  10) award('grants10',  '📋 Milestone: Senior Scientist!',       '📋 Milestone: Senior Scientist — 10 grants! +200 XP, +1 🧪 Life Booster',          () => { addXP(200); state.inventory.lifeBooster++; });
  if (!ms.grants25  && gc >=  25) award('grants25',  '📋 Milestone: Principal Investigator!', '📋 Milestone: Principal Investigator — 25 grants! +300 XP, +1 🧴 Chemical Drop',    () => { addXP(300); state.inventory.hydraKiller++; });
  if (!ms.grants50  && gc >=  50) award('grants50',  '📋 Milestone: Research Director!',      '📋 Milestone: Research Director — 50 grants! +500 XP, +1 ✨ Glowing Flakes',        () => { addXP(500); state.inventory.glowingFlakes++; });
  if (!ms.grants100 && gc >= 100) award('grants100', '📋 Milestone: Nobel Laureate!',         '📋 Milestone: Nobel Laureate — 100 grants! +1,000 XP, +2 🥚 Egg Packs',            () => { addXP(1000); state.inventory.boosterEggPack += 2; });

  // Skill tree tiers
  const tier = i => SKILL_TREE.some(b => sk(b.nodes[i]?.id));
  if (!ms.skillTier1 && tier(0)) award('skillTier1', '🌿 Milestone: First Skill!',        '🌿 Milestone: First Skill unlocked! +50 XP',            () => addXP(50));
  if (!ms.skillTier2 && tier(1)) award('skillTier2', '🌿 Milestone: Skill Tier 2!',        '🌿 Milestone: Tier-2 skill unlocked! +75 XP',           () => addXP(75));
  if (!ms.skillTier3 && tier(2)) award('skillTier3', '🌿 Milestone: Skill Tier 3!',        '🌿 Milestone: Tier-3 skill unlocked! +100 XP',          () => addXP(100));
  if (!ms.skillTier4 && tier(3)) award('skillTier4', '🌿 Milestone: Skill Tier 4!',        '🌿 Milestone: Tier-4 skill unlocked! +150 XP',          () => addXP(150));
  if (!ms.skillTier5 && tier(4)) award('skillTier5', '🌿 Milestone: Capstone Skill!',      '🌿 Milestone: Capstone skill unlocked! +200 XP',        () => addXP(200));

  // Skill tree branch / all
  if (!ms.skillFullBranch && SKILL_TREE.some(b => b.nodes.every(n => sk(n.id)))) {
    award('skillFullBranch', '🌳 Milestone: Completed Branch!',
      '🌳 Milestone: Completed Branch — all 5 nodes in a branch! +300 XP',
      () => addXP(300));
  }
  if (!ms.skillAllUnlocked && SKILL_TREE.every(b => b.nodes.every(n => sk(n.id)))) {
    award('skillAllUnlocked', '🏅 Milestone: Master of All!',
      '🏅 Milestone: Master of All — every skill unlocked! +1,000 XP, +2 🧴 Chemical Drops',
      () => { addXP(1000); state.inventory.hydraKiller += 2; });
  }
}

async function applyOfflineProgress(onProgress) {
  if (!state.lastTick) return;
  const now = Date.now();
  const originalLastTick = state.lastTick;
  let offlineMs = now - originalLastTick;
  if (offlineMs <= 1000) return;
  offlineMs = Math.min(offlineMs, OFFLINE_CAP_MS);
  state.totalOfflineMs = (state.totalOfflineMs || 0) + offlineMs;

  // Suppress sounds and hydra spawns during offline calculation
  _calculatingOfflineProgress = true;

  // Split into death-protected and unprotected periods
  const protExpiry    = state.offlineProtectionExpiry || 0;
  const protectedMs   = Math.min(offlineMs, Math.max(0, protExpiry - originalLastTick));
  const unprotectedMs = offlineMs - protectedMs;
  const hasProtection = protectedMs > 0;

  const totalMin = Math.round(offlineMs / 60000);
  const protMin  = Math.round(protectedMs / 60000);
  addLog(`⏰ Applied ${totalMin} min of offline progress${hasProtection ? ` (${protMin} min death-protected)` : ''}`);

  const totalChunks = Math.ceil(offlineMs / OFFLINE_CHUNK_MS) || 1;
  let chunksProcessed = 0;
  const YIELD_EVERY = 20; // yield to browser every 20 chunks (~200s sim time)

  // During the protected period monkey stage timers are frozen — push them
  // forward by the full protected duration so no aging occurs offline.
  if (protectedMs > 0) {
    for (const m of state.monkeys) {
      if (!m.alive) continue;
      if (m.stageStartTime != null) m.stageStartTime += protectedMs;
      if (m.pregnantSince  != null) m.pregnantSince  += protectedMs;
      if (m.bornAt         != null) m.bornAt         += protectedMs;
      if (m.lastMatedAt    != null) m.lastMatedAt    += protectedMs;
    }
  }

  // Simulate protected period first (deaths suppressed)
  _suppressDeaths = true;
  let rem = protectedMs;
  while (rem > 0) {
    const chunk = Math.min(rem, OFFLINE_CHUNK_MS);
    state.lastTick = now - offlineMs + (protectedMs - rem) + chunk;
    gameTick(chunk);
    rem -= chunk;
    chunksProcessed++;
    if (onProgress && chunksProcessed % YIELD_EVERY === 0) {
      onProgress(chunksProcessed / totalChunks);
      await new Promise(r => setTimeout(r, 0));
    }
  }
  _suppressDeaths = false;

  // Simulate unprotected period
  rem = unprotectedMs;
  while (rem > 0) {
    const chunk = Math.min(rem, OFFLINE_CHUNK_MS);
    state.lastTick = now - unprotectedMs + (unprotectedMs - rem) + chunk;
    gameTick(chunk);
    rem -= chunk;
    chunksProcessed++;
    if (onProgress && chunksProcessed % YIELD_EVERY === 0) {
      onProgress(chunksProcessed / totalChunks);
      await new Promise(r => setTimeout(r, 0));
    }
  }

  if (onProgress) onProgress(1);

  // Grant 5-min grace period on return if any protection was active
  if (hasProtection) {
    state.gracePeriodUntil = now + 5 * 60 * 1000;
    addLog(`🛡 5-min grace period — deaths paused while you settle in.`);
  }

  // Re-enable sounds and hydra spawns
  _calculatingOfflineProgress = false;
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
  const t = activeTank();
  const rows = [];

  if (t && t.purifying && !t.waterPure) {
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
    const threshold = v.masteryThreshold ?? (COLOR_OR_TAIL_KEYS.includes(v.key) ? MASTERY_THRESHOLD_COLOR : MASTERY_THRESHOLD_FUNC);
    const def = PHENOTYPE_DEFS[v.key];

    let styleAttr = '';
    let bioGlowClass = '';
    if (entry.discovered && def) {
      if (v.key === 'C_BIO') {
        if (bioGlowAnimation) {
          bioGlowClass = ' bio-glow';
        } else {
          const filterPart = def.filterStr ? `filter:${def.filterStr};` : '';
          const shadowPart = def.shadow ? `text-shadow:${def.shadow};` : '';
          if (filterPart || shadowPart) styleAttr = ` style="${filterPart}${shadowPart}"`;
        }
      } else if (def.opacity) {
        styleAttr = ` style="opacity:${def.opacity}; filter:${def.filterStr};"`;
      } else {
        const filterPart = def.filterStr ? `filter:${def.filterStr};` : '';
        const shadowPart = def.shadow ? `text-shadow:${def.shadow};` : '';
        if (filterPart || shadowPart) styleAttr = ` style="${filterPart}${shadowPart}"`;
      }
    }

    const tierLabel = v.tier ? `Tier ${v.tier}` : '';
    const masteredStar = entry.mastered ? ' ⭐' : '';
    const countStr = entry.mastered ? `${entry.count} ✓` : `${entry.count}/${threshold}`;
    const pct = entry.mastered ? 100 : Math.min(100, (entry.count / threshold) * 100);
    const progressBar = entry.discovered
      ? `<div class="dex-mastery-bar"><div class="dex-mastery-fill${entry.mastered ? ' mastered' : ''}" style="width:${pct}%"></div></div>`
      : '';

    return `<div class="dex-card ${entry.discovered ? '' : 'undiscovered'}">
      <div class="dex-emoji${bioGlowClass}"${styleAttr}>${entry.discovered ? '🦐' : '❓'}</div>
      <div class="dex-name">${entry.discovered ? v.name + masteredStar : '???'}</div>
      ${tierLabel ? `<div class="dex-rarity">${tierLabel}</div>` : ''}
      <div class="dex-count">${entry.discovered ? countStr : '?/?'}</div>
      ${progressBar}
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
let _popCardEls   = {};  // id → { bar, hp, age, stg, preg } — cached after innerHTML build
let _popSearch    = '';
let _popStageFilter = { egg: true, baby: true, juvenile: true, adult: true, dead: true };
let _tmSig        = '';
let _tmEls        = {};  // tankId → cached dynamic element refs for tank manager


function popSearchMatch(m, query) {
  if (!query) return true;
  const q = query.toLowerCase();
  if (m.name.toLowerCase().includes(q)) return true;
  const sexLabel = m.sex === 'M' ? 'male' : m.sex === 'F' ? 'female' : '';
  if (sexLabel === q) return true;
  if (m.dna) {
    const phenotype = resolveColorPhenotype(m.dna.body_color);
    const colourName = PHENOTYPE_DEFS[phenotype]?.name || phenotype;
    if (colourName.toLowerCase().includes(q)) return true;
    // Search all allele names across every locus
    for (const geneId of ['body_color', 'tail_shape', 'metabolism', 'constitution', 'longevity', 'filt']) {
      for (const code of m.dna[geneId]) {
        if (alleleName(geneId, code).toLowerCase().includes(q)) return true;
      }
    }
  }
  return false;
}

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
  let bioGlowClass = '';
  if (m.alive && def) {
    if (phenotype === 'C_BIO') {
      if (bioGlowAnimation) {
        bioGlowClass = ' bio-glow';
      } else {
        const fp = def.filterStr ? `filter:${def.filterStr};` : '';
        const sp = def.shadow    ? `text-shadow:${def.shadow};` : '';
        if (fp || sp) emojiStyle = `style="${fp}${sp}"`;
      }
    } else if (def.opacity) {
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

  return `<div class="pop-card ${m.alive ? m.stage : 'dead'}" data-monkey-id="${m.id}">
    ${pregTimerStr ? `<span class="pop-preg" id="pop-preg-${m.id}">🤰 ${pregTimerStr}</span>` : ''}
    <span class="pop-card-emoji${bioGlowClass}" ${emojiStyle}>${displayEmoji}</span>
    <div class="pop-card-name">${m.name} <span class="pop-sex">(${m.sex})</span></div>
    <div class="pop-card-badges">
      <span class="pop-stage">${stageLabel}</span>
      <span class="pop-gen">Gen ${m.generation}</span>
    </div>
    <span class="pop-age" id="pop-age-${m.id}">${fmtAge(ageMs)}</span>
    <div class="pop-card-health">❤ <span class="pop-bar" id="pop-bar-${m.id}">${healthBar}</span> <span class="pop-hp" id="pop-hp-${m.id}">${Math.round(m.health)}/${stats.maxHealth}</span></div>
    <div class="pop-traits">${traitsHtml !== null ? traitsHtml : traitsStr}</div>
    ${timeStr ? `<div class="pop-card-timer">${{egg:'🐠',baby:'🐟',juvenile:'🦐',adult:'💀'}[m.stage]||'⏱'} <span id="pop-stg-${m.id}">${timeStr}</span></div>` : ''}
    ${m.alive ? (() => {
      const price = calcSellPrice(m);
      const storBtn = m.stage === 'egg' ? `<button class="btn inv-use-btn pop-action-btn" data-store-egg="${m.id}">📦 Store</button>` : '';
      const archBtn = skOn('dna_archive') && m.stage !== 'egg' ? `<button class="btn inv-use-btn pop-action-btn" data-archive-dna="${m.id}" title="Archive DNA">🧬</button>` : '';
      return `<div class="pop-sell-row">${storBtn}${archBtn}<button class="btn pop-sell-btn" data-sell-monkey="${m.id}">💰 £${price}</button></div>`;
    })() : ''}
  </div>`;
}

function updatePopCard(m, now) {
  if (!m.alive) return; // dead cards are static
  const els = _popCardEls[m.id];
  if (!els) return;

  // Health bar — dirty-check; resolveStats only runs when health actually changed
  const hpRounded = Math.round(m.health);
  if (els._lastHp !== hpRounded) {
    els._lastHp = hpRounded;
    const stats = resolveStats(m);
    const filled = Math.max(0, Math.round((hpRounded / stats.maxHealth) * 10));
    els.bar.textContent = '█'.repeat(filled) + '░'.repeat(10 - filled);
    els.hp.textContent  = `${hpRounded}/${stats.maxHealth}`;
  }

  // Age counter — always ticking
  els.age.textContent = fmtAge((now - m.bornAt) * (debugMode ? debugSpeed : 1));

  // Stage countdown
  if (els.stg && m.stageDuration) {
    const eff = (now - m.stageStartTime) * (debugMode ? debugSpeed : 1);
    els.stg.textContent = fmtMs(Math.max(0, m.stageDuration - eff) / (debugMode ? debugSpeed : 1));
  }

  // Pregnancy countdown
  if (els.preg && m.pregnantSince) {
    const eff = (now - m.pregnantSince) * (debugMode ? debugSpeed : 1);
    els.preg.textContent = `🤰 ${fmtMs(Math.max(0, m.pregnancyDuration - eff) / (debugMode ? debugSpeed : 1))}`;
  }
}

function renderPopulation() {
  const view = document.getElementById('population-view');
  if (!view || !view.classList.contains('active')) return;

  const now        = paused ? pausedAt : Date.now();
  const tankMonkeys = state.monkeys.filter(m => m.tankId === state.activeTankId && !m.inStorage);
  const aliveCount = tankMonkeys.filter(m => m.alive).length;
  const deadCount  = tankMonkeys.filter(m => !m.alive).length;
  document.getElementById('population-view-title').textContent =
    `📋 Population — ${aliveCount} alive${deadCount ? ', ' + deadCount + ' dead' : ''}`;

  const list = document.getElementById('population-list');

  if (!tankMonkeys.length) {
    list.innerHTML = '<div class="pop-empty">No sea monkeys yet.</div>';
    _popSignature = '';
    return;
  }

  const sorted = [...tankMonkeys].sort((a, b) => {
    if (a.alive !== b.alive) return a.alive ? -1 : 1;
    return (a.bornAt ?? 0) - (b.bornAt ?? 0);
  });

  // Apply stage filter and search
  const filtered = sorted.filter(m => {
    const stageKey = m.alive ? m.stage : 'dead';
    if (!_popStageFilter[stageKey]) return false;
    return popSearchMatch(m, _popSearch);
  });

  const hasMagnifier = state.magnifyingGlassMode && state.inventory.magnifyingGlass > 0;
  const filterKey = Object.values(_popStageFilter).map(v => v ? '1' : '0').join('');
  const sig = filtered.map(m => `${m.id}:${m.stage}:${m.alive?1:0}:${m.pregnant?1:0}`).join('|')
    + `|m:${hasMagnifier ? 1 : 0}|f:${filterKey}|s:${_popSearch}`;

  if (sig !== _popSignature) {
    _popSignature = sig;
    const stageOrder  = ['adult', 'juvenile', 'baby', 'egg'];
    const stageLabels = { egg: '🥚 Eggs', baby: '🐠 Babies', juvenile: '🐟 Juveniles', adult: '🦐 Adults' };
    const byStage = {};
    const dead = [];
    for (const m of filtered) {
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
    if (!html) {
      html = `<div class="pop-empty">${_popSearch ? 'No results for "' + _popSearch + '".' : 'No sea monkeys match the current filters.'}</div>`;
    }
    list.innerHTML = html;
    // Cache sub-element refs so updatePopCard never calls getElementById
    _popCardEls = {};
    for (const m of filtered) {
      _popCardEls[m.id] = {
        bar:  document.getElementById(`pop-bar-${m.id}`),
        hp:   document.getElementById(`pop-hp-${m.id}`),
        age:  document.getElementById(`pop-age-${m.id}`),
        stg:  document.getElementById(`pop-stg-${m.id}`),
        preg: document.getElementById(`pop-preg-${m.id}`),
      };
    }
  } else {
    for (const m of filtered) updatePopCard(m, now);
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

  const now = paused ? pausedAt : Date.now();
  const currency = state.currency || 0;
  const tank   = activeTank();
  const aer    = tank.aeration;
  const skim   = tank.skimmer;
  const feeder = tank.feeder;
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
      const t = activeTank();
      const nextLevel = t.aeration.level + 1;
      if (nextLevel > 5) return;
      const cost = AERATION_LEVELS[nextLevel].upgradeCost;
      if ((state.currency || 0) < cost) return;
      state.currency -= cost;
      t.aeration.level = nextLevel;
      const lvl = AERATION_LEVELS[nextLevel];
      t.aeration.startedAt = Date.now();
      t.aeration.duration  = randRange(lvl.durationMin, lvl.durationMax);
      generateBubbles(AERATION_BUBBLE_COUNTS[nextLevel]);
      addXP(10);
      addLog(`💨 Aeration upgraded to ${lvl.name}!`, null, t.id);
      addNotification(`💨 ${lvl.name} aeration active!`);
    });

    document.getElementById('ls-btn-skim').addEventListener('click', () => {
      const t = activeTank();
      const nextLevel = t.skimmer.level + 1;
      if (nextLevel > 5) return;
      const cost = SKIMMER_LEVELS[nextLevel].upgradeCost;
      if ((state.currency || 0) < cost) return;
      state.currency -= cost;
      t.skimmer.level = nextLevel;
      const lvl = SKIMMER_LEVELS[nextLevel];
      t.skimmer.startedAt = Date.now();
      t.skimmer.duration  = randRange(lvl.durationMin, lvl.durationMax);
      addXP(10);
      addLog(`🧹 Skimmer upgraded to ${lvl.name}!`, null, t.id);
      addNotification(`🧹 ${lvl.name} skimmer active!`);
    });

    document.getElementById('ls-btn-feeder').addEventListener('click', () => {
      const t = activeTank();
      const nextLevel = t.feeder.level + 1;
      if (nextLevel > 5) return;
      const cost = FEEDER_LEVELS[nextLevel].upgradeCost;
      if ((state.currency || 0) < cost) return;
      state.currency -= cost;
      t.feeder.level = nextLevel;
      const lvl = FEEDER_LEVELS[nextLevel];
      t.feeder.startedAt = Date.now();
      t.feeder.duration  = randRange(lvl.durationMin, lvl.durationMax);
      addXP(10);
      addLog(`🍽️ Feeder upgraded to ${lvl.name}!`, null, t.id);
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

function renderSnail() {
  const container = document.getElementById('monkey-container');
  if (!container) return;
  const tank = activeTank();

  // Remove snail element if tank has no snail or we switched tanks
  if (!tank || !tank.snail || tank.id !== _snailTankId) {
    if (snailEl) { snailEl.remove(); snailEl = null; }
    if (!tank || !tank.snail) return;
  }

  const rect = container.getBoundingClientRect();
  const W = rect.width  || 560;
  const H = rect.height || 462;

  // Initialise or restore position for this tank
  if (!snailPos[tank.id]) {
    snailPos[tank.id] = { x: 20 + Math.random() * (W - 60), vx: (Math.random() < 0.5 ? 1 : -1) * 0.25 };
  }
  const pos = snailPos[tank.id];
  pos.x += pos.vx;
  if (pos.x < 10)      { pos.x = 10;      pos.vx =  Math.abs(pos.vx); }
  if (pos.x > W - 40)  { pos.x = W - 40;  pos.vx = -Math.abs(pos.vx); }

  if (!snailEl) {
    snailEl = document.createElement('div');
    snailEl.className = 'snail-companion';
    snailEl.innerHTML = `<span>🐌</span><div class="snail-tooltip">🐌 Snail Companion<br>Eats corpses • May eat eggs</div>`;
    container.appendChild(snailEl);
    _snailTankId = tank.id;
  }

  const corpseCount = state.monkeys.filter(m => m.tankId === tank.id && !m.alive).length;
  snailEl.querySelector('.snail-tooltip').textContent =
    corpseCount > 0
      ? `🐌 Snail — ${corpseCount} corpse${corpseCount > 1 ? 's' : ''} left to eat`
      : '🐌 Snail — tank is clean!';
  // Windows Segoe emoji faces left by default; Apple emoji faces right — compensate
  const emojiFlip = navigator.userAgent.includes('Windows') ? -1 : 1;
  const facing = (pos.vx >= 0 ? 1 : -1) * emojiFlip;
  snailEl.style.transform = `translate(${pos.x}px, ${H - 54}px) scaleX(${facing})`;
  // Counter-flip the tooltip so it's always readable
  snailEl.querySelector('.snail-tooltip').style.transform = `translateX(-50%) scaleX(${facing})`;
}

function renderHydra() {
  const container = document.getElementById('monkey-container');
  if (!container) return;
  const tank = activeTank();

  // Remove element if no hydra or tank switched
  if (!tank || !tank.hydra || tank.id !== _hydraTankId) {
    if (hydraEl) { hydraEl.remove(); hydraEl = null; }
    _hydraTankId = -1;
    if (!tank || !tank.hydra) return;
  }

  const rect = container.getBoundingClientRect();
  const W = rect.width  || 560;
  const H = rect.height || 462;

  // Initialise swimming position for this tank
  if (!hydraPos[tank.id]) {
    hydraPos[tank.id] = {
      x:  W * (0.2 + Math.random() * 0.6),
      y:  H * (0.2 + Math.random() * 0.5),
      vx: (Math.random() < 0.5 ? 1 : -1) * (0.7 + Math.random() * 0.6),
      vy: (Math.random() < 0.5 ? 1 : -1) * (0.35 + Math.random() * 0.35),
    };
  }
  const pos = hydraPos[tank.id];
  pos.x += pos.vx;
  pos.y += pos.vy;
  // Occasional random direction nudge
  if (Math.random() < 0.008) pos.vx = (Math.random() < 0.5 ? 1 : -1) * (0.7 + Math.random() * 0.6);
  if (Math.random() < 0.008) pos.vy = (Math.random() < 0.5 ? 1 : -1) * (0.35 + Math.random() * 0.35);
  // Bounce off walls (leave room for 44px emoji + 40px HP bar)
  if (pos.x < 5)       { pos.x = 5;       pos.vx =  Math.abs(pos.vx); }
  if (pos.x > W - 49)  { pos.x = W - 49;  pos.vx = -Math.abs(pos.vx); }
  if (pos.y < 5)       { pos.y = 5;        pos.vy =  Math.abs(pos.vy); }
  if (pos.y > H - 80)  { pos.y = H - 80;   pos.vy = -Math.abs(pos.vy); }

  if (!hydraEl) {
    hydraEl = document.createElement('div');
    hydraEl.className = 'hydra-creature';
    hydraEl.innerHTML =
      `<div class="hydra-tooltip">⚠️ Hydra! Click to fight back!<br>Eats a sea monkey every ${HYDRA_HUNT_MIN / 1000}–${HYDRA_HUNT_MAX / 1000}s</div>` +
      `<div class="hydra-body">🪸</div>` +
      `<div class="hydra-hp-wrap"><div class="hydra-hp-fill"></div></div>` +
      `<div class="hydra-hp-text">${tank.hydra.hp}</div>`;
    hydraEl.addEventListener('click', () => {
      const t = activeTank();
      if (!t || !t.hydra) return;
      t.hydra.hp--;
      AudioEngine.play('sell');
      if (t.hydra.hp <= 0) {
        t.hydra = null;
        _hydraTankId = -1;
        _tmSig = '';
        state.stats.hydrasDefeated = (state.stats.hydrasDefeated || 0) + 1;
        addLog(`🪸 The Hydra in ${t.name} was beaten back!`, null, t.id);
        addNotification('🪸 Hydra defeated!');
        AudioEngine.play('grant');
        saveState();
      }
    });
    container.appendChild(hydraEl);
    _hydraTankId = tank.id;
  }

  // Update HP bar and label each frame
  const fill = hydraEl.querySelector('.hydra-hp-fill');
  if (fill) fill.style.width = `${(tank.hydra.hp / HYDRA_HP * 100).toFixed(1)}%`;
  const hpText = hydraEl.querySelector('.hydra-hp-text');
  if (hpText) hpText.textContent = tank.hydra.hp;

  // Flip to face direction of travel; counter-flip text children so they stay readable
  hydraEl.style.transform = `translate(${pos.x}px, ${pos.y}px) scaleX(${pos.vx >= 0 ? 1 : -1})`;
  const counterFlip = `scaleX(${pos.vx >= 0 ? 1 : -1})`;
  const tip = hydraEl.querySelector('.hydra-tooltip');
  if (tip) tip.style.transform = `translateX(-50%) ${counterFlip}`;
  const hpWrap = hydraEl.querySelector('.hydra-hp-wrap');
  if (hpWrap) hpWrap.style.transform = counterFlip;
  const hpTxt = hydraEl.querySelector('.hydra-hp-text');
  if (hpTxt) hpTxt.style.transform = counterFlip;
}

function renderMolts() {
  const container = document.getElementById('monkey-container');
  if (!state.molts) state.molts = [];

  const now = Date.now();
  const activeTankId = state.activeTankId;

  // Remove DOM elements for molts no longer in state or on a different tank
  const activeMoltIds = new Set(
    state.molts.filter(mo => mo.tankId === activeTankId).map(mo => mo.id)
  );
  for (const id of Object.keys(moltEls)) {
    if (!activeMoltIds.has(Number(id))) {
      moltEls[id].remove();
      delete moltEls[id];
    }
  }

  for (const molt of state.molts) {
    if (molt.tankId !== activeTankId) continue;
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
        const baseReward = { egg: 1, baby: 2, juvenile: 3 }[molt.fromStage] || 0;
        const viralMult  = skOn('viral_marketing') && Date.now() < (state.skills?.viralMarketingExpiry || 0) ? 2 : 1;
        const reward = baseReward * viralMult;
        if (reward) {
          state.currency = (state.currency || 0) + reward;
          addXP(2);
          addNotification(`£${reward} collected!${viralMult > 1 ? ' 📣' : ''}`);
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
      const moltTankId = molt.tankId;
      setTimeout(() => {
        state.molts = state.molts.filter(mo => mo.id !== molt.id);
        const moltTank = state.tanks.find(t => t.id === moltTankId) || activeTank();
        moltTank.cleanliness = Math.max(0, moltTank.cleanliness - 2);
        addLog(`🌊 A shed skin dissolved, dirtying the water.`, null, moltTankId);
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
          fpsStressPopulation = state.monkeys.filter(m => m.alive && m.tankId === state.activeTankId).length;
          state.fpsStressPop = fpsStressPopulation;
          const stressEl = document.getElementById('fps-stress-pop');
          if (stressEl) stressEl.value = fpsStressPopulation;
          const resetRow = document.getElementById('fps-stress-reset-row');
          if (resetRow) resetRow.style.display = '';
        }
      } else {
        fpsLowSince = null;
      }
    }
  }

  renderHeader();
  renderTankSelector();
  renderTankLevel();
  renderSetupSection();
  renderGauges();
  renderPopulationCounts();
  renderMonkeys();
  renderSnail();
  renderHydra();
  renderMolts();
  renderLifeSupport();
  renderInventory();
  renderShop();
  renderGrants();
  renderSkillTree();
  renderDebugPanel();
  renderMonkeydex();
  renderPopulation();
  renderTankManager();
  renderEventLog();
  renderStatusBar();
  renderNotifications();
  renderTimerStats();
}

function renderTankLevel() {
  const xp  = state.playerXP || 0;
  const lvl = xpToLevel(xp);
  const cur = xpForLevel(lvl);
  const nxt = xpForLevel(lvl + 1);
  const pct = nxt > cur ? ((xp - cur) / (nxt - cur)) * 100 : 100;
  document.getElementById('tank-level-val').textContent = lvl;
  document.getElementById('tank-xp-bar').style.width = pct.toFixed(1) + '%';
  document.getElementById('tank-xp-label').textContent =
    `${Math.floor(xp - cur)} / ${nxt - cur} XP`;
  document.getElementById('mini-lv-num').textContent = lvl;
}

function renderHeader() {
  const alive = state.monkeys.filter(m => m.alive && !m.inStorage);
  document.getElementById('stat-pop').textContent    = alive.length;
  document.getElementById('stat-gen').textContent    = state.stats.totalGenerations;
  document.getElementById('stat-born').textContent   = state.stats.totalBorn;
  document.getElementById('stat-died').textContent   = state.stats.totalDied;
}

function renderSetupSection() {
  const t = activeTank();
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
    const elapsed = (paused ? pausedAt : Date.now()) - t.purifyStartTime;
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
  const mb = getMasteryBonuses();
  const feedAmt = ACTION_FEED_BASE + mb.feedBonus;
  const hasCorpses = state.monkeys.some(m => !m.alive && m.tankId === t.id);
  const feedDis  = !hasLife || t.food        + feedAmt          > getMaxFood(t);
  const aerDis   = !hasLife || t.oxygen      + ACTION_AERATE_AMT > getMaxOxygen(t);
  const cleanDis = !hasLife || (t.cleanliness + ACTION_CLEAN_AMT  > getMaxCleanliness(t) && !hasCorpses);
  document.getElementById('btn-feed').disabled   = feedDis;
  document.getElementById('btn-aerate').disabled = aerDis;
  document.getElementById('btn-clean').disabled  = cleanDis;
  document.getElementById(`mini-food-${t.id}`)?.classList.toggle('mini-disabled',  feedDis);
  document.getElementById(`mini-oxy-${t.id}`)?.classList.toggle('mini-disabled',   aerDis);
  document.getElementById(`mini-clean-${t.id}`)?.classList.toggle('mini-disabled', cleanDis);
}

let _gaugesSig = '';

function renderGauges() {
  const container = document.getElementById('tank-conditions-list');
  if (!container) return;

  // Rebuild rows only when tank list changes
  const tankSig = state.tanks.map(t => t.id).join(',');
  if (tankSig !== _gaugesSig) {
    _gaugesSig = tankSig;
    container.innerHTML = state.tanks.map(t =>
      `<div class="tank-cond-row" data-cond-tank="${t.id}">
        <div class="tank-cond-left">
          <div class="tank-cond-name">${t.name}</div>
          <span class="tank-cap-warn" id="cap-warn-${t.id}" style="display:none">⚠️ Full Capacity</span>
        </div>
        <div class="tank-cond-rings">
          <div class="tank-ring oxygen" id="ring-oxygen-${t.id}"><span>💨</span></div>
          <div class="tank-ring clean"  id="ring-clean-${t.id}"><span>🧹</span></div>
          <div class="tank-ring food"   id="ring-food-${t.id}"><span>🍔</span></div>
        </div>
      </div>`
    ).join('');
  }

  // Update ring values, active highlight, and per-tank capacity warning every frame
  for (const t of state.tanks) {
    const row = container.querySelector(`[data-cond-tank="${t.id}"]`);
    if (row) row.classList.toggle('active', t.id === state.activeTankId);

    const tankAlive = state.monkeys.filter(m => m.alive && m.tankId === t.id && !m.inStorage).length;
    const atCapacity = tankAlive >= getMaxPop(t);
    const warnEl = document.getElementById(`cap-warn-${t.id}`);
    if (warnEl) warnEl.style.display = atCapacity ? '' : 'none';

    const sets = [
      ['ring-oxygen-' + t.id, t.oxygen,       getMaxOxygen(t)],
      ['ring-clean-'  + t.id, t.cleanliness, getMaxCleanliness(t)],
      ['ring-food-'   + t.id, t.food,        getMaxFood(t)],
    ];
    for (const [id, val, max] of sets) {
      const el = document.getElementById(id);
      if (!el) continue;
      el.style.setProperty('--pct', Math.min(100, (val / (max || 100)) * 100).toFixed(1));
      el.classList.toggle('danger', val < 30);
    }

  }

  // Mini conditions: active tank only
  const miniContainer = document.getElementById('mini-conditions');
  if (miniContainer) {
    const t = activeTank();
    const miniSig = String(state.activeTankId);
    if (miniContainer.dataset.sig !== miniSig) {
      miniContainer.dataset.sig = miniSig;
      miniContainer.innerHTML =
        `<div class="mini-ring oxygen" id="mini-oxy-${t.id}"   data-action="aerate" data-tank-id="${t.id}"><span>💨</span></div>
         <div class="mini-ring clean"  id="mini-clean-${t.id}" data-action="clean"  data-tank-id="${t.id}"><span>🧹</span></div>
         <div class="mini-ring food"   id="mini-food-${t.id}"  data-action="feed"   data-tank-id="${t.id}"><span>🍔</span></div>`;
    }
    for (const [id, val, max] of [
      [`mini-oxy-${t.id}`,   t.oxygen,      getMaxOxygen(t)],
      [`mini-clean-${t.id}`, t.cleanliness, getMaxCleanliness(t)],
      [`mini-food-${t.id}`,  t.food,        getMaxFood(t)],
    ]) {
      const el = document.getElementById(id);
      if (!el) continue;
      el.style.setProperty('--pct', Math.min(100, (val / (max || 100)) * 100).toFixed(1));
      el.classList.toggle('danger', val < 30);
    }
  }
}

function renderPopulationCounts() {
  const alive = state.monkeys.filter(m => m.alive && m.tankId === state.activeTankId && !m.inStorage);
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
let   snailEl = null;       // single DOM element for the snail (active tank only)
let   _snailTankId = -1;    // which tank snailEl belongs to
const snailPos = {};        // tankId → { x, vx } — visual position, not saved
let   hydraEl = null;       // single DOM element for the hydra (active tank only)
let   _hydraTankId = -1;    // which tank hydraEl belongs to
const hydraPos = {};        // tankId → { x, y, vx, vy } — visual position, not saved

function renderMonkeys() {
  const container = document.getElementById('monkey-container');
  const tankRect   = container.getBoundingClientRect();
  const W = tankRect.width  || 560;
  const H = tankRect.height || 462;

  // Build the set of monkey IDs to render — optionally cap alive count to fpsStressPopulation
  const tankMonkeys = state.monkeys.filter(m => m.tankId === state.activeTankId && !m.inStorage);
  const aliveVisible = (limitViewToCap && fpsStressPopulation !== null)
    ? tankMonkeys.filter(m => m.alive).slice(0, fpsStressPopulation)
    : tankMonkeys.filter(m => m.alive);
  const deadVisible  = tankMonkeys.filter(m => !m.alive);
  const visibleIds   = new Set([...aliveVisible, ...deadVisible].map(m => m.id));

  const hiddenCount = tankMonkeys.filter(m => m.alive).length - aliveVisible.length;
  const banner = document.getElementById('fps-cap-banner');
  if (banner) banner.style.display = hiddenCount > 0 ? '' : 'none';

  // Remove DOM els for monkeys outside the visible set
  for (const id of Object.keys(monkeyEls)) {
    if (!visibleIds.has(Number(id))) {
      monkeyEls[id].remove();
      delete monkeyEls[id];
    }
  }

  for (const m of state.monkeys) {
    if (!visibleIds.has(m.id)) continue;
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
      el._emojiSpan = emojiSpan;  // cache — avoids querySelector every frame
      el.appendChild(emojiSpan);

      const tip = document.createElement('div');
      tip.className = 'monkey-tooltip';
      el._tip = tip;  // cache — avoids querySelector every frame
      el.appendChild(tip);

      // Phenotype styles — DNA never changes, apply once at creation
      el._tailCode = m.dna ? resolveAllele(m.dna.tail_shape, 'tail_shape') : 'T_STD';
      const phenotype = m.dna ? resolveColorPhenotype(m.dna.body_color) : 'C_PINK';
      const def = PHENOTYPE_DEFS[phenotype] || {};
      el._isBio = phenotype === 'C_BIO';
      const activeFilter = (colorTheme === 'colorblind' && def.cbFilterStr) ? def.cbFilterStr : def.filterStr;
      if (el._isBio) {
      } else if (def.opacity) {
        emojiSpan.style.filter  = activeFilter || '';
        emojiSpan.style.opacity = String(def.opacity);
      } else {
        el.style.filter     = activeFilter || '';
        el.style.textShadow = def.shadow    || '';
      }

      container.appendChild(el);
      monkeyEls[m.id] = el;
    }

    // Lazy stats — computed at most once per monkey per frame, only when needed
    let _stats = null;
    const getStats = () => { if (!_stats) _stats = resolveStats(m); return _stats; };

    // Dirty-check className
    const newClass = 'monkey ' + (m.alive ? m.stage : 'dead') + (m.pregnant ? ' pregnant' : '') + (el._isBio && bioGlowAnimation ? ' bio-glow' : '');
    if (el.className !== newClass) el.className = newClass;

    // Bio-glow style sync — updates inline filter/shadow when setting is toggled live
    if (el._isBio && el._bioGlowState !== bioGlowAnimation) {
      el._bioGlowState = bioGlowAnimation;
      const bd = PHENOTYPE_DEFS['C_BIO'];
      if (bioGlowAnimation) {
        el.style.filter = '';
        el.style.textShadow = '';
      } else {
        el.style.filter     = bd.filterStr || '';
        el.style.textShadow = bd.shadow    || '';
      }
    }

    // Emoji — dirty-check by stage+alive; tail/DNA never change
    const emojiSig = m.stage + (m.alive ? '1' : '0');
    if (el._emojiSig !== emojiSig) {
      el._emojiSig = emojiSig;
      const tailCode = el._tailCode;
      const baseEmoji = getMonkeyEmoji(m);
      el._emojiSpan.textContent = (tailCode === 'T_DBL' && m.alive) ? baseEmoji + baseEmoji : baseEmoji;
      if (tailCode === 'T_FAN' && m.alive) {
        const baseSizes = { egg: 18, baby: 16, juvenile: 19, adult: 22, dead: 18 };
        el._emojiSpan.style.fontSize = ((baseSizes[m.stage] || 20) + 4) + 'px';
      } else {
        el._emojiSpan.style.fontSize = '';
      }
    }

    // Tooltip — dirty-check; skip heavy gene resolution when nothing changed
    const tipSig = Math.round(m.health) + (m.pregnant ? 'p' : '') + (state.magnifyingGlassMode ? 'M' : '');
    if (el._tipSig !== tipSig) {
      el._tipSig = tipSig;
      const stats = getStats();
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
      el._tip.textContent = `${m.name} (${m.sex}) | ❤ ${healthBar} | Gen ${m.generation}${m.pregnant ? ' | 🤰' : ''}${geneInfo}`;
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
        // Individual CSS properties (translate + rotate) compose independently with
        // CSS animations that use transform — no conflict with egg-wiggle/pregnant-pulse
        el.style.transition = 'translate 1.5s ease-in, rotate 1.5s ease-in';
        el.style.translate = `${m._x}px ${H - 38}px`;
        el.style.rotate    = '90deg';
      }
      el._emojiSpan.style.transform = '';
    } else {
      el.style.transition = '';

      const stats = getStats();
      const baseSpeeds = { egg: 0, baby: 40, juvenile: 55, adult: 70 }; // px/sec
      const speed = (baseSpeeds[m.stage] || 0) * stats.moveSpeed * (stats.isFF ? 0.5 : 1);
      const dt = paused ? 0 : renderDt / 1000; // seconds

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
          // translate (individual property) composes with CSS animations using transform
          el.style.translate = `${finalX}px ${finalY}px`;
          el._emojiSpan.style.transform = nx > 0 ? 'scaleX(-1)' : '';
        }
      } else {
        el.style.translate = `${m._x || 50}px ${m._y || 50}px`;
        el._emojiSpan.style.transform = '';
      }
    }
  }
}

function renderTankManager() {
  const view = document.getElementById('tank-manager-view');
  if (!view || !view.classList.contains('active')) return;

  const now = paused ? pausedAt : Date.now();

  // Signature covers things that need a full rebuild: tank count/names, LS levels, pop counts, active tank
  const sig = state.tanks.map(t => {
    const alive = state.monkeys.filter(m => m.alive && m.tankId === t.id && !m.inStorage);
    const dead  = state.monkeys.filter(m => !m.alive && m.tankId === t.id).length;
    const stageCounts = ['egg','baby','juvenile','adult'].map(s => alive.filter(m => m.stage === s).length).join(',');
    return `${t.id}:${t.name}:${t.aeration.level}:${t.skimmer.level}:${t.feeder.level}:${stageCounts}:${dead}:${t.id === state.activeTankId ? 1 : 0}:${t.popLevel ?? 0}:${t.eggSkimmer ? 1 : 0}:${t.eggSkimmerActive ? 1 : 0}:${state.currency}:${t.hydra ? t.hydra.hp : 0}:${state.inventory.hydraKiller}`;
  }).join('|');

  const list = document.getElementById('tank-manager-list');

  // Don't rebuild while a tank name input is focused — it would destroy the input mid-edit
  if (list.querySelector('.tm-tank-name-input:focus')) return;

  if (sig !== _tmSig) {
    _tmSig = sig;
    _tmEls = {};

    list.innerHTML = state.tanks.map(t => {
      const tankMonkeys = state.monkeys.filter(m => m.tankId === t.id && !m.inStorage);
      const alive = tankMonkeys.filter(m => m.alive);
      const dead  = tankMonkeys.filter(m => !m.alive).length;
      const stageCounts = { egg: 0, baby: 0, juvenile: 0, adult: 0 };
      for (const m of alive) stageCounts[m.stage] = (stageCounts[m.stage] || 0) + 1;

      const maxFood  = getMaxFood(t);
      const maxOxy   = getMaxOxygen(t);
      const maxClean = getMaxCleanliness(t);
      const foodPct  = Math.min(100, (t.food  / maxFood)  * 100);
      const oxyPct   = Math.min(100, (t.oxygen / maxOxy)  * 100);
      const cleanPct = Math.min(100, (t.cleanliness / maxClean) * 100);

      const aerLvl  = AERATION_LEVELS[t.aeration.level];
      const skimLvl = SKIMMER_LEVELS[t.skimmer.level];
      const feedLvl = FEEDER_LEVELS[t.feeder.level];

      const timerStr = (addon, dur) => {
        if (!addon.startedAt) return '—';
        const rem = Math.max(0, dur - (now - addon.startedAt) * (debugMode ? debugSpeed : 1));
        return fmtMs(rem / (debugMode ? debugSpeed : 1));
      };
      const timerPct = (addon, dur) => {
        if (!addon.startedAt) return 0;
        return Math.max(0, (dur - (now - addon.startedAt) * (debugMode ? debugSpeed : 1)) / dur * 100);
      };

      const aerPct  = timerPct(t.aeration, t.aeration.duration);
      const skimPct = timerPct(t.skimmer,  t.skimmer.duration);
      const feedPct = timerPct(t.feeder,   t.feeder.duration);

      const isActive = t.id === state.activeTankId;

      const badge = (emoji, count) =>
        `<span class="tm-pop-badge${count === 0 ? ' zero' : ''}">${emoji} ${count}</span>`;

      return `<div class="tm-card${isActive ? ' active-tank' : ''}">
        <div class="tm-card-header">
          <span class="tm-tank-name" data-tm-name="${t.id}" title="Click to rename">${t.name}</span>
          ${isActive
            ? '<span class="tm-active-badge">Active</span>'
            : `<button class="tm-switch-btn" data-tm-switch="${t.id}">Switch</button>`}
        </div>

        <div>
          <div class="tm-section-label">Conditions</div>
          <div class="tm-gauges">
            <div class="tm-gauge-row">
              <span class="tm-gauge-icon">💨</span>
              <div class="tm-gauge-bar-wrap">
                <div class="tm-gauge-bar oxy${t.oxygen < 30 ? ' danger' : ''}" id="tm-gbar-oxy-${t.id}" style="width:${oxyPct.toFixed(1)}%"></div>
              </div>
              <span class="tm-gauge-val" id="tm-gval-oxy-${t.id}">${Math.round(t.oxygen)}/${maxOxy}</span>
            </div>
            <div class="tm-gauge-row">
              <span class="tm-gauge-icon">🧹</span>
              <div class="tm-gauge-bar-wrap">
                <div class="tm-gauge-bar clean${t.cleanliness < 30 ? ' danger' : ''}" id="tm-gbar-clean-${t.id}" style="width:${cleanPct.toFixed(1)}%"></div>
              </div>
              <span class="tm-gauge-val" id="tm-gval-clean-${t.id}">${Math.round(t.cleanliness)}/${maxClean}</span>
            </div>
            <div class="tm-gauge-row">
              <span class="tm-gauge-icon">🍔</span>
              <div class="tm-gauge-bar-wrap">
                <div class="tm-gauge-bar food${t.food < 30 ? ' danger' : ''}" id="tm-gbar-food-${t.id}" style="width:${foodPct.toFixed(1)}%"></div>
              </div>
              <span class="tm-gauge-val" id="tm-gval-food-${t.id}">${Math.round(t.food)}/${maxFood}</span>
            </div>
          </div>
        </div>

        <div>
          <div class="tm-section-label">Population — ${alive.length} alive${dead ? ', ' + dead + ' dead' : ''}</div>
          <div class="tm-pop">
            ${badge('🥚', stageCounts.egg)}
            ${badge('🐠', stageCounts.baby)}
            ${badge('🐟', stageCounts.juvenile)}
            ${badge('🦐', stageCounts.adult)}
            ${dead > 0 ? badge('💀', dead) : ''}
          </div>
        </div>

        <div>
          <div class="tm-section-label">Life Support</div>
          <div class="tm-ls">
            <div class="tm-ls-item">
              <div class="tm-ls-title">💨 Aeration</div>
              <div class="tm-ls-level">${aerLvl.name}</div>
              <div class="tm-ls-timer" id="tm-aer-timer-${t.id}">${timerStr(t.aeration, t.aeration.duration)}</div>
              <div class="tm-ls-bar-wrap"><div class="tm-ls-bar" id="tm-aer-bar-${t.id}" style="width:${aerPct.toFixed(1)}%"></div></div>
            </div>
            <div class="tm-ls-item">
              <div class="tm-ls-title">🧹 Skimmer</div>
              <div class="tm-ls-level">${skimLvl.name}</div>
              <div class="tm-ls-timer" id="tm-skim-timer-${t.id}">${timerStr(t.skimmer, t.skimmer.duration)}</div>
              <div class="tm-ls-bar-wrap"><div class="tm-ls-bar" id="tm-skim-bar-${t.id}" style="width:${skimPct.toFixed(1)}%"></div></div>
            </div>
            <div class="tm-ls-item">
              <div class="tm-ls-title">🍽️ Feeder</div>
              <div class="tm-ls-level">${feedLvl.name}</div>
              <div class="tm-ls-timer" id="tm-feed-timer-${t.id}">${timerStr(t.feeder, t.feeder.duration)}</div>
              <div class="tm-ls-bar-wrap"><div class="tm-ls-bar" id="tm-feed-bar-${t.id}" style="width:${feedPct.toFixed(1)}%"></div></div>
            </div>
          </div>
        </div>

        <div>
          <div class="tm-section-label">Upgrades</div>
          <div class="tm-upgrades-grid">
            ${(t.popLevel ?? 0) >= POP_LEVELS.length - 1
              ? `<span class="tm-cap-badge">📊 Max cap: ${POP_LEVELS[POP_LEVELS.length - 1]}</span><span></span>`
              : `<span class="tm-cap-desc">📊 Cap: ${POP_LEVELS[t.popLevel ?? 0]} → ${POP_LEVELS[(t.popLevel ?? 0) + 1]}</span>
                 <button class="tm-cap-btn" data-pop-upgrade="${t.id}" ${state.currency < POP_UPGRADE_COSTS[t.popLevel ?? 0] ? 'disabled' : ''}>£${POP_UPGRADE_COSTS[t.popLevel ?? 0].toLocaleString()}</button>`
            }
            ${t.eggSkimmer
              ? `<span class="tm-cap-desc">🫧 Egg Skimmer</span>
                 <button class="tm-cap-btn tm-toggle-btn${t.eggSkimmerActive ? ' active' : ''}" data-toggle-skimmer="${t.id}">${t.eggSkimmerActive ? 'On' : 'Off'}</button>`
              : `<span class="tm-cap-desc">🫧 Egg Skimmer — auto-store eggs</span>
                 <button class="tm-cap-btn" data-buy-skimmer="${t.id}" ${state.currency < 2000 ? 'disabled' : ''}>£2,000</button>`
            }
            ${t.snail
              ? `<span class="tm-cap-desc">🐌 Snail Companion</span><span class="tm-cap-badge" style="font-size:10px;color:var(--tx-lo);">Installed</span>`
              : `<span class="tm-cap-desc">🐌 Snail — eats corpses</span>
                 <button class="tm-cap-btn" data-buy-snail="${t.id}" ${state.currency < SNAIL_COST ? 'disabled' : ''}>£${SNAIL_COST.toLocaleString()}</button>`
            }
            ${t.hydra
              ? `<span class="tm-cap-desc tm-hydra-alert">🪸 Hydra! (${t.hydra.hp} HP)</span>
                 <button class="tm-cap-btn tm-hydra-kill-btn" data-use-hydra-killer="${t.id}" ${!state.inventory.hydraKiller ? 'disabled' : ''}>
                   🧴 Kill${state.inventory.hydraKiller ? ` ×${state.inventory.hydraKiller}` : ' (none)'}
                 </button>`
              : ''
            }
          </div>
        </div>

      </div>`;
    }).join('');

    // Cache dynamic element refs to avoid getElementById each frame
    _tmEls = {};
    for (const t of state.tanks) {
      _tmEls[t.id] = {
        gbarFood:  document.getElementById(`tm-gbar-food-${t.id}`),
        gvalFood:  document.getElementById(`tm-gval-food-${t.id}`),
        gbarOxy:   document.getElementById(`tm-gbar-oxy-${t.id}`),
        gvalOxy:   document.getElementById(`tm-gval-oxy-${t.id}`),
        gbarClean: document.getElementById(`tm-gbar-clean-${t.id}`),
        gvalClean: document.getElementById(`tm-gval-clean-${t.id}`),
        aerTimer:  document.getElementById(`tm-aer-timer-${t.id}`),
        aerBar:    document.getElementById(`tm-aer-bar-${t.id}`),
        skimTimer: document.getElementById(`tm-skim-timer-${t.id}`),
        skimBar:   document.getElementById(`tm-skim-bar-${t.id}`),
        feedTimer: document.getElementById(`tm-feed-timer-${t.id}`),
        feedBar:   document.getElementById(`tm-feed-bar-${t.id}`),
      };
    }
  } else {
    // Per-frame: update gauges and LS timers using cached refs
    for (const t of state.tanks) {
      const els = _tmEls[t.id];
      if (!els) continue;

      const maxFood  = getMaxFood(t);
      const maxOxy   = getMaxOxygen(t);
      const maxClean = getMaxCleanliness(t);

      const foodPct  = Math.min(100, (t.food  / maxFood)  * 100);
      const oxyPct   = Math.min(100, (t.oxygen / maxOxy)  * 100);
      const cleanPct = Math.min(100, (t.cleanliness / maxClean) * 100);

      els.gbarFood.style.width  = foodPct.toFixed(1)  + '%';
      els.gbarFood.className    = `tm-gauge-bar food${t.food < 30 ? ' danger' : ''}`;
      els.gvalFood.textContent  = `${Math.round(t.food)}/${maxFood}`;

      els.gbarOxy.style.width   = oxyPct.toFixed(1)   + '%';
      els.gbarOxy.className     = `tm-gauge-bar oxy${t.oxygen < 30 ? ' danger' : ''}`;
      els.gvalOxy.textContent   = `${Math.round(t.oxygen)}/${maxOxy}`;

      els.gbarClean.style.width = cleanPct.toFixed(1) + '%';
      els.gbarClean.className   = `tm-gauge-bar clean${t.cleanliness < 30 ? ' danger' : ''}`;
      els.gvalClean.textContent = `${Math.round(t.cleanliness)}/${maxClean}`;

      const updateAddon = (addon, timerEl, barEl) => {
        if (!addon.startedAt) return;
        const elapsed = (now - addon.startedAt) * (debugMode ? debugSpeed : 1);
        const rem = Math.max(0, addon.duration - elapsed);
        timerEl.textContent  = fmtMs(rem / (debugMode ? debugSpeed : 1));
        barEl.style.width    = (rem / addon.duration * 100).toFixed(1) + '%';
      };
      updateAddon(t.aeration, els.aerTimer,  els.aerBar);
      updateAddon(t.skimmer,  els.skimTimer, els.skimBar);
      updateAddon(t.feeder,   els.feedTimer, els.feedBar);
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
  if (container._lastTop === firstEntry.msg + firstEntry.tankId) return;
  container._lastTop = firstEntry.msg + firstEntry.tankId;

  const multiTank = state.tanks.length > 1;

  // Group consecutive entries with same group key + same tank
  const grouped = [];
  for (const e of entries) {
    const eKey = e.group + '|' + (e.tankId ?? '');
    const last = grouped[grouped.length - 1];
    if (last && last._key === eKey) {
      last.count++;
    } else {
      grouped.push({ ...e, count: 1, _key: eKey });
    }
  }

  container.innerHTML = grouped.map((e, i) => {
    const label = (multiTank && e.tankId !== undefined) ? `<span class="log-tank">[T${e.tankId + 1}]</span> ` : '';
    const text  = e.count > 1 ? `${e.count}x ${e.group}` : e.msg;
    return `<div class="log-entry ${i === 0 && e.isNew ? 'new' : ''}">${label}${text}</div>`;
  }).join('');
  entries.forEach(e => { e.isNew = false; });
}

function renderStatusBar() {
  const bar = document.getElementById('statusbar');
  const msg = document.getElementById('status-msg');
  const t = activeTank();
  const alive = state.monkeys.filter(m => m.alive && m.tankId === state.activeTankId && !m.inStorage);

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
  const adults = state.monkeys.filter(m => m.alive && m.stage === 'adult' && m.tankId === state.activeTankId);
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
  const tank = activeTank();
  if (!tank.eggsAdded) { addNotification('✨ Release eggs first!'); return; }
  tank.glowingFlakesActive = (tank.glowingFlakesActive || 0) + 1;
  state.inventory.glowingFlakes--;
  addXP(5);
  const stack = tank.glowingFlakesActive;
  addLog(`✨ Glowing Flakes activated in ${tank.name}! ${stack} birth${stack > 1 ? 's' : ''} queued with 10× mutations. (parents take damage)`);
  addNotification(`✨ Glowing Flakes ×${stack} active!`);
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
  if (!activeTank().eggsAdded) {
    addNotification('🥚 Release eggs first!');
    return;
  }
  const count = 5 + Math.floor(Math.random() * 4); // 5-8 eggs
  for (let i = 0; i < count; i++) createMonkey({ stage: 'egg', generation: state.stats.totalGenerations, tankId: state.activeTankId });
  state.inventory.boosterEggPack--;
  addXP(5);
  addLog(`🥚 Booster Egg Pack used! ${count} new eggs added to the tank`);
  addNotification(`🥚 +${count} eggs!`);
  saveState();
}

function renderInventory() {
  const inv = state.inventory;
  const hasLife = activeTank().eggsAdded;

  document.getElementById('currency-balance').textContent = `£${(state.currency || 0).toLocaleString()}`;
  document.getElementById('inv-shells-balance').textContent = (state.shells || 0).toLocaleString();

  document.getElementById('inv-life-booster-cnt').textContent = inv.lifeBooster.toLocaleString();
  document.getElementById('inv-egg-pack-cnt').textContent     = inv.boosterEggPack.toLocaleString();
  document.getElementById('btn-use-life-booster').disabled = inv.lifeBooster <= 0 || !hasLife;
  document.getElementById('btn-use-egg-pack').disabled     = inv.boosterEggPack <= 0 || !hasLife;

  document.getElementById('inv-glowing-flakes-cnt').textContent = inv.glowingFlakes.toLocaleString();
  document.getElementById('btn-use-glowing-flakes').disabled = inv.glowingFlakes <= 0 || !hasLife;
  const flakesStack = activeTank().glowingFlakesActive || 0;
  const flakesBadge = document.getElementById('glowing-flakes-active-badge');
  if (flakesBadge) {
    flakesBadge.style.display = flakesStack > 0 ? '' : 'none';
    flakesBadge.textContent = flakesStack > 1 ? `● ACTIVE ×${flakesStack}` : '● ACTIVE';
  }

  document.getElementById('inv-magnifying-glass-cnt').textContent = inv.magnifyingGlass.toLocaleString();
  const mgBtn = document.getElementById('btn-toggle-magnifying-glass');
  mgBtn.disabled = inv.magnifyingGlass <= 0;
  mgBtn.textContent = state.magnifyingGlassMode ? '🔍 Genotype ON' : '🔍 Phenotype';
  mgBtn.classList.toggle('debug-active', state.magnifyingGlassMode);

  const tank = activeTank();
  const inhibUntil = tank?.mutationInhibitorUntil || 0;
  const inhibRemMs = Math.max(0, inhibUntil - Date.now());
  const inhibActive = inhibRemMs > 0;
  document.getElementById('inv-mutation-inhibitor-cnt').textContent = inv.mutationInhibitor.toLocaleString();
  const inhibBtn = document.getElementById('btn-use-mutation-inhibitor');
  inhibBtn.disabled = inv.mutationInhibitor <= 0 || inhibActive;
  const inhibBadge = document.getElementById('mutation-inhibitor-badge');
  if (inhibActive) {
    const remSec = Math.ceil(inhibRemMs / 1000);
    const m = Math.floor(remSec / 60), s = remSec % 60;
    inhibBadge.textContent = `● ACTIVE ${m}:${String(s).padStart(2,'0')}`;
    inhibBadge.style.display = '';
  } else {
    inhibBadge.style.display = 'none';
  }

  const activeHasHydra = !!(activeTank()?.hydra);
  document.getElementById('inv-hydra-killer-cnt').textContent = inv.hydraKiller.toLocaleString();
  document.getElementById('btn-use-hydra-killer').disabled = inv.hydraKiller <= 0 || !activeHasHydra;

  const storedEggCount = state.monkeys.filter(m => m.inStorage).length;
  document.getElementById('inv-egg-storage-cnt').textContent = storedEggCount.toLocaleString();
  document.getElementById('btn-view-egg-storage').disabled = storedEggCount === 0;
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

let _movingMonkeyId = null;

function showMoveMonkeyModal(monkeyId) {
  const m = state.monkeys.find(m => m.id === monkeyId);
  if (!m || !m.alive || state.tanks.length <= 1) return;
  _movingMonkeyId = monkeyId;
  document.getElementById('move-monkey-title').textContent = `Move ${m.name} to...`;
  const otherTanks = state.tanks.filter(t => t.id !== m.tankId);
  document.getElementById('move-monkey-tanks').innerHTML = otherTanks.map(t =>
    `<button class="btn primary" data-move-tank="${t.id}">${t.name}</button>`
  ).join('');
  document.getElementById('move-monkey-modal').classList.add('open');
}

function closeMoveMonkeyModal() {
  document.getElementById('move-monkey-modal').classList.remove('open');
  _movingMonkeyId = null;
}

function addWater() {
  const t = activeTank();
  if (t.waterAdded) return;
  t.waterAdded = true;
  t.purifying = true;
  t.purifyStartTime = Date.now();
  const purifyLabel = t.purifyDuration <= 20_000 ? '~20 sec' : '~2 min';
  addLog('💧 Water packet added. Purifying...', null, t.id);
  addNotification(`💧 Purification started! (${purifyLabel})`);
  saveState();
}

let _placingEggId    = null;
let _placingGroupLabel = null;
let _egsSearch       = '';
const _egsCollapsed  = new Set();

function storeEgg(id) {
  const m = state.monkeys.find(m => m.id === id);
  if (!m || !m.alive || m.stage !== 'egg') return;
  m.inStorage = true;
  _popSignature = '';
  addLog(`📦 ${m.name} stored.`, null, m.tankId);
  saveState();
}

function placeEgg(id, tankId) {
  const m = state.monkeys.find(m => m.id === id);
  if (!m || !m.inStorage) return;
  const tank = state.tanks.find(t => t.id === tankId);
  if (!tank || !tank.waterPure) return;
  m.inStorage = false;
  m.tankId = tankId;
  m.stageStartTime = Date.now();  // reset hatch timer fresh
  if (!tank.eggsAdded) {
    tank.eggsAdded = true;
    state.gameStarted = true;
    state.lastTick = state.lastTick || Date.now();
  }
  _popSignature = '';
  _placingEggId = null;
  addLog(`🥚 Egg placed in ${tank.name}.`, null, tankId);
  saveState();
  renderEggStorage();
}

function placeAllEggs(label, tankId) {
  const tank = state.tanks.find(t => t.id === tankId);
  if (!tank || !tank.waterPure) return;
  const eggs = state.monkeys.filter(m => {
    if (!m.inStorage) return false;
    const phenotype = m.dna ? resolveColorPhenotype(m.dna.body_color) : 'C_PINK';
    if ((PHENOTYPE_DEFS[phenotype]?.name || phenotype) !== label) return false;
    return !_egsSearch || popSearchMatch(m, _egsSearch);
  });
  if (!eggs.length) return;
  const now = Date.now();
  for (const m of eggs) {
    m.inStorage = false;
    m.tankId = tankId;
    m.stageStartTime = now;
  }
  if (!tank.eggsAdded) {
    tank.eggsAdded = true;
    state.gameStarted = true;
    state.lastTick = state.lastTick || now;
  }
  _popSignature = '';
  _placingGroupLabel = null;
  addLog(`🥚 ${eggs.length} ${label} egg${eggs.length > 1 ? 's' : ''} placed in ${tank.name}.`, null, tankId);
  saveState();
  renderEggStorage();
}

function sellStoredEgg(id) {
  const m = state.monkeys.find(m => m.id === id && m.inStorage);
  if (!m) return;
  const price = calcSellPrice(m);
  state.currency += price;
  state.monkeys = state.monkeys.filter(m2 => m2.id !== id);
  addLog(`💰 ${m.name} (stored egg) sold for £${price}.`);
  saveState();
  renderEggStorage();
  renderInventory();
}

function sellStoredGroup(label) {
  const eggs = state.monkeys.filter(m => {
    if (!m.inStorage) return false;
    const phenotype = m.dna ? resolveColorPhenotype(m.dna.body_color) : 'C_PINK';
    if ((PHENOTYPE_DEFS[phenotype]?.name || phenotype) !== label) return false;
    return !_egsSearch || popSearchMatch(m, _egsSearch);
  });
  if (!eggs.length) return;
  let total = 0;
  const ids = new Set(eggs.map(m => m.id));
  for (const m of eggs) total += calcSellPrice(m);
  state.currency += total;
  state.monkeys = state.monkeys.filter(m => !ids.has(m.id));
  addLog(`💰 Sold ${eggs.length} ${label} egg${eggs.length > 1 ? 's' : ''} for £${total}.`);
  saveState();
  renderEggStorage();
  renderInventory();
}

function renderEggStorage() {
  const list = document.getElementById('egg-storage-list');
  if (!list) return;
  const stored = state.monkeys.filter(m => m.inStorage);

  if (!stored.length) {
    list.innerHTML = '<div style="color:#5599bb;font-size:11px;text-align:center;padding:20px 0;">No eggs in storage.</div>';
    return;
  }

  const q = _egsSearch.toLowerCase();
  const filtered = q ? stored.filter(m => popSearchMatch(m, q)) : stored;

  // Group by colour phenotype name
  if (!filtered.length) {
    list.innerHTML = `<div style="color:#5599bb;font-size:11px;text-align:center;padding:20px 0;">No results for "${_egsSearch}".</div>`;
    return;
  }

  const groups = {};
  for (const m of filtered) {
    const phenotype = m.dna ? resolveColorPhenotype(m.dna.body_color) : 'C_PINK';
    const def = PHENOTYPE_DEFS[phenotype] || {};
    const label = def.name || phenotype;
    if (!groups[label]) groups[label] = { label, phenotype, eggs: [] };
    groups[label].eggs.push(m);
  }
  const sorted = Object.values(groups).sort((a, b) => a.label.localeCompare(b.label));

  list.innerHTML = sorted.map(g => {
    const eggCards = g.eggs.map(m => {
      const def = PHENOTYPE_DEFS[g.phenotype] || {};
      let emojiStyle = '';
      let bioGlowClass = '';
      if (g.phenotype === 'C_BIO') {
        if (bioGlowAnimation) {
          bioGlowClass = ' bio-glow';
        } else {
          const fp = def.filterStr ? `filter:${def.filterStr};` : '';
          const sp = def.shadow    ? `text-shadow:${def.shadow};` : '';
          if (fp || sp) emojiStyle = `style="${fp}${sp}"`;
        }
      } else if (def.opacity) {
        emojiStyle = `style="opacity:${def.opacity};filter:${def.filterStr};"`;
      } else {
        const fp = def.filterStr ? `filter:${def.filterStr};` : '';
        const sp = def.shadow    ? `text-shadow:${def.shadow};` : '';
        if (fp || sp) emojiStyle = `style="${fp}${sp}"`;
      }

      const parts = [];
      if (m.dna) {
        const fn = (geneId, code) => GENE_DATA.find(g => g.id === geneId).alleles.find(a => a.code === code).name;
        const metCode  = resolveAllele(m.dna.metabolism,   'metabolism');
        const conCode  = resolveAllele(m.dna.constitution, 'constitution');
        const lonCode  = resolveAllele(m.dna.longevity,    'longevity');
        const tailCode = resolveAllele(m.dna.tail_shape,   'tail_shape');
        if (metCode  !== 'M_NRM') parts.push(fn('metabolism',   metCode));
        if (conCode  !== 'H_AVG') parts.push(fn('constitution', conCode));
        if (lonCode  !== 'L_STD') parts.push(fn('longevity',    lonCode));
        if (tailCode !== 'T_STD') parts.push(fn('tail_shape',   tailCode));
      }
      const traitsStr = parts.join(', ') || 'Standard traits';

      const isPlacing = _placingEggId === m.id;
      const eligibleTanks = state.tanks.filter(t => t.waterPure);
      const tankBtns = eligibleTanks.map(t =>
        `<button class="egs-tank-btn" data-place-egg="${m.id}" data-place-tank="${t.id}">${t.name}</button>`
      ).join('');

      return `<div class="egs-egg-card${isPlacing ? ' placing' : ''}">
        <span class="egs-egg-emoji-wrap${bioGlowClass}" data-monkey-id="${m.id}" ${emojiStyle}>🥚</span>
        <div class="egs-egg-info">
          <span class="egs-egg-name">${m.name} · Gen ${m.generation}</span>
          <span class="egs-egg-traits">${traitsStr}</span>
        </div>
        <div class="egs-card-actions">
          ${isPlacing ? '' : `<button class="egs-sell-btn" data-sell-egg="${m.id}">£${calcSellPrice(m)}</button>`}
          ${isPlacing && tankBtns
            ? `<div class="egs-tank-btns">${tankBtns}</div>`
            : `<button class="egs-place-btn" data-egg-id="${m.id}">Place ▾</button>`
          }
        </div>
      </div>`;
    }).join('');

    const eligibleTanks = state.tanks.filter(t => t.waterPure);
    const isPlacingGroup = _placingGroupLabel === g.label;
    const isCollapsed    = _egsCollapsed.has(g.label);
    const groupTankBtns = eligibleTanks.map(t =>
      `<button class="egs-tank-btn" data-place-all-tank="${t.id}" data-place-all-group="${g.label}">${t.name}</button>`
    ).join('');
    const groupTotal = g.eggs.reduce((sum, m) => sum + calcSellPrice(m), 0);

    return `<div class="egs-colour-group">
      <div class="egs-group-header" data-toggle-group="${g.label}" style="cursor:pointer">
        <span class="egs-group-label">${isCollapsed ? '▶' : '▼'} ${g.label} <span style="color:#2a6a9a;">(${g.eggs.length})</span></span>
        ${isCollapsed ? '' : `<div class="egs-group-actions">
          ${isPlacingGroup ? '' : `<button class="egs-sell-all-btn" data-sell-all-group="${g.label}">Sell All £${groupTotal.toLocaleString()}</button>`}
          ${isPlacingGroup && groupTankBtns
            ? `<div class="egs-tank-btns">${groupTankBtns}</div>`
            : `<button class="egs-place-all-btn" data-place-all-group="${g.label}">Place All ▾</button>`
          }
        </div>`}
      </div>
      ${isCollapsed ? '' : eggCards}
    </div>`;
  }).join('');
}

function releaseEggs() {
  const t = activeTank();
  if (!t.waterPure || t.eggsAdded) return;
  t.eggsAdded = true;
  state.gameStarted = true;
  state.lastTick = Date.now();

  const count = 3 + Math.floor(Math.random() * 3); // 3-5 eggs
  // Guarantee at least one male and one female so the colony can grow
  const sexes = ['M', 'F'];
  for (let i = 2; i < count; i++) sexes.push(Math.random() < 0.5 ? 'M' : 'F');
  sexes.sort(() => Math.random() - 0.5); // shuffle so guaranteed pair isn't always first
  for (let i = 0; i < count; i++) {
    createMonkey({ stage: 'egg', generation: 1, tankId: t.id, sex: sexes[i] });
  }
  addLog(`🥚 Released ${count} sea monkey eggs into the tank!`, null, t.id);
  addNotification(`🥚 ${count} eggs released!`);
  saveState();
}

function setColorTheme(theme) {
  colorTheme = theme;
  localStorage.setItem('colorTheme', theme);
  document.body.classList.remove('theme-light', 'theme-colorblind');
  if (theme === 'light')       document.body.classList.add('theme-light');
  if (theme === 'colorblind')  document.body.classList.add('theme-colorblind');
  // Update active button state
  ['dark', 'light', 'colorblind'].forEach(t => {
    const btn = document.getElementById('theme-' + t);
    if (btn) btn.classList.toggle('primary', t === theme);
  });
  // Force monkey re-render with new filters
  for (const id of Object.keys(monkeyEls)) {
    monkeyEls[id].remove();
    delete monkeyEls[id];
  }
}

function setupEventListeners() {
  // Shop
  document.getElementById('btn-open-shop').addEventListener('click', () => {
    _shopSig = '';
    renderShop();
    document.getElementById('shop-modal').classList.add('open');
  });
  document.getElementById('shop-close').addEventListener('click', () => {
    document.getElementById('shop-modal').classList.remove('open');
  });
  document.getElementById('shop-modal').addEventListener('click', (e) => {
    if (e.target === document.getElementById('shop-modal'))
      document.getElementById('shop-modal').classList.remove('open');
  });
  document.getElementById('shop-item-list').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-shop-buy]');
    if (btn) buyShopItem(btn.dataset.shopBuy);
  });

  // Grants modal
  document.getElementById('btn-grants').addEventListener('click', () => {
    _grantsSig = '';
    renderGrants();
    document.getElementById('grants-modal').classList.add('open');
  });
  document.getElementById('grants-close').addEventListener('click', () => {
    document.getElementById('grants-modal').classList.remove('open');
  });
  document.getElementById('grants-modal').addEventListener('click', (e) => {
    if (e.target === document.getElementById('grants-modal'))
      document.getElementById('grants-modal').classList.remove('open');
  });
  document.getElementById('grants-list').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-claim-grant]');
    if (btn) claimGrant(btn.dataset.claimGrant);
  });

  // Skill Tree modal
  document.getElementById('btn-skills').addEventListener('click', () => {
    _skillSig = '';
    renderSkillTree();
    document.getElementById('skills-modal').classList.add('open');
  });
  document.getElementById('skills-close').addEventListener('click', () => {
    document.getElementById('skills-modal').classList.remove('open');
  });
  document.getElementById('skills-modal').addEventListener('click', (e) => {
    if (e.target === document.getElementById('skills-modal'))
      document.getElementById('skills-modal').classList.remove('open');
  });
  document.getElementById('skills-branches').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-buy-skill]');
    if (btn && !btn.disabled) {
      const [branchId, nodeId] = btn.dataset.buySkill.split(':');
      buySkill(branchId, nodeId);
      renderSkillTree();
    }
  });
  document.getElementById('skills-branches').addEventListener('change', (e) => {
    if (e.target.id === 'cryo-pod-tank-select') {
      state.skills.cryoPodTankId = e.target.value ? Number(e.target.value) : null;
      const t = state.tanks.find(t => t.id === state.skills.cryoPodTankId);
      if (t) addLog(`🧊 Cryo-Pod assigned to ${t.name}.`);
      saveState();
    }
  });

  // Move monkey modal
  document.getElementById('move-monkey-cancel').addEventListener('click', closeMoveMonkeyModal);
  document.getElementById('move-monkey-modal').addEventListener('click', (e) => {
    if (e.target === document.getElementById('move-monkey-modal')) closeMoveMonkeyModal();
    const btn = e.target.closest('[data-move-tank]');
    if (btn && _movingMonkeyId !== null) {
      const m = state.monkeys.find(m => m.id === _movingMonkeyId);
      if (m) {
        const destId = Number(btn.dataset.moveTank);
        const destTank = state.tanks.find(t => t.id === destId);
        addLog(`🔀 ${m.name} moved to ${destTank.name}.`, null, destId);
        m.tankId = destId;
        _popSignature = '';
        saveState();
      }
      closeMoveMonkeyModal();
    }
  });

  // Population list: click card to move monkey
  document.getElementById('population-list').addEventListener('click', (e) => {
    // Store egg button takes priority
    const storeBtn = e.target.closest('[data-store-egg]');
    if (storeBtn) { storeEgg(Number(storeBtn.dataset.storeEgg)); return; }
    // DNA Archive button
    const archiveBtn = e.target.closest('[data-archive-dna]');
    if (archiveBtn) {
      const m = state.monkeys.find(m => m.id === Number(archiveBtn.dataset.archiveDna));
      if (m?.dna) {
        state.skills.storedDNA = { dna: JSON.parse(JSON.stringify(m.dna)), name: m.name };
        addLog(`🧬 DNA archived: ${m.name}`);
        addNotification(`🧬 DNA archived: ${m.name}`);
        _skillSig = ''; _popSignature = '';
        saveState();
      }
      return;
    }
    // Sell button
    const sellBtn = e.target.closest('[data-sell-monkey]');
    if (sellBtn) { sellMonkey(Number(sellBtn.dataset.sellMonkey)); return; }

    if (state.tanks.length <= 1) return;
    const card = e.target.closest('.pop-card[data-monkey-id]');
    if (card) showMoveMonkeyModal(Number(card.dataset.monkeyId));
  });

  // Population search + stage filter
  document.getElementById('pop-search').addEventListener('input', (e) => {
    _popSearch = e.target.value.trim();
    _popSignature = '';
    renderPopulation();
  });
  ['egg', 'baby', 'juvenile', 'adult', 'dead'].forEach(stage => {
    document.getElementById(`pop-filter-${stage}`).addEventListener('change', (e) => {
      _popStageFilter[stage] = e.target.checked;
      _popSignature = '';
      renderPopulation();
    });
  });

  document.getElementById('btn-use-life-booster').addEventListener('click', useLifeBooster);
  document.getElementById('btn-use-egg-pack').addEventListener('click', useBoosterEggPack);
  document.getElementById('btn-use-glowing-flakes').addEventListener('click', useGlowingFlakes);
  document.getElementById('btn-toggle-magnifying-glass').addEventListener('click', toggleMagnifyingGlass);
  document.getElementById('btn-use-hydra-killer').addEventListener('click', () => {
    useHydraKiller(state.activeTankId);
  });

  document.getElementById('btn-use-mutation-inhibitor').addEventListener('click', () => {
    const t = activeTank();
    if (!t || state.inventory.mutationInhibitor <= 0) return;
    if (Date.now() < (t.mutationInhibitorUntil || 0)) { addNotification('Already active in this tank!'); return; }
    state.inventory.mutationInhibitor--;
    t.mutationInhibitorUntil = Date.now() + MUT_INHIBITOR_MS;
    addLog(`🧪 Mutation Inhibitor active in ${t.name} for 10 minutes.`, null, t.id);
    saveState();
  });

  document.getElementById('egs-search').addEventListener('input', (e) => {
    _egsSearch = e.target.value.trim();
    _placingEggId = null; _placingGroupLabel = null;
    renderEggStorage();
  });
  document.getElementById('btn-view-egg-storage').addEventListener('click', () => {
    _placingEggId = null; _placingGroupLabel = null; _egsSearch = '';
    document.getElementById('egs-search').value = '';
    renderEggStorage();
    document.getElementById('egg-storage-modal').classList.add('open');
  });
  document.getElementById('egg-storage-close').addEventListener('click', () => {
    document.getElementById('egg-storage-modal').classList.remove('open');
    _placingEggId = null; _placingGroupLabel = null; _egsSearch = '';
    document.getElementById('egs-search').value = '';
  });
  document.getElementById('egg-storage-modal').addEventListener('click', (e) => {
    if (e.target === document.getElementById('egg-storage-modal')) {
      document.getElementById('egg-storage-modal').classList.remove('open');
      _placingEggId = null; _placingGroupLabel = null; _egsSearch = '';
      document.getElementById('egs-search').value = '';
    }
  });
  // Egg emoji hover → gene tooltip (fixed-position to escape scroll overflow clipping)
  const egsTooltip      = document.getElementById('egs-gene-tooltip');
  const egsTooltipTitle = document.getElementById('egs-gene-tooltip-title');
  const egsTooltipBody  = document.getElementById('egs-gene-tooltip-body');
  document.getElementById('egg-storage-list').addEventListener('mouseover', (e) => {
    const wrap = e.target.closest('.egs-egg-emoji-wrap');
    if (!wrap) { egsTooltip.style.display = 'none'; return; }
    const m = state.monkeys.find(m => m.id === Number(wrap.dataset.monkeyId));
    if (!m?.dna) { egsTooltip.style.display = 'none'; return; }
    egsTooltipTitle.textContent = `${m.name} · Gen ${m.generation}`;
    egsTooltipBody.innerHTML = genotypeCardHTML(m.dna);
    const rect = wrap.getBoundingClientRect();
    // Prefer right of emoji; clamp so it doesn't go off-screen
    const ttW = 210;
    const left = Math.min(rect.right + 8, window.innerWidth - ttW - 8);
    egsTooltip.style.left = left + 'px';
    egsTooltip.style.top  = rect.top + 'px';
    egsTooltip.style.display = 'block';
  });
  document.getElementById('egg-storage-modal').addEventListener('mouseleave', () => {
    egsTooltip.style.display = 'none';
  });
  document.getElementById('egg-storage-close').addEventListener('mouseenter', () => {
    egsTooltip.style.display = 'none';
  });

  document.getElementById('egg-storage-list').addEventListener('click', (e) => {
    // Collapse/expand group — only when clicking directly on header, not its buttons
    if (!e.target.closest('button') && !e.target.closest('.egs-tank-btns')) {
      const groupHeader = e.target.closest('[data-toggle-group]');
      if (groupHeader) {
        const label = groupHeader.dataset.toggleGroup;
        _egsCollapsed.has(label) ? _egsCollapsed.delete(label) : _egsCollapsed.add(label);
        renderEggStorage();
        return;
      }
    }
    // Sell single stored egg
    const sellEggBtn = e.target.closest('[data-sell-egg]');
    if (sellEggBtn) { sellStoredEgg(Number(sellEggBtn.dataset.sellEgg)); return; }
    // Sell all eggs in a group (respects search filter)
    const sellAllBtn = e.target.closest('[data-sell-all-group]');
    if (sellAllBtn) { sellStoredGroup(sellAllBtn.dataset.sellAllGroup); return; }
    // Place all eggs in group into a specific tank
    const placeAllTankBtn = e.target.closest('[data-place-all-tank]');
    if (placeAllTankBtn) {
      placeAllEggs(placeAllTankBtn.dataset.placeAllGroup, Number(placeAllTankBtn.dataset.placeAllTank));
      return;
    }
    // "Place All ▾" — expand group-level tank picker
    const placeAllBtn = e.target.closest('[data-place-all-group]');
    if (placeAllBtn) {
      _placingGroupLabel = _placingGroupLabel === placeAllBtn.dataset.placeAllGroup
        ? null  // toggle off if already open
        : placeAllBtn.dataset.placeAllGroup;
      _placingEggId = null;
      renderEggStorage();
      return;
    }
    // Place single egg into a specific tank
    const tankBtn = e.target.closest('[data-place-tank]');
    if (tankBtn) {
      placeEgg(Number(tankBtn.dataset.placeEgg), Number(tankBtn.dataset.placeTank));
      return;
    }
    // "Place in Tank ▾" — expand single-egg tank picker
    const placeBtn = e.target.closest('.egs-place-btn');
    if (placeBtn) {
      _placingEggId = _placingEggId === Number(placeBtn.dataset.eggId)
        ? null  // toggle off
        : Number(placeBtn.dataset.eggId);
      _placingGroupLabel = null;
      renderEggStorage();
    }
  });

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

  // Volume sliders
  const musicVolSlider = document.getElementById('music-vol');
  const sfxVolSlider   = document.getElementById('sfx-vol');
  const musicVolPct    = document.getElementById('music-vol-pct');
  const sfxVolPct      = document.getElementById('sfx-vol-pct');
  musicVolSlider.value = AudioEngine.getMusicVol();
  sfxVolSlider.value   = AudioEngine.getSfxVol();
  musicVolPct.textContent = Math.round(AudioEngine.getMusicVol() * 100) + '%';
  sfxVolPct.textContent   = Math.round(AudioEngine.getSfxVol()   * 100) + '%';
  musicVolSlider.addEventListener('input', () => {
    AudioEngine.setMusicVol(parseFloat(musicVolSlider.value));
    musicVolPct.textContent = Math.round(musicVolSlider.value * 100) + '%';
  });
  sfxVolSlider.addEventListener('input', () => {
    AudioEngine.setSfxVol(parseFloat(sfxVolSlider.value));
    sfxVolPct.textContent = Math.round(sfxVolSlider.value * 100) + '%';
  });

  document.getElementById('fps-stress-pop').addEventListener('change', () => {
    const input = document.getElementById('fps-stress-pop');
    const val = parseInt(input.value);
    if (!isNaN(val) && val >= 1) {
      fpsStressPopulation = val;
      fpsLowSince = null;
      state.fpsStressPop = val;
      document.getElementById('fps-stress-reset-row').style.display = '';
      saveState();
    }
  });

  document.getElementById('btn-reset-fps-stress').addEventListener('click', () => {
    fpsStressPopulation = null;
    fpsLowSince = null;
    state.fpsStressPop = null;
    const input = document.getElementById('fps-stress-pop');
    if (input) input.value = '';
    const resetRow = document.getElementById('fps-stress-reset-row');
    if (resetRow) resetRow.style.display = 'none';
    saveState();
    addNotification('🔄 FPS cap cleared');
  });

  document.getElementById('btn-pause').addEventListener('click', () => {
    const btn = document.getElementById('btn-pause');
    if (paused) {
      // Shift all timestamps forward BEFORE clearing the paused flag,
      // so the tick loop never sees stale timestamps on the first tick.
      const pauseDuration = Date.now() - pausedAt;
      for (const t of state.tanks) {
        if (t.aeration.startedAt != null) t.aeration.startedAt += pauseDuration;
        if (t.skimmer.startedAt  != null) t.skimmer.startedAt  += pauseDuration;
        if (t.feeder.startedAt   != null) t.feeder.startedAt   += pauseDuration;
        if (t.purifyStartTime    != null) t.purifyStartTime    += pauseDuration;
        if (t.snailLastEat       != null) t.snailLastEat       += pauseDuration;
        if (t.hydra?.lastHunt != null) t.hydra.lastHunt += pauseDuration;
      }
      for (const m of state.monkeys) {
        if (m.stageStartTime != null) m.stageStartTime += pauseDuration;
        if (m.pregnantSince  != null) m.pregnantSince  += pauseDuration;
        if (m.bornAt         != null) m.bornAt         += pauseDuration;
        if (m.lastMatedAt    != null) m.lastMatedAt    += pauseDuration;
      }
      paused = false;
      btn.textContent = '⏸';
      btn.classList.remove('paused');
      btn.title = 'Pause simulation';
      addNotification('▶ Resumed');
    } else {
      paused = true;
      pausedAt = Date.now();
      btn.textContent = '▶';
      btn.classList.add('paused');
      btn.title = 'Resume simulation';
      addNotification('⏸ Paused');
    }
  });

  // Sidebar collapse toggle
  document.getElementById('sidebar-collapse-btn').addEventListener('click', () => {
    const mini = document.body.classList.toggle('sidebar-mini');
    document.getElementById('sidebar-collapse-btn').textContent = mini ? '▶' : '◀';
    localStorage.setItem('sidebarCollapsed', mini ? '1' : '0');
  });
  document.getElementById('mini-conditions').addEventListener('click', e => {
    const ring = e.target.closest('[data-action]');
    if (!ring) return;
    const action = ring.dataset.action;
    if (action === 'feed')   document.getElementById('btn-feed').click();
    if (action === 'aerate') document.getElementById('btn-aerate').click();
    if (action === 'clean')  document.getElementById('btn-clean').click();
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

  // Colour theme buttons
  ['dark', 'light', 'colorblind'].forEach(t => {
    document.getElementById('theme-' + t).addEventListener('click', () => setColorTheme(t));
  });

  const limitViewToggle = document.getElementById('toggle-limit-view');
  limitViewToggle.checked = limitViewToCap;
  limitViewToggle.addEventListener('change', (e) => {
    limitViewToCap = e.target.checked;
    localStorage.setItem('limitViewToCap', limitViewToCap ? '1' : '0');
  });

  const bioGlowToggle = document.getElementById('toggle-bio-glow');
  bioGlowToggle.checked = bioGlowAnimation;
  bioGlowToggle.addEventListener('change', (e) => {
    bioGlowAnimation = e.target.checked;
    localStorage.setItem('bioGlowAnimation', bioGlowAnimation ? '1' : '0');
  });

  document.getElementById('inv-panel-title').addEventListener('click', () => {
    const panel = document.getElementById('inventory-panel');
    const collapsed = panel.classList.toggle('inv-collapsed');
    document.getElementById('inv-collapse-btn').textContent = collapsed ? '▴' : '▾';
    localStorage.setItem('inventoryCollapsed', collapsed ? '1' : '0');
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

  document.getElementById('btn-debug-spawn-hydra').addEventListener('click', () => {
    const tank = activeTank();
    if (!tank || !tank.eggsAdded) { addNotification('No active tank with life!'); return; }
    if (tank.hydra) { addNotification('Hydra already present!'); return; }
    tank.hydra = { hp: HYDRA_HP, lastHunt: Date.now(), huntInterval: HYDRA_HUNT_MIN + Math.random() * (HYDRA_HUNT_MAX - HYDRA_HUNT_MIN) };
    _tmSig = '';
    AudioEngine.play('alarm');
    addLog(`🪸 [DEBUG] Hydra spawned in ${tank.name}.`, null, tank.id);
    addNotification(`🪸 Hydra spawned!`);
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
  const tankTabs = ['tab-tank', 'tab-life-support', 'tab-population', 'tab-tank-manager'];
  const tankViews = {
    'tab-life-support': 'life-support-view',
    'tab-population':   'population-view',
    'tab-tank-manager': 'tank-manager-view',
  };
  function switchTankTab(activeId) {
    tankTabs.forEach(id => {
      document.getElementById(id).classList.toggle('active', id === activeId);
    });
    Object.values(tankViews).forEach(vid => {
      document.getElementById(vid).classList.remove('active');
    });
    if (tankViews[activeId]) {
      document.getElementById(tankViews[activeId]).classList.add('active');
      if (activeId === 'tab-population')   renderPopulation();
      if (activeId === 'tab-tank-manager') { _tmSig = ''; renderTankManager(); }
      if (activeId === 'tab-life-support') { _lsAerLevel = -1; _lsSkimLevel = -1; _lsFeederLevel = -1; }
    }
  }
  tankTabs.forEach(id => {
    document.getElementById(id).addEventListener('click', () => switchTankTab(id));
  });

  document.getElementById('tank-conditions-list').addEventListener('click', (e) => {
    const row = e.target.closest('[data-cond-tank]');
    if (row) switchActiveTank(Number(row.dataset.condTank));
  });

  // Tank Manager — name editing and Switch button
  document.getElementById('tank-manager-list').addEventListener('click', (e) => {
    // Population capacity upgrade button
    const popUpgradeBtn = e.target.closest('[data-pop-upgrade]');
    if (popUpgradeBtn) { buyPopUpgrade(Number(popUpgradeBtn.dataset.popUpgrade)); return; }
    const buySkimmerBtn = e.target.closest('[data-buy-skimmer]');
    if (buySkimmerBtn) { buyEggSkimmer(Number(buySkimmerBtn.dataset.buySkimmer)); return; }
    const toggleSkimmerBtn = e.target.closest('[data-toggle-skimmer]');
    if (toggleSkimmerBtn) { toggleEggSkimmer(Number(toggleSkimmerBtn.dataset.toggleSkimmer)); return; }
    const buySnailBtn = e.target.closest('[data-buy-snail]');
    if (buySnailBtn) { buySnail(Number(buySnailBtn.dataset.buySnail)); return; }
    const useHydraKillerBtn = e.target.closest('[data-use-hydra-killer]');
    if (useHydraKillerBtn) { useHydraKiller(Number(useHydraKillerBtn.dataset.useHydraKiller)); return; }
    // Switch button
    const switchBtn = e.target.closest('[data-tm-switch]');
    if (switchBtn) {
      switchActiveTank(Number(switchBtn.dataset.tmSwitch));
      _tmSig = '';  // force rebuild to update active badge/button
      return;
    }
    // Name click → inline edit
    const nameEl = e.target.closest('[data-tm-name]');
    if (!nameEl) return;
    const tankId = Number(nameEl.dataset.tmName);
    const tank = state.tanks.find(t => t.id === tankId);
    if (!tank) return;
    const input = document.createElement('input');
    input.className = 'tm-tank-name-input';
    input.value = tank.name;
    nameEl.replaceWith(input);
    input.focus();
    input.select();
    let saved = false;
    const save = () => {
      if (saved) return;
      saved = true;
      const newName = input.value.trim() || tank.name;
      tank.name = newName;
      // Swap input back to a span immediately so the DOM is clean
      const span = document.createElement('span');
      span.className = 'tm-tank-name';
      span.dataset.tmName = tankId;
      span.title = 'Click to rename';
      span.textContent = newName;
      input.replaceWith(span);
      _tmSig = '';
      _tankSelectorSig = '';
      saveState();
    };
    input.addEventListener('blur', save);
    input.addEventListener('keydown', ev => {
      if (ev.key === 'Enter')  { input.blur(); }
      if (ev.key === 'Escape') { input.value = tank.name; input.blur(); }
    });
  });

  document.getElementById('tank-selector-bar').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-tank-id]');
    if (btn) { switchActiveTank(Number(btn.dataset.tankId)); return; }
    if (e.target.id === 'btn-buy-tank') { buyTank(); return; }
    if (e.target.id === 'btn-manager') {
      const isOpen = document.getElementById('tank-manager-view')?.classList.contains('active');
      switchTankTab(isOpen ? 'tab-tank' : 'tab-tank-manager');
      _tankSelectorSig = '';  // force selector rebuild to update active state
    }
  });

  document.getElementById('btn-feed').addEventListener('click', () => {
    const t = activeTank();
    const mb = getMasteryBonuses();
    const feedAmt = ACTION_FEED_BASE + mb.feedBonus;
    t.food = Math.min(getMaxFood(t), t.food + feedAmt);
    addXP(1);
    addLog(`🍔 Tank fed (+${feedAmt} food)`, null, t.id);
    addNotification('🍔 Fed!');
    AudioEngine.play('feed');
    spawnFoodFlakes();
    saveState();
  });

  document.getElementById('btn-aerate').addEventListener('click', () => {
    const t = activeTank();
    t.oxygen = Math.min(getMaxOxygen(t), t.oxygen + ACTION_AERATE_AMT);
    addXP(1);
    addLog('💨 Tank aerated (+50 oxygen)', null, t.id);
    addNotification('💨 Aerated!');
    AudioEngine.play('aerate');
    spawnBurstBubbles();
    saveState();
  });

  document.getElementById('btn-clean').addEventListener('click', () => {
    const t = activeTank();
    t.cleanliness = Math.min(getMaxCleanliness(t), t.cleanliness + ACTION_CLEAN_AMT);
    const corpses = state.monkeys.filter(m => !m.alive && m.tankId === state.activeTankId);
    state.monkeys = state.monkeys.filter(m => m.alive || m.tankId !== state.activeTankId);
    addXP(1);
    if (corpses.length > 0) {
      addLog(`🧹 Tank cleaned — removed ${corpses.length} dead sea monkey${corpses.length > 1 ? 's' : ''}`, null, t.id);
    } else {
      addLog('🧹 Tank cleaned (+40 cleanliness)', null, t.id);
    }
    addNotification('🧹 Cleaned!');
    AudioEngine.play('clean');
    saveState();
  });
}

// ─────────────────────────────────────────────
// 14. TANK SELECTOR + MULTI-TANK ACTIONS
// ─────────────────────────────────────────────

let _tankSelectorSig = '';

function renderTankSelector() {
  const bar = document.getElementById('tank-selector-bar');
  if (!bar) return;
  const mgrActive = document.getElementById('tank-manager-view')?.classList.contains('active') ? 1 : 0;
  const canAfford = state.currency >= 1000;
  const sig = state.tanks.map(t => t.id + ':' + t.name).join('|')
    + `|active:${state.activeTankId}|mgr:${mgrActive}|buy:${canAfford ? 1 : 0}`;
  if (sig === _tankSelectorSig) return;
  _tankSelectorSig = sig;
  const btns = state.tanks.map(t =>
    `<button class="tank-sel-btn${t.id === state.activeTankId ? ' active' : ''}" data-tank-id="${t.id}">${t.name}</button>`
  ).join('');
  const buyBtn = `<button class="tank-sel-btn tank-buy-btn"${canAfford ? '' : ' disabled'} id="btn-buy-tank">＋ Tank (£1,000)</button>`;
  const mgrBtn = `<button class="tank-sel-btn tank-mgr-btn${mgrActive ? ' active' : ''}" id="btn-manager">🏠 Manager</button>`;
  bar.innerHTML = btns + buyBtn + mgrBtn;
}

function switchActiveTank(id) {
  state.activeTankId = id;
  _lsAerLevel = -1; _lsSkimLevel = -1; _lsFeederLevel = -1;
  _popSignature = '';
  generateBubbles();
  saveState();
}

function buyTank() {
  if (state.currency < 1000) return;
  state.currency -= 1000;
  const newId = state.tanks.length;
  state.tanks.push({
    ...JSON.parse(JSON.stringify(DEFAULT_TANK)),
    id: newId,
    name: `Tank ${newId + 1}`,
    tankCreatedAt: Date.now(),
    purifyDuration: 20_000,
  });
  switchActiveTank(newId);
  addLog(`💰 Purchased Tank ${newId + 1}!`);
  saveState();
}

// ─────────────────────────────────────────────
// 15. BUBBLE GENERATION + INIT
// ─────────────────────────────────────────────

const AERATION_BUBBLE_COUNTS = [20, 40, 60, 80, 100, 120];

// Left-% positions for each airstone (1-indexed by level), placed in plant gaps
const AIRSTONE_POSITIONS = [8, 25, 40, 63, 80];

function updateAirstoneVisuals(tank, level) {
  AIRSTONE_POSITIONS.forEach((pos, i) => {
    let wrap = document.getElementById(`airstone-wrap-${i}`);
    if (!wrap) {
      wrap = document.createElement('div');
      wrap.id = `airstone-wrap-${i}`;
      wrap.className = 'airstone-wrap';
      wrap.style.left = pos + '%';
      wrap.innerHTML =
        '<div class="airstone-tube"></div>' +
        '<div class="airstone-pipe"></div>' +
        '<div class="airstone-stone"></div>';
      tank.appendChild(wrap);
    }
    wrap.style.display = (i < level) ? 'flex' : 'none';
  });
}

function generateBubbles(count) {
  const tank = document.getElementById('tank');
  tank.querySelectorAll('.bubble').forEach(b => b.remove());
  const level = activeTank()?.aeration?.level ?? 0;
  const n = count ?? AERATION_BUBBLE_COUNTS[level] ?? 5;

  updateAirstoneVisuals(tank, level);

  if (level > 0) {
    // Inject a dynamic keyframe so bubbles rise straight within the tube
    // until 50px from the tank top, then drift outward via --bx per bubble.
    const tankH = tank.clientHeight || 400;
    const breakPct = Math.round((tankH - 50) / tankH * 100);
    let dynStyle = document.getElementById('bubble-rise-dynamic');
    if (!dynStyle) {
      dynStyle = document.createElement('style');
      dynStyle.id = 'bubble-rise-dynamic';
      document.head.appendChild(dynStyle);
    }
    dynStyle.textContent = `
      @keyframes bubble-rise {
        0%           { bottom: 0;               transform: translateX(0);              opacity: 0.7; }
        ${breakPct}% { bottom: calc(100% - 50px); transform: translateX(0);           opacity: 0.7; }
        100%         { bottom: 100%;            transform: translateX(var(--bx, 0px)); opacity: 0;   }
      }`;
  } else {
    document.getElementById('bubble-rise-dynamic')?.remove();
  }

  for (let i = 0; i < n; i++) {
    const bubble = document.createElement('div');
    bubble.className = 'bubble';
    const size = 4 + Math.random() * 8;
    bubble.style.width  = size + 'px';
    bubble.style.height = size + 'px';
    if (level > 0) {
      // Distribute bubbles evenly across active airstones
      const airstonePos = AIRSTONE_POSITIONS[i % level];
      bubble.style.left = (airstonePos - 0.5 + Math.random()) + '%';
      bubble.style.setProperty('--bx', ((Math.random() - 0.5) * 80) + 'px');
    } else {
      bubble.style.left = (5 + Math.random() * 90) + '%';
    }
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

function setLoadingProgress(pct, label) {
  const fill = document.getElementById('loading-bar-fill');
  const lbl  = document.getElementById('loading-label');
  if (fill) fill.style.width = pct + '%';
  if (lbl)  lbl.textContent  = label;
}

function nextFrame() {
  return new Promise(resolve => requestAnimationFrame(resolve));
}

async function initGame() {
  // Show loading screen (already visible by default in HTML)
  setLoadingProgress(5, 'Loading save data…');
  await nextFrame();

  // Step 1: Load & migrate state
  state = loadState();
  if (!state.grants?.active?.length) generateGrants();
  setLoadingProgress(30, 'Restoring your farm…');
  await nextFrame();

  // Step 2: Init timestamps + UI state
  state.tanks.forEach(t => { if (!t.tankCreatedAt) t.tankCreatedAt = Date.now(); });
  if (localStorage.getItem('sidebarCollapsed') === '1') {
    document.body.classList.add('sidebar-mini');
    document.getElementById('sidebar-collapse-btn').textContent = '▶';
  }
  if (localStorage.getItem('inventoryCollapsed') === '0') {
    document.getElementById('inventory-panel').classList.remove('inv-collapsed');
    document.getElementById('inv-collapse-btn').textContent = '▾';
  }
  if (state.fpsStressPop != null) {
    fpsStressPopulation = state.fpsStressPop;
    const el = document.getElementById('fps-stress-pop');
    if (el) el.value = fpsStressPopulation;
    const resetRow = document.getElementById('fps-stress-reset-row');
    if (resetRow) resetRow.style.display = '';
  }
  setLoadingProgress(50, 'Calculating offline progress…');
  await nextFrame();

  // Step 3: Offline progress (async — yields to browser so it doesn't freeze)
  await applyOfflineProgress(pct => {
    const bar = 50 + Math.round(pct * 30); // 50% → 80%
    const min = Math.round(pct * 100);
    setLoadingProgress(bar, `Calculating offline progress… ${min}%`);
  });
  state.lastTick = Date.now();
  setLoadingProgress(82, 'Setting up the tank…');
  await nextFrame();

  // Step 4: Event listeners + bubbles
  setupEventListeners();
  setColorTheme(colorTheme); // apply saved theme + mark active button
  generateBubbles();
  setLoadingProgress(85, 'Rendering…');
  await nextFrame();

  // Step 5: First render (sim still paused implicitly — loops not started yet)
  renderAll();
  setLoadingProgress(100, 'Ready!');
  await nextFrame();

  // Hide loading screen, then start loops
  const screen = document.getElementById('loading-screen');
  if (screen) {
    screen.classList.add('hidden');
    screen.addEventListener('transitionend', () => { screen.remove(); AudioEngine.startMusic(); }, { once: true });
  }

  // Tick loop: every 1000ms
  setInterval(() => {
    if (paused) { state.lastTick = Date.now(); return; }
    const now = Date.now();
    const dt = now - (state.lastTick || now);
    state.lastTick = now;
    if (state.tanks.some(t => t.eggsAdded || t.purifying)) {
      gameTick(dt);
    }
  }, 1000);

  // Render loop: every 25ms
  setInterval(renderAll, 25);
}

document.addEventListener('DOMContentLoaded', initGame);
