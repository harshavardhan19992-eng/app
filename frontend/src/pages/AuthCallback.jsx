import React, { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "@/lib/api";
import { PawPrint } from "lucide-react";

// REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
export default function AuthCallback() {
  const navigate = useNavigate();
  const processed = useRef(false);

  useEffect(() => {
    if (processed.current) return;
    processed.current = true;
    const hash = window.location.hash;
    const match = hash.match(/session_id=([^&]+)/);
    if (!match) {
      navigate("/login", { replace: true });
      return;
    }
    const session_id = match[1];
    api
      .post("/auth/session", { session_id })
      .then((r) => {
        window.history.replaceState({}, "", "/dashboard");
        navigate("/dashboard", { replace: true, state: { user: r.data } });
      })
      .catch(() => navigate("/login", { replace: true }));
  }, [navigate]);

  return (
    <main className="min-h-[calc(100vh-64px)] flex items-center justify-center">
      <div className="flex items-center gap-3 text-[#5C7365]">
        <span className="w-9 h-9 rounded-full bg-[#1E3F2D] text-[#FDFBF7] flex items-center justify-center">
          <PawPrint className="w-4 h-4 animate-pulse" strokeWidth={1.75}/>
        </span>
        Signing you in…
      </div>
    </main>
  );
}
