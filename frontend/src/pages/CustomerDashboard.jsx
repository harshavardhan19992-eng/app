import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, API } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { formatINR, STATUS_COLOR, STATUS_LABEL, cn } from "@/lib/utils";
import { Calendar, MapPin, Download, PawPrint, ArrowRight, Receipt } from "lucide-react";
import { toast } from "sonner";

export default function CustomerDashboard() {
  const { user, loading } = useAuth();
  const [bookings, setBookings] = useState([]);
  const [fetching, setFetching] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      navigate("/login", { replace: true });
      return;
    }
    api
      .get("/bookings")
      .then((r) => setBookings(r.data))
      .catch(() => toast.error("Could not load bookings"))
      .finally(() => setFetching(false));
  }, [user, loading, navigate]);

  const downloadInvoice = (booking_id) => {
    const url = `${API}/bookings/${booking_id}/invoice.pdf`;
    fetch(url, { credentials: "include" })
      .then((r) => {
        if (!r.ok) throw new Error();
        return r.blob();
      })
      .then((blob) => {
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = `PawGroom-${booking_id}.pdf`;
        link.click();
      })
      .catch(() => toast.error("Failed to download invoice"));
  };

  if (loading || !user) return null;

  const upcoming = bookings.filter((b) => ["pending", "confirmed", "in_service"].includes(b.status));
  const past = bookings.filter((b) => ["completed", "cancelled"].includes(b.status));

  return (
    <main data-testid="customer-dashboard" className="max-w-7xl mx-auto px-6 lg:px-10 py-12">
      <div className="flex items-end justify-between flex-wrap gap-4 mb-10">
        <div>
          <div className="text-xs uppercase tracking-[0.25em] text-[#5C7365] mb-2">Welcome back</div>
          <h1 className="font-serif-display text-4xl sm:text-5xl">Hi {user.name?.split(" ")[0] || "there"}.</h1>
          <p className="text-[#5C7365] mt-2">Manage your bookings, invoices and pet visits.</p>
        </div>
        <Button
          data-testid="dashboard-book-btn"
          onClick={() => navigate("/book")}
          className="rounded-full bg-[#D96C4A] hover:bg-[#c65e3e] text-white h-11 px-6"
        >
          New booking <ArrowRight className="w-4 h-4 ml-2" strokeWidth={1.75}/>
        </Button>
      </div>

      {/* Upcoming */}
      <section className="mb-14">
        <div className="flex items-center gap-3 mb-5">
          <Calendar className="w-4 h-4" strokeWidth={1.75}/>
          <h2 className="font-serif-display text-2xl">Upcoming</h2>
        </div>
        {fetching ? (
          <div className="text-[#5C7365]">Loading…</div>
        ) : upcoming.length === 0 ? (
          <EmptyState onBook={() => navigate("/book")} />
        ) : (
          <div className="grid md:grid-cols-2 gap-5">
            {upcoming.map((b) => (
              <BookingCard key={b.booking_id} b={b} onDownload={downloadInvoice} />
            ))}
          </div>
        )}
      </section>

      {/* History */}
      <section>
        <div className="flex items-center gap-3 mb-5">
          <Receipt className="w-4 h-4" strokeWidth={1.75}/>
          <h2 className="font-serif-display text-2xl">History & invoices</h2>
        </div>
        {past.length === 0 ? (
          <div className="text-[#5C7365] text-sm">Your past sessions will show up here.</div>
        ) : (
          <div className="grid md:grid-cols-2 gap-5">
            {past.map((b) => (
              <BookingCard key={b.booking_id} b={b} onDownload={downloadInvoice} />
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

function BookingCard({ b, onDownload }) {
  return (
    <article
      data-testid={`booking-card-${b.booking_id}`}
      className="rounded-3xl border border-[#E5DFD3] bg-[#FDFBF7] p-6"
    >
      <div className="flex items-center justify-between mb-4">
        <span className={cn("pill", STATUS_COLOR[b.status])}>
          {STATUS_LABEL[b.status]}
        </span>
        <span className="text-xs text-[#5C7365]">#{b.invoice_no}</span>
      </div>
      <div className="flex items-start gap-4">
        <div className="w-11 h-11 rounded-full bg-[#F1EBE1] flex items-center justify-center">
          <PawPrint className="w-5 h-5" strokeWidth={1.75}/>
        </div>
        <div className="flex-1">
          <div className="font-serif-display text-2xl leading-tight">
            {b.pet_name} <span className="text-[#5C7365] text-base">({b.pet_type})</span>
          </div>
          <div className="text-sm text-[#5C7365] flex items-center gap-2 mt-1">
            <Calendar className="w-3.5 h-3.5" strokeWidth={1.75}/> {b.slot_date} • {b.slot_time}
          </div>
          <div className="text-sm text-[#5C7365] flex items-center gap-2 mt-1">
            <MapPin className="w-3.5 h-3.5" strokeWidth={1.75}/> {b.city_name}
          </div>
        </div>
        <div className="text-right">
          <div className="font-serif-display text-2xl">{formatINR(b.total)}</div>
          <div className="text-xs text-[#5C7365] mt-1">{b.items.length} service{b.items.length > 1 ? "s" : ""}</div>
        </div>
      </div>
      <div className="mt-5 flex flex-wrap gap-2">
        {b.items.map((it, i) => (
          <span key={i} className="pill">{it.service_name}</span>
        ))}
      </div>
      <div className="mt-5 flex items-center justify-between">
        <div className="text-xs text-[#5C7365]">
          Payment: <span className="text-[#1E3F2D] font-medium">{b.payment_mode.toUpperCase()}</span> • {b.payment_status}
        </div>
        <button
          data-testid={`download-invoice-${b.booking_id}`}
          onClick={() => onDownload(b.booking_id)}
          className="inline-flex items-center gap-1.5 text-sm text-[#1E3F2D] hover:underline"
        >
          <Download className="w-3.5 h-3.5" strokeWidth={1.75}/> Invoice PDF
        </button>
      </div>
    </article>
  );
}

function EmptyState({ onBook }) {
  return (
    <div className="rounded-3xl border border-dashed border-[#E5DFD3] bg-[#F1EBE1]/40 p-10 text-center">
      <div className="w-14 h-14 rounded-full bg-[#1E3F2D] text-[#FDFBF7] flex items-center justify-center mx-auto mb-4">
        <PawPrint className="w-6 h-6" strokeWidth={1.75}/>
      </div>
      <div className="font-serif-display text-2xl">No upcoming sessions</div>
      <div className="text-sm text-[#5C7365] mt-2 max-w-sm mx-auto">Time to spoil your best friend. Book a pampering session in under two minutes.</div>
      <Button
        data-testid="empty-book-btn"
        onClick={onBook}
        className="rounded-full bg-[#1E3F2D] hover:bg-[#25523a] text-white mt-6 h-11 px-6"
      >
        Book now
      </Button>
    </div>
  );
}
