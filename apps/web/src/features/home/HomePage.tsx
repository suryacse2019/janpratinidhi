import React from "react";
import { ArrowRight, ArrowUpRight, Bookmark, Check, CircleHelp, ExternalLink, FileText, Github, Landmark, Menu, Search, ShieldCheck, Sparkles, Vote, X } from "lucide-react";
import type { Representative } from "@janpratinidhi/shared";
import { RepresentativeAvatar } from "../representatives/RepresentativeFeatures";
import { RepresentativeSearchCard } from "../representatives/RepresentativeFeatures";
import { ThemeToggle } from "../directory/PublicPoliticianPage";
import { ProfileCompletionModal } from "../admin/AdminFeatures";
import { ContributorSection } from "./ContributorSection";
import { ProfileMenu } from "../../components/ProfileMenu";

type Profile = Representative;
type User = { id: string; email: string; name: string; picture?: string; firstName?: string };
type Gender = "female" | "male" | "non_binary" | "prefer_not_to_say";

export function HomePage({ profiles, profileTotal, theme, toggleTheme, mobileNav, setMobileNav, user, signOut, signIn, authBusy, notice, setNotice, selected, setSelected, toggleSave, saved, pendingProfile, profileBusy, completeUserProfile, apiUrl }: { profiles: Profile[]; profileTotal: number; theme: "light" | "dark"; toggleTheme: () => void; mobileNav: boolean; setMobileNav: (value: boolean) => void; user: User | null; signOut: () => void; signIn: () => void; authBusy: boolean; notice: string; setNotice: (value: string) => void; selected: Profile | null; setSelected: (value: Profile | null) => void; toggleSave: (id: string) => void; saved: string[]; pendingProfile: User | null; profileBusy: boolean; completeUserProfile: (profile: { firstName: string; lastName: string; phoneNumber: string; gender: Gender }) => Promise<void>; apiUrl: string }) {
  return <div className="site-shell">
     <header className="header">
      <a className="brand" href="#home" aria-label="Janpratinidhi home"><span className="brand-mark"><Landmark size={20} strokeWidth={2.2} /></span><span className="brand-name">Jan Pratinidhi<span>.</span></span></a>
      <button className="mobile-menu icon-button" onClick={() => setMobileNav(!mobileNav)} aria-label="Toggle navigation">{mobileNav ? <X /> : <Menu />}</button>
      <nav className={mobileNav ? "nav-links open" : "nav-links"}>
        <a className="active" href="/politician">Explore Politician</a><a href="#how">How it works</a><a href="#about">About the project</a>
      </nav>
      {/* <a className="login-button admin-header-button" href="/admin/dashboard">Admin <Landmark size={14} /></a> */}
      {user && <a className="login-button dashboard-header-button" href="/dashboard">Dashboard <ArrowRight size={14} /></a>}
      <ThemeToggle theme={theme} onToggle={toggleTheme} />
      {user ? <ProfileMenu user={user} onSignOut={signOut} /> : <button className="login-button" onClick={signIn} disabled={authBusy}>{authBusy ? "Signing in…" : "Sign In"} <ArrowRight size={15} /></button>}
    </header>

    <main>
      <section className="hero" id="home">
        <div className="hero-copy">
          <div className="eyebrow"><span className="eyebrow-icon"><Sparkles size={13} /></span> YOUR PUBLIC REPRESENTATIVE DIRECTORY</div>
          <h1>Know the people<br />who <em>represent you.</em></h1>
          <p className="hero-sub">A clearer view of India's elected representatives, their public records, and the sources behind every detail.</p>
          <div className="hero-actions"><a href="/politician" className="primary-button">Explore politicians <ArrowRight size={16} /></a><a href="https://github.com/suryacse2019/janpratinidhi" className="text-button" target="_blank" rel="noreferrer"><Github size={16} /> GitHub</a></div>
          <div className="hero-proof"><div className="proof-avatars"><span>IN</span><span>EC</span><span>OP</span></div><span>Built on public records.<br /><b>Open for everyone.</b></span></div>
        </div>
        <div className="hero-art" aria-label="Illustration of the Indian Parliament">
          <div className="art-orbit orbit-one" /><div className="art-orbit orbit-two" />
          <div className="art-caption"><span className="caption-line" /> PEOPLE'S HOUSE <span>·</span> NEW DELHI</div>
          <div className="parliament-card">
            <div className="building-sun" /><div className="building-ground" />
            <div className="building-roof"><span /><span /><span /><span /><span /><span /><span /></div>
            <div className="building-top" />
            <div className="building-columns">{Array.from({ length: 11 }).map((_, i) => <i key={i} />)}</div>
            <div className="building-base" /><div className="building-steps" />
            <span className="flag flag-one" /><span className="flag flag-two" />
          </div>
          <div className="floating-note note-source"><span className="note-icon"><FileText size={15} /></span><span><b>Every fact has a source</b><small>Read the original record ↗</small></span></div>
          <div className="floating-note note-record"><span className="note-check"><Check size={15} /></span><span><b>Verified public records</b><small>With dates and context</small></span></div>
          <div className="art-footnote">A public resource, shaped by the public <span>✳</span></div>
        </div>
      </section>

      <section className="stats-band" aria-label="Directory overview">
        <div className="stat"><span className="stat-icon orange"><Landmark size={17} /></span><span><b>{profileTotal.toLocaleString("en-IN")}</b><small>Published profiles</small></span></div>
        <div className="stat"><span className="stat-icon blue"><Vote size={17} /></span><span><b>3</b><small>Types of office</small></span></div>
        <div className="stat"><span className="stat-icon green"><ShieldCheck size={17} /></span><span><b>Source first</b><small>Every record traceable</small></span></div>
        <div className="stats-note">Published public records<span> · </span>National coverage is in progress</div>
      </section>

      <section className="directory-section" id="directory">
        <div className="section-heading"><div><div className="eyebrow small-eyebrow">THE DIRECTORY <span className="heading-rule" /></div><h2>Meet your representatives<span>.</span></h2><p>Browse MPs and MLAs by name, constituency, state, or party. Each profile links to its available public sources.</p></div></div>
        <div className="people-grid">
          {profiles.map((person) => <RepresentativeSearchCard key={person.id} person={person} variant="home" apiUrl={apiUrl} />)}
        </div>
        <div className="directory-bottom"><span>Explore {profileTotal.toLocaleString("en-IN")} published MP and MLA profiles.</span><a className="primary-button" href="/politician">Explore politician <ArrowRight size={15} /></a></div>
      </section>

      <section className="trust-section" id="how"><div className="trust-copy"><div className="eyebrow small-eyebrow">BUILT FOR TRUST <span className="heading-rule" /></div><h2>Facts you can<br /><em>follow through.</em></h2><p>Public information should be easy to find and simple to verify. We connect each profile to the original public record, so you can check the context for yourself.</p><a href="https://www.eci.gov.in/affidavit-portal" target="_blank" rel="noreferrer" className="source-link">Explore ECI affidavit portal <ExternalLink size={14} /></a></div>
        <div className="trust-steps"><TrustStep number="01" icon={<Search size={18} />} title="Find a person" body="Search by name, state, constituency, party, or office." /><TrustStep number="02" icon={<FileText size={18} />} title="Check the record" body="See public education details, terms, and election results." /><TrustStep number="03" icon={<ExternalLink size={18} />} title="Go to the source" body="Open the original portal or document behind a claim." /></div>
      </section>
      <section className="bottom-cta" id="about"><span className="cta-mark"><Landmark size={20} /></span><div><h3>Democracy works better when it's easier to understand.</h3><p>Help make public information clearer, one well-sourced record at a time.</p></div><button onClick={() => setNotice("Thanks for your interest. The contributor guide will be available soon.")}>Get involved <ArrowRight size={15} /></button><div className="cta-deco">✳</div></section>
    </main>
    <ContributorSection />
    <footer className="community-footer">
      <div className="footer-brand-lockup">
        <a className="footer-wordmark" href="#home"><span>Jan</span> <span>Pratinidhi</span></a>
        <p>Open source <i>·</i> Built by community</p>
      </div>
      <nav className="footer-menu" aria-label="Footer navigation">
        <a href="#about">About</a>
        <a href="https://github.com/suryacse2019/janpratinidhi" target="_blank" rel="noreferrer">GitHub <ArrowUpRight size={13} /></a>
        <a href="/politician">Politicians</a>
        <a href="https://github.com/suryacse2019/janpratinidhi/issues/new" target="_blank" rel="noreferrer">Contributing <ArrowUpRight size={13} /></a>
      </nav>
      <small>© {new Date().getFullYear()} Jan Pratinidhi community</small>
    </footer>

    {notice && <div className="toast"><Check size={16} />{notice}<button onClick={() => setNotice("")} aria-label="Dismiss"><X size={15} /></button></div>}
    {selected && <ProfileModal person={selected} onClose={() => setSelected(null)} onSave={() => toggleSave(selected.id)} saved={saved.includes(selected.id)} />}
    {pendingProfile && <ProfileCompletionModal user={pendingProfile} busy={profileBusy} onSubmit={completeUserProfile} />}
  </div>;
}

function PersonCard({ person, index, saved, onOpen, onSave }: { person: Profile; index: number; saved: boolean; onOpen: () => void; onSave: () => void }) {
  const tones = ["tone-peach", "tone-sage", "tone-lavender", "tone-sky"];
  return <article className="person-card" style={{ animationDelay: `${index * 55}ms` }}>
    <div className="card-top"><span className="office-tag"><span className="tag-dot" />{person.office}</span><button className={saved ? "save-button is-saved" : "save-button"} onClick={onSave} title={saved ? "Remove saved profile" : "Save profile"}><Bookmark size={17} fill={saved ? "currentColor" : "none"} /></button></div>
    <button className="person-main" onClick={onOpen}><RepresentativeAvatar person={person} tone={tones[index % tones.length]} showSpark /><span className="person-name">{person.name}</span><span className="person-loc"><span>{person.constituency}</span><i>·</i><span>{person.state}</span></span></button>
    <div className="card-divider" /><div className="party-line"><span className="party-monogram">{person.partyShort?.slice(0, 2) || "—"}</span><span>{person.party}</span><ArrowUpRight size={13} className="party-arrow" /></div>
    <div className="card-foot"><span><span className="verified-dot"><Check size={9} /></span> Source linked</span><span>{person.since ? `Since ${person.since}` : "Public profile"}</span></div>
  </article>;
}

function TrustStep({ number, icon, title, body }: { number: string; icon: React.ReactNode; title: string; body: string }) {
  return <div className="trust-step"><span className="step-number">{number}</span><span className="step-icon">{icon}</span><div><h3>{title}</h3><p>{body}</p></div><ArrowUpRight size={15} className="step-arrow" /></div>;
}

function ProfileModal({ person, onClose, onSave, saved }: { person: Profile; onClose: () => void; onSave: () => void; saved: boolean }) {
  return <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section className="profile-modal" role="dialog" aria-modal="true" aria-labelledby="profile-title"><button className="modal-close" onClick={onClose} aria-label="Close profile"><X size={18} /></button><div className="modal-overline"><span className="tag-dot" />{person.office}<span className="modal-state">{person.state}</span></div><div className="modal-person"><RepresentativeAvatar person={person} showSpark /><div><h2 id="profile-title">{person.name}</h2><p>{person.party} <span>·</span> {person.constituency}</p></div></div>{person.sample && <div className="sample-warning"><CircleHelp size={15} /> Demonstration profile — details below are fictional and must not be treated as real records.</div>}<p className="modal-summary">{person.summary}</p><div className="modal-info-grid"><div><small>OFFICE</small><b>{person.office}</b></div><div><small>REPRESENTING</small><b>{person.constituency}, {person.state}</b></div><div><small>PARTY</small><b>{person.party}</b></div><div><small>EDUCATION</small><b>{person.education}</b></div></div><div className="modal-section-title"><h3>Election history</h3><span>{person.elections.length} {person.elections.length === 1 ? "record" : "records"}</span></div>{person.elections.length ? person.elections.map((election, i) => <div className="election-row" key={i}><div className="election-year">{election.year}</div><div className="election-detail"><b>{election.electionType} · {election.constituency}</b><small>{election.party} · {election.votes.toLocaleString("en-IN")} votes{election.margin ? ` · won by ${election.margin.toLocaleString("en-IN")}` : ""}</small></div><span className="won-label">{election.result}</span></div>) : <div className="no-election">Election figures are not shown for this office type in this sample.</div>}<div className="modal-section-title sources-title"><h3>Sources</h3><span>Checked {person.sources[0]?.accessedAt ?? "—"}</span></div>{person.sources.map((source, i) => <a className="modal-source" key={i} href={source.url} target="_blank" rel="noreferrer"><span className="source-file"><FileText size={16} /></span><span><b>{source.title}</b><small>{source.publisher} · opens official portal</small></span><ExternalLink size={15} /></a>)}<div className="modal-actions"><button className="primary-button" onClick={onSave}><Bookmark size={15} fill={saved ? "currentColor" : "none"} />{saved ? "Saved" : "Save profile"}</button><button className="modal-done" onClick={onClose}>Done</button></div></section></div>;
}
