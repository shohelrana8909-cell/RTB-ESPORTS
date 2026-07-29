import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Lock, ShieldAlert } from "lucide-react";
import { supabase } from "../supabaseClient.js";
import { ADMIN_DASHBOARD_PATH, useAdminSession } from "./ProtectedRoute.jsx";
import RTB_LOGO from "../rtb.png";

export default function AdminLogin() {
  const navigate = useNavigate();
  const session = useAdminSession();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // If already logged in (e.g. came back to this URL with a live session),
  // skip straight to the dashboard instead of showing the form again.
  useEffect(() => {
    if (session) navigate(ADMIN_DASHBOARD_PATH, { replace: true });
  }, [session, navigate]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (signInError) {
      setError(signInError.message);
      return;
    }
    navigate(ADMIN_DASHBOARD_PATH, { replace: true });
  }

  return (
    <div
      className="min-h-screen w-full flex items-center justify-center px-4 text-slate-100"
      style={{
        background: "radial-gradient(ellipse at top, #14101f 0%, #0a0a0f 55%, #060608 100%)",
        fontFamily: "'Rajdhani', sans-serif",
      }}
    >
      <div className="w-full max-w-sm bg-[#0d0d14] border border-purple-500/30 rounded-2xl p-7">
        <div className="flex flex-col items-center mb-5">
          <img src={RTB_LOGO} alt="RAHAT THE BRAND" className="h-14 mb-2 object-contain" />
          <p className="text-xs text-slate-500">RTB Esports · Admin Access</p>
        </div>

        <form onSubmit={handleSubmit}>
          <label className="text-[11px] text-slate-400 mb-1 block">Email</label>
          <input
            autoFocus
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-3 text-sm mb-3 focus:outline-none focus:border-cyan-400/60"
          />
          <label className="text-[11px] text-slate-400 mb-1 block">Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-3 text-sm mb-3 focus:outline-none focus:border-cyan-400/60"
          />
          {error && (
            <p className="flex items-center gap-1.5 text-red-400 text-xs mb-3">
              <ShieldAlert size={13} /> {error}
            </p>
          )}
          <button
            type="submit"
            disabled={loading}
            className="w-full inline-flex items-center justify-center gap-2 px-6 py-3 rounded-md font-semibold text-sm tracking-wide bg-gradient-to-r from-purple-600 to-cyan-500 text-white shadow-[0_0_20px_rgba(168,85,247,0.45)] hover:shadow-[0_0_30px_rgba(34,211,238,0.55)] transition-all disabled:opacity-50"
          >
            <Lock size={15} /> {loading ? "Logging in…" : "Log In"}
          </button>
        </form>

        <p className="text-[11px] text-slate-500 mt-4 leading-relaxed">
          Real access control via Supabase Auth + Row Level Security — see{" "}
          <code className="text-cyan-400">SUPABASE_SETUP.sql</code>. There's no self-signup; an admin invites each
          account from the Supabase dashboard (Authentication → Users → Invite user) before they can log in here.
        </p>
      </div>
    </div>
  );
}
