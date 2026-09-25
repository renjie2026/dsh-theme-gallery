/**
 * 实测 / 监控渲染进程：判定主题皮肤是否"跑飞"。
 *
 * 为什么要有这个脚本
 * ------------------
 * 上一次排障靠的是手工打开任务管理器读数字，信息很好但不可重复。
 * 本脚本按固定间隔采样各进程的**私有工作集内存**与**累计 CPU 时间**，
 * 并据此给出判定：
 *
 *   - CPU 累计增速  > 100%/核  → 每帧都在干活（跑飞）
 *   - 内存单调增长（不回落）    → 每个 tick 都在新增对象且不回收
 *
 * 用法：
 *   node tools/watch-renderer.mjs              # 采样 60 秒，每 5 秒一行
 *   node tools/watch-renderer.mjs 180 10       # 采样 180 秒，每 10 秒一行
 *   node tools/watch-renderer.mjs --once       # 只打一次快照
 *
 * 输出里的 "类型" 来自进程命令行：renderer 是渲染进程（插件代码跑在这里），
 * Host 是宿主，GPU/network/utility 各司其职。
 */
import { execFileSync } from 'node:child_process'

const args = process.argv.slice(2)
const once = args.includes('--once')
const positional = args.filter((a) => !a.startsWith('--'))
const totalSeconds = Number(positional[0] ?? 60)
const intervalSeconds = Number(positional[1] ?? 5)

const APP = 'DeepSeek Harness'

/**
 * 读一次所有 Harness 进程的内存与 CPU。
 * @returns 每个进程的一条记录。
 */
function sample() {
  let raw
  try {
    raw = execFileSync('powershell.exe', [
      '-NoProfile', '-Command',
      `Get-CimInstance Win32_Process -Filter "Name='${APP}.exe'" | `
      + 'Select-Object ProcessId,CommandLine,'
      + '@{n="WorkingSet";e={$_.WorkingSetSize}},'
      + '@{n="Private";e={$_.PrivatePageCount}},'
      + 'KernelModeTime,UserModeTime | ConvertTo-Json -Compress',
    ], { encoding: 'utf8', windowsHide: true })
  } catch (error) {
    console.error('无法读取进程信息：', error.message)
    process.exit(1)
  }
  const parsed = JSON.parse(raw.trim() === '' ? '[]' : raw)
  const list = Array.isArray(parsed) ? parsed : [parsed]

  return list.map((p) => {
    const cmd = String(p.CommandLine ?? '')
    // Chromium's switches name the process type; the main process has none of them.
    const type = /--type=renderer/.test(cmd) ? 'renderer'
      : /--type=([\w-]+)/.exec(cmd)?.[1] ?? 'main'
    const cpuSeconds = (Number(p.KernelModeTime ?? 0) + Number(p.UserModeTime ?? 0)) / 1e7
    return {
      pid: p.ProcessId,
      type,
      // Private bytes is the number that grew to 11 GB last time.
      privateMb: Number(p.Private ?? 0) / 1048576,
      workingSetMb: Number(p.WorkingSet ?? 0) / 1048576,
      cpuSeconds,
    }
  })
}

/**
 * 打印一次快照。
 * @param rows - 采样结果。
 * @param label - 行首标签。
 */
function print(rows, label) {
  const byType = new Map()
  for (const row of rows) {
    const current = byType.get(row.type) ?? { count: 0, privateMb: 0, workingSetMb: 0, cpuSeconds: 0 }
    byType.set(row.type, {
      count: current.count + 1,
      privateMb: current.privateMb + row.privateMb,
      workingSetMb: current.workingSetMb + row.workingSetMb,
      cpuSeconds: current.cpuSeconds + row.cpuSeconds,
    })
  }
  const parts = [...byType.entries()]
    .sort((a, b) => b[1].privateMb - a[1].privateMb)
    .map(([type, v]) => `${type}×${v.count} 私有${v.privateMb.toFixed(0)}MB CPU${v.cpuSeconds.toFixed(0)}s`)
  console.log(`${label}  ${parts.join('  |  ')}`)
  return byType
}

console.log(`采样目标：${APP}.exe`)
console.log('')

const first = sample()
if (first.length === 0) {
  console.log('没有找到正在运行的 DeepSeek Harness 进程。')
  process.exit(0)
}
const firstByType = print(first, '起始')
if (once) process.exit(0)

const startedAt = Date.now()
let lastByType = firstByType
let lastAt = startedAt
let worstCpuRatio = 0
let grew = 0

const timer = setInterval(() => {
  const now = Date.now()
  const rows = sample()
  const byType = print(rows, `第 ${Math.round((now - startedAt) / 1000)}s`)
  const elapsed = (now - lastAt) / 1000

  const rendererBefore = lastByType.get('renderer')
  const rendererNow = byType.get('renderer')
  if (rendererBefore !== undefined && rendererNow !== undefined && elapsed > 0) {
    // CPU seconds burned per second of wall clock. Above 1.0 means more than one core busy;
    // a decoration layer that idles should sit far below that.
    const cpuRatio = (rendererNow.cpuSeconds - rendererBefore.cpuSeconds) / elapsed
    worstCpuRatio = Math.max(worstCpuRatio, cpuRatio)
    const growth = rendererNow.privateMb - rendererBefore.privateMb
    if (growth > 5) grew += 1
    console.log(`        renderer 区间：CPU ${cpuRatio.toFixed(2)}×核  私有内存 ${growth >= 0 ? '+' : ''}${growth.toFixed(0)}MB`)
  }
  lastByType = byType
  lastAt = now

  if ((now - startedAt) / 1000 >= totalSeconds) {
    clearInterval(timer)
    console.log('')
    console.log('=== 判定 ===')
    console.log(`renderer CPU 峰值：${worstCpuRatio.toFixed(2)}×核（空闲装饰层应远低于 1.00）`)
    console.log(`内存持续增长的区间数：${grew}`)
    const firstRenderer = firstByType.get('renderer')
    const lastRenderer = lastByType.get('renderer')
    if (firstRenderer !== undefined && lastRenderer !== undefined) {
      const total = lastRenderer.privateMb - firstRenderer.privateMb
      console.log(`renderer 私有内存变化：${total >= 0 ? '+' : ''}${total.toFixed(0)}MB`)
    }
    const runaway = worstCpuRatio > 1.0 || grew >= 3
    console.log(runaway
      ? '结论：疑似跑飞 —— 请立即执行 npm run skin:disable 并保留上面的数字。'
      : '结论：未见跑飞迹象。')
  }
}, intervalSeconds * 1000)

process.on('SIGINT', () => {
  clearInterval(timer)
  console.log('\n已中止采样。')
  process.exit(0)
})
