import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { adminApi } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PawPrint } from "lucide-react";
import { toast } from "sonner";

export default function AdminLogin() {
  const [email, setEmail] = useState("admin@pawgroom.in");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const r = await adminApi.post("/admin/login", { email, password });
      localStorage.setItem("pg_admin_token", r.data.token);
      toast.success("Welcome back, admin.");
      navigate("/admin/dashboard", { replace: true });
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Login failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main data-testid="admin-login-page" className="min-h-screen bg-[#1E3F2D] text-white flex items-center justify-center px-6">
      <div className="w-full max-w-md">
        <div className="flex items-center gap-3 mb-10">
          <span className="w-10 h-10 rounded-full bg-[#D96C4A] flex items-center justify-center">
            <PawPrint className="w-5 h-5" strokeWidth={1.75}/>
          </span>
          <div>
            <div className="text-xs uppercase tracking-[0.25em] text-white/50">Admin portal</div>
            <div className="font-serif-display text-3xl">PawGroom</div>
          </div>
        </div>
        <h1 className="font-serif-display text-4xl">Sign in as admin</h1>
        <p className="text-white/60 mt-2">Manage bookings, services and revenue.</p>

        <form onSubmit={submit} className="mt-8 space-y-5">
          <div>
            <Label className="text-white/70" htmlFor="email">Email</Label>
            <Input
              id="email"
              data-testid="admin-email-input"
              type="email"
              className="mt-2 h-11 rounded-xl bg-white/10 border-white/20 text-white placeholder:text-white/40"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div>
            <Label className="text-white/70" htmlFor="password">Password</Label>
            <Input
              id="password"
              data-testid="admin-password-input"
              type="password"
              className="mt-2 h-11 rounded-xl bg-white/10 border-white/20 text-white placeholder:text-white/40"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <Button
            data-testid="admin-signin-btn"
            type="submit"
            disabled={busy}
            className="w-full h-11 rounded-full bg-[#D96C4A] hover:bg-[#c65e3e]"
          >
            {busy ? "Signing in…" : "Sign in"}
          </Button>
        </form>

        <div className="mt-10 text-xs text-white/50">
          Default: admin@pawgroom.in / Admin@123 (change in .env)
        </div>
      </div>
    </main>
  );
}
