import React from "react";
import { Link, useLocation } from "react-router-dom";
import { PawPrint } from "lucide-react";

export default function Footer() {
  const location = useLocation();
  if (location.pathname.startsWith("/admin")) return null;
  return (
    <footer data-testid="site-footer" className="border-t border-[#E5DFD3] bg-[#F1EBE1] mt-24">
      <div className="max-w-7xl mx-auto px-6 lg:px-10 py-14 grid md:grid-cols-4 gap-10">
        <div className="md:col-span-2">
          <div className="flex items-center gap-2">
            <span className="w-9 h-9 rounded-full bg-[#1E3F2D] text-[#FDFBF7] flex items-center justify-center">
              <PawPrint className="w-4 h-4" strokeWidth={1.75} />
            </span>
            <span className="font-serif-display text-2xl">PawGroom</span>
          </div>
          <p className="mt-4 text-sm text-[#5C7365] max-w-md">
            India&rsquo;s boutique at-home pet grooming service. Certified groomers,
            hypoallergenic products, and a calm space — right at your doorstep.
          </p>
        </div>
        <div>
          <div className="text-xs uppercase tracking-widest text-[#5C7365] mb-3">Company</div>
          <ul className="space-y-2 text-sm">
            <li><Link to="/" className="hover:underline">Home</Link></li>
            <li><Link to="/#services" className="hover:underline">Services</Link></li>
            <li><Link to="/#cities" className="hover:underline">Cities we serve</Link></li>
            <li><Link to="/admin/login" className="hover:underline">Admin portal</Link></li>
          </ul>
        </div>
        <div>
          <div className="text-xs uppercase tracking-widest text-[#5C7365] mb-3">Contact</div>
          <ul className="space-y-2 text-sm">
            <li>hello@pawgroom.in</li>
            <li>+91 90000 00000</li>
            <li>Mon–Sun, 9AM–8PM</li>
          </ul>
        </div>
      </div>
      <div className="border-t border-[#E5DFD3] py-5 text-center text-xs text-[#5C7365]">
        © {new Date().getFullYear()} PawGroom India. Crafted with care for tails and paws.
      </div>
    </footer>
  );
}
