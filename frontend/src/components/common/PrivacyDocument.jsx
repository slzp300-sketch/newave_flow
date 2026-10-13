import { privacyPolicy } from '../../content/privacyPolicy'
import '../../styles/privacy-policy.css'

export default function PrivacyDocument() {
  return <article className="privacy-document">
    <p className="privacy-brand">NEWAVE FLOW</p>
    <h2>{privacyPolicy.title}</h2>
    <p className="privacy-meta">{privacyPolicy.effectiveDate ? `시행일: ${privacyPolicy.effectiveDate}` : '공개 전 운영 확인본 · 시행일 미확정'}</p>
    {!privacyPolicy.publicationReady && <p className="privacy-draft">미확정 운영 기준을 확인 중인 검토본입니다. 아직 확정·시행된 개인정보처리방침이 아닙니다.</p>}
    <nav className="privacy-contents" aria-label="개인정보처리방침 목차">
      {privacyPolicy.sections.map(section => <a key={section.id} href={`#${section.id}`} onClick={event => {
        event.preventDefault()
        document.getElementById(section.id)?.scrollIntoView({ behavior: 'auto', block: 'start' })
      }}>{section.title}</a>)}
    </nav>
    {privacyPolicy.sections.map(section => <section key={section.id} id={section.id}>
      <h3>{section.title}</h3>
      {section.paragraphs?.map((paragraph, i) => <p key={i}>{paragraph}</p>)}
      {section.entries && <dl>{section.entries.map(([term, description]) => <div key={term}><dt>{term}</dt><dd>{description}</dd></div>)}</dl>}
      {section.links && <ul className="privacy-links">{section.links.map(([label, url]) => <li key={url}><a href={url} target={url.startsWith('https:') ? '_blank' : undefined} rel="noopener noreferrer">{label}</a></li>)}</ul>}
    </section>)}
  </article>
}
