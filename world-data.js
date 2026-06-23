/* ════════════════════════════════════════════════════════════════════
   WORLD DATA — オーバーワールドのマップ定義 (Phase W2)

   ── 方針 ──
   メモリの運用に合わせ、外部JSON(fetch)ではなく var 定義の script として持つ。
   GitHub Web UI(iPhone)で直接編集でき、CORS/キャッシュ/非同期initの罠を回避。
   将来マップが増えたら WORLD_MAPS に追加するだけで多マップ化できる構造。

   ── タイル凡例(WORLD_LEGEND の1文字 → タイルID) ──
     . 草地(歩ける)    , 道(歩ける)     ~ 浅瀬(歩ける/砂)
     W 海(壁)          T 森(壁)         M 山(壁)
   ── 地点(spots) ──
     type:'dungeon' は data.js の DD.id に紐付く(侵入でopenDmap)。
     type:'town'    は W2ではマーカー表示のみ(侵入で「準備中」通知)。

   ── マップ寸法 ──
   32×32。画面より広く、自キャラ中央固定でスクロールして探索する。
════════════════════════════════════════════════════════════════════ */

/* タイルID(world.jsのWLD_Tと一致させる) */
var WLD_T = { GRASS:0, WATER:1, FOREST:2, MOUNT:3, ROAD:4, SAND:5, HOUSE:6, FLOOR:7 };
var WLD_WALK = {0:true,1:false,2:false,3:false,4:true,5:true,6:false,7:true};
var WLD_COL  = {0:'#3f7a3a',1:'#2f6fb0',2:'#234d27',3:'#7d7264',4:'#c2a060',5:'#cdb87a',6:'#6b4a34',7:'#b9a888'};

/* 文字 → タイルID */
var WLD_LEGEND = { '.':WLD_T.GRASS, ',':WLD_T.ROAD, '~':WLD_T.SAND, 'W':WLD_T.WATER, 'T':WLD_T.FOREST, 'M':WLD_T.MOUNT,
                   'H':WLD_T.HOUSE, 'P':WLD_T.FLOOR, 'B':WLD_T.SAND };

/* 32列 × 32行。海で囲まれた一つの大陸。道(,)が拠点を結ぶ。 */
var WLD_OVERWORLD = {
  id:'overworld',
  name:'記憶の大陸',
  start:{x:16,y:24},   // 開始地点(草原・港町の近く)
  rows:[
    "WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW",
    "WWWWWMMMMWWWWWWWWWWWWWWWWWWWWWWW",
    "WWWMMMMMMMWWWWWWWTTTTWWWWWWWWWWW",
    "WWMMMMMMMM~~WWWWTTTTTTWWWWWWWWWW",
    "WWMMMMMMM~..~WWTTTT.TTTWWWWWWWWW",
    "WW~MMMMM~....~TTTT...TTTTWWWWWWW",
    "WWW~~~~~......TTT..,..TTWWWWWWWW",
    "WWWWW.........,,,,,...TTWWWWWWWW",
    "WWWWW....TT...,...,...~~WWWWWWWW",
    "WWWW....TTTT..,...,.....WWWWWWWW",
    "WWW....TTTT...,...,......WWWWWWW",
    "WWW.........,,,,,,,,,,...WWWWWWW",
    "WWW........,........,....WWWWWWW",
    "WWWW......,.........,...~WWWWWWW",
    "WWWWW....,..........,..~WWWWWWWW",
    "WWWWW...,...........,.~WWWWWWWWW",
    "WWWW...,...MMM......,.WWWWWWWWWW",
    "WWWW..,...MMMMM.....,.~WWWWWWWWW",
    "WWWW.,....MMMMM......,..WWWWWWWW",
    "WWWW,......MMM.......,...WWWWWWW",
    "WWW,,,,,,...........,,,..WWWWWWW",
    "WWW.......,,,,,,,,,,,...~WWWWWWW",
    "WWWW.........,.....,...~WWWWWWWW",
    "WWWW~.......,......,..~~WWWWWWWW",
    "WWWWW~~....,.......,.~~WWWWWWWWW",
    "WWWWWW~~..,.......,~~~WWWWWWWWWW",
    "WWWWWWW~~,.......~~~WWWWWWWWWWWW",
    "WWWWWWWW~~~~~~~~~~~WWWWWWWWWWWWW",
    "WWWWWWWWWWW~~~~~WWWWWWWWWWWWWWWW",
    "WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW",
    "WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW",
    "WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW"
  ],
  spots:[
    // ダンジョン入口(DD.idに紐付く)。地形テーマに合わせて配置。
    { gx:6,  gy:6,  type:'dungeon', id:'beginner_cave',  name:'Beginner Cave',  icon:'🕳' }, // 山麓の洞窟
    { gx:18, gy:5,  type:'dungeon', id:'fire_tower',     name:'Fire Tower',     icon:'🔥' }, // 森を貫く道沿い
    { gx:16, gy:11, type:'dungeon', id:'merchant_guild', name:'Merchant Guild', icon:'🏛' }, // 道の交差点
    // 町(W3でマップ化)。to で遷移先の町マップIDを指定。
    { gx:16, gy:24, type:'town',    id:'port_town',      name:'はじまりの港町', icon:'🏠', to:'town_port' },
    { gx:9,  gy:20, type:'town',    id:'west_village',   name:'西の村',         icon:'🏘', to:'town_west' }
  ]
};

/* ════════ 町: はじまりの港町 (16×14) ════════
   凡例追加: 'H'=家/建物(壁), 'B'=橋・床(歩ける道扱い), 'P'=石畳(歩ける)。
   外周は建物・海で囲み、下辺中央に出口(フィールドへ戻る)。 */
var WLD_TOWN_PORT = {
  id:'town_port',
  name:'はじまりの港町',
  isTown:true,
  start:{x:8,y:11},          // 出口のすぐ内側
  rows:[
    "WWWWWWWWWWWWWWWW",
    "WHHHHWPPPPWHHHHW",
    "WHHHHWPPPPWHHHHW",
    "WHHHHPPPPPPHHHHW",
    "WPPPPPPPPPPPPPPW",
    "WPPHHPPPPPPHHPPW",
    "WPPHHPPPPPPHHPPW",
    "WPPPPPP,,PPPPPPW",
    "WPPPPPP,,PPPPPPW",
    "WHHPPPP,,PPPPHHW",
    "WHHPPPP,,PPPPHHW",
    "WPPPPPP,,PPPPPPW",
    "WPPPPPP,,PPPPPPW",
    "WWWWWWW,,WWWWWWW"
  ],
  spots:[
    { gx:7, gy:13, type:'exit', name:'港町を出る' },
    { gx:8, gy:13, type:'exit', name:'港町を出る' },
    { gx:4, gy:4, type:'npc', icon:'🧓', name:'長老',
      lines:['ようこそ、はじまりの港町へ。','この世界は霧に覆われ、言葉が失われつつある。','語彙を取り戻し、世界を修復しておくれ。'] },
    { gx:11, gy:4, type:'npc', icon:'🧑‍🌾', name:'漁師',
      lines:['東の森には炎の塔がそびえている。','熱い言葉が眠っているという噂だ。'] },
    { gx:3, gy:9, type:'npc', icon:'🐱', name:'みならい猫',
      lines:['にゃー。','（メニューの図鑑で、覚えた言葉を確認できるよ）'] }
  ]
};

/* ════════ 町: 西の村 (14×12) ════════ */
var WLD_TOWN_WEST = {
  id:'town_west',
  name:'西の村',
  isTown:true,
  start:{x:7,y:9},
  rows:[
    "WWWWWWWWWWWWWW",
    "WTTPPPPPPTTTTW",
    "WTTPPPPPPTTTTW",
    "WPPPPPPPPPPPPW",
    "WPPHHPPPPHHPPW",
    "WPPHHPPPPHHPPW",
    "WPPPP,,,,PPPPW",
    "WPPPP,,,,PPPPW",
    "WPPPP,,,,PPPPW",
    "WPPPP,,,,PPPPW",
    "WHHPP,,,,PPHHW",
    "WWWWWW,,WWWWWW"
  ],
  spots:[
    { gx:6, gy:11, type:'exit', name:'西の村を出る' },
    { gx:7, gy:11, type:'exit', name:'西の村を出る' },
    { gx:3, gy:4, type:'npc', icon:'👩‍🍳', name:'宿屋の女将',
      lines:['お疲れさま。ゆっくりしていってね。','言葉を集める旅は大変でしょう。'] },
    { gx:10, gy:4, type:'npc', icon:'🧙', name:'もの知り',
      lines:['同じ言葉を何度も思い出すと、','記憶の盤に深く刻まれていく。','焦らず繰り返すことだ。'] }
  ]
};

/* 利用可能マップ一覧 */
var WORLD_MAPS = { overworld: WLD_OVERWORLD, town_port: WLD_TOWN_PORT, town_west: WLD_TOWN_WEST };
