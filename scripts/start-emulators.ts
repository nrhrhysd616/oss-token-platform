import { spawn, execSync } from 'child_process'
import { writeFileSync } from 'fs'
import { join } from 'path'

const pidFile = join(process.cwd(), '.firebase-emulator.pid')
const FIRESTORE_PORT = 8080 // Firestoreエミュレータのデフォルトポート

// ポートを使用しているプロセスのPIDを取得する関数
function getPidByPort(port: number): number[] {
  try {
    // macOSの場合
    const result = execSync(`lsof -i:${port} -t`).toString().trim()
    if (result) {
      // 複数のプロセスが見つかった場合は全て返す
      return result.split('\n').map(pid => parseInt(pid))
    }
  } catch (error) {
    // コマンドが失敗した場合（プロセスが見つからない場合など）
    console.log(`ポート${port}を使用しているプロセスは見つかりませんでした`)
  }
  return []
}

// Firebaseエミュレータのプロセスを検索する関数
function findFirebaseEmulatorPids(): number[] {
  try {
    // macOSとLinuxの場合
    // psコマンドでプロセスを検索し、grepでfirebase emulators:startを含むものをフィルタリング
    const cmd = `ps aux | grep "oss-token-platform" | grep -v grep | awk '{print $2}'`
    const result = execSync(cmd).toString().trim()

    if (result) {
      // 複数のプロセスが見つかった場合は全て返す
      return result.split('\n').map(pid => parseInt(pid))
    }
  } catch (error) {
    // コマンドが失敗した場合（プロセスが見つからない場合など）
    console.log('実行中のFirebase エミュレータは見つかりませんでした')
  }
  return []
}

// 両方の条件を満たすプロセスを見つける
function findValidEmulatorPid(): number | null {
  // ポートを使用しているプロセスのPIDを取得
  const portPids = getPidByPort(FIRESTORE_PORT)

  // Firebaseエミュレータのプロセスを検索
  const emulatorPids = findFirebaseEmulatorPids()

  // 両方の条件を満たすPIDを探す（共通のPID）
  const validPids = portPids.filter(pid => emulatorPids.includes(pid))

  if (validPids.length > 0) {
    // 複数見つかった場合は最初のものを使用
    return validPids[0]
  }

  return null
}

// 既存のエミュレータプロセスを確認
const existingPid = findValidEmulatorPid()

if (existingPid) {
  // 既存のエミュレータが見つかった場合
  console.log(`既存のFirebase エミュレータが見つかりました (PID: ${existingPid})`)
  writeFileSync(pidFile, existingPid.toString())
  console.log(`PIDをファイルに保存しました: ${pidFile}`)
  console.log(`停止するには 'bun run firebase:emulators:stop' を実行してください`)
} else {
  // 既存のエミュレータが見つからない場合、新しく起動
  const emulator = spawn('firebase', ['emulators:start'], {
    detached: true,
    stdio: 'ignore',
  })

  // プロセスをバックグラウンドで実行するために親プロセスから切り離す
  emulator.unref()

  // PIDをファイルに保存
  writeFileSync(pidFile, emulator.pid!.toString())

  console.log(`Firebase エミュレータがバックグラウンドで起動しました (PID: ${emulator.pid})`)
  console.log(`停止するには 'bun run firebase:emulators:stop' を実行してください`)
}
