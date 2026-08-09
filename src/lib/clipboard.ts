// クリップボードへのコピー。Clipboard API は HTTPS(localhost 含む)でのみ使えるため、
// 使えない環境では一時的な textarea + execCommand にフォールバックする
export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch {
    // 権限拒否などはフォールバックを試す
  }
  try {
    const ta = document.createElement('textarea')
    ta.value = text
    ta.setAttribute('readonly', '')
    // 画面外に置き、iOS でのスクロール移動やキーパッド表示を避ける
    ta.style.position = 'fixed'
    ta.style.top = '-1000px'
    ta.style.opacity = '0'
    document.body.appendChild(ta)
    ta.select()
    ta.setSelectionRange(0, text.length)
    const ok = document.execCommand('copy')
    document.body.removeChild(ta)
    return ok
  } catch {
    return false
  }
}
