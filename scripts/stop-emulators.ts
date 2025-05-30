import { readFileSync, unlinkSync, existsSync } from 'fs'
import { join } from 'path'

const pidFile = join(process.cwd(), '.firebase-emulator.pid')

// PIDファイルが存在するか確認
if (!existsSync(pidFile)) {
  console.log('Firebase エミュレータは実行されていないようです')
  process.exit(0)
}

try {
  // PIDファイルからプロセスIDを読み込む
  const pid = parseInt(readFileSync(pidFile, 'utf8'))

  // プロセスを終了
  process.kill(pid)
  console.log(`Firebase エミュレータを停止しました (PID: ${pid})`)

  // PIDファイルを削除
  unlinkSync(pidFile)
} catch (error) {
  console.error('エミュレータの停止中にエラーが発生しました:', error)

  // エラーが発生してもPIDファイルを削除
  if (existsSync(pidFile)) {
    unlinkSync(pidFile)
  }

  process.exit(1)
}
