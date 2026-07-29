import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { supabase } from "../supabaseClient.js";

/**
 * SiteDataContext is the single source of truth for everything the PUBLIC
 * site and the ADMIN dashboard both need: branding/settings (incl. the
 * admin-editable Next Event countdown + poster/venue/prize pool), YouTube
 * videos, gallery photos, and brand partner logos.
 *
 * Backed for real by Supabase (see SUPABASE_SETUP.sql — run once, or
 * UPDATE_phase2.sql if you already ran an earlier version):
 *   site_settings   — single row, id = 1, upserted on save
 *   youtube_videos  — Media Hub
 *   gallery_photos  — Web Gallery
 *   brand_partners  — Partner logo bar
 * All four are publicly READABLE (anon key, no login) so the marketing
 * site can render them; writes go through these context functions, which
 * only succeed for a logged-in admin (enforced by Postgres Row Level
 * Security, not just this code).
 *
 * If Supabase isn't configured yet (no .env values) or a request fails,
 * everything falls back to sensible local defaults instead of crashing —
 * so the public site still renders even before SUPABASE_SETUP.sql has
 * been run.
 */

export const DEFAULT_SETTINGS = {
  logoUrl: "",
  faviconUrl: "",
  heroTitle: "WE RUN THE ARENA",
  heroSubtitle:
    "RTB Esports produces Bangladesh's biggest Free Fire tournaments — official events, live broadcasts, and the players who show up to win.",
  announcementBar: "",
  nextEventName: "Free Fire Bangladesh Championship — Finals",
  nextEventStartsAt: new Date(Date.now() + 1000 * 60 * 60 * 52).toISOString(),
  nextEventPosterUrl: "",
  nextEventVenue: "",
  nextEventPrizePool: "",
  nextEventRegistrationStatus: "Open", // "Open" | "Full" | "Closed"
  statTournaments: "",
  statPrizeMoney: "",
  statReach: "",
  statPlayers: "",
  social: { facebook: "", youtube: "", instagram: "", discord: "", whatsapp: "" },
  contact: { email: "", phone: "", address: "" },
};

function rowToSettings(row) {
  if (!row) return DEFAULT_SETTINGS;
  return {
    logoUrl: row.logo_url || "",
    faviconUrl: row.favicon_url || "",
    heroTitle: row.hero_title || DEFAULT_SETTINGS.heroTitle,
    heroSubtitle: row.hero_subtitle || DEFAULT_SETTINGS.heroSubtitle,
    announcementBar: row.announcement_bar || "",
    nextEventName: row.next_event_name || DEFAULT_SETTINGS.nextEventName,
    nextEventStartsAt: row.next_event_starts_at || DEFAULT_SETTINGS.nextEventStartsAt,
    nextEventPosterUrl: row.next_event_poster_url || "",
    nextEventVenue: row.next_event_venue || "",
    nextEventPrizePool: row.next_event_prize_pool || "",
    nextEventRegistrationStatus: row.next_event_registration_status || "Open",
    statTournaments: row.stat_tournaments || "",
    statPrizeMoney: row.stat_prize_money || "",
    statReach: row.stat_reach || "",
    statPlayers: row.stat_players || "",
    social: {
      facebook: row.facebook_url || "",
      youtube: row.youtube_url || "",
      instagram: row.instagram_url || "",
      discord: row.discord_url || "",
      whatsapp: row.whatsapp_number || "",
    },
    contact: {
      email: row.contact_email || "",
      phone: row.contact_phone || "",
      address: row.contact_address || "",
    },
  };
}

function settingsToRow(s) {
  return {
    id: 1,
    logo_url: s.logoUrl,
    favicon_url: s.faviconUrl,
    hero_title: s.heroTitle,
    hero_subtitle: s.heroSubtitle,
    announcement_bar: s.announcementBar,
    next_event_name: s.nextEventName,
    next_event_starts_at: s.nextEventStartsAt,
    next_event_poster_url: s.nextEventPosterUrl,
    next_event_venue: s.nextEventVenue,
    next_event_prize_pool: s.nextEventPrizePool,
    next_event_registration_status: s.nextEventRegistrationStatus,
    stat_tournaments: s.statTournaments,
    stat_prize_money: s.statPrizeMoney,
    stat_reach: s.statReach,
    stat_players: s.statPlayers,
    facebook_url: s.social.facebook,
    youtube_url: s.social.youtube,
    instagram_url: s.social.instagram,
    discord_url: s.social.discord,
    whatsapp_number: s.social.whatsapp,
    contact_email: s.contact.email,
    contact_phone: s.contact.phone,
    contact_address: s.contact.address,
    updated_at: new Date().toISOString(),
  };
}

function rowToVideo(row) {
  return { id: row.id, youtubeId: row.youtube_id, title: row.title, category: row.category };
}
function rowToPhoto(row) {
  return { id: row.id, url: row.url, category: row.category };
}
function rowToPartner(row) {
  return { id: row.id, name: row.name, logoUrl: row.logo_url, websiteUrl: row.website_url || "" };
}
function rowToTeamMember(row) {
  return {
    id: row.id,
    name: row.name,
    role: row.role || "",
    photoUrl: row.photo_url || "",
    instagramUrl: row.instagram_url || "",
    facebookUrl: row.facebook_url || "",
    phone: row.phone || "",
  };
}

// Shown only if Supabase can't be reached (not yet configured, or
// SUPABASE_SETUP.sql hasn't been run) — so the public site still looks
// complete instead of rendering empty sections.
const FALLBACK_VIDEOS = [
  { id: "v1", youtubeId: "dQw4w9WgXcQ", title: "FFBC Grand Finals — Full Highlights", category: "Highlights" },
  { id: "v2", youtubeId: "dQw4w9WgXcQ", title: "Behind the Scenes: Stage Build", category: "BTS" },
  { id: "v3", youtubeId: "dQw4w9WgXcQ", title: "Caster Desk — Meta Breakdown", category: "Analysis" },
];
const FALLBACK_PHOTOS = [
  { id: "p1", url: "https://images.unsplash.com/photo-1542751371-6533d0c3f8f0?w=800&q=80", category: "Stage" },
  { id: "p2", url: "https://images.unsplash.com/photo-1511512578047-dfb367046420?w=800&q=80", category: "Crowd" },
  { id: "p3", url: "https://images.unsplash.com/photo-1560253023-3ec5d502959f?w=800&q=80", category: "Players" },
];
const FALLBACK_PARTNERS = [];
const FALLBACK_TEAM = [];

const SiteDataContext = createContext(null);

export function SiteDataProvider({ children }) {
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [videos, setVideos] = useState([]);
  const [photos, setPhotos] = useState([]);
  const [partners, setPartners] = useState([]);
  const [teamMembers, setTeamMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function loadAll() {
      setLoading(true);
      setLoadError("");
      try {
        const { data: settingsRow, error: settingsErr } = await supabase
          .from("site_settings")
          .select("*")
          .eq("id", 1)
          .single();
        if (settingsErr) throw settingsErr;
        if (!cancelled) setSettings(rowToSettings(settingsRow));

        const { data: videoRows, error: videoErr } = await supabase
          .from("youtube_videos")
          .select("*")
          .order("created_at", { ascending: false });
        if (videoErr) throw videoErr;
        if (!cancelled) setVideos((videoRows || []).map(rowToVideo));

        const { data: photoRows, error: photoErr } = await supabase
          .from("gallery_photos")
          .select("*")
          .order("created_at", { ascending: false });
        if (photoErr) throw photoErr;
        if (!cancelled) setPhotos((photoRows || []).map(rowToPhoto));

        const { data: partnerRows, error: partnerErr } = await supabase
          .from("brand_partners")
          .select("*")
          .order("created_at", { ascending: true });
        if (partnerErr) throw partnerErr;
        if (!cancelled) setPartners((partnerRows || []).map(rowToPartner));

        const { data: teamRows, error: teamErr } = await supabase
          .from("team_members")
          .select("*")
          .order("created_at", { ascending: true });
        if (teamErr) throw teamErr;
        if (!cancelled) setTeamMembers((teamRows || []).map(rowToTeamMember));
      } catch (err) {
        // Supabase not configured yet, or the setup SQL hasn't been run —
        // fall back to demo content instead of leaving the public site empty.
        if (!cancelled) {
          setLoadError(err?.message || String(err));
          setVideos((prev) => (prev.length ? prev : FALLBACK_VIDEOS));
          setPhotos((prev) => (prev.length ? prev : FALLBACK_PHOTOS));
          setPartners((prev) => (prev.length ? prev : FALLBACK_PARTNERS));
          setTeamMembers((prev) => (prev.length ? prev : FALLBACK_TEAM));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    loadAll();
    return () => {
      cancelled = true;
    };
  }, []);

  const saveSettings = useCallback(async (next) => {
    setSettings(next); // optimistic — reflects instantly across the site
    const { error } = await supabase.from("site_settings").upsert(settingsToRow(next));
    if (error) console.error("Failed to save site_settings:", error);
    return { error };
  }, []);

  const addVideo = useCallback(async ({ youtubeId, title, category }) => {
    const { data, error } = await supabase
      .from("youtube_videos")
      .insert({ youtube_id: youtubeId, title, category })
      .select()
      .single();
    if (error) {
      console.error("Failed to add video:", error);
      return;
    }
    setVideos((prev) => [rowToVideo(data), ...prev]);
  }, []);

  const removeVideo = useCallback(async (id) => {
    setVideos((prev) => prev.filter((v) => v.id !== id));
    const { error } = await supabase.from("youtube_videos").delete().eq("id", id);
    if (error) console.error("Failed to delete video:", error);
  }, []);

  const addPhoto = useCallback(async ({ url, category }) => {
    const { data, error } = await supabase.from("gallery_photos").insert({ url, category }).select().single();
    if (error) {
      console.error("Failed to add photo:", error);
      return;
    }
    setPhotos((prev) => [rowToPhoto(data), ...prev]);
  }, []);

  const removePhoto = useCallback(async (id) => {
    setPhotos((prev) => prev.filter((p) => p.id !== id));
    const { error } = await supabase.from("gallery_photos").delete().eq("id", id);
    if (error) console.error("Failed to delete photo:", error);
  }, []);

  const addPartner = useCallback(async ({ name, logoUrl, websiteUrl }) => {
    const { data, error } = await supabase
      .from("brand_partners")
      .insert({ name, logo_url: logoUrl, website_url: websiteUrl || null })
      .select()
      .single();
    if (error) {
      console.error("Failed to add partner:", error);
      return;
    }
    setPartners((prev) => [...prev, rowToPartner(data)]);
  }, []);

  const removePartner = useCallback(async (id) => {
    setPartners((prev) => prev.filter((p) => p.id !== id));
    const { error } = await supabase.from("brand_partners").delete().eq("id", id);
    if (error) console.error("Failed to delete partner:", error);
  }, []);

  const addTeamMember = useCallback(async ({ name, role, photoUrl, instagramUrl, facebookUrl, phone }) => {
    const { data, error } = await supabase
      .from("team_members")
      .insert({ name, role, photo_url: photoUrl, instagram_url: instagramUrl || null, facebook_url: facebookUrl || null, phone: phone || null })
      .select()
      .single();
    if (error) {
      console.error("Failed to add team member:", error);
      return;
    }
    setTeamMembers((prev) => [...prev, rowToTeamMember(data)]);
  }, []);

  const removeTeamMember = useCallback(async (id) => {
    setTeamMembers((prev) => prev.filter((m) => m.id !== id));
    const { error } = await supabase.from("team_members").delete().eq("id", id);
    if (error) console.error("Failed to delete team member:", error);
  }, []);

  const value = {
    settings,
    videos,
    photos,
    partners,
    teamMembers,
    loading,
    loadError,
    saveSettings,
    addVideo,
    removeVideo,
    addPhoto,
    removePhoto,
    addPartner,
    removePartner,
    addTeamMember,
    removeTeamMember,
  };
  return <SiteDataContext.Provider value={value}>{children}</SiteDataContext.Provider>;
}

export function useSiteData() {
  const ctx = useContext(SiteDataContext);
  if (!ctx) throw new Error("useSiteData must be used inside <SiteDataProvider>");
  return ctx;
}
