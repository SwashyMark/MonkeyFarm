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
  const prev = xpToLevel(state.playerXP || 0);
  state.playerXP = (state.playerXP || 0) + amount;
  const next = xpToLevel(state.playerXP);
  if (next > prev) {
    state.currency += 250;
    addLog(`⭐ Player reached Level ${next}! (+£250)`);
    addNotification(`⭐ Player Level Up! Now Level ${next} (+£250)`);
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
  glowingFlakesActive: false,
  popLevel: 0,
  eggSkimmer: false,
  eggSkimmerActive: false,
  mutationInhibitorUntil: 0,
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
      glowingFlakesActive: loaded.glowingFlakesActive || loaded.splicerActive || false,
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
  s.tanks = (loaded.tanks || []).map(t => Object.assign({}, JSON.parse(JSON.stringify(DEFAULT_TANK)), t));
  s.activeTankId = loaded.activeTankId ?? 0;
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
  state.monkeys = state.monkeys.filter(m2 => m2.id !== id);
  if (monkeyEls[id]) { monkeyEls[id].remove(); delete monkeyEls[id]; }
  _popSignature = '';
  addLog(`💰 ${m.name} sold for £${price}.`, null, m.tankId);
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
};

const OFFLINE_PROT_BLOCK  = 6 * 60 * 60 * 1000; // 6 hours per block
const TIMED_BOOST_MS      = 2 * 60 * 60 * 1000; // 2 hours for boosts
const EGG_SURGE_MS        = 1 * 60 * 60 * 1000; // 1 hour for egg surge
const MUT_INHIBITOR_MS    = 10 * 60 * 1000;      // 10 minutes

function buyShopItem(key) {
  const item = SHOP_ITEMS[key];
  if (!item) return;
  const now = Date.now();

  // Inventory consumable — just add to stock
  if (item.type === 'inventory') {
    if (state.currency < item.cost) { addNotification('Not enough funds!'); return; }
    state.currency -= item.cost;
    state.inventory[item.invKey] = (state.inventory[item.invKey] || 0) + 1;
    addLog(`🛒 Purchased ${item.label}.`);
    saveState();
    renderShop();
    return;
  }

  // Permanent — check not already owned
  if (item.type === 'permanent') {
    if (state.shop[key]) { addNotification('Already purchased!'); return; }
    if (state.currency < item.cost) { addNotification('Not enough funds!'); return; }
    state.currency -= item.cost;
    state.shop[key] = true;
    addLog(`🛒 Purchased ${item.label}.`);
    saveState();
    renderShop();
    return;
  }

  // Time-limited
  if (state.currency < item.cost) { addNotification('Not enough funds!'); return; }

  if (key === 'offlineProtection') {
    const current = Math.max(now, state.offlineProtectionExpiry || 0);
    const maxExpiry = now + 24 * 60 * 60 * 1000;
    if (current >= maxExpiry) { addNotification('Max protection reached (24h)!'); return; }
    state.currency -= item.cost;
    state.offlineProtectionExpiry = Math.min(current + OFFLINE_PROT_BLOCK, maxExpiry);
    addLog(`🛡 Offline protection extended to ${fmtProtRemaining()}.`);
  } else if (key === 'rationBoost') {
    state.currency -= item.cost;
    state.shop.rationBoostExpiry = Math.max(now, state.shop.rationBoostExpiry || 0) + TIMED_BOOST_MS;
    addLog(`🍖 Ration Boost active for 2h.`);
  } else if (key === 'waterTreatment') {
    state.currency -= item.cost;
    state.shop.waterTreatExpiry = Math.max(now, state.shop.waterTreatExpiry || 0) + TIMED_BOOST_MS;
    addLog(`💧 Water Treatment active for 2h.`);
  } else if (key === 'eggSurge') {
    state.currency -= item.cost;
    state.shop.eggSurgeExpiry = Math.max(now, state.shop.eggSurgeExpiry || 0) + EGG_SURGE_MS;
    addLog(`🥚 Egg Surge active for 1h — doubled egg counts!`);
  }

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
    state.inventory.glowingFlakes, state.inventory.mutationInhibitor,
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
    ${['invLifeBooster','invBoosterEggPack','invGlowingFlakes','invMutInhibitor'].map(key => {
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
  const condRow = document.querySelector(`[data-cond-tank="${monkey.tankId}"]`);
  if (condRow) {
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
  const catalystMult = (!noMutation && state.shop?.mutationCatalyst) ? 1.5 : 1;
  const mutMult = noMutation ? 0 : (glowingFlakesActive ? 10 : 1) * catalystMult;

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
    tank.food        = Math.max(0, Math.min(getMaxFood(tank),        tank.food        - foodDrain * dtSec * mb.foodMult * mb.voidHungerMult * foodDrainMult + feederRegen * dtSec + autoFeedBonus));
    tank.oxygen      = Math.max(0, Math.min(getMaxOxygen(tank),      tank.oxygen      - OXYGEN_DRAIN_PER * aliveNonEgg.length * dtSec * mb.oxygenMult + (oxygenGain + aerRegen + BASE_OXYGEN_REGEN) * dtSec));
    tank.cleanliness = Math.max(0, Math.min(getMaxCleanliness(tank), tank.cleanliness - (CLEAN_DRAIN_PER * aliveNonEgg.length + corpseRate * deadTank.length) * dtSec * mb.cleanMult * cleanDrainMult + (cleanGain + skimRegen + BASE_CLEAN_REGEN) * dtSec));

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

    // --- Auto-remove corpses after 5 minutes, penalise cleanliness ---
    const CORPSE_TTL = 5 * 60 * 1000;
    const now = Date.now();
    const beforeLen = state.monkeys.filter(m => m.tankId === tank.id).length;
    state.monkeys = state.monkeys.filter(m => {
      if (m.tankId !== tank.id || m.alive || !m.diedAt) return true;
      if (now - m.diedAt >= CORPSE_TTL) {
        tank.cleanliness = Math.max(0, tank.cleanliness - 5);
        return false;
      }
      return true;
    });
    const afterLen = state.monkeys.filter(m => m.tankId === tank.id).length;
    if (afterLen < beforeLen) {
      const removed = beforeLen - afterLen;
      addLog(`🧹 Corpse${removed > 1 ? 's' : ''} decayed. -${removed * 5} cleanliness.`, null, tank.id);
    }
  }

  // --- Update global stats ---
  const livePop = state.monkeys.filter(m => m.alive).length;
  if (livePop > state.stats.peakPopulation) state.stats.peakPopulation = livePop;

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
    m.stageDuration = randRange(...BABY_GROW) / stats.growthSpeed;
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
    m.stageDuration = randRange(...ADULT_LIFE) * stats.lifeMult * mb.lifespanMult;
    addXP(20);
    addLog(`🦐 ${m.name} is now an adult ${m.sex === 'M' ? '(male)' : '(female)'}!`, `🦐 became an adult ${m.sex === 'M' ? '(male)' : '(female)'}!`, m.tankId);
  } else if (m.stage === 'adult' && effectiveElapsed >= dur) {
    if (!_suppressDeaths && Date.now() >= (state.gracePeriodUntil || 0)) {
      killMonkey(m, 'old age');
    }
  }
}

function updateMonkeyReproduction(female, aliveMonkeys, tank) {
  if (female.pregnant) return;
  if (aliveMonkeys.length >= getMaxPop(tank)) return;
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

    // Glowing Flakes: boost mutations, deal damage to parents (per-tank)
    const usedFlakes = tank.glowingFlakesActive;
    if (usedFlakes) {
      m.health = Math.max(1, m.health - 20);
      if (father?.alive) father.health = Math.max(1, father.health - 10);
      tank.glowingFlakesActive = false;
    }

    const mb = getMasteryBonuses();
    const eggSurgeActive = Date.now() < (state.shop?.eggSurgeExpiry || 0);
    const inhibitorActive = Date.now() < (tank.mutationInhibitorUntil || 0);
    const baseCount = 1 + Math.floor(Math.random() * 3) + mb.extraEgg + mb.twinExtraEgg + mb.fanMult;
    const count = eggSurgeActive ? baseCount * 2 : baseCount;
    for (let i = 0; i < count; i++) {
      if (aliveMonkeys.length >= getMaxPop(tank)) break;
      const dna = inheritGenes(m, father || m, usedFlakes, inhibitorActive);
      const baby = createMonkey({ generation: gen, dna, tankId: tank.id });
      if (tank.eggSkimmerActive) baby.inStorage = true;
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
}

async function applyOfflineProgress(onProgress) {
  if (!state.lastTick) return;
  const now = Date.now();
  const originalLastTick = state.lastTick;
  let offlineMs = now - originalLastTick;
  if (offlineMs <= 1000) return;
  offlineMs = Math.min(offlineMs, OFFLINE_CAP_MS);
  state.totalOfflineMs = (state.totalOfflineMs || 0) + offlineMs;

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
    const threshold = COLOR_OR_TAIL_KEYS.includes(v.key) ? MASTERY_THRESHOLD_COLOR : MASTERY_THRESHOLD_FUNC;
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
    const countStr = `${entry.count}/${threshold}`;

    return `<div class="dex-card ${entry.discovered ? '' : 'undiscovered'}">
      <div class="dex-emoji${bioGlowClass}"${styleAttr}>${entry.discovered ? '🦐' : '❓'}</div>
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
      return `<div class="pop-sell-row">${storBtn}<button class="btn pop-sell-btn" data-sell-monkey="${m.id}">💰 £${price}</button></div>`;
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
  renderMolts();
  renderLifeSupport();
  renderInventory();
  renderShop();
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
  document.getElementById('stat-pop').textContent  = alive.length;
  document.getElementById('stat-gen').textContent  = state.stats.totalGenerations;
  document.getElementById('stat-born').textContent = state.stats.totalBorn;
  document.getElementById('stat-died').textContent = state.stats.totalDied;
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
      if (el._isBio) {
      } else if (def.opacity) {
        emojiSpan.style.filter  = def.filterStr || '';
        emojiSpan.style.opacity = String(def.opacity);
      } else {
        el.style.filter     = def.filterStr || '';
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
    return `${t.id}:${t.name}:${t.aeration.level}:${t.skimmer.level}:${t.feeder.level}:${stageCounts}:${dead}:${t.id === state.activeTankId ? 1 : 0}:${t.popLevel ?? 0}:${t.eggSkimmer ? 1 : 0}:${t.eggSkimmerActive ? 1 : 0}:${state.currency}`;
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
  const alive = state.monkeys.filter(m => m.alive && m.tankId === state.activeTankId);

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
  if (!activeTank().eggsAdded) { addNotification('✨ Release eggs first!'); return; }
  activeTank().glowingFlakesActive = true;
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

  document.getElementById('inv-life-booster-cnt').textContent = inv.lifeBooster.toLocaleString();
  document.getElementById('inv-egg-pack-cnt').textContent     = inv.boosterEggPack.toLocaleString();
  document.getElementById('btn-use-life-booster').disabled = inv.lifeBooster <= 0 || !hasLife;
  document.getElementById('btn-use-egg-pack').disabled     = inv.boosterEggPack <= 0 || !hasLife;

  document.getElementById('inv-glowing-flakes-cnt').textContent = inv.glowingFlakes.toLocaleString();
  document.getElementById('btn-use-glowing-flakes').disabled = inv.glowingFlakes <= 0 || !hasLife;
  const flakesBadge = document.getElementById('glowing-flakes-active-badge');
  if (flakesBadge) flakesBadge.style.display = activeTank().glowingFlakesActive ? '' : 'none';

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
  for (let i = 0; i < count; i++) {
    createMonkey({ stage: 'egg', generation: 1, tankId: t.id });
  }
  addLog(`🥚 Released ${count} sea monkey eggs into the tank!`, null, t.id);
  addNotification(`🥚 ${count} eggs released!`);
  saveState();
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
    spawnFoodFlakes();
    saveState();
  });

  document.getElementById('btn-aerate').addEventListener('click', () => {
    const t = activeTank();
    t.oxygen = Math.min(getMaxOxygen(t), t.oxygen + ACTION_AERATE_AMT);
    addXP(1);
    addLog('💨 Tank aerated (+50 oxygen)', null, t.id);
    addNotification('💨 Aerated!');
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
    screen.addEventListener('transitionend', () => screen.remove(), { once: true });
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
