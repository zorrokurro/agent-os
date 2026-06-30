import { homedir } from 'os'
import { join } from 'path'
import { writeFileSync, mkdirSync, existsSync } from 'fs'
import type { ResearchResult, SearchResult } from './research-engine'

// ==========================================
// 研究報告生成器（論文格式）
// ==========================================

export interface ResearchReport {
  title: string
  abstract: string
  sections: ReportSection[]
  references: Reference[]
  metadata: ReportMetadata
}

interface ReportSection {
  heading: string
  level: number // 1 = 章節, 2 = 子章節
  content: string
  sources: string[] // 來源索引
}

interface Reference {
  index: number
  title: string
  url: string
  source: string
  date?: string
  type: 'news' | 'paper' | 'web' | 'video' | 'code' | 'discussion'
}

interface ReportMetadata {
  query: string
  generatedAt: string
  totalSources: number
  sourcesBreakdown: Record<string, number>
  reportPath: string
}

// ---- 報告生成 ----

export function generateReport(
  research: ResearchResult,
  format: 'markdown' | 'html' = 'markdown'
): ResearchReport {
  const now = new Date()
  const dateStr = now.toISOString().split('T')[0]
  const timestamp = now.toISOString()

  // 分類來源
  const categorized = categorizeSources(research.results)

  // 建立参考文献列表
  const references = buildReferences(research.results)

  // 產生各章節
  const sections = buildSections(research, categorized, references)

  // 產生摘要
  const abstract = generateAbstract(research, categorized)

  // 統計
  const sourcesBreakdown: Record<string, number> = {}
  for (const r of research.results) {
    sourcesBreakdown[r.source] = (sourcesBreakdown[r.source] || 0) + 1
  }

  const report: ResearchReport = {
    title: `Research Report: ${research.query}`,
    abstract,
    sections,
    references,
    metadata: {
      query: research.query,
      generatedAt: timestamp,
      totalSources: research.results.length,
      sourcesBreakdown,
      reportPath: '',
    },
  }

  // 儲存報告
  const reportContent = format === 'markdown' ? renderMarkdown(report) : renderHtml(report)
  const reportPath = saveReport(report.title, reportContent, dateStr)
  report.metadata.reportPath = reportPath

  return report
}

// ---- 分類 ----

interface CategorizedSources {
  news: SearchResult[]
  academic: SearchResult[]
  web: SearchResult[]
  video: SearchResult[]
  code: SearchResult[]
  discussion: SearchResult[]
  other: SearchResult[]
}

function categorizeSources(results: SearchResult[]): CategorizedSources {
  const cat: CategorizedSources = {
    news: [], academic: [], web: [], video: [], code: [], discussion: [], other: [],
  }

  for (const r of results) {
    const src = r.source.toLowerCase()
    if (src.includes('news')) {
      cat.news.push(r)
    } else if (src.includes('arxiv')) {
      cat.academic.push(r)
    } else if (src.includes('youtube') || src.includes('video')) {
      cat.video.push(r)
    } else if (src.includes('github')) {
      cat.code.push(r)
    } else if (src.includes('hacker news') || src.includes('hn')) {
      cat.discussion.push(r)
    } else {
      cat.web.push(r)
    }
  }

  return cat
}

// ---- 參考文獻 ----

function buildReferences(results: SearchResult[]): Reference[] {
  return results.map((r, i) => {
    let type: Reference['type'] = 'web'
    const src = r.source.toLowerCase()
    if (src.includes('news')) type = 'news'
    else if (src.includes('arxiv')) type = 'paper'
    else if (src.includes('youtube')) type = 'video'
    else if (src.includes('github')) type = 'code'
    else if (src.includes('hacker news')) type = 'discussion'

    return {
      index: i + 1,
      title: r.title,
      url: r.url,
      source: r.source,
      date: r.date,
      type,
    }
  })
}

// ---- 章節建構 ----

function buildSections(
  research: ResearchResult,
  cat: CategorizedSources,
  refs: Reference[]
): ReportSection[] {
  const sections: ReportSection[] = []
  const refIdx = 0

  function getRefIndices(results: SearchResult[]): string[] {
    return results.map(r => {
      const idx = research.results.indexOf(r)
      return `[${idx + 1}]`
    })
  }

  // 1. 執行摘要
  sections.push({
    heading: 'Executive Summary',
    level: 1,
    content: generateExecutiveSummary(research, cat),
    sources: [],
  })

  // 2. 新聞動態
  if (cat.news.length > 0) {
    const refIds = getRefIndices(cat.news)
    sections.push({
      heading: 'News & Recent Developments',
      level: 1,
      content: cat.news.map((r, i) =>
        `**${r.title}** ${refIds[i]}\n\n${r.snippet}\n\n*Source: ${r.source}${r.date ? ' | ' + r.date : ''}*`
      ).join('\n\n---\n\n'),
      sources: refIds,
    })
  }

  // 3. 學術研究
  if (cat.academic.length > 0) {
    const refIds = getRefIndices(cat.academic)
    sections.push({
      heading: 'Academic Research',
      level: 1,
      content: cat.academic.map((r, i) =>
        `**${r.title}** ${refIds[i]}\n\n${r.snippet}\n\n*Source: ${r.source}${r.date ? ' | ' + r.date : ''}*`
      ).join('\n\n---\n\n'),
      sources: refIds,
    })
  }

  // 4. 網路資源
  if (cat.web.length > 0) {
    const refIds = getRefIndices(cat.web)
    sections.push({
      heading: 'Web Resources & Analysis',
      level: 1,
      content: cat.web.map((r, i) =>
        `**${r.title}** ${refIds[i]}\n\n${r.snippet}\n\n*Source: ${r.source}*`
      ).join('\n\n---\n\n'),
      sources: refIds,
    })
  }

  // 5. 影片內容
  if (cat.video.length > 0) {
    const refIds = getRefIndices(cat.video)
    sections.push({
      heading: 'Video Content',
      level: 1,
      content: cat.video.map((r, i) =>
        `**${r.title}** ${refIds[i]}\n\n${r.snippet}\n\n*Source: ${r.source}*`
      ).join('\n\n---\n\n'),
      sources: refIds,
    })
  }

  // 6. 開源專案
  if (cat.code.length > 0) {
    const refIds = getRefIndices(cat.code)
    sections.push({
      heading: 'Open Source Projects & Code',
      level: 1,
      content: cat.code.map((r, i) =>
        `**${r.title}** ${refIds[i]}\n\n${r.snippet}\n\n*Source: ${r.source}*`
      ).join('\n\n---\n\n'),
      sources: refIds,
    })
  }

  // 7. 社群討論
  if (cat.discussion.length > 0) {
    const refIds = getRefIndices(cat.discussion)
    sections.push({
      heading: 'Community Discussion',
      level: 1,
      content: cat.discussion.map((r, i) =>
        `**${r.title}** ${refIds[i]}\n\n${r.snippet}\n\n*Source: ${r.source}${r.date ? ' | ' + r.date : ''}*`
      ).join('\n\n---\n\n'),
      sources: refIds,
    })
  }

  // 8. 綜合分析
  sections.push({
    heading: 'Synthesis & Analysis',
    level: 1,
    content: generateSynthesis(research, cat),
    sources: [],
  })

  // 9. 結論與建議
  sections.push({
    heading: 'Conclusions & Recommendations',
    level: 1,
    content: `Based on the analysis of ${research.results.length} sources across ${Object.keys(cat).filter(k => cat[k as keyof CategorizedSources].length > 0).length} categories:\n\n` +
      `1. **Key Findings**: The research reveals multiple perspectives on "${research.query}".\n\n` +
      `2. **Trends**: ${cat.news.length > 0 ? 'Recent news coverage indicates active developments in this area.' : 'No recent news coverage was found.'} ${cat.academic.length > 0 ? 'Academic research provides theoretical foundations.' : ''}\n\n` +
      `3. **Practical Resources**: ${cat.code.length > 0 ? `${cat.code.length} open source projects were identified.` : 'No specific code repositories were found.'} ${cat.video.length > 0 ? `${cat.video.length} video resources provide visual explanations.` : ''}\n\n` +
      `4. **Further Research**: Consider diving deeper into the academic papers and following the news sources for ongoing developments.`,
    sources: [],
  })

  return sections
}

// ---- 摘要生成 ----

function generateAbstract(research: ResearchResult, cat: CategorizedSources): string {
  const total = research.results.length
  const categories = Object.entries(cat).filter(([, v]) => v.length > 0).map(([k]) => k)

  return `This research report provides a comprehensive analysis of "${research.query}" based on ${total} sources across ${categories.length} categories: ${categories.join(', ')}.\n\n` +
    `The research was conducted on ${new Date().toISOString().split('T')[0]} and includes:\n` +
    `- **${cat.news.length}** news articles and recent developments\n` +
    `- **${cat.academic.length}** academic papers and research publications\n` +
    `- **${cat.web.length}** web resources and analysis\n` +
    `- **${cat.video.length}** video content and tutorials\n` +
    `- **${cat.code.length}** open source projects and code repositories\n` +
    `- **${cat.discussion.length}** community discussions and forums\n\n` +
    `This report synthesizes findings from all sources to provide a multi-perspective understanding of the topic.`
}

function generateExecutiveSummary(research: ResearchResult, cat: CategorizedSources): string {
  const parts: string[] = []

  parts.push(`## Overview\n\nThis report analyzes "${research.query}" using ${research.results.length} sources from multiple platforms.\n`)

  if (cat.news.length > 0) {
    parts.push(`## Recent News\n\n${cat.news.slice(0, 3).map(n => `- **${n.title}**: ${n.snippet.substring(0, 150)}`).join('\n')}\n`)
  }

  if (cat.academic.length > 0) {
    parts.push(`## Academic Insights\n\n${cat.academic.slice(0, 3).map(a => `- **${a.title}**: ${a.snippet.substring(0, 150)}`).join('\n')}\n`)
  }

  if (cat.code.length > 0) {
    parts.push(`## Notable Projects\n\n${cat.code.slice(0, 3).map(c => `- **${c.title}** (${c.source}): ${c.snippet.substring(0, 100)}`).join('\n')}\n`)
  }

  return parts.join('\n')
}

function generateSynthesis(research: ResearchResult, cat: CategorizedSources): string {
  const parts: string[] = []

  parts.push(`## Cross-Source Analysis\n\n`)

  if (cat.news.length > 0 && cat.academic.length > 0) {
    parts.push(`### News vs. Academic Perspective\n\nThe news coverage and academic research provide complementary perspectives. News sources focus on recent developments and practical implications, while academic papers provide theoretical foundations and rigorous analysis.\n`)
  }

  if (cat.code.length > 0) {
    parts.push(`### Practical Implementation\n\n${cat.code.length} open source projects were identified, indicating active community development in this area. These projects provide practical implementations and can serve as starting points for further development.\n`)
  }

  if (cat.discussion.length > 0) {
    parts.push(`### Community Sentiment\n\nCommunity discussions on platforms like Hacker News reveal practical concerns, real-world experiences, and emerging trends that may not be covered in formal publications.\n`)
  }

  if (cat.video.length > 0) {
    parts.push(`### Educational Resources\n\n${cat.video.length} video resources were found, providing visual and auditory learning materials that complement the written sources.\n`)
  }

  parts.push(`## Key Takeaways\n\n` +
    `1. The topic "${research.query}" is actively discussed across multiple platforms.\n` +
    `2. ${cat.academic.length > 0 ? 'Academic research provides a solid theoretical foundation.' : 'More academic research may be needed in this area.'}\n` +
    `3. ${cat.code.length > 0 ? 'Practical implementations exist and are actively maintained.' : 'Practical implementations may be limited.'}\n` +
    `4. ${cat.news.length > 0 ? 'Recent developments indicate this is an evolving field.' : 'The field may be relatively stable.'}\n`
  )

  return parts.join('\n')
}

// ---- 渲染 ----

function renderMarkdown(report: ResearchReport): string {
  const lines: string[] = []

  lines.push(`# ${report.title}\n`)
  lines.push(`*Generated: ${report.metadata.generatedAt} | Sources: ${report.metadata.totalSources}*\n`)
  lines.push(`---\n`)

  // 摘要
  lines.push(`## Abstract\n`)
  lines.push(report.abstract)
  lines.push(`\n---\n`)

  // 章節
  for (const section of report.sections) {
    const prefix = '#'.repeat(section.level + 1)
    lines.push(`\n${prefix} ${section.heading}\n`)
    lines.push(section.content)
    lines.push('')
  }

  // 參考文獻
  lines.push(`\n---\n`)
  lines.push(`## References\n`)
  for (const ref of report.references) {
    const dateStr = ref.date ? ` (${ref.date})` : ''
    lines.push(`${ref.index}. **${ref.title}**${dateStr}`)
    lines.push(`   - Source: ${ref.source} | Type: ${ref.type}`)
    lines.push(`   - URL: ${ref.url}`)
    lines.push('')
  }

  // 統計
  lines.push(`\n---\n`)
  lines.push(`## Source Statistics\n`)
  for (const [source, count] of Object.entries(report.metadata.sourcesBreakdown)) {
    lines.push(`- ${source}: ${count}`)
  }

  return lines.join('\n')
}

function renderHtml(report: ResearchReport): string {
  // 簡化版 HTML 渲染
  const md = renderMarkdown(report)
  // 基本 Markdown to HTML 轉換
  const html = md
    .replace(/^# (.*$)/gm, '<h1>$1</h1>')
    .replace(/^## (.*$)/gm, '<h2>$1</h2>')
    .replace(/^### (.*$)/gm, '<h3>$1</h3>')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/^- (.*$)/gm, '<li>$1</li>')
    .replace(/\n\n/g, '</p><p>')

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${report.title}</title>
  <style>
    body { font-family: 'Segoe UI', sans-serif; max-width: 900px; margin: 0 auto; padding: 40px 20px; line-height: 1.8; color: #333; }
    h1 { color: #1a1a2e; border-bottom: 3px solid #6366f1; padding-bottom: 10px; }
    h2 { color: #16213e; margin-top: 40px; }
    h3 { color: #0f3460; }
    li { margin: 8px 0; }
    hr { border: none; border-top: 1px solid #ddd; margin: 30px 0; }
    .meta { color: #666; font-size: 0.9em; }
  </style>
</head>
<body>
  <p>${html}</p>
</body>
</html>`
}

// ---- 儲存 ----

function saveReport(title: string, content: string, dateStr: string): string {
  const dir = join(homedir(), 'AgentOS', 'Memory', 'outputs', 'research')
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true })
  }

  const safeName = title.replace(/[^a-zA-Z0-9\u4e00-\u9fff]/g, '_').substring(0, 80)
  const filename = `${dateStr}_${safeName}.md`
  const filepath = join(dir, filename)

  writeFileSync(filepath, content, 'utf-8')
  return filepath
}
