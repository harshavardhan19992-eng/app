import React, { useEffect, useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { adminApi } from "@/lib/api";
import { PawPrint, LayoutDashboard, CalendarCheck2, Scissors, LogOut, Users, Settings, UserCog } from "lucide-react";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/admin/dashboard", label: "Overview", icon: LayoutDashboard },
  { to: "/admin/bookings", label: "Bookings", icon: CalendarCheck2 },
  { to: "/admin/customers", label: "Customers", icon: Users },
  { to: "/admin/groomers", label: "Groomers", icon: UserCog },
  { to: "/admin/services", label: "Services", icon: Scissors },
  { to: "/admin/settings", label: "Settings", icon: Settings },
];

export default function AdminShell() {
  const [ok, setOk] = useState(false);
  const [checking, setChecking] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const t = localStorage.getItem("pg_admin_token");
    if (!t) {
      navigate("/admin/login", { replace: true });
      return;
    }
    adminApi
      .get("/admin/me")
      .then(() => setOk(true))
      .catch(() => {
        localStorage.removeItem("pg_admin_token");
        navigate("/admin/login", { replace: true });
      })
      .finally(() => setChecking(false));
  }, [navigate]);

  const logout = () => {
    localStorage.removeItem("pg_admin_token");
    navigate("/admin/login", { replace: true });
  };

  if (checking) return null;
  if (!ok) return null;

  return (
    <div data-testid="admin-shell" className="min-h-screen bg-[#FDFBF7]">
      <div className="grid lg:grid-cols-[260px_1fr] min-h-screen">
        <aside className="border-r border-[#E5DFD3] bg-[#F1EBE1] p-6 flex flex-col">
          <div className="flex items-center gap-2 mb-10">
            <span className="w-9 h-9 rounded-full bg-[#1E3F2D] text-white flex items-center justify-center">
              <PawPrint className="w-4 h-4" strokeWidth={1.75}/>
            </span>
            <div>
              <div className="font-serif-display text-xl leading-none">PawGroom</div>
              <div className="text-xs text-[#5C7365]">Admin</div>
            </div>
          </div>
          <nav className="flex-1 space-y-1">
            {NAV.map((n) => (
              <NavLink
                key={n.to}
                to={n.to}
                data-testid={`admin-nav-${n.label.toLowerCase()}`}
                className={({ isActive }) =>
                  cn(
                    "flex items-center gap-3 px-3 h-10 rounded-xl text-sm",
                    isActive
                      ? "bg-[#1E3F2D] text-white"
                      : "text-[#1E3F2D] hover:bg-[#FDFBF7]"
                  )
                }
              >
                <n.icon className="w-4 h-4" strokeWidth={1.75}/>
                {n.label}
              </NavLink>
            ))}
          </nav>
          <button
            data-testid="admin-logout-btn"
            onClick={logout}
            className="flex items-center gap-3 h-10 px-3 rounded-xl text-sm hover:bg-[#FDFBF7]"
          >
            <LogOut className="w-4 h-4" strokeWidth={1.75}/> Log out
          </button>
        </aside>
        <main className="p-6 lg:p-10">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
