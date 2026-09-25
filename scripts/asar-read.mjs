/**
 * 从 app.asar 中直接读取某个文件的源码，用于排查引导流程。
 *
 * asar 格式：前 16 字节是头部，其中 [12..16) 是 JSON 目录表的长度，
 * 目录表紧随其后；每个文件的 data offset 是**相对于数据区起点**的。
 *
 * 运行：
 *   node scripts/asar-read.mjs <asar内路径> [关键词1 关键词2 ...]
 */
import { readFileSync } from 'node:fs'

const ASAR = 'C:/Users/Administrator/AppData/Local/Programs/DeepSeek Harness/resources/app.asar'

/**
 * 读取 asar 目录表。
 * @returns {{ headerSize: number, files: object }}
 */
function readHeader() {
  const fd = readFileSync(ASAR)
  const headerSize = fd.readUInt32LE(12)
  const json = fd.subarray(16, 16 + headerSize).toString('utf8')
  return { headerSize, files: JSON.parse(json).files, buffer: fd }
}

/**
 * 按 asar 内路径取出文件内容。
 *
 * offset 已经是**相对于数据区起点**的字节位置，数据区从 `16 + headerSize` 开始，
 * 不需要再做对齐填充。这里曾按"对齐补 8 字节"处理，结果读到相邻文件的字节，
 * 关键词自然搜不到——所以偏移量值得先验证首字节再依赖它。
 * @param entry - 目录树。
 * @param parts - 路径分段。
 * @param headerSize - JSON 头长度。
 * @param buffer - 整个 asar。
 * @returns {Buffer|null}
 */
function pick(entry, parts, headerSize, buffer) {
  let node = entry
  for (const part of parts) {
    if (node == null || node.files == null || node.files[part] == null) return null
    node = node.files[part]
  }
  if (node.offset == null) return null
  const start = 16 + headerSize + Number(node.offset)
  return buffer.subarray(start, start + Number(node.size))
}

const { headerSize, files, buffer } = readHeader()
const target = process.argv[2] ?? 'dsh/lib/main.js'
const keywords = process.argv.slice(3)

const content = pick(files, target.split('/'), headerSize, buffer)
if (content === null) {
  console.error(`未找到：${target}`)
  process.exit(1)
}
const text = content.toString('utf8')
console.log(`${target}  ${text.length} 字符`)

if (keywords.length === 0) {
  console.log(text.slice(0, 4000))
  process.exit(0)
}

for (const keyword of keywords) {
  console.log(`\n======== ${keyword} ========`)
  let from = 0
  let shown = 0
  for (;;) {
    const at = text.indexOf(keyword, from)
    if (at < 0 || shown >= 4) break
    from = at + keyword.length
    shown += 1
    const lineStart = text.lastIndexOf('\n', at - 1) + 1
    const lineEnd = text.indexOf('\n', at)
    const lineNo = text.slice(0, at).split('\n').length
    console.log(`--- L${lineNo} ---`)
    console.log(text.slice(Math.max(lineStart, at - 700), Math.min(lineEnd + 900, at + 1400)))
  }
  if (shown === 0) console.log('(未找到)')
}
