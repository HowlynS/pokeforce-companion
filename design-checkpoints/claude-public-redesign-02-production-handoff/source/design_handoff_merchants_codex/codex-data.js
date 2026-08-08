// Merchants Codex — canonical dataset.
// Single source of truth for every page. Each screen currently inlines a copy of the
// arrays it needs; wire the pages to these exports when porting to the real app.
// Sprite paths are relative to the project root (assets/sprites/…).

export const SPR = {
  pot: { image: "./assets/sprites/chipped-pot.png", name: "Chipped Pot" },
  shard: { image: "./assets/sprites/comet-shard.png", name: "Comet Shard" },
  dusk: { image: "./assets/sprites/dusk.png", name: "Dusk Ball" },
  ether: { image: "./assets/sprites/ether.png", name: "Ether" },
  giga: { image: "./assets/sprites/gigaton.png", name: "Gigaton Stone" },
  net: { image: "./assets/sprites/net.png", name: "Net Ball" },
  para: { image: "./assets/sprites/paralyze-heal.png", name: "Paralyze Heal" },
  xspd: { image: "./assets/sprites/x-speed.png", name: "X Speed" },
};

// Pre-rendered sprites at exact display sizes. Always load a sprite at the size it is
// shown at (via a background-image div with explicit px width/height) — runtime scaling
// makes the pixel art shimmer.
export const RENDERED = {
  pot: { 24:"./assets/sprites/rendered/pot-24.png", 26:"./assets/sprites/rendered/pot-26.png", 36:"./assets/sprites/rendered/pot-36.png", 40:"./assets/sprites/rendered/pot-40.png", 44:"./assets/sprites/rendered/pot-44.png", 60:"./assets/sprites/rendered/pot-60.png" },
  shard: { 24:"./assets/sprites/rendered/shard-24.png", 26:"./assets/sprites/rendered/shard-26.png", 36:"./assets/sprites/rendered/shard-36.png", 40:"./assets/sprites/rendered/shard-40.png", 44:"./assets/sprites/rendered/shard-44.png", 60:"./assets/sprites/rendered/shard-60.png" },
  dusk: { 24:"./assets/sprites/rendered/dusk-24.png", 26:"./assets/sprites/rendered/dusk-26.png", 36:"./assets/sprites/rendered/dusk-36.png", 40:"./assets/sprites/rendered/dusk-40.png", 44:"./assets/sprites/rendered/dusk-44.png", 60:"./assets/sprites/rendered/dusk-60.png" },
  ether: { 24:"./assets/sprites/rendered/ether-24.png", 26:"./assets/sprites/rendered/ether-26.png", 36:"./assets/sprites/rendered/ether-36.png", 40:"./assets/sprites/rendered/ether-40.png", 44:"./assets/sprites/rendered/ether-44.png", 60:"./assets/sprites/rendered/ether-60.png" },
  giga: { 24:"./assets/sprites/rendered/giga-24.png", 26:"./assets/sprites/rendered/giga-26.png", 36:"./assets/sprites/rendered/giga-36.png", 40:"./assets/sprites/rendered/giga-40.png", 44:"./assets/sprites/rendered/giga-44.png", 60:"./assets/sprites/rendered/giga-60.png" },
  net: { 24:"./assets/sprites/rendered/net-24.png", 26:"./assets/sprites/rendered/net-26.png", 36:"./assets/sprites/rendered/net-36.png", 40:"./assets/sprites/rendered/net-40.png", 44:"./assets/sprites/rendered/net-44.png", 60:"./assets/sprites/rendered/net-60.png" },
  para: { 24:"./assets/sprites/rendered/para-24.png", 26:"./assets/sprites/rendered/para-26.png", 36:"./assets/sprites/rendered/para-36.png", 40:"./assets/sprites/rendered/para-40.png", 44:"./assets/sprites/rendered/para-44.png", 60:"./assets/sprites/rendered/para-60.png" },
  xspd: { 24:"./assets/sprites/rendered/xspd-24.png", 26:"./assets/sprites/rendered/xspd-26.png", 36:"./assets/sprites/rendered/xspd-36.png", 40:"./assets/sprites/rendered/xspd-40.png", 44:"./assets/sprites/rendered/xspd-44.png", 60:"./assets/sprites/rendered/xspd-60.png" }
};

const KEY_BY_IMAGE = {};
Object.keys(SPR).forEach(k => { KEY_BY_IMAGE[SPR[k].image] = k; });
export const sizesFor = (url) => RENDERED[KEY_BY_IMAGE[url]] || {};
export const ing = (...specs) => specs.map(spec => {
  const [key, q] = spec.split(":");
  const sized = RENDERED[key] || {};
  return { ...SPR[key], image24: sized[24], image26: sized[26], image36: sized[36], image40: sized[40], image44: sized[44], image60: sized[60], qty: q ? parseInt(q, 10) : 1 };
});
export const slugify = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

export const ITEMS = [
  {name:"Potion", category:"Consumables", description:"A basic healing tonic brewed from oran berries, restoring 20 HP to any weary party member.", source:"Purchased", image:SPR.pot.image},
  {name:"Antidote", category:"Consumables", description:"Cures poisoning.", source:"Purchased", image:SPR.shard.image},
  {name:"Ether", category:"Consumables", description:"A concentrated draught distilled by chemists that restores 10 PP to a single learned move.", source:"Crafted", image:SPR.xspd.image},
  {name:"Revive", category:"Consumables", description:"Revives a fainted party member.", source:"Purchased", image:SPR.para.image},
  {name:"Fresh Water", category:"Consumables", description:"A cool drink that restores a little HP.", source:"Purchased", image:SPR.ether.image},
  {name:"Moomoo Milk", category:"Consumables", description:"Rich milk that restores 40 HP.", source:"Farmed", image:SPR.net.image},
  {name:"Iron Ore", category:"Materials", description:"A dense, common ore chipped from mountain veins, favored by smiths for tools and armor alike.", source:"Mined", image:SPR.giga.image},
  {name:"Oak Wood", category:"Materials", description:"Sturdy wood harvested from oak trees.", source:"Foraged", image:SPR.dusk.image},
  {name:"Silver Ore", category:"Materials", description:"A lustrous ore prized by smiths.", source:"Mined", image:SPR.pot.image},
  {name:"River Clay", category:"Materials", description:"Fine clay dredged from riverbeds.", source:"Foraged", image:SPR.shard.image},
  {name:"Spool of Thread", category:"Materials", description:"Woven thread used in tailoring.", source:"Crafted", image:SPR.xspd.image},
  {name:"Pine Resin", category:"Materials", description:"Sticky resin used to seal and bind.", source:"Foraged", image:SPR.para.image},
  {name:"Traveler's Cloak", category:"Equipment", description:"Light cloak that slightly boosts evasion.", source:"Crafted", image:SPR.ether.image},
  {name:"Worn Leather Boots", category:"Equipment", description:"Durable boots for long routes.", source:"Crafted", image:SPR.net.image},
  {name:"Apricorn Satchel", category:"Equipment", description:"A satchel woven from apricorn fiber.", source:"Crafted", image:SPR.giga.image},
  {name:"Sailor's Coat", category:"Equipment", description:"Weatherproof coat favored by dock hands.", source:"Purchased", image:SPR.dusk.image},
  {name:"Copper Pickaxe", category:"Tools", description:"A basic pickaxe for mining soft rocks.", source:"Crafted", image:SPR.pot.image},
  {name:"Fishing Rod", category:"Tools", description:"A sturdy rod for angling in rivers.", source:"Purchased", image:SPR.shard.image},
  {name:"Foraging Sickle", category:"Tools", description:"A curved blade for gathering plants.", source:"Crafted", image:SPR.xspd.image},
  {name:"Prospector's Pan", category:"Tools", description:"Used to sift silt for ore and gems.", source:"Purchased", image:SPR.para.image},
  {name:"Carving Chisel", category:"Tools", description:"Fine chisel for woodworking detail.", source:"Crafted", image:SPR.ether.image},
  {name:"Old Coin", category:"Treasures", description:"A tarnished coin bearing a forgotten crest, unearthed from ruins predating living memory.", source:"Excavated", image:SPR.net.image},
  {name:"Rare Fossil", category:"Treasures", description:"A fossil holding signs of ancient life.", source:"Excavated", image:SPR.giga.image},
  {name:"Sea Glass Shard", category:"Treasures", description:"Smoothed glass washed ashore by tides.", source:"Foraged", image:SPR.dusk.image},
  {name:"Tarnished Locket", category:"Treasures", description:"A locket lost long ago near the docks.", source:"Excavated", image:SPR.pot.image},
  {name:"Merchant's Seal", category:"Trade Goods", description:"A seal of trust used by traveling traders.", source:"Quest Reward", image:SPR.shard.image},
  {name:"Bolt of Silk", category:"Trade Goods", description:"Fine silk bound for coastal markets.", source:"Purchased", image:SPR.xspd.image},
  {name:"Spice Crate", category:"Trade Goods", description:"A crate of spices from southern routes.", source:"Purchased", image:SPR.para.image},
  {name:"Dried Berries", category:"Trade Goods", description:"Preserved berries traded between towns.", source:"Farmed", image:SPR.ether.image},
  {name:"Harbor Master's Key", category:"Key Items", description:"Opens the gate to Olivine's harbor office.", source:"Quest Reward", image:SPR.net.image},
  {name:"Lighthouse Lantern Oil", category:"Key Items", description:"Rare oil required to relight the beacon.", source:"Quest Reward", image:SPR.giga.image},
  {name:"Shrine Offering Bell", category:"Key Items", description:"A bell used in mountain shrine rites.", source:"Quest Reward", image:SPR.dusk.image},
  {name:"Weathered Map Fragment", category:"Other", description:"A torn piece of an older regional map.", source:"Excavated", image:SPR.pot.image},
  {name:"Paper Lantern", category:"Other", description:"A folded lantern lit during festivals.", source:"Crafted", image:SPR.shard.image},
  {name:"Ceramic Roof Tile", category:"Other", description:"A glazed tile from a coastal rooftop.", source:"Foraged", image:SPR.xspd.image},
  {name:"Iron Nail Bundle", category:"Other", description:"A bundle of nails for construction work.", source:"Crafted", image:SPR.para.image},
  {name:"Salted Fish", category:"Consumables", description:"Preserved fish that restores stamina.", source:"Crafted", image:SPR.ether.image},
];

export const RECIPES = [
  {name:"Minor Healing Potion", profession:"Crafting", classReq:"Artisan", level:6, image:SPR.ether.image, ingredients:ing("pot:15","ether:1","shard:3","xspd:1","net:2"), outputRange:"2-3", exp:12},
  {name:"Hearty Bread", profession:"Cooking", classReq:"Trainer", level:5, image:SPR.para.image, ingredients:ing("giga:1","net:2","dusk:1","pot:2"), outputRange:"2", exp:9},
  {name:"Reinforced Fishing Rod", profession:"Fishing", classReq:"Ranger", level:9, image:SPR.net.image, ingredients:ing("shard:2","giga:1","xspd:3","ether:1","pot:1"), outputRange:"1", exp:18},
  {name:"Herbal Salve", profession:"Crafting", classReq:"Artisan", level:7, image:SPR.pot.image, ingredients:ing("pot:1","dusk:2","ether:2","giga:1"), outputRange:"3-4", exp:14},
  {name:"Bronze Pickaxe", profession:"Mining", classReq:"Rancher", level:10, image:SPR.giga.image, ingredients:ing("giga:2","shard:1","net:1","xspd:2","dusk:1","pot:3"), outputRange:"1", exp:20},
  {name:"Wooden Chair", profession:"Construction", classReq:"Farmhand", level:5, image:SPR.dusk.image, ingredients:ing("pot:2","giga:1","net:1"), outputRange:"1", exp:10},
  {name:"Sun-Dried Tomatoes", profession:"Farming", classReq:"Farmhand", level:4, image:SPR.xspd.image, ingredients:ing("para:3","net:1","dusk:2","giga:1"), outputRange:"3-5", exp:8},
  {name:"Preserved Fillets", profession:"Fishing", classReq:"Ranger", level:6, image:SPR.para.image, ingredients:ing("net:2","xspd:1","shard:1"), outputRange:"2-3", exp:11},
  {name:"Woven Fiber Rope", profession:"Foraging", classReq:"Rancher", level:7, image:SPR.dusk.image, ingredients:ing("pot:1","dusk:3","giga:1","ether:1","xspd:2"), outputRange:"2", exp:13},
  {name:"Polished River Stone", profession:"Archaeology", classReq:"Trainer", level:8, image:SPR.shard.image, ingredients:ing("shard:1","pot:1"), outputRange:"1", exp:16},
  {name:"Iron Nails", profession:"Smithing", classReq:"Artisan", level:5, image:SPR.giga.image, ingredients:ing("giga:2","net:1","dusk:1","shard:2"), outputRange:"5-6", exp:9},
  {name:"Roof Tile Set", profession:"Construction", classReq:"Farmhand", level:11, image:SPR.pot.image, ingredients:ing("pot:2","dusk:2","giga:1","shard:1","ether:1","net:2"), outputRange:"2", exp:22},
  {name:"Lantern Oil Flask", profession:"Crafting", classReq:"Trainer", level:6, image:SPR.ether.image, ingredients:ing("ether:2","xspd:1","para:1"), outputRange:"3", exp:12},
  {name:"Berry Compote", profession:"Cooking", classReq:"Farmhand", level:5, image:SPR.para.image, ingredients:ing("para:2","dusk:1","net:1","giga:1"), outputRange:"2", exp:10},
  {name:"Salt-Cured Fish", profession:"Cooking", classReq:"Ranger", level:5, image:SPR.net.image, ingredients:ing("net:1","xspd:1","pot:2"), outputRange:"2", exp:9},
  {name:"Excavation Brush", profession:"Archaeology", classReq:"Trainer", level:8, image:SPR.shard.image, ingredients:ing("shard:2","giga:1","ether:1"), outputRange:"1", exp:15},
  {name:"Silver Wire Coil", profession:"Smithing", classReq:"Artisan", level:9, image:SPR.xspd.image, ingredients:ing("giga:1","xspd:2","net:1","dusk:1"), outputRange:"2", exp:17},
  {name:"Terrace Planter Box", profession:"Construction", classReq:"Farmhand", level:10, image:SPR.dusk.image, ingredients:ing("pot:2","dusk:2","net:1","shard:1","xspd:1"), outputRange:"1", exp:19},
  {name:"Weathered Lure", profession:"Crafting", classReq:"Ranger", level:4, image:SPR.giga.image, ingredients:ing("giga:3","net:1"), outputRange:"1", exp:8},
  {name:"Moonlit Compass", profession:"Archaeology", classReq:"Artisan", level:11, image:SPR.shard.image, ingredients:ing("shard:1","pot:2","ether:3"), outputRange:"3-4", exp:21},
  {name:"Woven Trellis", profession:"Farming", classReq:"Rancher", level:7, image:SPR.dusk.image, ingredients:ing("dusk:2","giga:3","para:1","net:2"), outputRange:"1-2", exp:14},
  {name:"Braided Anvil", profession:"Construction", classReq:"Trainer", level:14, image:SPR.xspd.image, ingredients:ing("xspd:3","para:1","pot:2","dusk:3","net:1"), outputRange:"4-5", exp:27},
  {name:"Sunlit Barrel", profession:"Fishing", classReq:"Farmhand", level:10, image:SPR.net.image, ingredients:ing("net:1","giga:2"), outputRange:"2-3", exp:20},
  {name:"Polished Ratchet", profession:"Cooking", classReq:"Ranger", level:7, image:SPR.para.image, ingredients:ing("para:2","ether:3","shard:1"), outputRange:"1", exp:13},
  {name:"Etched Buckle", profession:"Foraging", classReq:"Artisan", level:13, image:SPR.pot.image, ingredients:ing("pot:3","giga:1","xspd:2","ether:3"), outputRange:"3-4", exp:26},
  {name:"Frosted Harness", profession:"Mining", classReq:"Rancher", level:10, image:SPR.pot.image, ingredients:ing("pot:1","net:2","ether:3","shard:1","xspd:2"), outputRange:"1-2", exp:19},
  {name:"Ancient Trowel", profession:"Smithing", classReq:"Trainer", level:6, image:SPR.para.image, ingredients:ing("para:2","net:3"), outputRange:"4-5", exp:12},
  {name:"Glazed Pendant", profession:"Crafting", classReq:"Farmhand", level:13, image:SPR.dusk.image, ingredients:ing("dusk:3","para:1","net:2"), outputRange:"2-3", exp:25},
  {name:"Smoked Kettle", profession:"Archaeology", classReq:"Ranger", level:9, image:SPR.dusk.image, ingredients:ing("dusk:1","para:2","shard:3","giga:1"), outputRange:"1", exp:18},
  {name:"Rustic Whistle", profession:"Farming", classReq:"Artisan", level:6, image:SPR.net.image, ingredients:ing("net:2","giga:3","shard:1","xspd:2","para:3"), outputRange:"3-4", exp:11},
  {name:"Charred Tapestry", profession:"Construction", classReq:"Rancher", level:12, image:SPR.shard.image, ingredients:ing("shard:3","para:1"), outputRange:"1-2", exp:24},
  {name:"Salted Flask", profession:"Fishing", classReq:"Trainer", level:9, image:SPR.para.image, ingredients:ing("para:1","pot:2","xspd:3"), outputRange:"4-5", exp:17},
  {name:"Sturdy Canister", profession:"Cooking", classReq:"Farmhand", level:5, image:SPR.dusk.image, ingredients:ing("dusk:2","para:3","pot:1","shard:2"), outputRange:"2-3", exp:10},
  {name:"Refined Hook", profession:"Foraging", classReq:"Ranger", level:12, image:SPR.giga.image, ingredients:ing("giga:3","ether:1","shard:2","net:3","pot:1"), outputRange:"1", exp:23},
  {name:"Carved Grindstone", profession:"Mining", classReq:"Artisan", level:8, image:SPR.pot.image, ingredients:ing("pot:1","giga:2"), outputRange:"3-4", exp:16},
  {name:"Gilded Crate", profession:"Smithing", classReq:"Rancher", level:5, image:SPR.dusk.image, ingredients:ing("dusk:2","para:3","net:1"), outputRange:"1-2", exp:9},
  {name:"Rugged Spindle", profession:"Crafting", classReq:"Trainer", level:11, image:SPR.dusk.image, ingredients:ing("dusk:3","pot:1","giga:2","net:3"), outputRange:"4-5", exp:22},
  {name:"Tempered Satchel", profession:"Archaeology", classReq:"Farmhand", level:8, image:SPR.para.image, ingredients:ing("para:1","shard:2","xspd:3","giga:1","ether:2"), outputRange:"2-3", exp:15},
  {name:"Weathered Mallet", profession:"Farming", classReq:"Ranger", level:4, image:SPR.net.image, ingredients:ing("net:2","xspd:3"), outputRange:"1", exp:8},
  {name:"Moonlit Brooch", profession:"Construction", classReq:"Artisan", level:11, image:SPR.ether.image, ingredients:ing("ether:3","dusk:1","shard:2"), outputRange:"3-4", exp:21},
  {name:"Woven Basin", profession:"Fishing", classReq:"Rancher", level:7, image:SPR.giga.image, ingredients:ing("giga:1","ether:2","shard:3","pot:1"), outputRange:"1-2", exp:14},
  {name:"Braided Sconce", profession:"Cooking", classReq:"Trainer", level:14, image:SPR.pot.image, ingredients:ing("pot:2","para:3","giga:1","net:2","shard:3"), outputRange:"4-5", exp:27},
  {name:"Sunlit Ledger", profession:"Foraging", classReq:"Farmhand", level:10, image:SPR.pot.image, ingredients:ing("pot:3","dusk:1"), outputRange:"2-3", exp:20},
  {name:"Polished Locket", profession:"Mining", classReq:"Ranger", level:7, image:SPR.shard.image, ingredients:ing("shard:1","giga:2","xspd:3"), outputRange:"1", exp:13},
  {name:"Etched Lantern", profession:"Smithing", classReq:"Artisan", level:13, image:SPR.para.image, ingredients:ing("para:2","shard:3","pot:1","dusk:2"), outputRange:"3-4", exp:26},
  {name:"Frosted Ribbon", profession:"Crafting", classReq:"Rancher", level:10, image:SPR.dusk.image, ingredients:ing("dusk:3","giga:1","net:2","para:3","shard:1"), outputRange:"1-2", exp:19},
  {name:"Ancient Awl", profession:"Archaeology", classReq:"Trainer", level:6, image:SPR.para.image, ingredients:ing("para:1","dusk:2"), outputRange:"4-5", exp:12},
  {name:"Glazed Charm", profession:"Farming", classReq:"Farmhand", level:13, image:SPR.giga.image, ingredients:ing("giga:2","xspd:3","dusk:1"), outputRange:"2-3", exp:25},
  {name:"Smoked Lure", profession:"Construction", classReq:"Ranger", level:9, image:SPR.xspd.image, ingredients:ing("xspd:3","ether:1","pot:2","shard:3"), outputRange:"1", exp:18},
  {name:"Rustic Compass", profession:"Fishing", classReq:"Artisan", level:6, image:SPR.dusk.image, ingredients:ing("dusk:1","ether:2","net:3","para:1","giga:2"), outputRange:"3-4", exp:11},
  {name:"Charred Trellis", profession:"Cooking", classReq:"Rancher", level:12, image:SPR.xspd.image, ingredients:ing("xspd:2","ether:3"), outputRange:"1-2", exp:24},
  {name:"Salted Anvil", profession:"Foraging", classReq:"Trainer", level:9, image:SPR.pot.image, ingredients:ing("pot:3","xspd:1","dusk:2"), outputRange:"4-5", exp:17},
  {name:"Sturdy Barrel", profession:"Mining", classReq:"Farmhand", level:5, image:SPR.xspd.image, ingredients:ing("xspd:1","para:2","ether:3","shard:1"), outputRange:"2-3", exp:10},
  {name:"Refined Ratchet", profession:"Smithing", classReq:"Ranger", level:12, image:SPR.net.image, ingredients:ing("net:2","xspd:3","ether:1","pot:2","para:3"), outputRange:"1", exp:23},
  {name:"Carved Buckle", profession:"Crafting", classReq:"Artisan", level:8, image:SPR.dusk.image, ingredients:ing("dusk:3","shard:1"), outputRange:"3-4", exp:16},
  {name:"Gilded Harness", profession:"Archaeology", classReq:"Rancher", level:5, image:SPR.ether.image, ingredients:ing("ether:1","dusk:2","net:3"), outputRange:"1-2", exp:9},
  {name:"Rugged Trowel", profession:"Farming", classReq:"Trainer", level:11, image:SPR.pot.image, ingredients:ing("pot:2","para:3","net:1","giga:2"), outputRange:"4-5", exp:22},
  {name:"Tempered Pendant", profession:"Construction", classReq:"Farmhand", level:8, image:SPR.dusk.image, ingredients:ing("dusk:3","ether:1","giga:2","net:3","pot:1"), outputRange:"2-3", exp:15},
  {name:"Weathered Kettle", profession:"Fishing", classReq:"Ranger", level:4, image:SPR.net.image, ingredients:ing("net:1","xspd:2"), outputRange:"1", exp:8},
  {name:"Moonlit Whistle", profession:"Cooking", classReq:"Artisan", level:11, image:SPR.pot.image, ingredients:ing("pot:2","net:3","giga:1"), outputRange:"3-4", exp:21},
  {name:"Woven Tapestry", profession:"Foraging", classReq:"Rancher", level:7, image:SPR.ether.image, ingredients:ing("ether:3","net:1","xspd:2","giga:3"), outputRange:"1-2", exp:14},
  {name:"Braided Flask", profession:"Mining", classReq:"Trainer", level:14, image:SPR.dusk.image, ingredients:ing("dusk:1","shard:2","net:3","para:1","ether:2"), outputRange:"4-5", exp:27},
  {name:"Sunlit Canister", profession:"Smithing", classReq:"Farmhand", level:10, image:SPR.ether.image, ingredients:ing("ether:2","para:3"), outputRange:"2-3", exp:20},
  {name:"Polished Hook", profession:"Crafting", classReq:"Ranger", level:7, image:SPR.shard.image, ingredients:ing("shard:3","xspd:1","ether:2"), outputRange:"1", exp:13},
  {name:"Etched Grindstone", profession:"Archaeology", classReq:"Artisan", level:13, image:SPR.net.image, ingredients:ing("net:1","shard:2","para:3","ether:1"), outputRange:"3-4", exp:26},
  {name:"Frosted Crate", profession:"Farming", classReq:"Rancher", level:10, image:SPR.net.image, ingredients:ing("net:2","ether:3","pot:1","dusk:2","giga:3"), outputRange:"1-2", exp:19},
  {name:"Ancient Spindle", profession:"Construction", classReq:"Trainer", level:6, image:SPR.shard.image, ingredients:ing("shard:3","para:1"), outputRange:"4-5", exp:12},
  {name:"Glazed Satchel", profession:"Fishing", classReq:"Farmhand", level:13, image:SPR.xspd.image, ingredients:ing("xspd:1","net:2","shard:3"), outputRange:"2-3", exp:25},
];

export const PROFESSIONS = [
  {name:"Foraging", type:"Gathering", description:"Gather herbs, berries, and wild fiber from routes, forests, and roadside brush across Johto.", recipeCount:9, maxLevel:100, image:SPR.dusk.image},
  {name:"Fishing", type:"Gathering", description:"Cast a line in rivers, lakes, and coastal waters to reel in fish, shells, and rarer aquatic finds.", recipeCount:7, maxLevel:100, image:SPR.net.image},
  {name:"Farming", type:"Gathering", description:"Tend crops and livestock on tilled land, yielding produce used in cooking and trade.", recipeCount:6, maxLevel:100, image:SPR.xspd.image},
  {name:"Mining", type:"Gathering", description:"Extract ore, stone, and gems from cave systems and mountain veins using pick and pan.", recipeCount:5, maxLevel:100, image:SPR.giga.image},
  {name:"Archaeology", type:"Gathering", description:"Excavate ruins and riverbeds for fossils, relics, and fragments of a forgotten Johto.", recipeCount:6, maxLevel:100, image:SPR.shard.image},
  {name:"Crafting", type:"Production", description:"Turn raw materials into potions, salves, and general-purpose goods at a workshop bench.", recipeCount:11, maxLevel:100, image:SPR.ether.image},
  {name:"Cooking", type:"Production", description:"Prepare meals and preserves from farmed and foraged ingredients over a kitchen fire.", recipeCount:6, maxLevel:100, image:SPR.para.image},
  {name:"Construction", type:"Production", description:"Build and repair structures, furniture, and fixtures using timber, stone, and nails.", recipeCount:5, maxLevel:100, image:SPR.pot.image},
  {name:"Smithing", type:"Production", description:"Forge tools, nails, and fittings from ore and metal stock at the profession's anvil.", recipeCount:4, maxLevel:100, image:SPR.giga.image},
];

export const CLASSES = [
  {name:"Artisan", type:"Crafting", description:"Skilled crafters who turn raw materials into potions, tools, and everyday goods with practiced, steady hands.", bonus:"+15% Craft Yield", maxLevel:99, image:SPR.ether.image},
  {name:"Trainer", type:"Battle", description:"Battle-focused trainers who raise and command creatures, sharpening technique through disciplined study.", bonus:"+10% Battle XP", maxLevel:99, image:SPR.pot.image},
  {name:"Ranger", type:"Gathering", description:"Woodland rangers skilled at foraging and fishing, moving quietly through routes that others overlook.", bonus:"+15% Gather Speed", maxLevel:99, image:SPR.dusk.image},
  {name:"Rancher", type:"Husbandry", description:"A rancher class devoted to raising livestock and mining alongside them, at home on farms and in quarries.", bonus:"+10% Mining Yield", maxLevel:99, image:SPR.giga.image},
  {name:"Farmhand", type:"Agriculture", description:"Farmhands tend crops and construction alike, forming the backbone labor of Johto's growing towns.", bonus:"+15% Farming Yield", maxLevel:99, image:SPR.shard.image},
];

export const LOCATIONS = [
  {name:"New Bark Town", region:"Johto", type:"Town", description:"A tiny town where fresh winds blow, home to Professor Elm's laboratory and Johto's newest trainers.", npcCount:3, hasShop:false, image:SPR.dusk},
  {name:"Route 29", region:"Johto", type:"Route", description:"A quiet dirt path connecting New Bark Town to Cherrygrove City, lined with tall grass.", npcCount:2, hasShop:false, image:SPR.dusk},
  {name:"Cherrygrove City", region:"Johto", type:"City", description:"The first city most Johto trainers visit, known for its welcoming Pokémon Center and coastal breeze.", npcCount:4, hasShop:true, image:SPR.giga},
  {name:"Route 30", region:"Johto", type:"Route", description:"A winding route past Mr. Pokémon's house, popular with early berry foragers.", npcCount:2, hasShop:false, image:SPR.para},
  {name:"Violet City", region:"Johto", type:"City", description:"A city of ancient towers and academic tradition, home to the Sprout Tower.", npcCount:5, hasShop:true, image:SPR.giga},
  {name:"Sprout Tower", region:"Johto", type:"Landmark", description:"A wooden tower swaying atop a pillar, where monks train alongside Bellsprout.", npcCount:6, hasShop:false, image:SPR.shard},
  {name:"Dark Cave", region:"Johto", type:"Cave", description:"A pitch-black cavern connecting Route 31 and Route 45, nearly impossible without a light source.", npcCount:0, hasShop:false, image:SPR.xspd},
  {name:"Azalea Town", region:"Johto", type:"Town", description:"A rural town bordered by the Ilex Forest, known for its Slowpoke Well.", npcCount:3, hasShop:true, image:SPR.dusk},
  {name:"Ilex Forest", region:"Johto", type:"Forest", description:"A dense, ancient forest said to house a shrine to the forest spirit.", npcCount:1, hasShop:false, image:SPR.para},
  {name:"Goldenrod City", region:"Johto", type:"City", description:"Johto's largest city, famous for its sprawling Department Store and radio tower.", npcCount:8, hasShop:true, image:SPR.giga},
  {name:"National Park", region:"Johto", type:"Landmark", description:"A well-kept park hosting the annual Bug-Catching Contest under open skies.", npcCount:2, hasShop:false, image:SPR.ether},
  {name:"Ecruteak City", region:"Johto", type:"City", description:"A city steeped in legend, home to the Burned Tower and the Dance Theatre.", npcCount:4, hasShop:true, image:SPR.net},
  {name:"Burned Tower", region:"Johto", type:"Landmark", description:"The scorched ruins of a once-great tower, said to be the origin of the legendary beasts.", npcCount:1, hasShop:false, image:SPR.shard},
  {name:"Olivine City", region:"Johto", type:"City", description:"A harbor city with a working lighthouse that guides ships safely to port.", npcCount:5, hasShop:true, image:SPR.pot},
  {name:"Whirl Islands", region:"Johto", type:"Landmark", description:"A cluster of sea caves battered by whirlpools, resting place of a legendary guardian.", npcCount:0, hasShop:false, image:SPR.xspd},
  {name:"Cianwood City", region:"Johto", type:"Town", description:"A remote coastal town reachable only by boat, known for its secret medicine shop.", npcCount:3, hasShop:true, image:SPR.dusk},
  {name:"Mahogany Town", region:"Johto", type:"Town", description:"A small mountain town overlooking the Lake of Rage, rumored to hide a criminal hideout.", npcCount:2, hasShop:true, image:SPR.para},
  {name:"Lake of Rage", region:"Johto", type:"Lake", description:"A misty lake said to stir with unusual energy during certain seasons.", npcCount:1, hasShop:false, image:SPR.ether},
  {name:"Ice Path", region:"Johto", type:"Cave", description:"A frozen cavern of slick floors and hidden chambers leading toward Blackthorn City.", npcCount:0, hasShop:false, image:SPR.xspd},
  {name:"Blackthorn City", region:"Johto", type:"City", description:"A mountain city of dragon tamers, nestled at the foot of the Dragon's Den.", npcCount:4, hasShop:true, image:SPR.net},
  {name:"Pallet Town", region:"Kanto", type:"Town", description:"A peaceful town of few houses, famed as the starting point of many great journeys.", npcCount:2, hasShop:false, image:SPR.dusk},
  {name:"Route 1", region:"Kanto", type:"Route", description:"The well-trodden road linking Pallet Town to Viridian City.", npcCount:1, hasShop:false, image:SPR.dusk},
  {name:"Viridian City", region:"Kanto", type:"City", description:"A quiet city known as the perpetually calm gateway to Kanto's forests.", npcCount:3, hasShop:true, image:SPR.giga},
  {name:"Viridian Forest", region:"Kanto", type:"Forest", description:"A maze-like forest thick with bug trainers and rustling leaves.", npcCount:2, hasShop:false, image:SPR.para},
  {name:"Pewter City", region:"Kanto", type:"City", description:"A city built from stone, home to a renowned Gym and natural history museum.", npcCount:4, hasShop:true, image:SPR.giga},
  {name:"Mt. Moon", region:"Kanto", type:"Cave", description:"A moonlit mountain cave prized by fossil hunters and stargazers alike.", npcCount:2, hasShop:false, image:SPR.shard},
  {name:"Cerulean City", region:"Kanto", type:"City", description:"A city built around clear blue waterways, known for its Cape and Gym.", npcCount:5, hasShop:true, image:SPR.net},
  {name:"Lavender Town", region:"Kanto", type:"Town", description:"A somber town shrouded in mist, home to the Pokémon Tower.", npcCount:2, hasShop:false, image:SPR.pot},
  {name:"Pokémon Tower", region:"Kanto", type:"Landmark", description:"A tower of rest for departed Pokémon, said to be haunted after dark.", npcCount:3, hasShop:false, image:SPR.shard},
  {name:"Celadon City", region:"Kanto", type:"City", description:"A bustling metropolis famed for its department store and hidden game corner.", npcCount:6, hasShop:true, image:SPR.giga},
];

export const SHOPS = [
  {name:"Cherrygrove Outfitters", region:"Johto", location:"Cherrygrove City", type:"General Store", inventoryCount:18, image:SPR.dusk},
  {name:"Violet Herbalist", region:"Johto", location:"Violet City", type:"Apothecary", inventoryCount:12, image:SPR.ether},
  {name:"Azalea Trading Post", region:"Johto", location:"Azalea Town", type:"General Store", inventoryCount:15, image:SPR.dusk},
  {name:"Goldenrod Department Store", region:"Johto", location:"Goldenrod City", type:"General Store", inventoryCount:42, image:SPR.giga},
  {name:"Goldenrod Game Corner", region:"Johto", location:"Goldenrod City", type:"Game Corner", inventoryCount:9, image:SPR.net},
  {name:"Ecruteak Charm Shop", region:"Johto", location:"Ecruteak City", type:"Tailor", inventoryCount:11, image:SPR.shard},
  {name:"Olivine Forge", region:"Johto", location:"Olivine City", type:"Blacksmith", inventoryCount:14, image:SPR.giga},
  {name:"Olivine Bait & Tackle", region:"Johto", location:"Olivine City", type:"Bait & Tackle", inventoryCount:10, image:SPR.para},
  {name:"Cianwood Apothecary", region:"Johto", location:"Cianwood City", type:"Apothecary", inventoryCount:13, image:SPR.ether},
  {name:"Mahogany Trading Post", region:"Johto", location:"Mahogany Town", type:"General Store", inventoryCount:16, image:SPR.dusk},
  {name:"Blackthorn Forge", region:"Johto", location:"Blackthorn City", type:"Blacksmith", inventoryCount:17, image:SPR.giga},
  {name:"Blackthorn Bookstore", region:"Johto", location:"Blackthorn City", type:"Bookstore", inventoryCount:8, image:SPR.shard},
  {name:"Viridian Trading Post", region:"Kanto", location:"Viridian City", type:"General Store", inventoryCount:19, image:SPR.dusk},
  {name:"Pewter Rock Emporium", region:"Kanto", location:"Pewter City", type:"General Store", inventoryCount:20, image:SPR.giga},
  {name:"Cerulean Bait & Tackle", region:"Kanto", location:"Cerulean City", type:"Bait & Tackle", inventoryCount:12, image:SPR.para},
  {name:"Celadon Department Store", region:"Kanto", location:"Celadon City", type:"General Store", inventoryCount:48, image:SPR.giga},
  {name:"Celadon Game Corner", region:"Kanto", location:"Celadon City", type:"Game Corner", inventoryCount:11, image:SPR.net},
  {name:"Celadon Tailor", region:"Kanto", location:"Celadon City", type:"Tailor", inventoryCount:13, image:SPR.shard},
];

export const NPCS = [
  {name:"Prof. Elm", region:"Johto", location:"New Bark Town", role:"Professor", image:SPR.dusk},
  {name:"Mr. Pokémon", region:"Johto", location:"Route 30", role:"Villager", image:SPR.para},
  {name:"Falkner", region:"Johto", location:"Violet City", role:"Gym Leader", image:SPR.shard},
  {name:"Bugsy", region:"Johto", location:"Azalea Town", role:"Gym Leader", image:SPR.giga},
  {name:"Whitney", region:"Johto", location:"Goldenrod City", role:"Gym Leader", image:SPR.net},
  {name:"Goldenrod Nurse", region:"Johto", location:"Goldenrod City", role:"Nurse", image:SPR.ether},
  {name:"Morty", region:"Johto", location:"Ecruteak City", role:"Gym Leader", image:SPR.shard},
  {name:"Dancing Theatre Host", region:"Johto", location:"Ecruteak City", role:"Villager", image:SPR.dusk},
  {name:"Jasmine", region:"Johto", location:"Olivine City", role:"Gym Leader", image:SPR.giga},
  {name:"Chuck", region:"Johto", location:"Cianwood City", role:"Gym Leader", image:SPR.para},
  {name:"Pryce", region:"Johto", location:"Mahogany Town", role:"Gym Leader", image:SPR.ether},
  {name:"Clair", region:"Johto", location:"Blackthorn City", role:"Gym Leader", image:SPR.shard},
  {name:"Silver", region:"Johto", location:"Route 29", role:"Rival", image:SPR.xspd},
  {name:"Prof. Oak", region:"Kanto", location:"Pallet Town", role:"Professor", image:SPR.dusk},
  {name:"Blue", region:"Kanto", location:"Pallet Town", role:"Rival", image:SPR.xspd},
  {name:"Brock", region:"Kanto", location:"Pewter City", role:"Gym Leader", image:SPR.giga},
  {name:"Misty", region:"Kanto", location:"Cerulean City", role:"Gym Leader", image:SPR.net},
  {name:"Cerulean Nurse", region:"Kanto", location:"Cerulean City", role:"Nurse", image:SPR.ether},
  {name:"Lt. Surge", region:"Kanto", location:"Vermilion City", role:"Gym Leader", image:SPR.shard},
  {name:"Erika", region:"Kanto", location:"Celadon City", role:"Gym Leader", image:SPR.para},
  {name:"Celadon Merchant", region:"Kanto", location:"Celadon City", role:"Villager", image:SPR.dusk},
];

export const ITEM_CATEGORIES = ["Materials","Consumables","Equipment","Tools","Treasures","Trade Goods","Key Items","Other"];

export const RECIPE_PROFESSIONS = ["All Recipes","Foraging","Fishing","Farming","Crafting","Mining","Cooking","Construction","Archaeology","Smithing"];

export const PROFESSION_TYPES = ["Gathering","Production"];

export const CLASS_TYPES = ["Crafting","Battle","Gathering","Husbandry","Agriculture"];

export const LOCATION_TYPES = ["City","Town","Route","Cave","Forest","Landmark","Lake"];

export const SHOP_TYPES = ["General Store","Apothecary","Blacksmith","Tailor","Bait & Tackle","Game Corner","Bookstore"];

export const NPC_ROLES = ["Gym Leader","Professor","Nurse","Rival","Villager"];

export const COUNTS = {
  items: ITEMS.length,
  recipes: RECIPES.length,
  professions: PROFESSIONS.length,
  classes: CLASSES.length,
  locations: LOCATIONS.length,
  shops: SHOPS.length,
  npcs: NPCS.length,
};
export const TOTAL_ENTRIES = Object.values(COUNTS).reduce((a, b) => a + b, 0);
