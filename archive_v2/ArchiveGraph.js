// ArchiveGraph.js
// Phase1: データ構造の表示エンジンのみ
// 役割: ArchiveDataの nodes/links を SVG上にグラフとして描画する
//
// 提供機能:
//  1. ノード表示 (circle + text)
//  2. 接続線表示 (line)
//  3. ズーム (マウスホイール)
//  4. パン移動 (ドラッグ)
//  5. ノードクリックイベント (コールバック呼び出しのみ)
//
// 禁止事項により実装しないもの:
//  - UI装飾(色分け、グラデーション、ホバー演出 等)
//  - アニメーション(トランジション、イージング 等)
//  - 詳細パネル
//  - カテゴリフィルタ

class ArchiveGraph {
  /**
   * @param {string} containerId - グラフを描画するDOM要素のid
   * @param {{nodes: Array, links: Array}} data - ArchiveData形式のデータ
   * @param {Object} [options]
   * @param {Function} [options.onNodeClick] - ノードクリック時に呼ばれるコールバック (node) => void
   * @param {number} [options.width] - SVG表示幅 (デフォルト: コンテナ幅)
   * @param {number} [options.height] - SVG表示高さ (デフォルト: コンテナ高さ)
   */
  constructor(containerId, data, options = {}) {
    this.container = document.getElementById(containerId);
    if (!this.container) {
      throw new Error(`ArchiveGraph: container element "${containerId}" not found`);
    }

    this.data = data;
    this.onNodeClick = options.onNodeClick || null;

    this.width = options.width || this.container.clientWidth || 800;
    this.height = options.height || this.container.clientHeight || 600;

    // ビューボックス状態 (パン・ズーム用)
    this.viewBox = {
      x: 0,
      y: 0,
      w: this.width,
      h: this.height
    };

    // ドラッグ(パン)状態
    this._isPanning = false;
    this._panStart = { x: 0, y: 0 };
    this._viewBoxStart = { x: 0, y: 0 };

    // ノード座標マップ id -> {x, y}
    this.positions = {};

    this._init();
  }

  // ----------------------------------------------------------------
  // 初期化
  // ----------------------------------------------------------------
  _init() {
    this._computeLayout();
    this._createSVG();
    this._renderLinks();
    this._renderNodes();
    this._bindZoomAndPan();
  }

  // ----------------------------------------------------------------
  // レイアウト計算 (hubクラスタ配置)
  // 階層構造: core(中心) -> hub(中間円) -> word(第2階層) -> word(第3階層)
  //
  // 各hubを中心とする扇状クラスタを形成する:
  //  - core : 中心
  //  - hub  : 中間円上に等間隔配置
  //  - word(第2階層, hub->word relation) : 対応するhubの外側、
  //         hub方向を中心とした扇状に配置
  //  - word(第3階層, 第2階層word->word relation) : さらに外側、
  //         対応する第2階層wordの方向を中心とした扇状に配置
  //
  // 旧データ(nodeType:"category"を使う構造)との互換性のため、
  // hubノードが存在しない場合は旧Phase3の同心円配置にフォールバックする。
  //
  // 装飾目的ではなく、ノードが重ならず表示できるようにするための
  // 最小限の座標計算のみ。
  // ----------------------------------------------------------------
  _computeLayout() {
    const nodes = this.data.nodes;
    const links = this.data.links;

    const cx = this.width / 2;
    const cy = this.height / 2;
    const maxRadius = Math.min(this.width, this.height) / 2 - 40;

    const coreNodes = nodes.filter((n) => n.nodeType === "core");
    const hubNodes = nodes.filter((n) => n.nodeType === "hub");
    const categoryNodes = nodes.filter((n) => n.nodeType === "category");
    const wordNodes = nodes.filter((n) => n.nodeType === "word");

    // --- フォールバック1: nodeType情報が一切ない既存データ(Phase1相当) ---
    if (hubNodes.length === 0 && categoryNodes.length === 0 && wordNodes.length === 0) {
      const count = nodes.length;
      nodes.forEach((node, i) => {
        const angle = (2 * Math.PI * i) / count;
        const x = cx + maxRadius * Math.cos(angle);
        const y = cy + maxRadius * Math.sin(angle);
        this.positions[node.id] = { x, y };
      });
      return;
    }

    // --- フォールバック2: hubノードが無い(Phase3相当: category構造) ---
    if (hubNodes.length === 0) {
      this._computeLayoutCategoryStyle(nodes, links, cx, cy, maxRadius, coreNodes, categoryNodes, wordNodes);
      return;
    }

    // --- core: 中心 ---
    coreNodes.forEach((node) => {
      this.positions[node.id] = { x: cx, y: cy };
    });

    // --- hub: 中間円 ---
    const hubRadius = maxRadius * 0.35;
    const hubAngleStep = (2 * Math.PI) / Math.max(hubNodes.length, 1);
    const hubAngles = {};

    hubNodes.forEach((node, i) => {
      const angle = hubAngleStep * i;
      hubAngles[node.id] = angle;

      const x = cx + hubRadius * Math.cos(angle);
      const y = cy + hubRadius * Math.sin(angle);
      this.positions[node.id] = { x, y };
    });

    // hub間の角度幅(自分のhub角度を中心に、隣接hubとの中間まで広げる)
    const hubArcWidth = hubAngleStep * 0.9;

    // hub -> word(第2階層) の関係抽出
    // (relation: "related" または "synonym" で、sourceがhub)
    const hubIdSet = new Set(hubNodes.map((n) => n.id));
    const tier2ByHub = {};
    hubNodes.forEach((h) => {
      tier2ByHub[h.id] = [];
    });

    links.forEach((link) => {
      if (hubIdSet.has(link.source)) {
        tier2ByHub[link.source].push(link.target);
      }
    });

    // 第2階層: 各hubの外側に扇状配置
    const tier2Radius = maxRadius * 0.65;
    const tier2Angles = {}; // wordId -> angle

    hubNodes.forEach((hubNode) => {
      const baseAngle = hubAngles[hubNode.id];
      const tier2Ids = tier2ByHub[hubNode.id];
      const count = tier2Ids.length;

      tier2Ids.forEach((wordId, i) => {
        let angle;
        if (count === 1) {
          angle = baseAngle;
        } else {
          const t = i / (count - 1); // 0..1
          angle = baseAngle - hubArcWidth / 2 + hubArcWidth * t;
        }
        tier2Angles[wordId] = angle;

        const x = cx + tier2Radius * Math.cos(angle);
        const y = cy + tier2Radius * Math.sin(angle);
        this.positions[wordId] = { x, y };
      });
    });

    // 第2階層 -> 第3階層 の関係抽出
    const tier2IdSet = new Set(Object.keys(tier2Angles));
    const tier3ByTier2 = {};
    tier2IdSet.forEach((id) => {
      tier3ByTier2[id] = [];
    });

    links.forEach((link) => {
      if (tier2IdSet.has(link.source) && !this.positions[link.target]) {
        tier3ByTier2[link.source].push(link.target);
      }
    });

    // 第3階層: 各第2階層wordの外側に扇状配置
    const tier3Radius = maxRadius;
    const tier3ArcWidth = hubArcWidth * 0.5;

    tier2IdSet.forEach((tier2Id) => {
      const baseAngle = tier2Angles[tier2Id];
      const tier3Ids = tier3ByTier2[tier2Id];
      const count = tier3Ids.length;

      tier3Ids.forEach((wordId, i) => {
        let angle;
        if (count === 1) {
          angle = baseAngle;
        } else {
          const t = i / (count - 1); // 0..1
          angle = baseAngle - tier3ArcWidth / 2 + tier3ArcWidth * t;
        }

        const x = cx + tier3Radius * Math.cos(angle);
        const y = cy + tier3Radius * Math.sin(angle);
        this.positions[wordId] = { x, y };
      });
    });

    // 上記いずれにも属さないword(孤立ノード)は、最外周に均等配置するフォールバック
    const unplacedWords = wordNodes.filter((n) => !this.positions[n.id]);
    if (unplacedWords.length > 0) {
      const step = (2 * Math.PI) / unplacedWords.length;
      unplacedWords.forEach((node, i) => {
        const angle = step * i;
        const x = cx + tier3Radius * Math.cos(angle);
        const y = cy + tier3Radius * Math.sin(angle);
        this.positions[node.id] = { x, y };
      });
    }
  }

  // ----------------------------------------------------------------
  // Phase3互換レイアウト(category構造)
  // hubノードが存在しない旧データ向けのフォールバック。
  // ----------------------------------------------------------------
  _computeLayoutCategoryStyle(nodes, links, cx, cy, maxRadius, coreNodes, categoryNodes, wordNodes) {
    // --- core: 中心 ---
    coreNodes.forEach((node) => {
      this.positions[node.id] = { x: cx, y: cy };
    });

    // --- category: 中間円 ---
    const categoryRadius = maxRadius * 0.4;
    const categoryAngleStep = (2 * Math.PI) / Math.max(categoryNodes.length, 1);
    const categoryAngles = {};

    categoryNodes.forEach((node, i) => {
      const angle = categoryAngleStep * i;
      categoryAngles[node.id] = angle;

      const x = cx + categoryRadius * Math.cos(angle);
      const y = cy + categoryRadius * Math.sin(angle);
      this.positions[node.id] = { x, y };
    });

    // --- word: 各categoryの周囲(外周) ---
    const wordRadius = maxRadius;

    const wordsByCategory = {};
    categoryNodes.forEach((c) => {
      wordsByCategory[c.id] = [];
    });

    links.forEach((link) => {
      if (link.relation === "belongs_to" && wordsByCategory[link.source]) {
        wordsByCategory[link.source].push(link.target);
      }
    });

    const arcWidth = categoryAngleStep * 0.9;

    categoryNodes.forEach((catNode) => {
      const baseAngle = categoryAngles[catNode.id];
      const wordIds = wordsByCategory[catNode.id];
      const wCount = wordIds.length;

      wordIds.forEach((wordId, i) => {
        let angle;
        if (wCount === 1) {
          angle = baseAngle;
        } else {
          const t = i / (wCount - 1);
          angle = baseAngle - arcWidth / 2 + arcWidth * t;
        }

        const x = cx + wordRadius * Math.cos(angle);
        const y = cy + wordRadius * Math.sin(angle);
        this.positions[wordId] = { x, y };
      });
    });

    const unplacedWords = wordNodes.filter((n) => !this.positions[n.id]);
    if (unplacedWords.length > 0) {
      const step = (2 * Math.PI) / unplacedWords.length;
      unplacedWords.forEach((node, i) => {
        const angle = step * i;
        const x = cx + wordRadius * Math.cos(angle);
        const y = cy + wordRadius * Math.sin(angle);
        this.positions[node.id] = { x, y };
      });
    }
  }

  // ----------------------------------------------------------------
  // SVG要素の作成
  // ----------------------------------------------------------------
  _createSVG() {
    const svgNS = "http://www.w3.org/2000/svg";

    this.svg = document.createElementNS(svgNS, "svg");
    this.svg.setAttribute("width", "100%");
    this.svg.setAttribute("height", "100%");
    this.svg.setAttribute(
      "viewBox",
      `${this.viewBox.x} ${this.viewBox.y} ${this.viewBox.w} ${this.viewBox.h}`
    );
    this.svg.style.display = "block";

    // リンク用とノード用のグループを分ける(描画順制御のみ)
    this.linkGroup = document.createElementNS(svgNS, "g");
    this.linkGroup.setAttribute("id", "archive-links");

    this.nodeGroup = document.createElementNS(svgNS, "g");
    this.nodeGroup.setAttribute("id", "archive-nodes");

    this.svg.appendChild(this.linkGroup);
    this.svg.appendChild(this.nodeGroup);

    this.container.innerHTML = "";
    this.container.appendChild(this.svg);
  }

  // ----------------------------------------------------------------
  // 接続線の描画
  // ----------------------------------------------------------------
  _renderLinks() {
    const svgNS = "http://www.w3.org/2000/svg";

    // id -> node のマップ(カテゴリ判定用)
    const nodeById = {};
    this.data.nodes.forEach((n) => {
      nodeById[n.id] = n;
    });

    this.data.links.forEach((link) => {
      const sourcePos = this.positions[link.source];
      const targetPos = this.positions[link.target];

      if (!sourcePos || !targetPos) {
        // 対応するノードが存在しない場合は描画しない
        return;
      }

      const sourceNode = nodeById[link.source];
      const targetNode = nodeById[link.target];

      const line = document.createElementNS(svgNS, "line");
      line.setAttribute("x1", sourcePos.x);
      line.setAttribute("y1", sourcePos.y);
      line.setAttribute("x2", targetPos.x);
      line.setAttribute("y2", targetPos.y);
      line.setAttribute("stroke", "#999999");
      line.setAttribute("stroke-width", "1");
      line.setAttribute("data-relation", link.relation || "");
      line.setAttribute("data-source", link.source);
      line.setAttribute("data-target", link.target);
      line.setAttribute("data-source-category", (sourceNode && sourceNode.category) || "");
      line.setAttribute("data-target-category", (targetNode && targetNode.category) || "");

      this.linkGroup.appendChild(line);
    });
  }

  // ----------------------------------------------------------------
  // ノードの描画
  // ----------------------------------------------------------------
  _renderNodes() {
    const svgNS = "http://www.w3.org/2000/svg";
    const nodeRadius = 6;

    this.data.nodes.forEach((node) => {
      const pos = this.positions[node.id];
      if (!pos) return;

      // ノード全体をまとめるグループ
      const g = document.createElementNS(svgNS, "g");
      g.setAttribute("data-id", node.id);
      g.setAttribute("data-category", node.category || "");
      g.setAttribute("data-node-type", node.nodeType || "");
      g.style.cursor = "pointer";

      // 円
      const circle = document.createElementNS(svgNS, "circle");
      circle.setAttribute("cx", pos.x);
      circle.setAttribute("cy", pos.y);
      circle.setAttribute("r", nodeRadius);
      circle.setAttribute("fill", "#cccccc");
      circle.setAttribute("stroke", "#333333");
      circle.setAttribute("stroke-width", "1");

      // ラベル
      const text = document.createElementNS(svgNS, "text");
      text.setAttribute("x", pos.x);
      text.setAttribute("y", pos.y - nodeRadius - 4);
      text.setAttribute("text-anchor", "middle");
      text.setAttribute("font-size", "10");
      text.setAttribute("fill", "#000000");
      // 学習状態が "unknown" の word ノードは "???" 表示にする
      text.textContent = (node.nodeType === "word" && node.status === "unknown")
        ? "???"
        : node.label;

      g.appendChild(circle);
      g.appendChild(text);

      // クリックイベント
      g.addEventListener("click", (e) => {
        e.stopPropagation();
        if (typeof this.onNodeClick === "function") {
          this.onNodeClick(node);
        }
      });

      this.nodeGroup.appendChild(g);
    });
  }

  // ----------------------------------------------------------------
  // ズーム・パンのイベントバインド
  // ----------------------------------------------------------------
  _bindZoomAndPan() {
    // ズーム (マウスホイール)
    this.svg.addEventListener("wheel", (e) => {
      e.preventDefault();

      const scaleFactor = e.deltaY > 0 ? 1.1 : 0.9;

      const newW = this.viewBox.w * scaleFactor;
      const newH = this.viewBox.h * scaleFactor;

      // マウス位置を中心にズームするための座標補正
      const rect = this.svg.getBoundingClientRect();
      const mouseXRatio = (e.clientX - rect.left) / rect.width;
      const mouseYRatio = (e.clientY - rect.top) / rect.height;

      const dx = (this.viewBox.w - newW) * mouseXRatio;
      const dy = (this.viewBox.h - newH) * mouseYRatio;

      this.viewBox.x += dx;
      this.viewBox.y += dy;
      this.viewBox.w = newW;
      this.viewBox.h = newH;

      this._updateViewBox();
    });

    // パン (ドラッグ)
    this.svg.addEventListener("mousedown", (e) => {
      this._isPanning = true;
      this._panStart = { x: e.clientX, y: e.clientY };
      this._viewBoxStart = { x: this.viewBox.x, y: this.viewBox.y };
    });

    window.addEventListener("mousemove", (e) => {
      if (!this._isPanning) return;

      const rect = this.svg.getBoundingClientRect();
      const scaleX = this.viewBox.w / rect.width;
      const scaleY = this.viewBox.h / rect.height;

      const dx = (e.clientX - this._panStart.x) * scaleX;
      const dy = (e.clientY - this._panStart.y) * scaleY;

      this.viewBox.x = this._viewBoxStart.x - dx;
      this.viewBox.y = this._viewBoxStart.y - dy;

      this._updateViewBox();
    });

    window.addEventListener("mouseup", () => {
      this._isPanning = false;
    });
  }

  // ----------------------------------------------------------------
  // viewBox属性の反映
  // ----------------------------------------------------------------
  _updateViewBox() {
    this.svg.setAttribute(
      "viewBox",
      `${this.viewBox.x} ${this.viewBox.y} ${this.viewBox.w} ${this.viewBox.h}`
    );
  }

  // ----------------------------------------------------------------
  // カテゴリフィルタ
  // 指定したカテゴリ集合に該当するノード/リンクのみ表示する。
  // 再描画・再レイアウトは行わず、display切り替えのみ。
  //
  // @param {string[]} categories - 表示するカテゴリ名の配列。
  //                                 空配列、またはnull/undefinedの場合は全件表示。
  //
  // 表示ルール:
  //  - nodeType "core" は常に表示
  //  - nodeType "category" は categories に含まれる場合のみ表示
  //  - nodeType "word" は node.category が categories に含まれる場合のみ表示
  //  - link は source/target 双方が表示状態の場合のみ表示
  // ----------------------------------------------------------------
  setVisibleCategories(categories) {
    const showAll = !categories || categories.length === 0;
    const categorySet = new Set(categories || []);

    // id -> 表示状態
    const visibleNodeIds = new Set();

    const nodeGroups = this.nodeGroup.querySelectorAll("g[data-id]");
    nodeGroups.forEach((g) => {
      const id = g.getAttribute("data-id");
      const nodeType = g.getAttribute("data-node-type");
      const category = g.getAttribute("data-category");

      let visible;
      if (showAll) {
        visible = true;
      } else if (nodeType === "core") {
        visible = true;
      } else {
        visible = categorySet.has(category);
      }

      g.style.display = visible ? "" : "none";
      if (visible) {
        visibleNodeIds.add(id);
      }
    });

    const lines = this.linkGroup.querySelectorAll("line");
    lines.forEach((line) => {
      const sourceId = line.getAttribute("data-source");
      const targetId = line.getAttribute("data-target");

      const visible = visibleNodeIds.has(sourceId) && visibleNodeIds.has(targetId);
      line.style.display = visible ? "" : "none";
    });
  }

  // ----------------------------------------------------------------
  // 指定ノードの表示ラベルのみ再描画する
  // (再レイアウト・座標再計算は行わない)
  //
  // 学習状態(status)が変更された際に、ArchiveProgress等から呼び出される。
  //
  // @param {string} id - 更新対象ノードのid (this.data.nodes 内の id と一致)
  // ----------------------------------------------------------------
  updateNode(id) {
    const node = this.data.nodes.find((n) => n.id === id);
    if (!node) return;

    const g = this.nodeGroup.querySelector(`g[data-id="${id}"]`);
    if (!g) return;

    const text = g.querySelector("text");
    if (!text) return;

    text.textContent = (node.nodeType === "word" && node.status === "unknown")
      ? "???"
      : node.label;
  }
}

// ブラウザ/モジュール両対応エクスポート
if (typeof module !== "undefined" && module.exports) {
  module.exports = ArchiveGraph;
}
