// ArchiveFilter.js
// Phase3: カテゴリ管理(フィルタ)機能のみ
//
// 役割: 左側パネルにカテゴリ一覧(チェックボックス)を表示し、
//       選択状態に応じて ArchiveGraph.setVisibleCategories() を呼び出す。
//
// 動作:
//  - カテゴリを選択 -> 該当カテゴリのみ表示
//  - 複数選択可能 -> 選択した全カテゴリを表示
//  - 全解除 -> 全カテゴリ表示(フィルタなし)に戻す
//
// 禁止事項により実装しないもの:
//  - 発光・金装飾・魔法陣などの装飾
//  - アニメーション
//  - グラフ描画ロジックの変更(ArchiveGraphのsetVisibleCategoriesを呼ぶのみ)

class ArchiveFilter {
  /**
   * @param {string} containerId - フィルタUIを表示するDOM要素のid
   * @param {{nodes: Array, links: Array}} data - ArchiveData形式のデータ(カテゴリ一覧抽出用)
   * @param {ArchiveGraph} graph - フィルタ結果を適用するArchiveGraphインスタンス
   */
  constructor(containerId, data, graph) {
    this.container = document.getElementById(containerId);
    if (!this.container) {
      throw new Error(`ArchiveFilter: container element "${containerId}" not found`);
    }

    this.data = data;
    this.graph = graph;

    // 選択中のカテゴリ名集合(空 = 全表示)
    this.selectedCategories = new Set();

    this._render();
  }

  // ----------------------------------------------------------------
  // フィルタ対象ノード(hub)の一覧を抽出(表示順は ArchiveData の登場順)
  // 旧データ(nodeType:"category"を使う構造)との互換性のため、
  // hubノードが存在しない場合は categoryノードを使用する。
  // ----------------------------------------------------------------
  _getCategoryList() {
    const hubLabels = this.data.nodes
      .filter((n) => n.nodeType === "hub")
      .map((n) => n.label);

    if (hubLabels.length > 0) {
      return hubLabels;
    }

    return this.data.nodes
      .filter((n) => n.nodeType === "category")
      .map((n) => n.label);
  }

  // ----------------------------------------------------------------
  // UI構築
  // ----------------------------------------------------------------
  _render() {
    this.container.innerHTML = "";

    const categories = this._getCategoryList();

    categories.forEach((category) => {
      const label = document.createElement("label");

      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.value = category;

      checkbox.addEventListener("change", () => {
        if (checkbox.checked) {
          this.selectedCategories.add(category);
        } else {
          this.selectedCategories.delete(category);
        }
        this._applyFilter();
      });

      label.appendChild(checkbox);
      label.appendChild(document.createTextNode(" " + category));

      const wrapper = document.createElement("div");
      wrapper.appendChild(label);

      this.container.appendChild(wrapper);
    });

    // 全解除ボタン
    const clearButton = document.createElement("button");
    clearButton.textContent = "全解除";
    clearButton.addEventListener("click", () => {
      this.selectedCategories.clear();

      // 全チェックボックスをオフにする
      const checkboxes = this.container.querySelectorAll('input[type="checkbox"]');
      checkboxes.forEach((cb) => {
        cb.checked = false;
      });

      this._applyFilter();
    });

    this.container.appendChild(clearButton);
  }

  // ----------------------------------------------------------------
  // 選択状態をグラフへ反映
  // ----------------------------------------------------------------
  _applyFilter() {
    const categories = Array.from(this.selectedCategories);
    this.graph.setVisibleCategories(categories);
  }
}

// ブラウザ/モジュール両対応エクスポート
if (typeof module !== "undefined" && module.exports) {
  module.exports = ArchiveFilter;
}
