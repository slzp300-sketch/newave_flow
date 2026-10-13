import { readFile, mkdir, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { privacyPolicy as policy } from '../src/content/privacyPolicy.js'

if (!policy.publicationReady && process.env.ALLOW_PRIVACY_DRAFT !== '1') {
  throw new Error('개인정보 운영 기준 확인 전입니다. 로컬 검토만 ALLOW_PRIVACY_DRAFT=1을 사용하고 확정 전 배포·릴리스하지 마세요.')
}
if (policy.publicationReady && !/^\d{4}-\d{2}-\d{2}$/.test(policy.effectiveDate || '')) throw new Error('확정 방침의 시행일이 필요합니다.')
const escape = value => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;')
const css = await readFile(new URL('../src/styles/privacy-policy.css', import.meta.url), 'utf8')
const contents = policy.sections.map(section => `<a href="#${escape(section.id)}">${escape(section.title)}</a>`).join('\n')
const sections = policy.sections.map(section => `<section id="${escape(section.id)}"><h3>${escape(section.title)}</h3>
${(section.paragraphs || []).map(text => `<p>${escape(text)}</p>`).join('\n')}
${section.entries ? `<dl>${section.entries.map(([term, description]) => `<div><dt>${escape(term)}</dt><dd>${escape(description)}</dd></div>`).join('\n')}</dl>` : ''}
${section.links ? `<ul class="privacy-links">${section.links.map(([label, url]) => `<li><a href="${escape(url)}"${url.startsWith('https:') ? ' target="_blank" rel="noopener noreferrer"' : ''}>${escape(label)}</a></li>`).join('\n')}</ul>` : ''}</section>`).join('\n')
const html = `<!doctype html>
<html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escape(policy.title)}</title><meta name="description" content="뉴웨이브 플로우의 개인정보 처리 목적·항목·보관 기간·삭제 요청과 해외 보관 안내">
<style>*{box-sizing:border-box}body{background:#f7f9fb;font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;margin:0}main{max-width:760px;margin:auto}.public-header{background:white;border-bottom:1px solid #e5e9ee;padding:14px 20px}.public-header h1{font-size:17px;margin:0}.public-footer{display:flex;flex-wrap:wrap;justify-content:center;gap:20px;padding:12px 20px 32px;font-size:13px}.public-footer a{color:#087b59}${css}</style></head>
<body><main><header class="public-header"><h1>개인정보처리방침</h1></header>
<article class="privacy-document"><p class="privacy-brand">NEWAVE FLOW</p><h2>${escape(policy.title)}</h2>
<p class="privacy-meta">${policy.effectiveDate ? `시행일: ${escape(policy.effectiveDate)}` : '공개 전 운영 확인본 · 시행일 미확정'}</p>
${policy.publicationReady ? '' : '<p class="privacy-draft">미확정 운영 기준을 확인 중인 검토본입니다. 아직 확정·시행된 개인정보처리방침이 아닙니다.</p>'}
<nav class="privacy-contents" aria-label="개인정보처리방침 목차">${contents}</nav>${sections}</article>
<nav class="public-footer" aria-label="이용 지원"><a href="/login">로그인 화면</a><a href="/support">고객지원</a><a href="/account-deletion">계정 삭제 요청</a></nav></main></body></html>`
const target = new URL('../public/privacy/index.html', import.meta.url)
await mkdir(new URL('.', target), { recursive: true })
await writeFile(target, html, 'utf8')
console.log(`Privacy HTML generated: ${fileURLToPath(target)} (${policy.publicationReady ? policy.effectiveDate : 'local draft'})`)
