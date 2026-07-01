import React from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { PawPrint, LogOut, User as UserIcon } from "lucide-react";

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const onAdmin = location.pathname.startsWith("/admin");
  if (onAdmin) return null;

  return (
    <header
      data-testid="site-navbar"
      className="sticky top-0 z-40 backdrop-blur-xl bg-[#FDFBF7]/80 border-b border-[#E5DFD3]"
    >
      <div className="max-w-7xl mx-auto px-6 lg:px-10 h-16 flex items-center justify-between">
        <Link to="/" data-testid="nav-logo" className="flex items-center gap-2">
          <span className="w-9 h-9 rounded-full bg-[#1E3F2D] text-[#FDFBF7] flex items-center justify-center">
            <PawPrint className="w-4 h-4" strokeWidth={1.75} />
          </span>
          <span className="font-serif-display text-2xl leading-none">PawGroom</span>
        </Link>

        <nav className="hidden md:flex items-center gap-8 text-sm text-[#1E3F2D]/80">
          <Link to="/#services" data-testid="nav-services" className="hover:text-[#1E3F2D]">Services</Link>
          <Link to="/#cities" data-testid="nav-cities" className="hover:text-[#1E3F2D]">Cities</Link>
          <Link to="/#how" data-testid="nav-how" className="hover:text-[#1E3F2D]">How it works</Link>
          <Link to="/admin/login" data-testid="nav-admin" className="hover:text-[#1E3F2D]">Admin</Link>
        </nav>

        <div className="flex items-center gap-3">
          {user ? (
            <>
              <Link to="/dashboard" data-testid="nav-dashboard" className="hidden sm:flex items-center gap-2 pill">
                <UserIcon className="w-3.5 h-3.5" strokeWidth={1.75} />
                {user.name?.split(" ")[0] || "Account"}
              </Link>
              <Link to="/profile" data-testid="nav-profile" className="hidden md:inline text-sm hover:text-[#1E3F2D]/70">
                Profile
              </Link>
              <Button
                data-testid="nav-book-btn"
                onClick={() => navigate("/book")}
                className="rounded-full bg-[#D96C4A] hover:bg-[#c65e3e] text-white px-5"
              >
                Book Now
              </Button>
              <button
                data-testid="nav-logout"
                onClick={logout}
                className="p-2 rounded-full border border-[#E5DFD3] hover:bg-[#F1EBE1] hover-lift"
                aria-label="Logout"
              >
                <LogOut className="w-4 h-4" strokeWidth={1.75} />
              </button>
            </>
          ) : (
            <>
              <Link to="/login" data-testid="nav-login" className="text-sm">Sign in</Link>
              <Button
                data-testid="nav-book-btn"
                onClick={() => navigate("/book")}
                className="rounded-full bg-[#1E3F2D] hover:bg-[#25523a] text-white px-5"
              >
                Book Now
              </Button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
