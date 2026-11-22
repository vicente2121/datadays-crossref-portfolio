import { useState } from 'react';
import { ArrowRight, ArrowUpRight, BookOpen, Check, ChevronRight, ExternalLink, FileCode2, FolderOpen, Layers3, Menu, Moon, Sun, X } from 'lucide-react';
import { useTheme } from './hooks/theme.context';
import { caseStudy } from './portfolio.data';

const navigation = [
  { label: 'El caso', href: '#caso' },
  { label: 'Arquitectura', href: '#arquitectura' },
  { label: 'Resultados', href: '#resultados' },
  { label: 'Material', href: '#material' },
];

function Motif() {
  return <div className={`motif motif--${caseStudy.motif}`} aria-hidden="true">
    <span className="motif__orbit motif__orbit--one" /><span className="motif__orbit motif__orbit--two" /><span className="motif__orbit motif__orbit--three" />
    <span className="motif__axis motif__axis--one" /><span className="motif__axis motif__axis--two" />
    <span className="motif__core">{caseStudy.monogram}</span>
    <span className="motif__satellite motif__satellite--one" /><span className="motif__satellite motif__satellite--two" /><span className="motif__satellite motif__satellite--three" />
  </div>;
}

export default function PortfolioApp() {
  const { isDark, toggleTheme } = useTheme();
  const [activeStage, setActiveStage] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const stage = caseStudy.stages[activeStage];

  return <div className={`portfolio portfolio--${caseStudy.motif}`}>
    <div className="portfolio__topline" />
    <header className="portfolio__header">
      <a className="portfolio__brand" href="#inicio" aria-label="Ir al inicio"><span className="portfolio__brand-mark">DD</span><span>DATA DAYS <span className="portfolio__brand-separator">/</span> DP-600</span></a>
      <nav className={`portfolio__nav ${menuOpen ? 'portfolio__nav--open' : ''}`} aria-label="Secciones">
        {navigation.map((item) => <a key={item.href} href={item.href} onClick={() => setMenuOpen(false)}>{item.label}</a>)}
      </nav>
      <div className="portfolio__header-actions">
        <button className="portfolio__icon-button" type="button" onClick={toggleTheme} aria-label={isDark ? 'Activar tema claro' : 'Activar tema oscuro'} title={isDark ? 'Tema claro' : 'Tema oscuro'}>{isDark ? <Sun aria-hidden="true" /> : <Moon aria-hidden="true" />}</button>
        <button className="portfolio__icon-button portfolio__menu-button" type="button" onClick={() => setMenuOpen((open) => !open)} aria-label={menuOpen ? 'Cerrar menú' : 'Abrir menú'} aria-expanded={menuOpen}>{menuOpen ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}</button>
      </div>
    </header>

    <main id="inicio">
      <section className="portfolio__hero" aria-labelledby="hero-title">
        <div className="portfolio__hero-copy">
          <p className="portfolio__eyebrow"><span className="portfolio__eyebrow-dot" /> {caseStudy.kicker}</p>
          <h1 id="hero-title">{caseStudy.title}</h1>
          <p className="portfolio__hero-intro">{caseStudy.intro}</p>
          <div className="portfolio__hero-actions">
            <a className="portfolio__button portfolio__button--primary" href="#caso">Explorar el caso <ArrowRight aria-hidden="true" /></a>
            <a className="portfolio__button portfolio__button--quiet" href={caseStudy.sourceUrl} target="_blank" rel="noreferrer">Material original <ArrowUpRight aria-hidden="true" /></a>
          </div>
          <p className="portfolio__hero-note">{caseStudy.disclosure}</p>
        </div>
        <div className="portfolio__hero-art">
          <div className="portfolio__hero-art-header"><span>ARQUITECTURA / {caseStudy.number}</span><span>FABRIC CASE STUDY</span></div>
          <Motif />
          <div className="portfolio__hero-art-footer"><span>{caseStudy.flow}</span><span className="portfolio__status"><span /> DOCUMENTADO</span></div>
        </div>
      </section>

      <section className="portfolio__metrics" aria-label="Datos clave del proyecto">
        {caseStudy.metrics.map((metric) => <div className="portfolio__metric" key={metric.label}><strong>{metric.value}</strong><span>{metric.label}</span></div>)}
        <div className="portfolio__metric portfolio__metric--tag"><span>{caseStudy.domain}</span></div>
      </section>

      <section className="portfolio__section portfolio__intro-grid" id="caso" aria-labelledby="case-title">
        <div><p className="portfolio__section-index">01 / EL CASO</p><h2 id="case-title">{caseStudy.challengeTitle}</h2></div>
        <div className="portfolio__prose"><p>{caseStudy.challenge}</p><div className="portfolio__takeaway"><span className="portfolio__takeaway-icon"><Check aria-hidden="true" /></span><span>{caseStudy.takeaway}</span></div></div>
      </section>

      <section className="portfolio__section portfolio__architecture" id="arquitectura" aria-labelledby="architecture-title">
        <div className="portfolio__section-heading"><div><p className="portfolio__section-index">02 / ARQUITECTURA</p><h2 id="architecture-title">De la fuente al informe.</h2></div><p>Selecciona una capa para ver su función y sus artefactos.</p></div>
        <div className="portfolio__stage-layout">
          <div className="portfolio__stage-list" role="group" aria-label="Capas del proyecto">
            {caseStudy.stages.map((item, index) => <button key={item.name} className={`portfolio__stage ${index === activeStage ? 'portfolio__stage--active' : ''}`} type="button" onClick={() => setActiveStage(index)} aria-pressed={index === activeStage}><span className="portfolio__stage-number">0{index + 1}</span><span><strong>{item.name}</strong><small>{item.short}</small></span><ChevronRight aria-hidden="true" /></button>)}
          </div>
          <article className="portfolio__stage-detail" aria-live="polite">
            <div className="portfolio__stage-detail-top"><Layers3 aria-hidden="true" /><span>CAPA 0{activeStage + 1} / 0{caseStudy.stages.length}</span></div>
            <h3>{stage.title}</h3><p>{stage.description}</p>
            <ul>{stage.points.map((point) => <li key={point}><Check aria-hidden="true" />{point}</li>)}</ul>
            <span className="portfolio__stage-caption">{stage.caption}</span>
          </article>
        </div>
      </section>

      <section className="portfolio__section portfolio__results" id="resultados" aria-labelledby="results-title">
        <div className="portfolio__section-heading"><div><p className="portfolio__section-index">03 / RESULTADOS</p><h2 id="results-title">Preguntas que resuelve.</h2></div><p>{caseStudy.resultsIntro}</p></div>
        <div className="portfolio__outcome-grid">{caseStudy.outcomes.map((outcome, index) => <article className="portfolio__outcome" key={outcome.question}><span>0{index + 1}</span><h3>{outcome.question}</h3><p>{outcome.answer}</p></article>)}</div>
        <div className="portfolio__limits"><strong>Alcance honesto</strong><p>{caseStudy.limit}</p></div>
      </section>

      <section className="portfolio__section portfolio__materials" id="material" aria-labelledby="materials-title">
        <div className="portfolio__section-heading"><div><p className="portfolio__section-index">04 / MATERIAL</p><h2 id="materials-title">Abre el proyecto.</h2></div><p>Este repositorio incluye los artefactos del caso, tomados del material general de Data Days.</p></div>
        <div className="portfolio__artifact-grid">{caseStudy.artifacts.map((artifact) => <a href={artifact.href} className="portfolio__artifact" key={artifact.title} target="_blank" rel="noreferrer"><span className="portfolio__artifact-icon">{artifact.kind === 'guide' ? <BookOpen aria-hidden="true" /> : artifact.kind === 'code' ? <FileCode2 aria-hidden="true" /> : <FolderOpen aria-hidden="true" />}</span><span><strong>{artifact.title}</strong><small>{artifact.description}</small></span><ExternalLink aria-hidden="true" /></a>)}</div>
        <div className="portfolio__replica"><div><p className="portfolio__section-index">PARA REPRODUCIRLO</p><h3>{caseStudy.replicaTitle}</h3></div><ol>{caseStudy.replicaSteps.map((step) => <li key={step}>{step}</li>)}</ol></div>
      </section>
    </main>

    <footer className="portfolio__footer"><span>DATA DAYS / DP-600 · {caseStudy.footer}</span><a href={caseStudy.sourceUrl} target="_blank" rel="noreferrer">Ver caso original <ArrowUpRight aria-hidden="true" /></a></footer>
  </div>;
}
