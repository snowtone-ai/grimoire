export function buildTaskParsePrompt(text: string, todayDate: string): string {
  return `今日の日付は ${todayDate} です。
以下の音声入力テキストからタスク情報を抽出してください。
出力はJSONのみ。余計なテキストなし。マークダウンのコードブロックも不要。

音声入力: "${text}"

以下のJSONフォーマットで出力:
{
  "title": "タスク名（簡潔に）",
  "dueDate": "YYYY-MM-DD（今日の日付基準で計算）",
  "dueTime": "HH:MM または null（時刻指定なしの場合）",
  "category": "job または university または life"
}

カテゴリの判定基準:
- job: 就活、企業、インターン、ES、面接、説明会、OB訪問など
- university: 大学、講義、レポート、課題、試験、ゼミ、授業など
- life: それ以外の日常タスク（買い物、通院、習い事など）`;
}
