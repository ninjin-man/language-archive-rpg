// ArchiveProgress.js
// Phase4: アーカイブの学習状態管理・進捗率算出ロジック
//
// 役割: 単語(nodeType:"word")ごとの学習状態(status)・習熟度(mastery)を
//       管理し、カテゴリ別/全体の進捗率を算出する。
//       Phase5以降からも利用される想定のゲームロジック層。
//
// status の定義:
//  - unknown    : 未発見 (初期値)
//  - discovered : 発見済み
//  - learning   : 学習中
//  - mastered   : 習得済み
//
// 提供API:
//  - unlockWord(id)        : status を "unknown" -> "discovered" に変更
//  - setMastery(id, value) : mastery値(0-100)を更新
//  - setStatus(id, status) : status を直接設定
//  - getCompletion()       : 全体達成率(%, 小数1桁)を返す
//  - getCategoryCompletion(category) : 指定カテゴリの進捗率(%, 小数1桁)を返す
//  - getAllCategoryCompletion()      : 全カテゴリの進捗率を { category: percent } で返す
//
// 進捗率の定義:
//  - 各wordノードの進捗値は mastery(0-100) を用いる
//  - カテゴリ進捗率 = そのカテゴリに属するwordのmastery平均
//  - 全体達成率     = 全wordのmastery平均
//
// 禁止事項により実装しないもの:
//  - UI装飾
//  - 永続化(localStorage等)
//  - グラフ描画ロジックそのものの変更(ArchiveGraph.updateNodeの呼び出しのみ)

class ArchiveProgress {
  /**
   * @param {{nodes: Array, links: Array}} data - ArchiveData形式のデータ
   * @param {ArchiveGraph} [graph] - 状態変更時に表示更新を行うArchiveGraphインスタンス(省略可)
   */
  constructor(data, graph) {
    this.data = data;
    this.graph = graph || null;
  }

  // ----------------------------------------------------------------
  // 内部ヘルパー: idからwordノードを取得
  // ----------------------------------------------------------------
  _getWordNode(id) {
    return this.data.nodes.find((n) => n.id === id && n.nodeType === "word");
  }

  // ----------------------------------------------------------------
  // 内部ヘルパー: 状態変更後にグラフ表示を更新
  // ----------------------------------------------------------------
  _refresh(id) {
    if (this.graph && typeof this.graph.updateNode === "function") {
      this.graph.updateNode(id);
    }
  }

  // ----------------------------------------------------------------
  // unlockWord(id)
  // 単語を「未発見」から「発見済み」にする。
  // すでに unknown 以外の状態の場合は何もしない。
  // ----------------------------------------------------------------
  unlockWord(id) {
    const node = this._getWordNode(id);
    if (!node) return;

    if (node.status === "unknown") {
      node.status = "discovered";
      this._refresh(id);
    }
  }

  // ----------------------------------------------------------------
  // setMastery(id, value)
  // 習熟度(0-100)を設定する。範囲外の値は0-100にクランプする。
  // ----------------------------------------------------------------
  setMastery(id, value) {
    const node = this._getWordNode(id);
    if (!node) return;

    let v = Number(value);
    if (isNaN(v)) v = 0;
    if (v < 0) v = 0;
    if (v > 100) v = 100;

    node.mastery = v;
    this._refresh(id);
  }

  // ----------------------------------------------------------------
  // setStatus(id, status)
  // 学習状態を直接設定する。
  // 不正な値の場合は何もしない。
  // ----------------------------------------------------------------
  setStatus(id, status) {
    const validStatuses = ["unknown", "discovered", "learning", "mastered"];
    if (!validStatuses.includes(status)) return;

    const node = this._getWordNode(id);
    if (!node) return;

    node.status = status;
    this._refresh(id);
  }

  // ----------------------------------------------------------------
  // getCompletion()
  // 全wordノードのmastery平均(%)を返す。
  // wordノードが存在しない場合は0を返す。
  // ----------------------------------------------------------------
  getCompletion() {
    const wordNodes = this.data.nodes.filter((n) => n.nodeType === "word");
    if (wordNodes.length === 0) return 0;

    const sum = wordNodes.reduce((acc, n) => acc + (Number(n.mastery) || 0), 0);
    const avg = sum / wordNodes.length;

    return Math.round(avg * 10) / 10;
  }

  // ----------------------------------------------------------------
  // getCategoryCompletion(category)
  // 指定カテゴリに属するwordノードのmastery平均(%)を返す。
  // 該当wordが存在しない場合は0を返す。
  // ----------------------------------------------------------------
  getCategoryCompletion(category) {
    const wordNodes = this.data.nodes.filter(
      (n) => n.nodeType === "word" && n.category === category
    );
    if (wordNodes.length === 0) return 0;

    const sum = wordNodes.reduce((acc, n) => acc + (Number(n.mastery) || 0), 0);
    const avg = sum / wordNodes.length;

    return Math.round(avg * 10) / 10;
  }

  // ----------------------------------------------------------------
  // getAllCategoryCompletion()
  // 全カテゴリの進捗率を { categoryLabel: percent } で返す。
  // 新データ構造(nodeType:"hub")を優先し、存在しない場合は
  // 旧データ構造(nodeType:"category")を使用する。
  // 算出ロジック(getCategoryCompletion)自体は変更しない。
  // ----------------------------------------------------------------
  getAllCategoryCompletion() {
    let categoryNodes = this.data.nodes.filter((n) => n.nodeType === "hub");

    if (categoryNodes.length === 0) {
      categoryNodes = this.data.nodes.filter((n) => n.nodeType === "category");
    }

    const result = {};

    categoryNodes.forEach((c) => {
      result[c.label] = this.getCategoryCompletion(c.label);
    });

    return result;
  }
}

// ブラウザ/モジュール両対応エクスポート
if (typeof module !== "undefined" && module.exports) {
  module.exports = ArchiveProgress;
}
