/* ════ GAME DATA & CONSTANTS ════ */
const WD=[{"id":1,"word":"Fire","meaning":"火","pos":"noun","cefr":"A1","rarity":"common","archive":"Elements","relations":{"related":["Burn","Heat","Smoke","Ash","Spark"],"synonyms":["Flame","Blaze","Inferno"],"opposites":["Water","Ice"],"evolution":[],"craft":["Firefly","Campfire","Fireball"]},"jobs":["Fire Mage"],"dungeons":["Fire Tower"]},{"id":2,"word":"Water","meaning":"水","pos":"noun","cefr":"A1","rarity":"common","archive":"Elements","relations":{"related":["Wave","Flow","Rain","River"],"synonyms":["Aqua","Liquid"],"opposites":["Fire"],"evolution":[],"craft":["Waterfall","Rainwater"]},"jobs":[],"dungeons":[]},{"id":3,"word":"Earth","meaning":"土・地球","pos":"noun","cefr":"A1","rarity":"common","archive":"Elements","relations":{"related":["Soil","Ground","Rock","Mud"],"synonyms":["Ground","Land","Terra"],"opposites":["Sky"],"evolution":[],"craft":["Earthquake","Earthworm"]},"jobs":[],"dungeons":[]},{"id":4,"word":"Wind","meaning":"風","pos":"noun","cefr":"A1","rarity":"common","archive":"Elements","relations":{"related":["Breeze","Storm","Air","Gust"],"synonyms":["Breeze","Air","Gale"],"opposites":[],"evolution":[],"craft":["Windmill","Windfall"]},"jobs":[],"dungeons":[]},{"id":5,"word":"Flame","meaning":"炎","pos":"noun","cefr":"B1","rarity":"uncommon","archive":"Elements","relations":{"related":["Fire","Heat","Light"],"synonyms":["Fire","Blaze"],"opposites":["Water"],"evolution":[],"craft":[]},"jobs":["Fire Mage"],"dungeons":["Fire Tower"]},{"id":6,"word":"Blaze","meaning":"炎・激しく燃える","pos":"noun","cefr":"B2","rarity":"rare","archive":"Elements","relations":{"related":["Fire","Flame","Inferno"],"synonyms":["Fire","Flame","Inferno"],"opposites":[],"evolution":[],"craft":[]},"jobs":[],"dungeons":["Fire Tower"]},{"id":7,"word":"Ice","meaning":"氷","pos":"noun","cefr":"A1","rarity":"common","archive":"Elements","relations":{"related":["Cold","Snow","Freeze","Crystal"],"synonyms":["Frost","Glacier"],"opposites":["Fire","Heat"],"evolution":[],"craft":["Iceberg","Snowball"]},"jobs":[],"dungeons":[]},{"id":8,"word":"Lightning","meaning":"稲妻","pos":"noun","cefr":"B1","rarity":"rare","archive":"Elements","relations":{"related":["Thunder","Storm","Electricity"],"synonyms":["Thunder","Bolt","Spark"],"opposites":[],"evolution":[],"craft":[]},"jobs":[],"dungeons":[]},{"id":9,"word":"Slime","meaning":"スライム","pos":"noun","cefr":"A1","rarity":"common","archive":"Monsters","relations":{"related":["Goo","Jelly","Ooze"],"synonyms":[],"opposites":[],"evolution":[],"craft":[]},"jobs":[],"dungeons":["Beginner Cave"]},{"id":10,"word":"Goblin","meaning":"ゴブリン","pos":"noun","cefr":"A2","rarity":"common","archive":"Monsters","relations":{"related":["Monster","Enemy","Creature"],"synonyms":[],"opposites":[],"evolution":[],"craft":[]},"jobs":[],"dungeons":["Beginner Cave"]},{"id":11,"word":"Dragon","meaning":"ドラゴン","pos":"noun","cefr":"A2","rarity":"legendary","archive":"Monsters","relations":{"related":["Fire","Wing","Scale","Claw"],"synonyms":[],"opposites":[],"evolution":[],"craft":[]},"jobs":[],"dungeons":["Fire Tower"]},{"id":12,"word":"Wolf","meaning":"狼","pos":"noun","cefr":"A2","rarity":"common","archive":"Monsters","relations":{"related":["Pack","Fang","Howl","Hunt"],"synonyms":[],"opposites":[],"evolution":[],"craft":[]},"jobs":[],"dungeons":["Beginner Cave"]},{"id":13,"word":"Skeleton","meaning":"骸骨","pos":"noun","cefr":"B1","rarity":"uncommon","archive":"Monsters","relations":{"related":["Bone","Undead","Death"],"synonyms":[],"opposites":[],"evolution":[],"craft":[]},"jobs":[],"dungeons":["Beginner Cave"]},{"id":14,"word":"Bat","meaning":"コウモリ","pos":"noun","cefr":"A2","rarity":"common","archive":"Monsters","relations":{"related":["Wing","Night","Cave","Dark"],"synonyms":[],"opposites":[],"evolution":[],"craft":[]},"jobs":[],"dungeons":["Beginner Cave"]},{"id":15,"word":"Rat","meaning":"ネズミ","pos":"noun","cefr":"A1","rarity":"common","archive":"Monsters","relations":{"related":["Mouse","Rodent","Small"],"synonyms":["Mouse"],"opposites":[],"evolution":[],"craft":[]},"jobs":[],"dungeons":["Beginner Cave"]},{"id":16,"word":"Buy","meaning":"買う","pos":"verb","cefr":"A1","rarity":"common","archive":"Commerce","relations":{"related":["Purchase","Trade","Shop","Market"],"synonyms":["Purchase","Acquire"],"opposites":["Sell"],"evolution":["Bought","Buying","Buyer"],"craft":[]},"jobs":["Merchant"],"dungeons":["Merchant Guild"]},{"id":17,"word":"Sell","meaning":"売る","pos":"verb","cefr":"A1","rarity":"common","archive":"Commerce","relations":{"related":["Trade","Market","Price","Profit"],"synonyms":["Vend","Trade"],"opposites":["Buy"],"evolution":["Sold","Selling","Seller"],"craft":[]},"jobs":["Merchant"],"dungeons":["Merchant Guild"]},{"id":18,"word":"Trade","meaning":"取引・交換する","pos":"noun","cefr":"A2","rarity":"common","archive":"Commerce","relations":{"related":["Merchant","Market","Exchange","Barter"],"synonyms":["Exchange","Barter","Deal"],"opposites":[],"evolution":[],"craft":[]},"jobs":["Merchant"],"dungeons":["Merchant Guild"]},{"id":19,"word":"Gold","meaning":"金・ゴールド","pos":"noun","cefr":"A1","rarity":"uncommon","archive":"Commerce","relations":{"related":["Money","Coin","Wealth","Price"],"synonyms":["Money","Coin","Currency"],"opposites":[],"evolution":[],"craft":[]},"jobs":["Merchant"],"dungeons":["Merchant Guild"]},{"id":20,"word":"Market","meaning":"市場","pos":"noun","cefr":"A2","rarity":"common","archive":"Commerce","relations":{"related":["Trade","Buy","Sell","Shop","Price"],"synonyms":["Bazaar","Shop","Store"],"opposites":[],"evolution":[],"craft":[]},"jobs":["Merchant"],"dungeons":["Merchant Guild"]},{"id":21,"word":"Price","meaning":"値段","pos":"noun","cefr":"A2","rarity":"common","archive":"Commerce","relations":{"related":["Cost","Value","Gold","Market"],"synonyms":["Cost","Fee","Rate"],"opposites":[],"evolution":[],"craft":[]},"jobs":["Merchant"],"dungeons":["Merchant Guild"]},{"id":22,"word":"Merchant","meaning":"商人","pos":"noun","cefr":"B1","rarity":"uncommon","archive":"Commerce","relations":{"related":["Trader","Seller","Buyer","Shop"],"synonyms":["Trader","Vendor","Dealer"],"opposites":[],"evolution":[],"craft":[]},"jobs":["Merchant"],"dungeons":["Merchant Guild"]},{"id":23,"word":"Profit","meaning":"利益","pos":"noun","cefr":"B1","rarity":"uncommon","archive":"Commerce","relations":{"related":["Money","Sell","Income","Gain"],"synonyms":["Gain","Income","Revenue"],"opposites":["Loss"],"evolution":[],"craft":[]},"jobs":["Merchant"],"dungeons":[]},{"id":24,"word":"Explore","meaning":"探索する","pos":"verb","cefr":"A2","rarity":"common","archive":"Exploration","relations":{"related":["Search","Find","Discover","Map"],"synonyms":["Search","Investigate","Discover"],"opposites":[],"evolution":["Explorer","Explored","Exploring","Exploration"],"craft":[]},"jobs":["Explorer"],"dungeons":["Ancient Ruins"]},{"id":25,"word":"Discover","meaning":"発見する","pos":"verb","cefr":"A2","rarity":"common","archive":"Exploration","relations":{"related":["Find","Search","Explore","Reveal"],"synonyms":["Find","Uncover","Reveal"],"opposites":["Hide"],"evolution":["Discovery","Discovered","Discovering"],"craft":[]},"jobs":["Explorer"],"dungeons":[]},{"id":26,"word":"Map","meaning":"地図","pos":"noun","cefr":"A1","rarity":"common","archive":"Exploration","relations":{"related":["Guide","Path","Direction","Route"],"synonyms":["Chart","Plan"],"opposites":[],"evolution":[],"craft":[]},"jobs":["Explorer"],"dungeons":["Ancient Ruins"]},{"id":27,"word":"Path","meaning":"道・経路","pos":"noun","cefr":"A2","rarity":"common","archive":"Exploration","relations":{"related":["Road","Route","Trail","Direction"],"synonyms":["Road","Route","Trail","Way"],"opposites":[],"evolution":[],"craft":[]},"jobs":["Explorer"],"dungeons":[]},{"id":28,"word":"Quest","meaning":"クエスト・探索","pos":"noun","cefr":"B1","rarity":"uncommon","archive":"Exploration","relations":{"related":["Mission","Journey","Adventure","Goal"],"synonyms":["Mission","Journey","Adventure"],"opposites":[],"evolution":[],"craft":[]},"jobs":["Explorer"],"dungeons":[]},{"id":29,"word":"Search","meaning":"探す・調べる","pos":"verb","cefr":"A1","rarity":"common","archive":"Exploration","relations":{"related":["Find","Look","Explore","Hunt"],"synonyms":["Find","Look","Seek","Explore"],"opposites":[],"evolution":["Searching","Searched"],"craft":[]},"jobs":["Explorer"],"dungeons":["Beginner Cave"]},{"id":30,"word":"Ancient","meaning":"古代の・古い","pos":"adjective","cefr":"B1","rarity":"uncommon","archive":"Exploration","relations":{"related":["Old","History","Ruin","Past"],"synonyms":["Old","Historic","Antique"],"opposites":["Modern","New"],"evolution":[],"craft":[]},"jobs":[],"dungeons":["Ancient Ruins"]},{"id":31,"word":"Magic","meaning":"魔法","pos":"noun","cefr":"A2","rarity":"uncommon","archive":"Magic","relations":{"related":["Spell","Power","Mystic","Enchant"],"synonyms":["Spell","Enchantment","Sorcery"],"opposites":[],"evolution":["Magical","Magician","Magically"],"craft":["Fireball"]},"jobs":["Fire Mage"],"dungeons":["Fire Tower"]},{"id":32,"word":"Spell","meaning":"呪文・魔法","pos":"noun","cefr":"B1","rarity":"uncommon","archive":"Magic","relations":{"related":["Magic","Incantation","Curse","Power"],"synonyms":["Incantation","Enchantment","Magic"],"opposites":[],"evolution":[],"craft":[]},"jobs":["Fire Mage"],"dungeons":[]},{"id":33,"word":"Enchant","meaning":"魔法をかける","pos":"verb","cefr":"B2","rarity":"rare","archive":"Magic","relations":{"related":["Magic","Spell","Charm","Power"],"synonyms":["Charm","Bewitch","Spellbind"],"opposites":["Curse"],"evolution":["Enchanted","Enchanting","Enchantment"],"craft":[]},"jobs":["Fire Mage"],"dungeons":[]},{"id":34,"word":"Mana","meaning":"マナ・魔力","pos":"noun","cefr":"B1","rarity":"rare","archive":"Magic","relations":{"related":["Magic","Power","Energy","Spell"],"synonyms":["Energy","Power","Essence"],"opposites":[],"evolution":[],"craft":[]},"jobs":["Fire Mage"],"dungeons":[]},{"id":35,"word":"Rune","meaning":"ルーン・古代文字","pos":"noun","cefr":"B2","rarity":"rare","archive":"Magic","relations":{"related":["Symbol","Magic","Power","Ancient"],"synonyms":["Symbol","Glyph","Sign"],"opposites":[],"evolution":[],"craft":[]},"jobs":[],"dungeons":["Ancient Ruins"]},{"id":36,"word":"Tree","meaning":"木・樹木","pos":"noun","cefr":"A1","rarity":"common","archive":"Nature","relations":{"related":["Forest","Wood","Branch","Leaf","Root"],"synonyms":["Timber","Wood"],"opposites":[],"evolution":[],"craft":[]},"jobs":[],"dungeons":[]},{"id":37,"word":"Forest","meaning":"森林","pos":"noun","cefr":"A1","rarity":"common","archive":"Nature","relations":{"related":["Tree","Wood","Nature","Wildlife"],"synonyms":["Wood","Woodland","Grove"],"opposites":["Desert"],"evolution":[],"craft":[]},"jobs":["Explorer"],"dungeons":[]},{"id":38,"word":"Stone","meaning":"石","pos":"noun","cefr":"A1","rarity":"common","archive":"Nature","relations":{"related":["Rock","Ground","Hard","Heavy"],"synonyms":["Rock","Boulder","Pebble"],"opposites":[],"evolution":[],"craft":[]},"jobs":[],"dungeons":[]},{"id":39,"word":"River","meaning":"川・河川","pos":"noun","cefr":"A1","rarity":"common","archive":"Nature","relations":{"related":["Water","Stream","Flow","Bank"],"synonyms":["Stream","Brook","Creek"],"opposites":[],"evolution":[],"craft":[]},"jobs":[],"dungeons":[]},{"id":40,"word":"Mountain","meaning":"山","pos":"noun","cefr":"A1","rarity":"common","archive":"Nature","relations":{"related":["Hill","Peak","Rock","High"],"synonyms":["Peak","Summit","Hill"],"opposites":[],"evolution":[],"craft":[]},"jobs":[],"dungeons":[]},{"id":41,"word":"Sky","meaning":"空","pos":"noun","cefr":"A1","rarity":"common","archive":"Nature","relations":{"related":["Cloud","Wind","Sun","Bird","High"],"synonyms":["Heaven","Atmosphere"],"opposites":["Earth","Ground"],"evolution":[],"craft":[]},"jobs":[],"dungeons":[]},{"id":42,"word":"Sun","meaning":"太陽","pos":"noun","cefr":"A1","rarity":"common","archive":"Nature","relations":{"related":["Light","Fire","Day","Warm","Star"],"synonyms":["Solar","Star"],"opposites":["Moon"],"evolution":[],"craft":[]},"jobs":[],"dungeons":[]},{"id":43,"word":"Moon","meaning":"月","pos":"noun","cefr":"A1","rarity":"common","archive":"Nature","relations":{"related":["Night","Star","Dark","Light"],"synonyms":["Lunar"],"opposites":["Sun"],"evolution":[],"craft":[]},"jobs":[],"dungeons":[]},{"id":44,"word":"Sword","meaning":"剣","pos":"noun","cefr":"A2","rarity":"uncommon","archive":"Weapons","relations":{"related":["Blade","Fight","Metal","Battle","Warrior"],"synonyms":["Blade","Saber"],"opposites":[],"evolution":[],"craft":[]},"jobs":["Warrior"],"dungeons":[]},{"id":45,"word":"Bow","meaning":"弓","pos":"noun","cefr":"A2","rarity":"uncommon","archive":"Weapons","relations":{"related":["Arrow","Hunt","Range","Forest"],"synonyms":[],"opposites":[],"evolution":[],"craft":[]},"jobs":["Warrior"],"dungeons":[]},{"id":46,"word":"Arrow","meaning":"矢","pos":"noun","cefr":"A2","rarity":"common","archive":"Weapons","relations":{"related":["Bow","Target","Hunt","Speed"],"synonyms":[],"opposites":[],"evolution":[],"craft":[]},"jobs":["Warrior"],"dungeons":[]},{"id":47,"word":"Shield","meaning":"盾","pos":"noun","cefr":"A2","rarity":"uncommon","archive":"Weapons","relations":{"related":["Protect","Defend","Metal","Warrior"],"synonyms":["Guard","Buckler"],"opposites":[],"evolution":[],"craft":[]},"jobs":["Warrior"],"dungeons":[]},{"id":48,"word":"Staff","meaning":"杖","pos":"noun","cefr":"B1","rarity":"uncommon","archive":"Weapons","relations":{"related":["Mage","Magic","Wood","Wand"],"synonyms":["Wand","Rod","Stave"],"opposites":[],"evolution":[],"craft":[]},"jobs":["Fire Mage"],"dungeons":[]},{"id":49,"word":"Wood","meaning":"木材","pos":"noun","cefr":"A1","rarity":"common","archive":"Materials","relations":{"related":["Tree","Forest","Build","Fire","Log"],"synonyms":["Timber","Lumber","Log"],"opposites":[],"evolution":[],"craft":["Torch","Arrow","Bow"]},"jobs":["Engineer"],"dungeons":[]},{"id":50,"word":"Iron","meaning":"鉄","pos":"noun","cefr":"A2","rarity":"common","archive":"Materials","relations":{"related":["Metal","Hard","Heavy","Strong","Sword"],"synonyms":["Steel","Metal"],"opposites":[],"evolution":[],"craft":["Sword","Shield"]},"jobs":["Engineer"],"dungeons":[]},{"id":51,"word":"Ore","meaning":"鉱石","pos":"noun","cefr":"B1","rarity":"uncommon","archive":"Materials","relations":{"related":["Mine","Metal","Stone","Iron","Gold"],"synonyms":["Mineral","Rock"],"opposites":[],"evolution":[],"craft":["Metal","Iron"]},"jobs":["Engineer"],"dungeons":[]},{"id":52,"word":"Herb","meaning":"薬草・ハーブ","pos":"noun","cefr":"A2","rarity":"common","archive":"Materials","relations":{"related":["Plant","Medicine","Green","Heal"],"synonyms":["Plant","Medicine","Remedy"],"opposites":[],"evolution":[],"craft":["Potion"]},"jobs":[],"dungeons":[]},{"id":53,"word":"Crystal","meaning":"水晶・クリスタル","pos":"noun","cefr":"B1","rarity":"rare","archive":"Materials","relations":{"related":["Magic","Clear","Pure","Light","Stone"],"synonyms":["Gem","Diamond","Jewel"],"opposites":[],"evolution":[],"craft":[]},"jobs":["Fire Mage"],"dungeons":[]},{"id":54,"word":"Cloth","meaning":"布・生地","pos":"noun","cefr":"A2","rarity":"common","archive":"Materials","relations":{"related":["Fabric","Wear","Soft","Thread"],"synonyms":["Fabric","Textile","Thread"],"opposites":[],"evolution":[],"craft":[]},"jobs":["Merchant"],"dungeons":[]},{"id":55,"word":"Leather","meaning":"革・皮革","pos":"noun","cefr":"B1","rarity":"uncommon","archive":"Materials","relations":{"related":["Animal","Skin","Armor","Soft"],"synonyms":["Hide","Skin"],"opposites":[],"evolution":[],"craft":[]},"jobs":[],"dungeons":[]},{"id":56,"word":"Burn","meaning":"燃える・焼く","pos":"verb","cefr":"A2","rarity":"common","archive":"Elements","relations":{"related":["Fire","Flame","Heat","Destroy"],"synonyms":["Ignite","Char","Scorch"],"opposites":[],"evolution":["Burned","Burning","Burns"],"craft":[]},"jobs":["Fire Mage"],"dungeons":["Fire Tower"]},{"id":57,"word":"Heat","meaning":"熱・温める","pos":"noun","cefr":"A2","rarity":"common","archive":"Elements","relations":{"related":["Fire","Warm","Temperature","Hot"],"synonyms":["Warmth","Temperature"],"opposites":["Cold","Ice"],"evolution":[],"craft":[]},"jobs":[],"dungeons":[]},{"id":58,"word":"Cold","meaning":"寒い・冷たい","pos":"adjective","cefr":"A1","rarity":"common","archive":"Elements","relations":{"related":["Ice","Snow","Freeze","Winter"],"synonyms":["Cool","Chilly","Frigid"],"opposites":["Hot","Warm","Heat"],"evolution":[],"craft":[]},"jobs":[],"dungeons":[]},{"id":59,"word":"Light","meaning":"光・明かり","pos":"noun","cefr":"A1","rarity":"common","archive":"Nature","relations":{"related":["Sun","Fire","Bright","Day","Illuminate"],"synonyms":["Glow","Shine","Brightness"],"opposites":["Dark","Darkness"],"evolution":[],"craft":["Torch","Lantern"]},"jobs":[],"dungeons":[]},{"id":60,"word":"Dark","meaning":"暗い・闇","pos":"adjective","cefr":"A1","rarity":"common","archive":"Nature","relations":{"related":["Night","Shadow","Black","Cave"],"synonyms":["Shadow","Darkness","Night"],"opposites":["Light","Bright"],"evolution":["Darkness","Darkly"],"craft":[]},"jobs":[],"dungeons":["Beginner Cave"]},{"id":61,"word":"Power","meaning":"力・パワー","pos":"noun","cefr":"A1","rarity":"common","archive":"Magic","relations":{"related":["Strength","Energy","Force","Magic"],"synonyms":["Strength","Force","Energy"],"opposites":["Weakness"],"evolution":["Powerful","Powerless","Powerfully"],"craft":[]},"jobs":["Warrior","Fire Mage"],"dungeons":[]},{"id":62,"word":"Swift","meaning":"速い・素早い","pos":"adjective","cefr":"B1","rarity":"uncommon","archive":"Exploration","relations":{"related":["Fast","Quick","Speed","Agile"],"synonyms":["Fast","Quick","Rapid"],"opposites":["Slow"],"evolution":["Swiftly","Swiftness"],"craft":[]},"jobs":["Explorer"],"dungeons":[]},{"id":63,"word":"Strong","meaning":"強い","pos":"adjective","cefr":"A1","rarity":"common","archive":"Weapons","relations":{"related":["Power","Muscle","Iron","Force"],"synonyms":["Powerful","Mighty","Robust"],"opposites":["Weak"],"evolution":["Strength","Strongly"],"craft":[]},"jobs":["Warrior"],"dungeons":[]},{"id":64,"word":"Ruin","meaning":"廃墟・遺跡","pos":"noun","cefr":"B1","rarity":"uncommon","archive":"Exploration","relations":{"related":["Ancient","Old","Destroy","History"],"synonyms":["Remnant","Wreck","Debris"],"opposites":[],"evolution":["Ruins","Ruined"],"craft":[]},"jobs":["Explorer"],"dungeons":["Ancient Ruins"]},{"id":65,"word":"Treasure","meaning":"宝物・財宝","pos":"noun","cefr":"A2","rarity":"rare","archive":"Exploration","relations":{"related":["Gold","Jewel","Rare","Find","Explore"],"synonyms":["Riches","Loot","Bounty"],"opposites":[],"evolution":[],"craft":[]},"jobs":["Explorer","Merchant"],"dungeons":["Beginner Cave","Ancient Ruins"]},{"id":66,"word":"Battle","meaning":"戦い・戦闘","pos":"noun","cefr":"A2","rarity":"common","archive":"Weapons","relations":{"related":["Fight","War","Sword","Enemy","Warrior"],"synonyms":["Fight","Combat","War","Clash"],"opposites":["Peace"],"evolution":["Battles","Battled"],"craft":[]},"jobs":["Warrior"],"dungeons":[]},{"id":67,"word":"Defend","meaning":"守る・防衛する","pos":"verb","cefr":"B1","rarity":"uncommon","archive":"Weapons","relations":{"related":["Shield","Protect","Guard","Safe"],"synonyms":["Protect","Guard","Shield","Secure"],"opposites":["Attack","Assault"],"evolution":["Defense","Defender","Defending"],"craft":[]},"jobs":["Warrior"],"dungeons":[]},{"id":68,"word":"Attack","meaning":"攻撃する","pos":"verb","cefr":"A2","rarity":"common","archive":"Weapons","relations":{"related":["Fight","Strike","Hit","Sword","Force"],"synonyms":["Strike","Assault","Charge"],"opposites":["Defend","Retreat"],"evolution":["Attacker","Attacking"],"craft":[]},"jobs":["Warrior"],"dungeons":[]},{"id":69,"word":"Heal","meaning":"癒やす・回復する","pos":"verb","cefr":"B1","rarity":"uncommon","archive":"Magic","relations":{"related":["Health","Potion","Herb","Recover"],"synonyms":["Cure","Recover","Restore"],"opposites":["Hurt","Damage","Poison"],"evolution":["Healer","Healing","Healed"],"craft":["Potion"]},"jobs":["Fire Mage"],"dungeons":[]},{"id":70,"word":"Build","meaning":"建てる・造る","pos":"verb","cefr":"A2","rarity":"common","archive":"Materials","relations":{"related":["Create","Make","Construct","Wood","Stone"],"synonyms":["Construct","Create","Make","Forge"],"opposites":["Destroy","Break"],"evolution":["Builder","Building","Built"],"craft":[]},"jobs":["Engineer"],"dungeons":[]},{"id":71,"word":"Craft","meaning":"作る・工作する","pos":"verb","cefr":"B1","rarity":"uncommon","archive":"Materials","relations":{"related":["Build","Make","Create","Skill","Art"],"synonyms":["Make","Create","Forge","Fabricate"],"opposites":[],"evolution":["Crafter","Crafted","Crafting","Craftsmanship"],"craft":[]},"jobs":["Engineer"],"dungeons":[]},{"id":72,"word":"Mine","meaning":"採掘する・鉱山","pos":"verb","cefr":"B1","rarity":"uncommon","archive":"Materials","relations":{"related":["Ore","Stone","Metal","Deep","Dark"],"synonyms":["Dig","Excavate","Quarry"],"opposites":[],"evolution":["Miner","Mining","Mined"],"craft":["Ore"]},"jobs":["Engineer"],"dungeons":["Beginner Cave"]},{"id":73,"word":"Forge","meaning":"鍛造する","pos":"verb","cefr":"B2","rarity":"rare","archive":"Materials","relations":{"related":["Metal","Fire","Craft","Build","Sword"],"synonyms":["Craft","Shape","Create","Smelt"],"opposites":[],"evolution":["Forger","Forging","Forged"],"craft":["Sword","Shield","Iron"]},"jobs":["Engineer"],"dungeons":[]},{"id":74,"word":"Smoke","meaning":"煙","pos":"noun","cefr":"A2","rarity":"common","archive":"Elements","relations":{"related":["Fire","Burn","Cloud","Dark","Signal"],"synonyms":["Fume","Haze","Smog"],"opposites":[],"evolution":[],"craft":[]},"jobs":[],"dungeons":["Fire Tower"]},{"id":75,"word":"Ash","meaning":"灰","pos":"noun","cefr":"B1","rarity":"common","archive":"Elements","relations":{"related":["Fire","Burn","Remain","Black","Smoke"],"synonyms":["Cinder","Ember","Residue"],"opposites":[],"evolution":[],"craft":[]},"jobs":[],"dungeons":[]},{"id":76,"word":"Spark","meaning":"火花・きっかけ","pos":"noun","cefr":"B1","rarity":"uncommon","archive":"Elements","relations":{"related":["Fire","Electric","Light","Start","Ignite"],"synonyms":["Flash","Glint","Flicker"],"opposites":[],"evolution":[],"craft":[]},"jobs":[],"dungeons":[]},{"id":77,"word":"Thunder","meaning":"雷・雷鳴","pos":"noun","cefr":"B1","rarity":"rare","archive":"Elements","relations":{"related":["Lightning","Storm","Loud","Rain","Fear"],"synonyms":["Roar","Boom","Rumble"],"opposites":[],"evolution":[],"craft":[]},"jobs":[],"dungeons":[]},{"id":78,"word":"Wave","meaning":"波","pos":"noun","cefr":"A2","rarity":"common","archive":"Nature","relations":{"related":["Water","Ocean","Sea","Flow","Tide"],"synonyms":["Surf","Swell","Ripple"],"opposites":[],"evolution":[],"craft":[]},"jobs":[],"dungeons":[]},{"id":79,"word":"Cave","meaning":"洞窟・穴","pos":"noun","cefr":"A2","rarity":"common","archive":"Exploration","relations":{"related":["Dark","Stone","Mine","Bat","Echo"],"synonyms":["Cavern","Grotto","Den"],"opposites":[],"evolution":[],"craft":[]},"jobs":["Explorer"],"dungeons":["Beginner Cave"]},{"id":80,"word":"Echo","meaning":"反響・こだま","pos":"noun","cefr":"B1","rarity":"uncommon","archive":"Exploration","relations":{"related":["Sound","Cave","Repeat","Voice"],"synonyms":["Reflection","Resonance"],"opposites":[],"evolution":[],"craft":[]},"jobs":[],"dungeons":["Beginner Cave"]},{"id":81,"word":"Ghost","meaning":"幽霊・ゴースト","pos":"noun","cefr":"A2","rarity":"uncommon","archive":"Monsters","relations":{"related":["Spirit","Undead","Dark","Fear","Soul"],"synonyms":["Spirit","Phantom","Specter"],"opposites":[],"evolution":[],"craft":[]},"jobs":[],"dungeons":[]},{"id":82,"word":"Troll","meaning":"トロル","pos":"noun","cefr":"B1","rarity":"uncommon","archive":"Monsters","relations":{"related":["Monster","Rock","Bridge","Large"],"synonyms":[],"opposites":[],"evolution":[],"craft":[]},"jobs":[],"dungeons":["Beginner Cave"]},{"id":83,"word":"Potion","meaning":"ポーション・薬","pos":"noun","cefr":"A2","rarity":"common","archive":"Magic","relations":{"related":["Heal","Herb","Bottle","Drink","Medicine"],"synonyms":["Elixir","Brew","Remedy"],"opposites":[],"evolution":[],"craft":[]},"jobs":["Fire Mage"],"dungeons":[]},{"id":84,"word":"Bottle","meaning":"瓶・ボトル","pos":"noun","cefr":"A1","rarity":"common","archive":"Materials","relations":{"related":["Container","Potion","Glass","Fill"],"synonyms":["Flask","Vial","Container","Jar"],"opposites":[],"evolution":[],"craft":["Potion","Elixir"]},"jobs":["Merchant"],"dungeons":[]},{"id":85,"word":"Coin","meaning":"コイン・硬貨","pos":"noun","cefr":"A1","rarity":"common","archive":"Commerce","relations":{"related":["Gold","Money","Pay","Trade","Value"],"synonyms":["Money","Currency","Token"],"opposites":[],"evolution":[],"craft":[]},"jobs":["Merchant"],"dungeons":["Merchant Guild"]},{"id":86,"word":"Book","meaning":"本・書物","pos":"noun","cefr":"A1","rarity":"common","archive":"Magic","relations":{"related":["Read","Write","Knowledge","Spell","Archive"],"synonyms":["Volume","Text","Tome","Manual"],"opposites":[],"evolution":[],"craft":["Bookmark","Spellbook"]},"jobs":["Fire Mage","Explorer"],"dungeons":[]},{"id":87,"word":"Mark","meaning":"印・記す","pos":"noun","cefr":"A2","rarity":"common","archive":"Exploration","relations":{"related":["Sign","Target","Symbol","Point","Note"],"synonyms":["Sign","Symbol","Stamp","Label"],"opposites":[],"evolution":[],"craft":["Bookmark","Landmark"]},"jobs":[],"dungeons":[]},{"id":88,"word":"Snow","meaning":"雪","pos":"noun","cefr":"A1","rarity":"common","archive":"Nature","relations":{"related":["Ice","Cold","White","Winter","Fall"],"synonyms":["Sleet","Frost","Flurry"],"opposites":["Heat","Fire"],"evolution":[],"craft":["Snowman","Snowball"]},"jobs":[],"dungeons":[]},{"id":89,"word":"Man","meaning":"人・男性","pos":"noun","cefr":"A1","rarity":"common","archive":"Monsters","relations":{"related":["Human","Person","Male","People"],"synonyms":["Person","Human","Male","Guy"],"opposites":["Woman"],"evolution":[],"craft":["Snowman","Swordsman"]},"jobs":[],"dungeons":[]},{"id":90,"word":"Fly","meaning":"飛ぶ","pos":"verb","cefr":"A1","rarity":"common","archive":"Nature","relations":{"related":["Wing","Sky","Bird","Air","Float"],"synonyms":["Soar","Float","Glide","Flutter"],"opposites":[],"evolution":["Flying","Flew","Flown","Flight"],"craft":["Firefly"]},"jobs":[],"dungeons":[]},{"id":91,"word":"Hammer","meaning":"ハンマー・槌","pos":"noun","cefr":"A2","rarity":"common","archive":"Weapons","relations":{"related":["Hit","Build","Metal","Tool","Forge"],"synonyms":["Mallet","Club","Tool"],"opposites":[],"evolution":[],"craft":["Sword","Iron"]},"jobs":["Engineer"],"dungeons":[]},{"id":92,"word":"Night","meaning":"夜","pos":"noun","cefr":"A1","rarity":"common","archive":"Nature","relations":{"related":["Dark","Moon","Star","Sleep","Quiet"],"synonyms":["Darkness","Midnight","Evening"],"opposites":["Day","Light"],"evolution":[],"craft":["Nightmare"]},"jobs":[],"dungeons":[]},{"id":93,"word":"Day","meaning":"昼・日","pos":"noun","cefr":"A1","rarity":"common","archive":"Nature","relations":{"related":["Sun","Light","Bright","Morning"],"synonyms":["Daytime","Daylight","Dawn"],"opposites":["Night"],"evolution":[],"craft":["Daydream"]},"jobs":[],"dungeons":[]},{"id":94,"word":"Soul","meaning":"魂","pos":"noun","cefr":"B1","rarity":"rare","archive":"Magic","relations":{"related":["Spirit","Ghost","Life","Death","Mind"],"synonyms":["Spirit","Essence","Psyche"],"opposites":[],"evolution":[],"craft":[]},"jobs":[],"dungeons":[]},{"id":95,"word":"Storm","meaning":"嵐・暴風","pos":"noun","cefr":"A2","rarity":"uncommon","archive":"Nature","relations":{"related":["Wind","Rain","Thunder","Lightning","Dark"],"synonyms":["Tempest","Gale","Squall"],"opposites":["Calm","Peace"],"evolution":[],"craft":[]},"jobs":[],"dungeons":[]},{"id":96,"word":"Deep","meaning":"深い・奥深い","pos":"adjective","cefr":"A2","rarity":"common","archive":"Nature","relations":{"related":["Ocean","Cave","Dark","Profound","Low"],"synonyms":["Profound","Vast","Immense"],"opposites":["Shallow","Surface"],"evolution":["Deeply","Depth"],"craft":[]},"jobs":["Explorer"],"dungeons":["Beginner Cave"]},{"id":97,"word":"Sharp","meaning":"鋭い・尖った","pos":"adjective","cefr":"B1","rarity":"common","archive":"Weapons","relations":{"related":["Blade","Sword","Point","Edge","Cut"],"synonyms":["Keen","Acute","Pointed","Edged"],"opposites":["Dull","Blunt"],"evolution":["Sharpen","Sharply","Sharpness"],"craft":[]},"jobs":["Warrior"],"dungeons":[]},{"id":98,"word":"Guard","meaning":"守衛・守る","pos":"noun","cefr":"B1","rarity":"uncommon","archive":"Weapons","relations":{"related":["Shield","Defend","Protect","Watch","Safety"],"synonyms":["Protector","Defender","Sentinel"],"opposites":[],"evolution":["Guarding","Guarded","Guardian"],"craft":[]},"jobs":["Warrior"],"dungeons":[]},{"id":99,"word":"Legend","meaning":"伝説","pos":"noun","cefr":"B1","rarity":"legendary","archive":"Exploration","relations":{"related":["Story","Myth","Hero","Ancient","Great"],"synonyms":["Myth","Epic","Tale","Saga"],"opposites":[],"evolution":["Legendary"],"craft":[]},"jobs":[],"dungeons":["Ancient Ruins"]},{"id":100,"word":"Inferno","meaning":"大火災・地獄の業火","pos":"noun","cefr":"C1","rarity":"epic","archive":"Elements","relations":{"related":["Fire","Blaze","Heat","Destroy"],"synonyms":["Blaze","Conflagration","Hellfire"],"opposites":["Ice","Water"],"evolution":[],"craft":[]},"jobs":["Fire Mage"],"dungeons":["Fire Tower"]}];
const JD=[
  {id:'novice',name:'Novice',icon:'🌱',tier:0,
    unlock:{type:'always'},
    desc:'Every legend starts somewhere.',bonus:'特になし',bonusKey:null,bonusVal:0,always:true},
  {id:'warrior',name:'Warrior',icon:'⚔️',tier:1,
    unlock:{type:'pos',pos:'noun',count:20},
    desc:'名詞を集め、力を磨いた戦士。',bonus:'ATK +20%',bonusKey:'atk',bonusVal:0.20,always:false},
  {id:'mage',name:'Mage',icon:'🪄',tier:1,
    unlock:{type:'pos',pos:'verb',count:20},
    desc:'動詞を集め、知識の力を高めた魔導士。',bonus:'Archive EXP +20%',bonusKey:'aexp',bonusVal:0.20,always:false},
  {id:'scholar',name:'Scholar',icon:'📖',tier:1,
    unlock:{type:'registered',count:30},
    desc:'図鑑を充実させた博識家。',bonus:'単語発見率 +10%',bonusKey:'discover',bonusVal:0.10,always:false},
  {id:'explorer',name:'Explorer',icon:'🧭',tier:1,
    unlock:{type:'pos',pos:'adverb',count:20},
    desc:'副詞を集め、フィールドを駆け抜ける探検家。',bonus:'移動回数 +2',bonusKey:'move',bonusVal:2,always:false},
];
const DD=[{"id":"beginner_cave","name":"Beginner Cave","theme":"beginner","desc":"A damp cave where novice adventurers begin their journey. Basic monsters lurk in the shadows.","words":["Slime","Goblin","Wolf","Bat","Rat","Skeleton","Cave","Dark","Deep","Echo"],"difficulty":"A1","sessionLength":"30–60 sec","recommended":"Novice"},{"id":"fire_tower","name":"Fire Tower","theme":"fire","desc":"A blazing tower wreathed in eternal flame. Fire-type words grant massive bonuses here.","words":["Fire","Burn","Flame","Blaze","Smoke","Ash","Spark","Dragon","Magic","Heat"],"difficulty":"A2","sessionLength":"60–90 sec","recommended":"Fire Mage"},{"id":"merchant_guild","name":"Merchant Guild","theme":"merchant","desc":"The bustling center of commerce. Master commerce words to unlock merchant bonuses.","words":["Buy","Sell","Trade","Gold","Market","Price","Merchant","Profit","Coin","Treasure"],"difficulty":"A2","sessionLength":"60–90 sec","recommended":"Merchant"}];
const WR=[{"result":"Firefly","ingredients":["Fire","Fly"],"hint":"火と飛ぶ生き物…"},{"result":"Bookmark","ingredients":["Book","Mark"],"hint":"本のある場所を記す"},{"result":"Snowman","ingredients":["Snow","Man"],"hint":"冬の人形"},{"result":"Sunlight","ingredients":["Sun","Light"],"hint":"太陽の光"},{"result":"Moonlight","ingredients":["Moon","Light"],"hint":"夜を照らす光"},{"result":"Daylight","ingredients":["Day","Light"],"hint":"昼の光"},{"result":"Thunderstorm","ingredients":["Thunder","Storm"],"hint":"轟く嵐"},{"result":"Darknight","ingredients":["Dark","Night"],"hint":"光のない深夜"},{"result":"Spellbook","ingredients":["Spell","Book"],"hint":"魔法の書"},{"result":"Soulfire","ingredients":["Soul","Fire"],"hint":"魂から燃える炎"},{"result":"Stormwind","ingredients":["Storm","Wind"],"hint":"嵐の中の強風"},{"result":"Firestone","ingredients":["Fire","Stone"],"hint":"火を宿す石"},{"result":"Ironwood","ingredients":["Iron","Wood"],"hint":"鉄のように硬い木"},{"result":"Swordsman","ingredients":["Sword","Man"],"hint":"剣を扱う者"},{"result":"Goldmine","ingredients":["Gold","Mine"],"hint":"金を産む鉱山"},{"result":"Goldmark","ingredients":["Gold","Mark"],"hint":"金の印"},{"result":"Tradewind","ingredients":["Trade","Wind"],"hint":"商人を運ぶ風"},{"result":"Sharpstone","ingredients":["Sharp","Stone"],"hint":"刃を研ぐ石"},{"result":"Deepwater","ingredients":["Deep","Water"],"hint":"底知れぬ水"},{"result":"Deepcave","ingredients":["Deep","Cave"],"hint":"深い地底の洞窟"},{"result":"Soulstone","ingredients":["Soul","Stone"],"hint":"魂を宿す石"}];
const IR=[{"result":"Torch","ingredients":["Wood","Fire"],"category":"Tools","rarity":"common"},{"result":"Metal","ingredients":["Ore","Fire"],"category":"Materials","rarity":"common"},{"result":"Sword","ingredients":["Iron","Hammer"],"category":"Weapons","rarity":"uncommon"},{"result":"Potion","ingredients":["Herb","Bottle"],"category":"Consumables","rarity":"common"},{"result":"Spear","ingredients":["Wood","Iron"],"category":"Weapons","rarity":"uncommon"},{"result":"Shield","ingredients":["Iron","Wood"],"category":"Armor","rarity":"uncommon"},{"result":"Bow","ingredients":["Wood","String"],"category":"Weapons","rarity":"uncommon"},{"result":"Arrow","ingredients":["Wood","Iron"],"category":"Weapons","rarity":"common"},{"result":"Armor","ingredients":["Iron","Leather"],"category":"Armor","rarity":"rare"},{"result":"Helmet","ingredients":["Iron","Leather"],"category":"Armor","rarity":"uncommon"},{"result":"Boots","ingredients":["Leather","Iron"],"category":"Armor","rarity":"common"},{"result":"Gloves","ingredients":["Leather","Cloth"],"category":"Armor","rarity":"common"},{"result":"Cloak","ingredients":["Cloth","Shadow"],"category":"Armor","rarity":"uncommon"},{"result":"Staff","ingredients":["Wood","Crystal"],"category":"Weapons","rarity":"rare"},{"result":"Wand","ingredients":["Wood","Mana"],"category":"Weapons","rarity":"rare"},{"result":"Tome","ingredients":["Book","Leather"],"category":"Tools","rarity":"uncommon"},{"result":"Lantern","ingredients":["Iron","Light"],"category":"Tools","rarity":"common"},{"result":"Rope","ingredients":["Hemp","Fiber"],"category":"Tools","rarity":"common"},{"result":"Candle","ingredients":["Wax","Fire"],"category":"Tools","rarity":"common"},{"result":"Map","ingredients":["Parchment","Ink"],"category":"Tools","rarity":"common"},{"result":"Compass","ingredients":["Iron","Crystal"],"category":"Tools","rarity":"uncommon"},{"result":"Pickaxe","ingredients":["Iron","Wood"],"category":"Tools","rarity":"common"},{"result":"Axe","ingredients":["Iron","Wood"],"category":"Weapons","rarity":"common"},{"result":"Hammer","ingredients":["Iron","Wood"],"category":"Tools","rarity":"common"},{"result":"Key","ingredients":["Iron","Gold"],"category":"Tools","rarity":"uncommon"},{"result":"Lock","ingredients":["Iron","Spring"],"category":"Tools","rarity":"common"},{"result":"Cage","ingredients":["Iron","Lock"],"category":"Tools","rarity":"uncommon"},{"result":"Bomb","ingredients":["Fire","Powder"],"category":"Weapons","rarity":"rare"},{"result":"Elixir","ingredients":["Potion","Crystal"],"category":"Consumables","rarity":"rare"},{"result":"Antidote","ingredients":["Herb","Water"],"category":"Consumables","rarity":"common"},{"result":"Bandage","ingredients":["Cloth","Water"],"category":"Consumables","rarity":"common"},{"result":"Salve","ingredients":["Herb","Oil"],"category":"Consumables","rarity":"common"},{"result":"Coin","ingredients":["Gold","Forge"],"category":"Currency","rarity":"common"},{"result":"Gem","ingredients":["Crystal","Stone"],"category":"Materials","rarity":"rare"},{"result":"Crown","ingredients":["Gold","Gem"],"category":"Accessories","rarity":"epic"},{"result":"Ring","ingredients":["Gold","Crystal"],"category":"Accessories","rarity":"rare"},{"result":"Necklace","ingredients":["Gold","Thread"],"category":"Accessories","rarity":"uncommon"},{"result":"Bag","ingredients":["Cloth","Leather"],"category":"Tools","rarity":"common"},{"result":"Chest","ingredients":["Wood","Iron"],"category":"Tools","rarity":"uncommon"},{"result":"Raft","ingredients":["Wood","Rope"],"category":"Transport","rarity":"common"},{"result":"Cart","ingredients":["Wood","Wheel"],"category":"Transport","rarity":"uncommon"},{"result":"Wheel","ingredients":["Wood","Iron"],"category":"Transport","rarity":"common"},{"result":"Bellows","ingredients":["Leather","Wood"],"category":"Tools","rarity":"common"},{"result":"Anvil","ingredients":["Iron","Stone"],"category":"Tools","rarity":"uncommon"},{"result":"Furnace","ingredients":["Stone","Fire"],"category":"Tools","rarity":"uncommon"},{"result":"Cauldron","ingredients":["Iron","Fire"],"category":"Tools","rarity":"uncommon"},{"result":"Scroll","ingredients":["Parchment","Spell"],"category":"Magic","rarity":"uncommon"},{"result":"Rune Stone","ingredients":["Stone","Rune"],"category":"Magic","rarity":"rare"},{"result":"Mirror","ingredients":["Glass","Silver"],"category":"Tools","rarity":"rare"},{"result":"Lantern","ingredients":["Glass","Fire"],"category":"Tools","rarity":"common"}];

/* ════ CONSTANTS ════ */
const ST=['unknown','discovered','learned','skilled','master'];
const ST_JP=['未発見','発見済み','学習中','習熟済み','マスター'];
const ST_EXP=[0,5,10,25,50];
const CCAT={Elements:'#e07030',Nature:'#40c060',Monsters:'#c04040',
  Commerce:'#c8a84b',Exploration:'#4dc8e0',Magic:'#8a6dfa',Weapons:'#c06040',Materials:'#7a9090',
  Armor:'#5a7ac0',Food:'#c8804a',Construction:'#a08060',Emotion:'#e07ab0',
  Farming:'#8ac060',Transport:'#609ac0',Social:'#c0a070',Science:'#60c0c0',
  Technology:'#9090e0',Medicine:'#e06090',Government:'#a0a040',History:'#c09050'};
const CICON={Elements:'🔥',Nature:'🌿',Monsters:'👹',Commerce:'💰',
  Exploration:'🧭',Magic:'✨',Weapons:'⚔️',Materials:'⛏️',
  Armor:'🛡️',Food:'🍞',Construction:'🏠',Emotion:'💭',
  Farming:'🌾',Transport:'🚢',Social:'👥',Science:'🔬',
  Technology:'⚙️',Medicine:'💊',Government:'🏛️',History:'📜'};
const RCOL={common:'#6a7090',uncommon:'#4dc8e0',rare:'#7ab4ff',epic:'#b06aff',legendary:'#e8c060'};
const RLBL={common:'コモン',uncommon:'アンコモン',rare:'レア',epic:'エピック',legendary:'レジェンダリー'};
// Rank order for combining word rarities into a skill rarity (Phase4: higher of the two)
const RRANK={common:0,uncommon:1,rare:2,epic:3,legendary:4};
const RKEYS=['common','uncommon','rare','epic','legendary'];
const CJP={Elements:'元素',Nature:'自然',Monsters:'モンスター',Commerce:'商業',
  Exploration:'探索',Magic:'魔法',Weapons:'武器',Materials:'素材',
  Armor:'防具',Food:'食料',Construction:'建築',Emotion:'感情',
  Farming:'農業',Transport:'交通',Social:'社会',Science:'科学',
  Technology:'技術',Medicine:'医療',Government:'政治',History:'歴史'};
const PICO={noun:'📦',verb:'⚡',adjective:'💎',adverb:'🌀'};

const WM={};WD.forEach(w=>{WM[w.word]=w});

/* ════ WORD LEVEL & EVOLUTION (Phase3) ════ */
// Fixed evolution chains (固定・ランダム禁止). Both source and target must exist in WD.
const EVOLUTION={
  Fire:'Flame', Flame:'Blaze', Blaze:'Inferno',
  Build:'Forge',
  Cave:'Echo',
  Magic:'Enchant',
};
// Evolution tier: 0 = base word, 1 = first evolution, 2 = second, etc.
const EVO_TIER={};
(function(){
  // Find base words (not a target of any evolution)
  const targets=new Set(Object.values(EVOLUTION));
  WD.forEach(w=>{ if(!targets.has(w.word)) EVO_TIER[w.word]=0 });
  // Propagate tiers along chains
  let changed=true;
  while(changed){
    changed=false;
    for(const [src,tgt] of Object.entries(EVOLUTION)){
      if(EVO_TIER[src]!==undefined && EVO_TIER[tgt]===undefined){
        EVO_TIER[tgt]=EVO_TIER[src]+1; changed=true;
      }
    }
  }
})();
const WLV_CAP=10;        // max word level
const WEXP_PER_LV=10;    // EXP needed per level-up (constant, simple)

/* ════ SKILL EFFECTS (Phase5: 探索ビルドシステム) ════ */
// Effect magnitude scaling by skill rarity (仮数値)
const SKILL_EFFECT_MAG={
  common:{pct:0.05,flat:1},
  uncommon:{pct:0.08,flat:1},
  rare:{pct:0.12,flat:2},
  epic:{pct:0.18,flat:2},
  legendary:{pct:0.25,flat:3},
};
// Keyword groups -> exploration effect type (単純なキーワード判定)
const SKILL_EFFECT_TABLE=[
  {type:'exp',     label:'探索EXP',        unit:'%',  keywords:['Fire','Flame','Blaze','Inferno','Burn','Heat','Spark']},
  {type:'move',    label:'移動回数',        unit:'',   keywords:['Swift','Wind','Fly','Quick','Breeze','Gale']},
  {type:'rare',    label:'レア単語出現率',  unit:'%',  keywords:['Dragon','Ancient','Legend','Ruin','Treasure']},
  {type:'quiz',    label:'クイズ報酬',      unit:'%',  keywords:['Water','Wave','River','Rain','Ice']},
  {type:'gold',    label:'Gold獲得量',      unit:'%',  keywords:['Forge','Build','Craft','Iron','Hammer','Coin','Gold','Trade','Merchant','Sell','Profit']},
  {type:'discover',label:'単語発見率',      unit:'%',  keywords:['Magic','Spell','Enchant','Mana','Rune','Echo']},
];

/* ════ DUNGEON FLOOR TIERS (Phase7: ダンジョン階層システム) ════ */
// Floor depth -> word rarity weighting + enemy strength multiplier (仮値)
// rarityWeight: relative selection weight per rarity at this tier (higher = more likely)
const FLOOR_TIERS=[
  {minFloor:1,  maxFloor:4,  label:'1-4F',   rarityWeight:{common:10,uncommon:3,rare:1,epic:0,legendary:0}, enemyMult:1.0},
  {minFloor:5,  maxFloor:9,  label:'5-9F',   rarityWeight:{common:6, uncommon:8,rare:3,epic:1,legendary:0}, enemyMult:1.3},
  {minFloor:10, maxFloor:19, label:'10-19F', rarityWeight:{common:3, uncommon:5,rare:8,epic:3,legendary:1}, enemyMult:1.7},
  {minFloor:20, maxFloor:20, label:'20F',    rarityWeight:{common:1, uncommon:2,rare:5,epic:8,legendary:5}, enemyMult:2.2},
];
function getFloorTier(floor){
  return FLOOR_TIERS.find(t=>floor>=t.minFloor&&floor<=t.maxFloor)||FLOOR_TIERS[0];
}

/* ════ ENEMIES (Phase8: 戦闘システム → Phase21: バランス調整で構成更新) ════ */
// Minimal enemy roster. def is derived simply from rarity for damage calc.
// detectBonus: 索敵距離への加算(例: コウモリは追跡距離+2)
const ENEMIES=[
  {id:'slime',  name:'Slime',  jp:'スライム', desc:'最も弱いモンスター。',     icon:'🟢', hp:10, atk:3, def:0, rarity:'common',    reward:{gold:5,  aexp:3}},
  {id:'bat',    name:'Bat',    jp:'コウモリ', desc:'素早く飛び回り、遠くからでも追ってくる。', icon:'🦇', hp:8,  atk:2, def:0, rarity:'uncommon',  reward:{gold:6,  aexp:4}, detectBonus:2},
  {id:'goblin', name:'Goblin', jp:'ゴブリン', desc:'武器を使う狡猾な小鬼。',     icon:'👺', hp:20, atk:5, def:1, rarity:'rare',      reward:{gold:12, aexp:8}},
  {id:'orc',    name:'Orc',    jp:'オーク',   desc:'力任せに殴りかかる大柄な魔物。', icon:'👹', hp:35, atk:8, def:2, rarity:'legendary', reward:{gold:25, aexp:15}},
  // Phase23: コンテンツ拡張で追加(将来15種類まで拡張可能な構造の一部)
  {id:'wolf',     name:'Wolf',     jp:'ウルフ',   desc:'群れで行動する俊敏な獣。',       icon:'🐺', hp:16, atk:7, def:0, rarity:'uncommon',  reward:{gold:13, aexp:9},  detectBonus:1},
  {id:'skeleton', name:'Skeleton', jp:'スケルトン', desc:'骨の鎧で硬さを増した不死者。',   icon:'💀', hp:22, atk:6, def:2, rarity:'rare',      reward:{gold:14, aexp:10}},
  {id:'zombie',   name:'Zombie',   jp:'ゾンビ',   desc:'動きは遅いが非常にしぶとい。',     icon:'🧟', hp:30, atk:5, def:1, rarity:'rare',      reward:{gold:14, aexp:11}},
  {id:'mage',     name:'Mage',     jp:'メイジ',   desc:'高い攻撃力を持つが防御は薄い魔術師。', icon:'🧙', hp:18, atk:9, def:0, rarity:'legendary', reward:{gold:18, aexp:13}},
];
// Phase21: 階層別の出現率テーブル(B1〜B3は仕様の通り固定)
// Phase23: B4以降を深度ブラケットに分け、新モンスター(ウルフ/スケルトン/ゾンビ/メイジ)を段階的に追加
function getEnemySpawnWeights(floor){
  if(floor===1)return {slime:100};
  if(floor===2)return {slime:70,bat:30};
  if(floor===3)return {slime:50,bat:30,goblin:20};
  if(floor<=6) return {slime:30,bat:20,goblin:25,orc:15,wolf:10};
  if(floor<=9) return {slime:15,bat:15,goblin:20,orc:20,wolf:15,skeleton:15};
  if(floor<=12)return {bat:10,goblin:15,orc:20,wolf:15,skeleton:20,zombie:20};
  if(floor<=16)return {goblin:10,orc:20,wolf:10,skeleton:20,zombie:20,mage:20};
  return {orc:15,wolf:5,skeleton:20,zombie:20,mage:40}; // B17〜B20: 最深部
}
// Pick an enemy appropriate for the current floor (Phase21: 階層別出現率テーブルに基づく抽選。
// HP/攻撃力は仕様の固定値のまま使用し、階層によるさらなる倍率補正は行わない)
function pickEnemyForFloor(floor){
  const weights=getEnemySpawnWeights(floor);
  const weighted=[];
  ENEMIES.forEach(e=>{
    const w=weights[e.id]||0;
    for(let i=0;i<w;i++)weighted.push(e);
  });
  if(!weighted.length)return {...ENEMIES[0]};
  return {...weighted[Math.floor(Math.random()*weighted.length)]};
}

/* ════ ITEMS (Phase10: 持ち物システム) ════
   type は将来のアーカイブ実装(weapon/archive等)を見据えた拡張可能な構造。
   MVPでは consumable(消費アイテム)のみ実装。 */
const ITEMS=[
  {id:'herb',      type:'consumable', name:'Herb',       jp:'薬草',   desc:'HPを20回復する',icon:'🌿', effect:{hp:20}},
  {id:'great_herb',type:'consumable', name:'Great Herb', jp:'上薬草', desc:'HPを50回復する',icon:'🍀', effect:{hp:50}},
  {id:'bread',     type:'consumable', name:'Bread',      jp:'パン',   desc:'HPを10回復する',icon:'🍞', effect:{hp:10}},
  // Phase23: コンテンツ拡張で追加
  {id:'big_herb',  type:'consumable', name:'Big Herb',   jp:'大薬草', desc:'HPを100回復する',icon:'🪴', effect:{hp:100}},
  {id:'antidote',  type:'consumable', name:'Antidote',   jp:'毒消し草', desc:'状態異常を解除する(状態異常システムは未実装)',icon:'🧪', effect:{cure:true}},
  {id:'fire_stone',type:'consumable', name:'Fire Stone', jp:'火炎石', desc:'隣接する敵に固定ダメージを与える',icon:'🔥', effect:{fireDmg:15}},

  /* ════ Phase26: 探索リワード刷新 ════
     ダンジョンの床ドロップに「装備品/鉱石/お金/アーカイブの欠片」を追加する。
     ・装備(weapon/shield/accessory): 装備すると永続的にステータスへ加算される。
       床ドロップ時にレアリティ(meta.rarity)を持ち、レアリティ係数で実効値が変動する。
       base は common時の値。実効値 = round(base * EQUIP_RARITY_MULT[rarity])。
     ・ore(鉱石): 将来のクラフト素材。消費・使用不可で持ち物に蓄積する。
     ・gold_pile(お金): 拾うと即Goldに変換される(持ち物枠を消費しない)。
     ・archive_shard(アーカイブの欠片): 素材として蓄積し、「解読」で1個消費して
       そのダンジョン固有(meta.dungeonId)の単語を1語発見する。 */
  {id:'eq_sword',   type:'weapon',     slot:'weapon',    name:'Sword',     jp:'剣',     desc:'攻撃力を上げる武器。',icon:'🗡️', base:{atk:3}},
  {id:'eq_axe',     type:'weapon',     slot:'weapon',    name:'Axe',       jp:'斧',     desc:'重く高い攻撃力を持つ武器。',icon:'🪓', base:{atk:4}},
  {id:'eq_spear',   type:'weapon',     slot:'weapon',    name:'Spear',     jp:'槍',     desc:'間合いの広い攻撃力重視の武器。',icon:'🔱', base:{atk:3}},
  {id:'eq_shield',  type:'shield',     slot:'shield',    name:'Shield',    jp:'盾',     desc:'防御力を上げる盾。',icon:'🛡️', base:{def:2}},
  {id:'eq_armor',   type:'shield',     slot:'shield',    name:'Armor',     jp:'鎧',     desc:'高い防御力を得られる鎧。',icon:'🥋', base:{def:3}},
  {id:'eq_ring',    type:'accessory',  slot:'accessory', name:'Ring',      jp:'指輪',   desc:'回復力を上げる装身具。',icon:'💍', base:{regen:1}},
  {id:'eq_amulet',  type:'accessory',  slot:'accessory', name:'Amulet',    jp:'護符',   desc:'最大HPを上げる装身具。',icon:'📿', base:{hp:8}},

  {id:'ore_iron',   type:'material',   name:'Iron Ore',  jp:'鉄鉱石', desc:'クラフト素材。鍛冶に使える鉄の鉱石。',icon:'⛏️'},
  {id:'ore_crystal',type:'material',   name:'Crystal Ore',jp:'水晶鉱石',desc:'クラフト素材。魔力を帯びた美しい鉱石。',icon:'💎'},
  {id:'ore_gold',   type:'material',   name:'Gold Ore',  jp:'金鉱石', desc:'クラフト素材。価値の高い金の鉱石。',icon:'🪙'},

  {id:'gold_pile',  type:'gold',       name:'Gold',      jp:'お金',   desc:'拾うと即座にGoldになる。',icon:'💰'},

  {id:'archive_shard',type:'shard',    name:'Archive Shard',jp:'アーカイブの欠片',desc:'失われた言葉の断片。解読すると、このダンジョンに眠る単語を1つ取り戻せる。',icon:'🔮'},
];
function getItemDef(id){return ITEMS.find(i=>i.id===id)}

/* ════ Phase26: 装備レアリティ係数 ════
   床ドロップした装備は meta.rarity を持ち、base値にこの係数を掛けた実効値で機能する。 */
const EQUIP_RARITY_MULT={common:1,uncommon:1.4,rare:1.8,epic:2.4,legendary:3};
// 装備の実効ステータスを返す。eq = {id, rarity}
function getEquipStats(eq){
  if(!eq)return {};
  const def=getItemDef(eq.id);
  if(!def||!def.base)return {};
  const mult=EQUIP_RARITY_MULT[eq.rarity]||1;
  const out={};
  for(const k in def.base)out[k]=Math.round(def.base[k]*mult);
  return out;
}
// 装備の表示名(レアリティ接頭辞つき)。例: "レアな剣"
function equipDisplayName(eq){
  if(!eq)return '';
  const def=getItemDef(eq.id);if(!def)return '';
  const rl=RLBL[eq.rarity]||'';
  return `${def.icon} ${def.jp}${rl?`(${rl})`:''}`;
}
// 装備のドロップ抽選用テーブル(床ドロップで使う)。スロット別に1種をランダム選択。
const EQUIP_BY_SLOT={
  weapon:['eq_sword','eq_axe','eq_spear'],
  shield:['eq_shield','eq_armor'],
  accessory:['eq_ring','eq_amulet'],
};

/* ════ POS COMBO / 単語構文システム (Phase9) ════ */
// スキル生成スロット定義 (Noun/Verb/Adjective/Adverb の4枠、空欄可)
const SKILL_SLOTS=[
  {pos:'noun',      label:'Noun',      jp:'名詞',   icon:'📦', role:'対象'},
  {pos:'verb',      label:'Verb',      jp:'動詞',   icon:'⚡', role:'行動'},
  {pos:'adjective', label:'Adjective', jp:'形容詞', icon:'💎', role:'強化'},
  {pos:'adverb',    label:'Adverb',    jp:'副詞',   icon:'🌀', role:'補助'},
];
// 名詞ボーナス: スキルの基本属性決定 (キーワード判定、仮値)
const ELEMENT_TABLE=[
  {element:'炎', icon:'🔥', keywords:['Fire','Flame','Blaze','Inferno','Burn','Heat','Spark','Ash','Smoke']},
  {element:'水', icon:'💧', keywords:['Water','Wave','Rain','River','Ice','Snow']},
  {element:'竜', icon:'🐉', keywords:['Dragon']},
  {element:'土', icon:'⛰️', keywords:['Stone','Mountain','Cave','Earth','Rock','Ore','Mine']},
  {element:'風', icon:'🌪️', keywords:['Wind','Sky','Storm','Thunder','Lightning']},
  {element:'闇', icon:'🌙', keywords:['Dark','Night','Ghost','Soul','Shadow']},
  {element:'光', icon:'☀️', keywords:['Light','Sun','Day','Holy']},
  {element:'魔', icon:'✨', keywords:['Magic','Spell','Mana','Rune','Enchant']},
];
function getElement(words){
  for(const w of words){if(!w)continue;
    for(const e of ELEMENT_TABLE){
      if(e.keywords.some(kw=>w.includes(kw)))return e;
    }
  }
  return null;
}
// 動詞ボーナス: 行動タイプ決定 (キーワード判定、仮値)
const ACTION_TABLE=[
  {action:'攻撃', icon:'⚔️', keywords:['Attack','Battle','Burn','Strike','Hit']},
  {action:'防御', icon:'🛡️', keywords:['Guard','Defend','Shield','Block']},
  {action:'生成', icon:'🔨', keywords:['Build','Craft','Forge','Make','Mine']},
  {action:'探索', icon:'🧭', keywords:['Search','Explore','Discover','Find']},
];
function getAction(words){
  for(const w of words){if(!w)continue;
    for(const a of ACTION_TABLE){
      if(a.keywords.some(kw=>w.includes(kw)))return a;
    }
  }
  return null;
}
// 形容詞ボーナス: 性能強化 (キーワード判定、仮値)
//  atkMult: ATKステータスへの乗算 / rareBonus: レア単語出現率加算 / effectMult: スキル効果(SKILL_EFFECT)への乗算
const ADJ_BONUS_TABLE=[
  {keywords:['Strong','Sharp'],  label:'ATK',     atkMult:0.5,  jp:'ATK +50%'},
  {keywords:['Ancient','Deep'],  label:'RARE',    rareBonus:0.10, jp:'レア単語出現率 +10%'},
  {keywords:['Magic','Cold'],    label:'EFFECT',  effectMult:0.5, jp:'効果量 +50%'},
];
function getAdjBonus(word){
  if(!word)return null;
  for(const e of ADJ_BONUS_TABLE){
    if(e.keywords.some(kw=>word.includes(kw)))return e;
  }
  return null;
}
// 副詞ボーナス: 挙動変化 (キーワード判定、仮値) — Phase9時点でWDに副詞は存在しないため将来拡張用
//  spdMult: SPDステータスへの乗算 / failReduction: 失敗率低下(探索イベント等) / rareDiscover: レア発見率増加
const ADV_BONUS_TABLE=[
  {keywords:['Quickly','Swift','Fast'],   label:'SPD',  spdMult:0.5,    jp:'速度 +50%'},
  {keywords:['Safely','Carefully'],       label:'SAFE', failReduction:0.10, jp:'失敗率 -10%'},
  {keywords:['Secretly','Quietly'],       label:'RAREDISC', rareDiscover:0.10, jp:'レア発見率 +10%'},
];
function getAdvBonus(word){
  if(!word)return null;
  for(const e of ADV_BONUS_TABLE){
    if(e.keywords.some(kw=>word.includes(kw)))return e;
  }
  return null;
}
// スキルランク: 使用単語数で変化 (レアリティとは別軸)
const SKILL_RANKS={2:{key:'common',jp:'Common Skill'},3:{key:'advanced',jp:'Advanced Skill'},4:{key:'master',jp:'Master Skill'}};
function getSkillRank(wordCount){return SKILL_RANKS[wordCount]||SKILL_RANKS[2]}
