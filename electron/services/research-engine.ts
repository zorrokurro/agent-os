import https from 'https';
import http from 'http';
import { URL } from 'url';

// ==========================================
// 多平台搜尋引擎
// ==========================================

export interface SearchResult {
  title: string
  url: string
  snippet: string
  source: string
  date?: string
}

export interface ResearchResult {
  query: string
  results: SearchResult[]
  timestamps: {
    started: string
    completed: string
  }
}

// ---- HTTP 工具 ----

function fetchUrl(url: string, headers: Record<string, string> = {}): Promise<string> {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const mod = u.protocol === 'https:' ? https : http;
    const req = mod.request({
      hostname: u.hostname,
      path: u.pathname + u.search,
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9,zh-TW;q=0.8',
        ...headers,
      },
      timeout: 15000,
    }, (res) => {
      if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        const redirectUrl = res.headers.location.startsWith('/')
          ? `${u.protocol}//${u.host}${res.headers.location}`
          : res.headers.location;
        return fetchUrl(redirectUrl, headers).then(resolve).catch(reject);
      }
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
    req.end();
  });
}

function decodeHtml(text: string): string {
  return text
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&#x27;/g, "'")
    .replace(/<[^>]+>/g, '').trim();
}

// ---- 1. Google News RSS ----

async function searchGoogleNews(query: string, lang = 'en'): Promise<SearchResult[]> {
  try {
    const hl = lang === 'zh' ? 'zh-TW' : 'en'
    const gl = lang === 'zh' ? 'TW' : 'US'
    const ceid = lang === 'zh' ? 'TW:zh-Hant' : 'US:en'
    const url = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=${hl}&gl=${gl}&ceid=${ceid}`
    const xml = await fetchUrl(url)

    const results: SearchResult[] = []
    const itemRegex = /<item>([\s\S]*?)<\/item>/g
    let match
    while ((match = itemRegex.exec(xml)) !== null) {
      const block = match[1]
      const title = extractXmlTag(block, 'title')
      const link = extractXmlTag(block, 'link')
      const pubDate = extractXmlTag(block, 'pubDate')
      const source = extractXmlTag(block, 'source')
      const description = extractXmlTag(block, 'description')

      if (title && link) {
        results.push({
          title: decodeHtml(title),
          url: link,
          snippet: decodeHtml(description).substring(0, 300),
          source: source || 'Google News',
          date: pubDate ? new Date(pubDate).toISOString().split('T')[0] : undefined,
        })
      }
    }
    return results.slice(0, 15)
  } catch {
    return []
  }
}

function extractXmlTag(xml: string, tag: string): string {
  const regex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`)
  const match = regex.exec(xml)
  if (match) {
    return match[1]
      .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
      .replace(/<[^>]+>/g, '')
      .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"').replace(/&#39;/g, "'").trim()
  }
  return ''
}

// ---- 2. arXiv API ----

async function searchArxiv(query: string): Promise<SearchResult[]> {
  try {
    const url = `https://export.arxiv.org/api/query?search_query=all:${encodeURIComponent(query)}&start=0&max_results=10&sortBy=submittedDate&sortOrder=descending`
    const xml = await fetchUrl(url)

    const results: SearchResult[] = []
    const entryRegex = /<entry>([\s\S]*?)<\/entry>/g
    let match
    while ((match = entryRegex.exec(xml)) !== null) {
      const block = match[1]
      const title = extractXmlTag(block, 'title')
      const summary = extractXmlTag(block, 'summary')
      const published = extractXmlTag(block, 'published')
      const id = extractXmlTag(block, 'id')
      const authors = (block.match(/<name>([^<]+)<\/name>/g) || []).map(a =>
        a.replace(/<\/?name>/g, '')
      ).slice(0, 3).join(', ')

      if (title) {
        results.push({
          title: decodeHtml(title),
          url: id || '',
          snippet: `${authors} — ${decodeHtml(summary).substring(0, 300)}`,
          source: 'arXiv',
          date: published ? published.split('T')[0] : undefined,
        })
      }
    }
    return results
  } catch {
    return []
  }
}

// ---- 3. DuckDuckGo Instant Answer ----

async function searchDuckDuckGo(query: string): Promise<SearchResult[]> {
  try {
    const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`
    const html = await fetchUrl(url)

    const results: SearchResult[] = []
    // 解析搜尋結果
    const resultRegex = /<div class="result[^"]*"[^>]*>([\s\S]*?)<\/div>\s*<\/div>\s*<\/div>/g
    let match
    while ((match = resultRegex.exec(html)) !== null) {
      const block = match[1]
      const titleMatch = block.match(/<a[^>]*class="result__a"[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/)
      const snippetMatch = block.match(/<a[^>]*class="result__snippet"[^>]*>([\s\S]*?)<\/a>/)

      if (titleMatch) {
        const title = decodeHtml(titleMatch[2])
        const url = titleMatch[1]
        const snippet = snippetMatch ? decodeHtml(snippetMatch[1]) : ''

        if (title && url && !url.includes('duckduckgo.com/y.js')) {
          results.push({ title, url, snippet: snippet.substring(0, 300), source: 'DuckDuckGo' })
        }
      }
    }
    return results.slice(0, 10)
  } catch {
    return []
  }
}

// ---- 4. YouTube 搜尋 ----

async function searchYouTube(query: string): Promise<SearchResult[]> {
  try {
    const url = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}&sp=CAISBBABGAE%253D` // 排序：相關性
    const html = await fetchUrl(url)

    const results: SearchResult[] = []

    // 從 ytInitialData 提取
    const dataMatch = html.match(/var ytInitialData = (\{.*?\});/s) ||
                      html.match(/window\["ytInitialData"\] = (\{.*?\});/s)

    if (dataMatch) {
      try {
        const data = JSON.parse(dataMatch[1])
        const contents = data?.contents?.twoColumnSearchResultsRenderer?.primaryContents?.sectionListRenderer?.contents?.[0]?.itemSectionRenderer?.contents || []

        for (const item of contents) {
          const video = item?.videoRenderer
          if (!video) continue

          const title = video?.title?.runs?.[0]?.text || ''
          const videoId = video?.videoId
          const description = video?.detailedMetadataSnippets?.[0]?.snippetText?.runs?.map((r: any) => r.text).join('') || ''
          const channel = video?.ownerText?.runs?.[0]?.text || ''
          const viewCount = video?.viewCountText?.simpleText || ''

          if (title && videoId) {
            results.push({
              title,
              url: `https://www.youtube.com/watch?v=${videoId}`,
              snippet: `${channel} | ${viewCount} | ${description.substring(0, 200)}`,
              source: 'YouTube',
            })
          }
        }
      } catch {
        // JSON parse failed
      }
    }

    return results.slice(0, 8)
  } catch {
    return []
  }
}

// ---- 5. GitHub 搜尋 ----

async function searchGitHub(query: string): Promise<SearchResult[]> {
  try {
    const url = `https://api.github.com/search/repositories?q=${encodeURIComponent(query)}&sort=stars&order=desc&per_page=8`
    const json = await fetchUrl(url, { 'Accept': 'application/vnd.github.v3+json' })
    const data = JSON.parse(json)

    return (data.items || []).map((item: any) => ({
      title: item.full_name,
      url: item.html_url,
      snippet: item.description || 'No description',
      source: `GitHub ⭐ ${item.stargazers.toLocaleString()}`,
      date: item.updated_at?.split('T')[0],
    }))
  } catch {
    return []
  }
}

// ---- 6. Hacker News 搜尋 ----

async function searchHackerNews(query: string): Promise<SearchResult[]> {
  try {
    const url = `https://hn.algolia.com/api/v1/search?query=${encodeURIComponent(query)}&tags=story&hitsPerPage=8`
    const json = await fetchUrl(url)
    const data = JSON.parse(json)

    return (data.hits || []).map((item: any) => ({
      title: item.title,
      url: item.url || `https://news.ycombinator.com/item?id=${item.objectID}`,
      snippet: `${item.points} points | ${item.num_comments} comments | by ${item.author}`,
      source: 'Hacker News',
      date: item.created_at ? item.created_at.split('T')[0] : undefined,
    }))
  } catch {
    return []
  }
}

// ==========================================
// 主要研究函數
// ==========================================

export interface ResearchOptions {
  query: string
  sources?: Array<'news' | 'arxiv' | 'web' | 'youtube' | 'github' | 'hackernews' | 'zh_news'>
  maxPerSource?: number
}

export async function conductResearch(options: ResearchOptions): Promise<ResearchResult> {
  const { query, sources = ['news', 'arxiv', 'web', 'youtube', 'github', 'hackernews', 'zh_news'], maxPerSource = 10 } = options

  const started = new Date().toISOString()

  // 並行搜尋所有來源
  const searchPromises: Promise<SearchResult[]>[] = []

  if (sources.includes('news')) {
    searchPromises.push(searchGoogleNews(query, 'en'))
  }
  if (sources.includes('zh_news')) {
    searchPromises.push(searchGoogleNews(query, 'zh'))
  }
  if (sources.includes('arxiv')) {
    searchPromises.push(searchArxiv(query))
  }
  if (sources.includes('web')) {
    searchPromises.push(searchDuckDuckGo(query))
  }
  if (sources.includes('youtube')) {
    searchPromises.push(searchYouTube(query))
  }
  if (sources.includes('github')) {
    searchPromises.push(searchGitHub(query))
  }
  if (sources.includes('hackernews')) {
    searchPromises.push(searchHackerNews(query))
  }

  const resultsArrays = await Promise.all(searchPromises)

  // 合併並去重
  const allResults: SearchResult[] = []
  const seenUrls = new Set<string>()

  for (const arr of resultsArrays) {
    for (const r of arr) {
      if (!seenUrls.has(r.url)) {
        seenUrls.add(r.url)
        allResults.push(r)
        if (allResults.length >= maxPerSource * sources.length) break
      }
    }
  }

  return {
    query,
    results: allResults,
    timestamps: {
      started,
      completed: new Date().toISOString(),
    },
  }
}
