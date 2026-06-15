// ArchiveData.js
// 単語アーカイブのグラフデータ(ノード/リンク)
// データ構造: { nodes: [{id, label, japanese, wordType, category, mastery, nodeType, status?}], links: [{source, target, relation}] }
// nodeType: 'core' | 'hub' | 'word'
// 階層: core(Adventure) -> hub(Fire/Water/Earth/Wind/Search/Trade) -> word(第2階層:related) -> word(第3階層:related/synonym)
// status (nodeType:'word'のみ): 'unknown' | 'discovered' | 'learning' | 'mastered'

const ArchiveData = {
  "nodes": [
    {
      "id": "adventure",
      "label": "Adventure",
      "japanese": "冒険",
      "wordType": "",
      "category": "",
      "mastery": 0,
      "nodeType": "core"
    },
    {
      "id": "fire",
      "label": "Fire",
      "japanese": "火",
      "wordType": "noun",
      "category": "Fire",
      "mastery": 0,
      "nodeType": "hub"
    },
    {
      "id": "burn",
      "label": "Burn",
      "japanese": "燃える・焼く",
      "wordType": "verb",
      "category": "Fire",
      "mastery": 0,
      "nodeType": "word",
      "status": "unknown"
    },
    {
      "id": "heat",
      "label": "Heat",
      "japanese": "熱・温める",
      "wordType": "noun",
      "category": "Fire",
      "mastery": 0,
      "nodeType": "word",
      "status": "unknown"
    },
    {
      "id": "smoke",
      "label": "Smoke",
      "japanese": "煙",
      "wordType": "noun",
      "category": "Fire",
      "mastery": 0,
      "nodeType": "word",
      "status": "unknown"
    },
    {
      "id": "ash",
      "label": "Ash",
      "japanese": "灰",
      "wordType": "noun",
      "category": "Fire",
      "mastery": 0,
      "nodeType": "word",
      "status": "unknown"
    },
    {
      "id": "spark",
      "label": "Spark",
      "japanese": "火花・きっかけ",
      "wordType": "noun",
      "category": "Fire",
      "mastery": 0,
      "nodeType": "word",
      "status": "unknown"
    },
    {
      "id": "flame",
      "label": "Flame",
      "japanese": "炎",
      "wordType": "noun",
      "category": "Fire",
      "mastery": 0,
      "nodeType": "word",
      "status": "unknown"
    },
    {
      "id": "dark",
      "label": "Dark",
      "japanese": "暗い・闇",
      "wordType": "adjective",
      "category": "Fire",
      "mastery": 0,
      "nodeType": "word",
      "status": "unknown"
    },
    {
      "id": "light",
      "label": "Light",
      "japanese": "光・明かり",
      "wordType": "noun",
      "category": "Fire",
      "mastery": 0,
      "nodeType": "word",
      "status": "unknown"
    },
    {
      "id": "water",
      "label": "Water",
      "japanese": "水",
      "wordType": "noun",
      "category": "Water",
      "mastery": 0,
      "nodeType": "hub"
    },
    {
      "id": "wave",
      "label": "Wave",
      "japanese": "波",
      "wordType": "noun",
      "category": "Water",
      "mastery": 0,
      "nodeType": "word",
      "status": "unknown"
    },
    {
      "id": "river",
      "label": "River",
      "japanese": "川・河川",
      "wordType": "noun",
      "category": "Water",
      "mastery": 0,
      "nodeType": "word",
      "status": "unknown"
    },
    {
      "id": "earth",
      "label": "Earth",
      "japanese": "土・地球",
      "wordType": "noun",
      "category": "Earth",
      "mastery": 0,
      "nodeType": "hub"
    },
    {
      "id": "wind",
      "label": "Wind",
      "japanese": "風",
      "wordType": "noun",
      "category": "Wind",
      "mastery": 0,
      "nodeType": "hub"
    },
    {
      "id": "storm",
      "label": "Storm",
      "japanese": "嵐・暴風",
      "wordType": "noun",
      "category": "Wind",
      "mastery": 0,
      "nodeType": "word",
      "status": "unknown"
    },
    {
      "id": "thunder",
      "label": "Thunder",
      "japanese": "雷・雷鳴",
      "wordType": "noun",
      "category": "Wind",
      "mastery": 0,
      "nodeType": "word",
      "status": "unknown"
    },
    {
      "id": "lightning",
      "label": "Lightning",
      "japanese": "稲妻",
      "wordType": "noun",
      "category": "Wind",
      "mastery": 0,
      "nodeType": "word",
      "status": "unknown"
    },
    {
      "id": "search",
      "label": "Search",
      "japanese": "探す・調べる",
      "wordType": "verb",
      "category": "Search",
      "mastery": 0,
      "nodeType": "hub"
    },
    {
      "id": "explore",
      "label": "Explore",
      "japanese": "探索する",
      "wordType": "verb",
      "category": "Search",
      "mastery": 0,
      "nodeType": "word",
      "status": "unknown"
    },
    {
      "id": "discover",
      "label": "Discover",
      "japanese": "発見する",
      "wordType": "verb",
      "category": "Search",
      "mastery": 0,
      "nodeType": "word",
      "status": "unknown"
    },
    {
      "id": "map",
      "label": "Map",
      "japanese": "地図",
      "wordType": "noun",
      "category": "Search",
      "mastery": 0,
      "nodeType": "word",
      "status": "unknown"
    },
    {
      "id": "trade",
      "label": "Trade",
      "japanese": "取引・交換する",
      "wordType": "noun",
      "category": "Trade",
      "mastery": 0,
      "nodeType": "hub"
    },
    {
      "id": "merchant",
      "label": "Merchant",
      "japanese": "商人",
      "wordType": "noun",
      "category": "Trade",
      "mastery": 0,
      "nodeType": "word",
      "status": "unknown"
    },
    {
      "id": "market",
      "label": "Market",
      "japanese": "市場",
      "wordType": "noun",
      "category": "Trade",
      "mastery": 0,
      "nodeType": "word",
      "status": "unknown"
    },
    {
      "id": "buy",
      "label": "Buy",
      "japanese": "買う",
      "wordType": "verb",
      "category": "Trade",
      "mastery": 0,
      "nodeType": "word",
      "status": "unknown"
    },
    {
      "id": "sell",
      "label": "Sell",
      "japanese": "売る",
      "wordType": "verb",
      "category": "Trade",
      "mastery": 0,
      "nodeType": "word",
      "status": "unknown"
    },
    {
      "id": "price",
      "label": "Price",
      "japanese": "値段",
      "wordType": "noun",
      "category": "Trade",
      "mastery": 0,
      "nodeType": "word",
      "status": "unknown"
    }
  ],
  "links": [
    {
      "source": "adventure",
      "target": "fire",
      "relation": "category"
    },
    {
      "source": "fire",
      "target": "burn",
      "relation": "related"
    },
    {
      "source": "fire",
      "target": "heat",
      "relation": "related"
    },
    {
      "source": "fire",
      "target": "smoke",
      "relation": "related"
    },
    {
      "source": "fire",
      "target": "ash",
      "relation": "related"
    },
    {
      "source": "fire",
      "target": "spark",
      "relation": "related"
    },
    {
      "source": "burn",
      "target": "flame",
      "relation": "related"
    },
    {
      "source": "smoke",
      "target": "dark",
      "relation": "related"
    },
    {
      "source": "spark",
      "target": "light",
      "relation": "related"
    },
    {
      "source": "adventure",
      "target": "water",
      "relation": "category"
    },
    {
      "source": "water",
      "target": "wave",
      "relation": "related"
    },
    {
      "source": "water",
      "target": "river",
      "relation": "related"
    },
    {
      "source": "adventure",
      "target": "earth",
      "relation": "category"
    },
    {
      "source": "adventure",
      "target": "wind",
      "relation": "category"
    },
    {
      "source": "wind",
      "target": "storm",
      "relation": "related"
    },
    {
      "source": "storm",
      "target": "thunder",
      "relation": "related"
    },
    {
      "source": "storm",
      "target": "lightning",
      "relation": "related"
    },
    {
      "source": "adventure",
      "target": "search",
      "relation": "category"
    },
    {
      "source": "search",
      "target": "explore",
      "relation": "related"
    },
    {
      "source": "explore",
      "target": "discover",
      "relation": "related"
    },
    {
      "source": "explore",
      "target": "map",
      "relation": "related"
    },
    {
      "source": "adventure",
      "target": "trade",
      "relation": "category"
    },
    {
      "source": "trade",
      "target": "merchant",
      "relation": "related"
    },
    {
      "source": "trade",
      "target": "market",
      "relation": "related"
    },
    {
      "source": "market",
      "target": "buy",
      "relation": "related"
    },
    {
      "source": "market",
      "target": "sell",
      "relation": "related"
    },
    {
      "source": "market",
      "target": "price",
      "relation": "related"
    }
  ]
};

// ブラウザ/モジュール両対応エクスポート
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ArchiveData;
}
