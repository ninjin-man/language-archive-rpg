// ArchiveDetail.js
// Phase2: 単語詳細パネルの表示機能のみ
//
// 役割: ノードクリック時に渡された単語データを、
//       右側固定パネル(#archive-detail)に表示する。
//
// 表示項目:
//  - 単語名 (label)
//  - 日本語訳 (japanese)
//  - 品詞 (wordType)
//  - カテゴリ (category)
//  - 習熟度 (mastery)
//  - 関連単語数 (links から動的に算出)
//
// 禁止事項により実装しないもの:
//  - レイアウト変更
//  - SVG/グラフ描画への変更
//  - アニメーション
//  - CSS装飾

class ArchiveDetail {
  /**
   * @param {string} containerId - 詳細パネルを表示するDOM要素のid
   * @param {{nodes: Array, links: Array}} data - ArchiveData形式のデータ (関連単語数の算出に使用)
   * @param {Object} [options]
   * @param {Function} [options.onTestClick] - 「テストする」ボタン押下時に呼ばれるコールバック (node) => void
   */
  constructor(containerId, data, options = {}) {
    this.container = document.getElementById(containerId);
    if (!this.container) {
      throw new Error(`ArchiveDetail: container element "${containerId}" not found`);
    }

    this.data = data;
    this.onTestClick = (options && options.onTestClick) || null;

    this._renderEmpty();
  }

  // ----------------------------------------------------------------
  // 初期状態(未選択時)の表示
  // ----------------------------------------------------------------
  _renderEmpty() {
    this.container.innerHTML = "";

    const message = document.createElement("p");
    message.textContent = "ノードをクリックすると詳細が表示されます。";

    this.container.appendChild(message);
  }

  // ----------------------------------------------------------------
  // 指定ノードに接続するリンク数(関連単語数)を算出
  // ----------------------------------------------------------------
  _countRelatedWords(nodeId) {
    let count = 0;
    this.data.links.forEach((link) => {
      if (link.source === nodeId || link.target === nodeId) {
        count++;
      }
    });
    return count;
  }

  // ----------------------------------------------------------------
  // 単語詳細を表示
  // @param {Object} node - クリックされたノードオブジェクト
  // ----------------------------------------------------------------
  show(node) {
    this.container.innerHTML = "";

    const relatedCount = this._countRelatedWords(node.id);

    const fields = [
      { label: "", value: node.label },
      { label: "", value: node.japanese || "" },
      { label: "", value: node.wordType || "" },
      { label: "Category", value: node.category || "" },
      { label: "Mastery", value: `${node.mastery}%` },
      { label: "Related Words", value: `${relatedCount}` }
    ];

    fields.forEach((field) => {
      const p = document.createElement("p");
      if (field.label) {
        p.textContent = `${field.label}: ${field.value}`;
      } else {
        p.textContent = field.value;
      }
      this.container.appendChild(p);
    });

    // 「テストする」ボタン (Phase5: 単語学習システムとの接続)
    const testButton = document.createElement("button");
    testButton.textContent = "テストする";
    testButton.addEventListener("click", () => {
      if (typeof this.onTestClick === "function") {
        this.onTestClick(node);
      }
    });
    this.container.appendChild(testButton);
  }
}

// ブラウザ/モジュール両対応エクスポート
if (typeof module !== "undefined" && module.exports) {
  module.exports = ArchiveDetail;
}
