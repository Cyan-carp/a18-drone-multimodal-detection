/**
 * Playwright click-through checks for the A18 demo console.
 *
 * Covers the three gaps that API-level smoke tests cannot prove:
 *   1. workbench: scenario detection, canvas actually painted, branch switch
 *   2. workbench: local upload -> detection (multipart + no-ground-truth path)
 *   3. tasks: row -> drawer -> CSV download
 *   4. logs: live rows, level filter, pause/resume with pending counter
 *
 * Run:  node check.mjs        (requires backend 8080 and Vite 5173 running)
 */
import { chromium } from 'playwright'
import { mkdirSync, existsSync } from 'node:fs'
import path from 'node:path'

const BASE = process.env.A18_BASE ?? 'http://localhost:5173'
const API = process.env.A18_API ?? 'http://localhost:8080'
const SHOTS = path.resolve('.shots')
const DATA = path.resolve('../../data/scenarios')

const consoleErrors = []
const pageErrors = []
const requestErrors = []
const results = []

function attach(page, tag) {
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(`[${tag}] ${message.text()}`)
  })
  page.on('pageerror', (error) => pageErrors.push(`[${tag}] ${error.message}`))
  page.on('requestfailed', (request) => {
    const url = request.url()
    if (url.includes('fonts.googleapis') || url.includes('fonts.gstatic')) return
    // SSE 在任务结束或页面离开时被主动断开，属正常收尾，不计为失败
    if (url.includes('/stream') && request.failure()?.errorText === 'net::ERR_ABORTED') return
    requestErrors.push(`[${tag}] ${url} :: ${request.failure()?.errorText}`)
  })
}

function check(name, pass, detail = '') {
  results.push({ name, pass, detail })
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? '  -- ' + detail : ''}`)
}

async function canvasPixels(page) {
  return page.evaluate(() => {
    const canvases = Array.from(document.querySelectorAll('canvas'))
    return canvases.map((canvas) => {
      const context = canvas.getContext('2d')
      if (!context) return 0
      const { data } = context.getImageData(0, 0, canvas.width, canvas.height)
      let painted = 0
      for (let index = 3; index < data.length; index += 4) {
        if (data[index] > 0) painted += 1
      }
      return painted
    })
  })
}

async function main() {
  if (!existsSync(SHOTS)) mkdirSync(SHOTS, { recursive: true })
  const browser = await chromium.launch()
  const context = await browser.newContext({ viewport: { width: 1600, height: 1000 }, acceptDownloads: true })

  // ---------- 1. scenario detection ----------
  const workbench = await context.newPage()
  attach(workbench, 'workbench')
  await workbench.goto(BASE, { waitUntil: 'domcontentloaded' })
  await workbench.getByText('检测输入', { exact: true }).waitFor({ timeout: 15000 })
  await workbench.getByRole('button', { name: /开始检测/ }).click()
  await workbench.getByText('检测完成').first().waitFor({ timeout: 30000 })

  const rows = await workbench.locator('table tbody tr').count()
  check('场景检测返回明细', rows > 0, `${rows} 行`)

  const painted = await canvasPixels(workbench)
  check('画布实际绘制了检测框', painted.some((count) => count > 2000), `覆盖像素 ${painted.join(', ')}`)
  await workbench.screenshot({ path: path.join(SHOTS, 'workbench-scenario.png') })

  await workbench.getByRole('tab', { name: /^RGB/ }).click()
  await workbench.waitForTimeout(400)
  const rgbRows = await workbench.locator('table tbody tr').count()
  check('切换 RGB 分支后表格刷新', rgbRows > 0, `${rgbRows} 行`)

  await workbench.getByRole('button', { name: /真值/ }).click()
  await workbench.waitForTimeout(300)
  const gtPainted = await canvasPixels(workbench)
  check('叠加真值后画布仍可绘制', gtPainted.some((count) => count > 2000), `覆盖像素 ${gtPainted.join(', ')}`)

  // ---------- 2. upload detection ----------
  await workbench.getByRole('tab', { name: '上传', exact: true }).click()
  const inputs = workbench.locator('input[type=file]')
  await inputs.nth(0).setInputFiles(path.join(DATA, 'SC-002_rgb.png'))
  await inputs.nth(1).setInputFiles(path.join(DATA, 'SC-002_ir.png'))
  await workbench.locator('img[alt="可见光 RGB"]').waitFor({ timeout: 8000 })
  await workbench.getByRole('button', { name: /开始检测/ }).click()
  // 上一轮结果已被清空，等表格重新出现行即代表本次上传检测完成
  await workbench.locator('table tbody tr').first().waitFor({ timeout: 45000 })
  const uploadRows = await workbench.locator('table tbody tr').count()
  const noGroundTruth = await workbench.getByText(/上传图像没有真值标注/).count()
  const gtButton = await workbench.getByRole('button', { name: /真值/ }).textContent()
  check('上传图像可完成检测', uploadRows > 0, `${uploadRows} 行`)
  check('上传图像正确提示无真值', noGroundTruth > 0, `${noGroundTruth} 处提示`)
  check('上传模式不继承上一场景真值', /真值\s*0/.test(gtButton ?? ''), gtButton?.trim() ?? '')
  await workbench.screenshot({ path: path.join(SHOTS, 'workbench-upload.png') })

  // ---------- 3. tasks drawer + export ----------
  const tasks = await context.newPage()
  attach(tasks, 'tasks')
  await tasks.goto(`${BASE}/tasks`, { waitUntil: 'domcontentloaded' })
  await tasks.locator('table tbody tr').first().waitFor({ timeout: 15000 })
  // 只看成功任务，避免点到仍在执行、尚无融合结果的记录
  await tasks.selectOption('select', 'SUCCESS')
  await tasks.waitForTimeout(800)
  await tasks.locator('table tbody tr').first().click()
  await tasks.getByText(/^任务 R-/).waitFor({ timeout: 10000 })
  await tasks.locator('aside table tbody tr').first().waitFor({ timeout: 15000 })
  const drawerRows = await tasks.locator('aside table tbody tr').count()
  check('任务详情抽屉可回放', drawerRows > 0, `${drawerRows} 行`)

  const [download] = await Promise.all([
    tasks.waitForEvent('download', { timeout: 20000 }),
    tasks.getByRole('button', { name: /CSV/ }).click(),
  ])
  const failure = await download.failure()
  check('CSV 导出按钮可下载', !failure, `${download.suggestedFilename()}${failure ? ' :: ' + failure : ''}`)
  await tasks.screenshot({ path: path.join(SHOTS, 'tasks-drawer.png') })

  // ---------- 4. logs page ----------
  const logs = await context.newPage()
  attach(logs, 'logs')
  await logs.goto(`${BASE}/logs`, { waitUntil: 'domcontentloaded' })
  await logs.locator('ol li').first().waitFor({ timeout: 15000 })
  const logRows = await logs.locator('ol li').count()
  check('日志页渲染实时条目', logRows > 0, `${logRows} 行`)

  await logs.selectOption('select', 'INFO')
  await logs.waitForTimeout(500)
  const infoRows = await logs.locator('ol li').count()
  const allInfo = await logs.locator('ol li').evaluateAll((nodes) =>
    nodes.every((node) => node.textContent?.includes('INFO')),
  )
  check('按 INFO 级别过滤生效', allInfo && infoRows > 0, `${infoRows} 行`)

  await logs.getByRole('button', { name: /暂停/ }).click()
  const pausedLabel = await logs.getByRole('button', { name: /继续/ }).textContent()
  check('暂停后按钮切换为继续', Boolean(pausedLabel?.includes('继续')), pausedLabel?.trim() ?? '')

  await fetch(`${API}/api/runs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sourceType: 'scenario',
      sourceId: 'SC-009',
      params: { conf: 0.1, iou: 0.58, imgsz: 1024, branches: { rgb: true, ir: true, dual: true } },
    }),
  })
  await logs.waitForTimeout(2500)
  const pendingLabel = await logs.getByRole('button', { name: /继续/ }).textContent()
  check('暂停期间累计新日志数', /继续\s*\(\d+\)/.test(pendingLabel ?? ''), pendingLabel?.trim() ?? '')

  await logs.getByRole('button', { name: /继续/ }).click()
  await logs.waitForTimeout(400)
  const resumedLabel = await logs.getByRole('button', { name: /暂停/ }).textContent()
  check('继续后可恢复暂停', Boolean(resumedLabel?.includes('暂停')), resumedLabel?.trim() ?? '')
  await logs.screenshot({ path: path.join(SHOTS, 'logs.png') })

  // ---------- 5. theme toggle ----------
  const theme = await context.newPage()
  attach(theme, 'theme')
  await theme.goto(BASE, { waitUntil: 'domcontentloaded' })
  const before = await theme.evaluate(() => document.documentElement.dataset.theme)
  await theme.getByRole('button', { name: /切换到/ }).click()
  await theme.waitForTimeout(400)
  const after = await theme.evaluate(() => document.documentElement.dataset.theme)
  check('主题开关可切换深浅', before !== after, `${before} -> ${after}`)

  await theme.reload({ waitUntil: 'domcontentloaded' })
  await theme.waitForTimeout(600)
  const persisted = await theme.evaluate(() => document.documentElement.dataset.theme)
  check('主题偏好刷新后保持', persisted === after, persisted)

  await browser.close()
}

main()
  .catch((error) => {
    console.error('FATAL', error.message)
    results.push({ name: '运行期异常', pass: false, detail: error.message })
  })
  .then(() => {
    const failed = results.filter((item) => !item.pass)
    console.log('\n===== 汇总 =====')
    console.log(`断言 ${results.length} 条，失败 ${failed.length} 条`)
    if (consoleErrors.length) console.log(`控制台错误 ${consoleErrors.length} 条:\n  ` + consoleErrors.join('\n  '))
    if (pageErrors.length) console.log(`未捕获异常 ${pageErrors.length} 条:\n  ` + pageErrors.join('\n  '))
    if (requestErrors.length) console.log(`请求失败 ${requestErrors.length} 条:\n  ` + requestErrors.join('\n  '))
    const ok = failed.length === 0 && pageErrors.length === 0 && consoleErrors.length === 0
    console.log(ok ? 'RESULT: PASS' : 'RESULT: FAIL')
    process.exit(ok ? 0 : 1)
  })
