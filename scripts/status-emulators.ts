import { existsSync, readFileSync } from 'fs'
import { join } from 'path'

const pidFile = join(process.cwd(), '.firebase-emulator.pid')

// PIDファイルが存在するか確認
if (!existsSync(pidFile)) {
  console.log('Firebase エミュレータは実行されていません')
  process.exit(1)
}

try {
  // PIDファイルからプロセスIDを読み込む
  const pid = parseInt(readFileSync(pidFile, 'utf8'))

  // プロセスが実行中かどうかを確認
  try {
    // プロセスが存在するかチェック（シグナル0を送信してテスト）
    process.kill(pid, 0)
    console.log(`Firebase エミュレータは実行中です (PID: ${pid})`)
    process.exit(0)
  } catch (e) {
    // プロセスが存在しない場合
    console.log(
      `Firebase エミュレータは実行されていません（PIDファイルは存在しますが、プロセス ${pid} は見つかりません）`
    )
    process.exit(1)
  }
} catch (error) {
  console.error('エミュレータの状態確認中にエラーが発生しました:', error)
  process.exit(1)
}
