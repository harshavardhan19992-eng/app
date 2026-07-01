import React from "react";
import { Link } from "react-router-dom";
import { PawPrint } from "lucide-react";

export default function CustomerLogin() {
  const handleGoogle = () => {
    // REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
    const redirectUrl = window.location.origin + "/dashboard";
    window.location.href = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;
  };

  return (
    <main data-testid="customer-login-page" className="min-h-[calc(100vh-64px)] grid lg:grid-cols-2">
      <div className="hidden lg:block relative">
        <img
          src="https://images.unsplash.com/photo-1509205477838-a534e43a849f?crop=entropy&cs=srgb&fm=jpg&q=85&w=1200"
          alt=""
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#1E3F2D]/60 to-transparent" />
        <div className="absolute bottom-10 left-10 right-10 text-white">
          <div className="font-serif-display text-4xl leading-tight">
            &ldquo;PawGroom feels like a spa day made <em>just for him</em>.&rdquo;
          </div>
          <div className="mt-3 text-white/70 text-sm">Riya • Mumbai • Golden Retriever mum</div>
        </div>
      </div>
      <div className="flex items-center justify-center px-6 py-16">
        <div className="w-full max-w-md">
          <Link to="/" className="inline-flex items-center gap-2 mb-10">
            <span className="w-9 h-9 rounded-full bg-[#1E3F2D] text-[#FDFBF7] flex items-center justify-center">
              <PawPrint className="w-4 h-4" strokeWidth={1.75}/>
            </span>
            <span className="font-serif-display text-2xl">PawGroom</span>
          </Link>
          <h1 className="font-serif-display text-4xl">Sign in to your account</h1>
          <p className="text-[#5C7365] mt-3">
            One-tap sign-in with Google. Access bookings, invoices and your pet profile.
          </p>

          <button
            data-testid="google-signin-btn"
            onClick={handleGoogle}
            className="mt-10 w-full h-12 rounded-full border border-[#E5DFD3] bg-[#FDFBF7] hover:bg-[#F1EBE1] flex items-center justify-center gap-3 font-medium hover-lift"
          >
            <svg width="18" height="18" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
              <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.9 32.3 29.4 35.5 24 35.5c-6.4 0-11.6-5.2-11.6-11.6S17.6 12.3 24 12.3c3 0 5.8 1.1 7.9 3l5.7-5.7C34.6 6.5 29.6 4.5 24 4.5 13.2 4.5 4.5 13.2 4.5 24S13.2 43.5 24 43.5 43.5 34.8 43.5 24c0-1.2-.1-2.4-.4-3.5z"/>
              <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 16 19 12.3 24 12.3c3 0 5.8 1.1 7.9 3l5.7-5.7C34.6 6.5 29.6 4.5 24 4.5 16.1 4.5 9.3 8.9 6.3 14.7z"/>
              <path fill="#4CAF50" d="M24 43.5c5.5 0 10.4-1.9 14.2-5.1l-6.6-5.4c-2 1.4-4.5 2.2-7.6 2.2-5.4 0-9.9-3.2-11.3-7.7l-6.5 5C9.3 39.1 16.1 43.5 24 43.5z"/>
              <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.7 2-2 3.7-3.7 4.9l6.6 5.4c-.5.4 7.3-5.3 7.3-14.3 0-1.2-.1-2.4-.4-3.5z"/>
            </svg>
            Continue with Google
          </button>

          <div className="mt-8 text-xs text-[#5C7365] text-center">
            By continuing, you agree to PawGroom&rsquo;s Terms & Privacy.
          </div>

          <div className="mt-10 text-center text-sm text-[#5C7365]">
            Running a grooming business? <Link to="/admin/login" className="underline hover:text-[#1E3F2D]">Admin sign in</Link>
          </div>
        </div>
      </div>
    </main>
  );
}
