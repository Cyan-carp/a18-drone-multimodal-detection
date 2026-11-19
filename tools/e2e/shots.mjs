/**
 * 截图工具：三个页面 × 浅色/深色，用于人工核对主题与版式。
 * 运行前需后端 8080、前端 5173 已启动。
 */
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'
import path from 'node:path'

const BASE = process.env.A18_BASE ?? 'http://localhost:5173'
const OUT = path.resolve('.shots')
mkdirSync(OUT, { recursive: true })

const PAGES = [
  { name: 'workbench', url: '/' },
  { name: 'tasks', url: '/tasks' },
  { name: 'logs', url: '/logs' },
]

const browser = await chromium.launch()
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })

for (const theme of ['light', 'dark']) {
  await context.addInitScript((value) => {
    localStorage.setItem('a18-theme', value)
  }, theme)

  for (const item of PAGES) {
    const page = await context.newPage()
    await page.goto(BASE + item.url, { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(1800)
    await page.screenshot({ path: path.join(OUT, `${item.name}-${theme}.png`) })
    console.log(`shot ${item.name}-${theme}.png`)
    await page.close()
  }
}

await browser.close()
