import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ShieldCheck,
  Trophy,
  Youtube,
  Image as ImageIcon,
  MessageCircle,
  MessageSquare,
  Home,
  Menu,
  X,
  Play,
  ChevronRight,
  Instagram,
  Facebook,
  Mail,
  Phone,
  MapPin,
  Swords,
  Zap,
  Radio,
  Crosshair,
} from "lucide-react";
import { useSiteData } from "./context/SiteDataContext.jsx";

/**
 * =============================================================================
 * RTB ESPORTS — rtbnetworkbd.com (public site)
 * Official Garena Partner (Bangladesh) — Single-page marketing site
 * =============================================================================
 * Admin panel lives at the secure route defined by VITE_ADMIN_PATH (see
 * src/admin/). This file no longer contains any admin/login UI — settings,
 * videos, and photos are read from SiteDataContext, which the admin
 * dashboard writes to.
 *
 * PHASE 1 — visual foundation: animated cyber-grid background, mouse
 * parallax hero with floating elements, neon glow badges/buttons,
 * glassmorphism hover-lift cards, and scroll-reveal animations.
 * =============================================================================
 */

// Design tokens for this pass (Valorant/BLAST-style palette)
const CYAN = "#00F0FF";
const PURPLE = "#7000FF";
const GREEN = "#39FF14";

// ---------------------------------------------------------------------------
// SEO: inject <head> meta + Schema.org JSON-LD (since this is a component,
// not a full HTML document — in a real Next.js/Vite SSR setup, move this
// into your document head / <Helmet> instead).
// ---------------------------------------------------------------------------
function useSEO() {
  useEffect(() => {
    document.title = "RTB Esports | Official Garena Partner Bangladesh";

    const metaTags = [
      { name: "description", content: "RTB Esports — the Official Garena Partner in Bangladesh. Free Fire tournaments, live events, and creator content from rtbnetworkbd.com." },
      { property: "og:title", content: "RTB Esports | Official Garena Partner Bangladesh" },
      { property: "og:description", content: "Official Garena Partner running Free Fire esports events across Bangladesh." },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://rtbnetworkbd.com" },
      { name: "twitter:card", content: "summary_large_image" },
    ];

    const created = [];
    metaTags.forEach((attrs) => {
      const tag = document.createElement("meta");
      Object.entries(attrs).forEach(([k, v]) => tag.setAttribute(k, v));
      document.head.appendChild(tag);
      created.push(tag);
    });

    const schema = document.createElement("script");
    schema.type = "application/ld+json";
    schema.text = JSON.stringify({
      "@context": "https://schema.org",
      "@type": "SportsOrganization",
      name: "RTB Esports",
      url: "https://rtbnetworkbd.com",
      sport: "Esports",
      areaServed: "Bangladesh",
      memberOf: { "@type": "Organization", name: "Garena" },
      sameAs: ["https://www.facebook.com/rtbesports", "https://www.instagram.com/rtbesports"],
    });
    document.head.appendChild(schema);
    created.push(schema);

    const fontLink = document.createElement("link");
    fontLink.rel = "stylesheet";
    fontLink.href = "https://fonts.googleapis.com/css2?family=Orbitron:wght@600;800&family=Rajdhani:wght@500;600;700&display=swap";
    document.head.appendChild(fontLink);
    created.push(fontLink);

    return () => created.forEach((el) => el.remove());
  }, []);
}

// ---------------------------------------------------------------------------
// Favicon: swap the browser tab icon whenever settings.faviconUrl changes.
// ---------------------------------------------------------------------------
function useFavicon(faviconUrl) {
  useEffect(() => {
    if (!faviconUrl) return;
    let link = document.querySelector("link[rel~='icon']");
    if (!link) {
      link = document.createElement("link");
      link.rel = "icon";
      document.head.appendChild(link);
    }
    const previousHref = link.href;
    link.href = faviconUrl;
    return () => {
      if (link) link.href = previousHref;
    };
  }, [faviconUrl]);
}

// ---------------------------------------------------------------------------
// Countdown hook
// ---------------------------------------------------------------------------
function useCountdown(target) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const diff = Math.max(0, target.getTime() - now);
  const d = Math.floor(diff / (1000 * 60 * 60 * 24));
  const h = Math.floor((diff / (1000 * 60 * 60)) % 24);
  const m = Math.floor((diff / (1000 * 60)) % 60);
  const s = Math.floor((diff / 1000) % 60);
  return { d, h, m, s };
}

const pad = (n) => String(n).padStart(2, "0");

// ---------------------------------------------------------------------------
// Mouse parallax hook — normalized -1..1 offset from viewport center.
// Ignored automatically on touch devices (no mousemove events fire there).
// ---------------------------------------------------------------------------
function useParallax() {
  const [pos, setPos] = useState({ x: 0, y: 0 });
  useEffect(() => {
    function onMove(e) {
      const x = (e.clientX / window.innerWidth) * 2 - 1;
      const y = (e.clientY / window.innerHeight) * 2 - 1;
      setPos({ x, y });
    }
    window.addEventListener("mousemove", onMove);
    return () => window.removeEventListener("mousemove", onMove);
  }, []);
  return pos;
}

// ---------------------------------------------------------------------------
// Scroll-reveal: fades + slides a section in the first time it enters the
// viewport. Pure CSS transition, IntersectionObserver-driven.
// ---------------------------------------------------------------------------
function Reveal({ children, className = "", delay = 0 }) {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.15 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return (
    <div
      ref={ref}
      className={`transition-all duration-700 ease-out ${visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"} ${className}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Small shared bits
// ---------------------------------------------------------------------------
function SectionEyebrow({ children }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <span className="h-px w-8" style={{ background: `linear-gradient(90deg, ${CYAN}, transparent)` }} />
      <span className="text-[11px] tracking-[0.3em] uppercase text-cyan-300/90" style={{ fontFamily: "'Rajdhani', sans-serif" }}>
        {children}
      </span>
    </div>
  );
}

function GlowButton({ children, onClick, href, variant = "primary", className = "", type }) {
  const base =
    "inline-flex items-center justify-center gap-2 px-6 py-3 rounded-md font-bold text-sm tracking-wide transition-all duration-200 active:scale-95";
  const styles =
    variant === "primary"
      ? "text-white bg-gradient-to-r from-[#7000FF] to-[#00F0FF] shadow-[0_0_22px_rgba(112,0,255,0.5)] hover:shadow-[0_0_34px_rgba(0,240,255,0.65)] hover:-translate-y-0.5"
      : variant === "accent"
      ? "border text-emerald-200 bg-emerald-400/5 hover:bg-emerald-400/10 hover:-translate-y-0.5"
      : "border border-purple-400/40 text-purple-100 hover:border-cyan-400/60 hover:text-cyan-200 bg-white/5 hover:-translate-y-0.5";
  const extraStyle = variant === "accent" ? { borderColor: `${GREEN}55`, boxShadow: `0 0 0 rgba(57,255,20,0)` } : undefined;
  const Comp = href ? "a" : "button";
  return (
    <Comp href={href} onClick={onClick} type={!href ? type : undefined} className={`${base} ${styles} ${className}`} style={extraStyle}>
      {children}
    </Comp>
  );
}

// Renders the social icon row wherever it's used (header / footer / contact),
// automatically hiding any platform whose URL is empty in settings.
function SocialIconRow({ social, size = 16, className = "" }) {
  const items = [
    { key: "facebook", url: social.facebook, Icon: Facebook },
    { key: "youtube", url: social.youtube, Icon: Youtube },
    { key: "instagram", url: social.instagram, Icon: Instagram },
    { key: "discord", url: social.discord, Icon: MessageSquare },
    { key: "whatsapp", url: social.whatsapp ? `https://wa.me/${social.whatsapp}` : "", Icon: MessageCircle },
  ].filter((i) => i.url);

  if (items.length === 0) return null;

  return (
    <div className={`flex gap-3 ${className}`}>
      {items.map(({ key, url, Icon }) => (
        <a
          key={key}
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="w-9 h-9 rounded-full border border-white/10 flex items-center justify-center hover:border-cyan-400/40 hover:-translate-y-0.5 text-slate-300 transition-all"
        >
          <Icon size={size} />
        </a>
      ))}
    </div>
  );
}

// Colored pill for the Next Event's registration status (admin-set).
function RegistrationBadge({ status }) {
  const styles = {
    Open: { bg: "bg-emerald-400/10", border: "border-emerald-400/40", text: "text-emerald-300", dot: "bg-emerald-400" },
    Full: { bg: "bg-amber-400/10", border: "border-amber-400/40", text: "text-amber-300", dot: "bg-amber-400" },
    Closed: { bg: "bg-slate-400/10", border: "border-slate-400/30", text: "text-slate-400", dot: "bg-slate-500" },
  }[status] || { bg: "bg-emerald-400/10", border: "border-emerald-400/40", text: "text-emerald-300", dot: "bg-emerald-400" };

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[11px] font-bold uppercase tracking-wide ${styles.bg} ${styles.border} ${styles.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${styles.dot}`} />
      Registration {status}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------
export default function RTBEsports() {
  useSEO();
  const { settings, videos, photos, partners, teamMembers } = useSiteData();
  useFavicon(settings.faviconUrl);
  const parallax = useParallax();

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeVideo, setActiveVideo] = useState(null);
  const [photoFilter, setPhotoFilter] = useState("All");
  const countdown = useCountdown(new Date(settings.nextEventStartsAt));

  const [form, setForm] = useState({ name: "", org: "", budget: "", message: "" });

  const photoCategories = useMemo(() => ["All", ...Array.from(new Set(photos.map((p) => p.category)))], [photos]);
  const filteredPhotos = useMemo(
    () => (photoFilter === "All" ? photos : photos.filter((p) => p.category === photoFilter)),
    [photos, photoFilter]
  );

  function handleContactSubmit(e) {
    e.preventDefault();
    const text = encodeURIComponent(
      `Hi RTB Esports, I'm ${form.name}${form.org ? ` from ${form.org}` : ""}. ` +
        `Sponsorship budget: ${form.budget || "N/A"}. Message: ${form.message}`
    );
    window.open(`https://wa.me/${settings.social.whatsapp}?text=${text}`, "_blank", "noopener,noreferrer");
  }

  return (
    <div
      className="min-h-screen w-full text-slate-100 relative overflow-x-hidden"
      style={{
        background: "radial-gradient(ellipse at top, #14101f 0%, #0a0a0f 55%, #060608 100%)",
        fontFamily: "'Rajdhani', sans-serif",
      }}
    >
      <style>{`
        .font-display { font-family: 'Orbitron', sans-serif; }
        .scanlines::before {
          content: "";
          position: absolute; inset: 0;
          background: repeating-linear-gradient(0deg, rgba(255,255,255,0.03) 0px, rgba(255,255,255,0.03) 1px, transparent 1px, transparent 3px);
          pointer-events: none;
        }
        .hex-clip { clip-path: polygon(25% 0%, 75% 0%, 100% 50%, 75% 100%, 25% 100%, 0% 50%); }
        @keyframes pulseGlow { 0%,100%{ opacity:.55 } 50%{ opacity:1 } }
        .pulse-glow { animation: pulseGlow 2.2s ease-in-out infinite; }

        @keyframes ringPulse {
          0% { box-shadow: 0 0 0 0 rgba(0,240,255,0.35), 0 0 0 0 rgba(57,255,20,0.25); }
          70% { box-shadow: 0 0 0 8px rgba(0,240,255,0), 0 0 0 14px rgba(57,255,20,0); }
          100% { box-shadow: 0 0 0 0 rgba(0,240,255,0), 0 0 0 0 rgba(57,255,20,0); }
        }
        .verified-badge { animation: ringPulse 2.6s ease-out infinite; }

        @keyframes gridDrift {
          from { background-position: 0 0; }
          to { background-position: 64px 64px; }
        }
        .cyber-grid {
          position: absolute; inset: 0; z-index: 0; pointer-events: none;
          background-image:
            linear-gradient(rgba(0,240,255,0.07) 1px, transparent 1px),
            linear-gradient(90deg, rgba(112,0,255,0.07) 1px, transparent 1px);
          background-size: 64px 64px;
          animation: gridDrift 14s linear infinite;
          mask-image: radial-gradient(ellipse 70% 60% at 50% 0%, black 40%, transparent 100%);
        }

        @keyframes floatY {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-14px); }
        }
        .float-slow { animation: floatY 6s ease-in-out infinite; }
        .float-slower { animation: floatY 8s ease-in-out infinite; animation-delay: 1.2s; }
        .float-slowest { animation: floatY 7s ease-in-out infinite; animation-delay: 2.4s; }

        .glass-card {
          background: rgba(255,255,255,0.03);
          backdrop-filter: blur(10px);
          -webkit-backdrop-filter: blur(10px);
          border: 1px solid rgba(255,255,255,0.08);
        }
        .hover-lift {
          transition: transform 0.25s ease, box-shadow 0.25s ease, border-color 0.25s ease;
        }
        .hover-lift:hover {
          transform: translateY(-4px);
          box-shadow: 0 12px 32px -8px rgba(0,240,255,0.18);
          border-color: rgba(0,240,255,0.4);
        }

        @keyframes tickerScroll {
          from { transform: translateX(0); }
          to { transform: translateX(-50%); }
        }
        .ticker-track {
          animation: tickerScroll 22s linear infinite;
          width: max-content;
        }
      `}</style>

      {/* ============================ ANNOUNCEMENT BAR (admin-editable, hidden if empty) ============================ */}
      {settings.announcementBar && (
        <div className="bg-gradient-to-r from-purple-600 to-cyan-500 text-black text-center text-xs sm:text-sm font-bold py-2 px-4 relative z-10">
          {settings.announcementBar}
        </div>
      )}

      {/* ============================ TOP NAV (desktop) ============================ */}
      <header className="sticky top-0 z-40 backdrop-blur-md bg-black/40 border-b border-purple-500/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 select-none">
            {settings.logoUrl ? (
              <img src={settings.logoUrl} alt="RTB Esports logo" className="w-9 h-9 object-contain rounded" />
            ) : (
              <div className="relative w-9 h-9 hex-clip bg-gradient-to-br from-purple-500 to-cyan-400 flex items-center justify-center">
                <Swords className="w-4.5 h-4.5 text-black" size={18} />
              </div>
            )}
            <span className="font-display font-extrabold text-lg tracking-wider text-white">
              RTB<span className="text-cyan-400">.</span>
            </span>
          </div>

          <nav className="hidden md:flex items-center gap-8 text-sm font-semibold tracking-wide text-slate-300">
            <a href="#events" className="hover:text-cyan-300 transition-colors">Events</a>
            <a href="#media" className="hover:text-cyan-300 transition-colors">Media Hub</a>
            <a href="#gallery" className="hover:text-cyan-300 transition-colors">Gallery</a>
            <a href="#contact" className="hover:text-cyan-300 transition-colors">Sponsorship</a>
          </nav>

          <div className="hidden md:flex items-center gap-4">
            <SocialIconRow social={settings.social} size={14} />
            <GlowButton href="#contact">Partner With Us <ChevronRight size={16} /></GlowButton>
          </div>

          <button className="md:hidden text-slate-200" onClick={() => setMobileMenuOpen((v) => !v)}>
            {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>

        {mobileMenuOpen && (
          <div className="md:hidden border-t border-purple-500/10 bg-black/70 px-4 py-3 flex flex-col gap-3 text-sm font-semibold">
            {["events", "media", "gallery", "contact"].map((id) => (
              <a key={id} href={`#${id}`} onClick={() => setMobileMenuOpen(false)} className="py-1.5 capitalize text-slate-200">
                {id === "contact" ? "Sponsorship" : id === "media" ? "Media Hub" : id}
              </a>
            ))}
          </div>
        )}
      </header>

      {/* ============================ STATS TICKER (admin-editable, hidden if all blank) ============================ */}
      {(settings.statTournaments || settings.statPrizeMoney || settings.statReach || settings.statPlayers) && (
        <div className="relative z-10 overflow-hidden border-b border-white/5 bg-black/30 py-2.5">
          <div className="ticker-track flex whitespace-nowrap">
            {[0, 1].map((rep) => (
              <div key={rep} className="flex items-center shrink-0">
                {[settings.statTournaments, settings.statPrizeMoney, settings.statReach, settings.statPlayers]
                  .filter(Boolean)
                  .map((stat, i) => (
                    <span key={i} className="flex items-center text-xs sm:text-sm font-bold tracking-wide text-slate-300 px-6">
                      <span className="text-cyan-300">{stat}</span>
                      <span className="ml-6 text-purple-400/50">◆</span>
                    </span>
                  ))}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ============================ HERO ============================ */}
      <section className="relative px-4 sm:px-6 pt-14 pb-16 sm:pt-20 sm:pb-24 max-w-7xl mx-auto scanlines overflow-hidden">
        <div className="cyber-grid" />

        {/* Parallax glow orb */}
        <div
          className="absolute -top-20 left-1/2 w-[600px] h-[600px] rounded-full pointer-events-none transition-transform duration-300 ease-out"
          style={{
            background: `radial-gradient(circle, ${PURPLE}33 0%, transparent 70%)`,
            transform: `translate(calc(-50% + ${parallax.x * 20}px), ${parallax.y * 14}px)`,
          }}
        />

        {/* Floating decorative gaming elements — parallax + gentle bob */}
        <div
          className="hidden sm:block absolute top-10 left-[8%] text-cyan-400/20 float-slow transition-transform duration-300"
          style={{ transform: `translate(${parallax.x * -18}px, ${parallax.y * -12}px)` }}
        >
          <Trophy size={54} strokeWidth={1.2} />
        </div>
        <div
          className="hidden sm:block absolute top-32 right-[10%] text-purple-400/20 float-slower transition-transform duration-300"
          style={{ transform: `translate(${parallax.x * 16}px, ${parallax.y * 10}px)` }}
        >
          <Crosshair size={46} strokeWidth={1.2} />
        </div>
        <div
          className="hidden sm:block absolute bottom-6 left-[18%] text-emerald-400/20 float-slowest transition-transform duration-300"
          style={{ transform: `translate(${parallax.x * -12}px, ${parallax.y * 16}px)` }}
        >
          <Zap size={38} strokeWidth={1.2} />
        </div>

        <div className="relative z-10 flex flex-col items-center text-center">
          <div className="verified-badge flex items-center gap-2 px-4 py-1.5 rounded-full border border-cyan-400/30 bg-cyan-400/5 mb-6">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full rounded-full opacity-75 pulse-glow" style={{ background: GREEN }} />
              <span className="relative inline-flex rounded-full h-2 w-2" style={{ background: GREEN }} />
            </span>
            <ShieldCheck size={15} className="text-cyan-300" />
            <span className="text-xs font-bold tracking-wide text-cyan-200">Official Garena Partner · Verified</span>
          </div>

          <h1 className="font-display font-extrabold text-4xl sm:text-6xl lg:text-7xl leading-[1.05] text-transparent bg-clip-text bg-gradient-to-r from-white via-white to-cyan-300 max-w-4xl">
            {settings.heroTitle}
          </h1>
          <p className="mt-5 text-slate-300 text-base sm:text-lg max-w-xl">{settings.heroSubtitle}</p>

          <div className="mt-8 flex flex-col sm:flex-row gap-3">
            <GlowButton href="#media">
              <Radio size={16} /> Watch Live
            </GlowButton>
            <GlowButton href="#events" variant="secondary">
              <Trophy size={16} /> Join Tournament
            </GlowButton>
            <GlowButton href="#contact" variant="accent">
              <Zap size={16} /> Become Sponsor
            </GlowButton>
          </div>
        </div>
      </section>

      {/* ============================ COUNTDOWN BANNER ============================ */}
      <Reveal>
        <section id="events" className="px-4 sm:px-6 max-w-7xl mx-auto -mt-2 mb-16 sm:mb-24">
          <div className="hover-lift relative rounded-2xl border border-purple-500/25 bg-gradient-to-r from-[#160f24] via-[#0f1420] to-[#0c1a1f] p-5 sm:p-8 overflow-hidden">
            <div className="absolute top-3 right-3 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-red-500 pulse-glow" />
              <span className="text-[11px] font-bold tracking-widest text-red-400">LIVE SOON</span>
            </div>
            <SectionEyebrow>Next Event</SectionEyebrow>

            <div className="grid md:grid-cols-[220px_1fr] gap-6 items-start">
              {settings.nextEventPosterUrl ? (
                <img
                  src={settings.nextEventPosterUrl}
                  alt={settings.nextEventName}
                  className="w-full h-40 md:h-full rounded-xl object-cover border border-white/10"
                />
              ) : (
                <div className="hidden md:flex w-full h-full min-h-[140px] rounded-xl border border-dashed border-white/10 items-center justify-center text-slate-600">
                  <Trophy size={40} strokeWidth={1.2} />
                </div>
              )}

              <div>
                <div className="flex items-center gap-2 flex-wrap mb-3">
                  <h2 className="font-display text-xl sm:text-2xl font-bold text-white">{settings.nextEventName}</h2>
                  <RegistrationBadge status={settings.nextEventRegistrationStatus} />
                </div>

                {(settings.nextEventVenue || settings.nextEventPrizePool) && (
                  <div className="flex flex-wrap gap-x-6 gap-y-1.5 mb-5 text-sm text-slate-300">
                    {settings.nextEventVenue && (
                      <span className="flex items-center gap-1.5"><MapPin size={14} className="text-cyan-300" /> {settings.nextEventVenue}</span>
                    )}
                    {settings.nextEventPrizePool && (
                      <span className="flex items-center gap-1.5"><Trophy size={14} className="text-cyan-300" /> Prize Pool: {settings.nextEventPrizePool}</span>
                    )}
                  </div>
                )}

                <div className="flex gap-3 sm:gap-4">
                  {[
                    { label: "Days", value: countdown.d },
                    { label: "Hrs", value: countdown.h },
                    { label: "Min", value: countdown.m },
                    { label: "Sec", value: countdown.s },
                  ].map((unit) => (
                    <div key={unit.label} className="flex-1 sm:flex-none sm:w-20 text-center bg-black/40 border border-cyan-500/20 rounded-lg py-3">
                      <div className="font-display text-2xl sm:text-3xl font-extrabold text-cyan-300 tabular-nums">{pad(unit.value)}</div>
                      <div className="text-[10px] uppercase tracking-widest text-slate-400 mt-1">{unit.label}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>
      </Reveal>

      {/* ============================ BRAND PARTNERS ============================ */}
      {partners.length > 0 && (
        <Reveal>
          <section className="px-4 sm:px-6 max-w-7xl mx-auto mb-16 sm:mb-24">
            <SectionEyebrow>Backed By</SectionEyebrow>
            <h2 className="font-display text-2xl sm:text-3xl font-bold text-white mb-6">Brand Partners</h2>
            <div className="flex flex-wrap items-center gap-4 sm:gap-6">
              {partners.map((p) => {
                const Tag = p.websiteUrl ? "a" : "div";
                const linkProps = p.websiteUrl ? { href: p.websiteUrl, target: "_blank", rel: "noopener noreferrer" } : {};
                return (
                  <Tag
                    key={p.id}
                    {...linkProps}
                    className="hover-lift glass-card rounded-xl px-5 py-4 flex items-center justify-center"
                  >
                    <img
                      src={p.logoUrl}
                      alt={p.name}
                      title={p.name}
                      className="h-9 max-w-[120px] object-contain grayscale opacity-70 hover:grayscale-0 hover:opacity-100 transition-all duration-300"
                    />
                  </Tag>
                );
              })}
            </div>
          </section>
        </Reveal>
      )}

      {/* ============================ OUR TEAM ============================ */}
      {teamMembers.length > 0 && (
        <Reveal>
          <section className="px-4 sm:px-6 max-w-7xl mx-auto mb-16 sm:mb-24">
            <SectionEyebrow>The People Behind The Play</SectionEyebrow>
            <h2 className="font-display text-2xl sm:text-3xl font-bold text-white mb-6">Our Team</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-5">
              {teamMembers.map((m) => (
                <div key={m.id} className="hover-lift glass-card rounded-xl p-5 flex flex-col items-center text-center">
                  {m.photoUrl ? (
                    <img src={m.photoUrl} alt={m.name} className="h-20 w-20 rounded-full object-cover mb-3 border border-white/10" />
                  ) : (
                    <div className="h-20 w-20 rounded-full mb-3 bg-white/5 border border-white/10 flex items-center justify-center">
                      <Swords size={26} className="text-slate-600" />
                    </div>
                  )}
                  <p className="font-display font-bold text-white text-sm">{m.name}</p>
                  {m.role && <p className="text-[10px] uppercase tracking-widest text-cyan-400 font-bold mt-0.5">{m.role}</p>}
                  {(m.instagramUrl || m.facebookUrl || m.phone) && (
                    <div className="flex items-center gap-2 mt-3">
                      {m.instagramUrl && (
                        <a href={m.instagramUrl} target="_blank" rel="noopener noreferrer" className="w-7 h-7 rounded-full border border-white/10 flex items-center justify-center hover:border-cyan-400/40 text-slate-400 transition-colors">
                          <Instagram size={12} />
                        </a>
                      )}
                      {m.facebookUrl && (
                        <a href={m.facebookUrl} target="_blank" rel="noopener noreferrer" className="w-7 h-7 rounded-full border border-white/10 flex items-center justify-center hover:border-cyan-400/40 text-slate-400 transition-colors">
                          <Facebook size={12} />
                        </a>
                      )}
                      {m.phone && (
                        <a href={`tel:${m.phone}`} className="w-7 h-7 rounded-full border border-white/10 flex items-center justify-center hover:border-cyan-400/40 text-slate-400 transition-colors">
                          <Phone size={12} />
                        </a>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>
        </Reveal>
      )}

      {/* ============================ YOUTUBE MEDIA HUB ============================ */}
      <Reveal>
        <section id="media" className="px-4 sm:px-6 max-w-7xl mx-auto mb-16 sm:mb-24">
          <SectionEyebrow>Media Hub</SectionEyebrow>
          <div className="flex items-end justify-between mb-6">
            <h2 className="font-display text-2xl sm:text-3xl font-bold text-white">Latest Broadcasts</h2>
            <Youtube className="text-red-500 hidden sm:block" size={28} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {videos.map((v) => (
              <button
                key={v.id}
                onClick={() => setActiveVideo(v)}
                className="hover-lift group relative rounded-xl overflow-hidden glass-card text-left"
              >
                <div className="relative aspect-video bg-black">
                  <img
                    src={`https://img.youtube.com/vi/${v.youtubeId}/hqdefault.jpg`}
                    alt={v.title}
                    className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity"
                  />
                  <div className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover:bg-black/10 transition-colors">
                    <div className="w-12 h-12 rounded-full bg-white/10 backdrop-blur flex items-center justify-center border border-white/20 group-hover:scale-110 transition-transform">
                      <Play size={18} className="text-white ml-0.5" />
                    </div>
                  </div>
                </div>
                <div className="p-3.5">
                  <span className="text-[10px] uppercase tracking-widest text-cyan-400 font-bold">{v.category}</span>
                  <p className="text-sm font-semibold text-slate-100 mt-1 line-clamp-2">{v.title}</p>
                </div>
              </button>
            ))}
          </div>
        </section>
      </Reveal>

      {activeVideo && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setActiveVideo(null)}>
          <div className="w-full max-w-3xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-end mb-2">
              <button onClick={() => setActiveVideo(null)} className="text-slate-300 hover:text-white"><X size={26} /></button>
            </div>
            <div className="aspect-video rounded-xl overflow-hidden border border-purple-500/30">
              <iframe
                className="w-full h-full"
                src={`https://www.youtube.com/embed/${activeVideo.youtubeId}?autoplay=1`}
                title={activeVideo.title}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
          </div>
        </div>
      )}

      {/* ============================ GALLERY ============================ */}
      <Reveal>
        <section id="gallery" className="px-4 sm:px-6 max-w-7xl mx-auto mb-16 sm:mb-24">
          <SectionEyebrow>Gallery</SectionEyebrow>
          <div className="flex items-end justify-between mb-6 flex-wrap gap-4">
            <h2 className="font-display text-2xl sm:text-3xl font-bold text-white">From The Arena</h2>
            <div className="flex flex-wrap gap-2">
              {photoCategories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setPhotoFilter(cat)}
                  className={`px-3.5 py-1.5 rounded-full text-xs font-bold tracking-wide transition-colors ${
                    photoFilter === cat ? "bg-gradient-to-r from-purple-500 to-cyan-400 text-black" : "bg-white/5 text-slate-300 border border-white/10 hover:border-cyan-400/40"
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
            {filteredPhotos.map((p) => (
              <div key={p.id} className="hover-lift relative aspect-square rounded-lg overflow-hidden border border-white/10 group">
                <img src={p.url} alt={p.category} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/70 to-transparent">
                  <span className="text-[10px] uppercase tracking-wider font-bold text-cyan-300">{p.category}</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      </Reveal>

      {/* ============================ CONTACT / SPONSORSHIP ============================ */}
      <Reveal>
        <section id="contact" className="px-4 sm:px-6 max-w-7xl mx-auto mb-24 sm:mb-32">
          <div className="hover-lift glass-card rounded-2xl p-6 sm:p-10 grid md:grid-cols-2 gap-10">
            <div>
              <SectionEyebrow>Sponsorship</SectionEyebrow>
              <h2 className="font-display text-2xl sm:text-3xl font-bold text-white mb-4">Bring Your Brand Into The Arena</h2>
              <p className="text-slate-400 text-sm leading-relaxed mb-6">
                RTB Esports partners with brands across Bangladesh for tournament sponsorships, stage activations,
                and creator collaborations. Send your details and we'll reply on WhatsApp.
              </p>

              {(settings.contact.email || settings.contact.phone || settings.contact.address) && (
                <div className="space-y-2 mb-6 text-sm text-slate-300">
                  {settings.contact.email && <div className="flex items-center gap-2"><Mail size={14} className="text-cyan-300" /> {settings.contact.email}</div>}
                  {settings.contact.phone && <div className="flex items-center gap-2"><Phone size={14} className="text-cyan-300" /> {settings.contact.phone}</div>}
                  {settings.contact.address && <div className="flex items-center gap-2"><MapPin size={14} className="text-cyan-300" /> {settings.contact.address}</div>}
                </div>
              )}

              <SocialIconRow social={settings.social} />
            </div>

            <form onSubmit={handleContactSubmit} className="space-y-3.5">
              <input
                required
                placeholder="Your name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-cyan-400/60"
              />
              <input
                placeholder="Company / organization (optional)"
                value={form.org}
                onChange={(e) => setForm({ ...form, org: e.target.value })}
                className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-cyan-400/60"
              />
              <input
                placeholder="Sponsorship budget range (optional)"
                value={form.budget}
                onChange={(e) => setForm({ ...form, budget: e.target.value })}
                className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-cyan-400/60"
              />
              <textarea
                required
                rows={3}
                placeholder="Tell us about your idea"
                value={form.message}
                onChange={(e) => setForm({ ...form, message: e.target.value })}
                className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-cyan-400/60 resize-none"
              />
              <GlowButton className="w-full" type="submit"><MessageCircle size={16} /> Send via WhatsApp</GlowButton>
            </form>
          </div>
        </section>
      </Reveal>

      {/* ============================ FOOTER ============================ */}
      <footer className="px-4 sm:px-6 max-w-7xl mx-auto pb-28 md:pb-10 text-center text-xs text-slate-500">
        <SocialIconRow social={settings.social} size={14} className="justify-center mb-4" />
        <p>© {new Date().getFullYear()} RTB Esports · rtbnetworkbd.com · Official Garena Partner, Bangladesh</p>
      </footer>

      {/* ============================ MOBILE STICKY BOTTOM NAV ============================ */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-black/80 backdrop-blur-lg border-t border-purple-500/20 px-2 py-2 flex items-center justify-around">
        {[
          { href: "#", icon: Home, label: "Home" },
          { href: "#events", icon: Trophy, label: "Events" },
          { href: "#media", icon: Youtube, label: "Media" },
          { href: "#gallery", icon: ImageIcon, label: "Gallery" },
          { href: "#contact", icon: MessageCircle, label: "Contact" },
        ].map((item) => (
          <a key={item.label} href={item.href} className="flex flex-col items-center gap-1 text-slate-400 hover:text-cyan-300 px-2 py-1">
            <item.icon size={20} />
            <span className="text-[10px] font-semibold">{item.label}</span>
          </a>
        ))}
      </nav>
    </div>
  );
}
