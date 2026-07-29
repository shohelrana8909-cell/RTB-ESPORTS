import React, { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { supabase } from "../supabaseClient.js";

/**
 * Real access control, backed by Supabase Auth + Row Level Security.
 * See SUPABASE_SETUP.sql for the profiles/RLS setup. There is no
 * self-signup — an admin has to invite each account from the Supabase
 * dashboard (Authentication → Users → Invite user) before they can log
 * in here. The obscure route path below (VITE_ADMIN_PATH) is an extra,
 * optional layer on top of that — nobody finds the login page unless
 * they already know the URL — but Supabase Auth + RLS is what actually
 * protects the data, since the database itself rejects unauthenticated
 * reads/writes on every admin-only table and storage bucket.
 */

export const ADMIN_PATH = import.meta.env.VITE_ADMIN_PATH || "/admin-x7k9";
export const ADMIN_DASHBOARD_PATH = `${ADMIN_PATH}/dashboard`;

// undefined = still checking for an existing session, null = logged out, object = logged in
export function useAdminSession() {
  const [session, setSession] = useState(undefined);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  return session;
}

export default function ProtectedRoute({ children }) {
  const session = useAdminSession();

  if (session === undefined) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-[#0a0a0f] text-slate-400">
        <Loader2 size={22} className="animate-spin" />
      </div>
    );
  }
  if (!session) {
    return <Navigate to={ADMIN_PATH} replace />;
  }
  return children;
}
