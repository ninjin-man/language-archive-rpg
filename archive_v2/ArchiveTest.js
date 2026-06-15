// ArchiveTest.js
// Phase5: アーカイブと学習システムの接続(単語テスト起動)
//
// 役割: 単語IDを受け取り、その単語のテストを開始する。
//       Phase5では仮実装としてalert()で出題内容を表示するのみ。
//
// 提供API:
//  - startWordTest(wordId) : 指定wordIdの単語テストを開始する
//
// 設計方針:
//  - ArchiveData形式のデータ(nodes/links)のみに依存する独立クラス。
//  - ArchiveGraph / ArchiveProgress / ArchiveDetail への依存は持たない。
//  - 将来的にダンジョン・クエスト・単語帳など他システムからも
//    同じ startWordTest(wordId) を呼び出して利用される想定。
//
// 禁止事項により実装しないもの:
//  - UI変更
//  - グラフ描画変更
//  - カテゴリ管理の変更
//  - 進捗率算出の変更

class ArchiveTest {
  /**
   * @param {{nodes: Array, links: Array}} data - ArchiveData形式のデータ
   */
  constructor(data) {
    this.data = data;
  }

  // ----------------------------------------------------------------
  // 内部ヘルパー: idからwordノードを取得
  // ----------------------------------------------------------------
  _getWordNode(id) {
    return this.data.nodes.find((n) => n.id === id && n.nodeType === "word");
  }

  // ----------------------------------------------------------------
  // startWordTest(wordId)
  // 指定された単語のテストを開始する。
  //
  // Phase5では仮実装として、出題文をalert()で表示する。
  // 将来的にはここをテスト画面遷移・問題生成ロジックに置き換える想定。
  //
  // @param {string} wordId - テスト対象の単語id (ArchiveDataのnode.id)
  // ----------------------------------------------------------------
  startWordTest(wordId) {
    const node = this._getWordNode(wordId);

    if (!node) {
      console.warn("ArchiveTest: word not found for id =", wordId);
      return;
    }

    const question = `${node.label} の意味は？`;

    // 仮実装: alertで出題内容を表示
    alert(question);

    // 将来のテストシステム連携用に出題情報をログ出力
    console.log("ArchiveTest.startWordTest:", {
      wordId: node.id,
      label: node.label,
      japanese: node.japanese,
      question: question
    });
  }
}

// ブラウザ/モジュール両対応エクスポート
if (typeof module !== "undefined" && module.exports) {
  module.exports = ArchiveTest;
}
