import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { adminApi } from "@/lib/api";
import { formatINR, STATUS_LABEL, STATUS_COLOR, cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CalendarCheck2, Users, IndianRupee, Hourglass, Phone, MapPin, Mail, PawPrint, Zap, Gift, ArrowRight } from "lucide-react";

export default function AdminDashboard() {
  const [stats, setStats] = useState(null);
  const [recent, setRecent] = useState([]);
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    adminApi.get("/admin/stats").then((r) => setStats(r.data));
    adminApi.get("/admin/bookings").then((r) => setRecent(r.data.slice(0, 8)));
  }, []);

  const cards = [
    { icon: CalendarCheck2, label: "Total bookings", value: stats?.total_bookings ?? "—" },
    { icon: Hourglass, label: "Pending", value: stats?.pending ?? "—" },
    { icon: IndianRupee, label: "Revenue", value: stats ? formatINR(stats.revenue) : "—" },
    { icon: Users, label: "Customers", value: stats?.total_users ?? "—" },
  ];

  return (
    <div data-testid="admin-dashboard">
      <div className="mb-8">
        <div className="text-xs uppercase tracking-[0.25em] text-[#5C7365] mb-2">Overview</div>
        <h1 className="font-serif-display text-4xl">Business at a glance</h1>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((c) => (
          <div key={c.label} className="rounded-2xl border border-[#E5DFD3] bg-white p-5">
            <div className="flex items-center gap-2 text-xs text-[#5C7365]">
              <c.icon className="w-3.5 h-3.5" strokeWidth={1.75}/> {c.label}
            </div>
            <div className="font-serif-display text-3xl mt-2">{c.value}</div>
          </div>
        ))}
      </div>

      <div className="mt-10">
        <div className="flex items-end justify-between mb-4 flex-wrap gap-3">
          <h2 className="font-serif-display text-2xl">Recent bookings</h2>
          <Link
            to="/admin/bookings"
            data-testid="view-all-bookings-link"
            className="text-sm inline-flex items-center gap-1 text-[#1E3F2D] hover:underline"
          >
            View all <ArrowRight className="w-3.5 h-3.5" strokeWidth={1.75}/>
          </Link>
        </div>

        {recent.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[#E5DFD3] p-10 text-center bg-white">
            <PawPrint className="w-8 h-8 mx-auto text-[#5C7365] mb-2" strokeWidth={1.5}/>
            <div className="text-[#5C7365]">No bookings yet. New bookings will appear here.</div>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
            {recent.map((b) => (
              <button
                key={b.booking_id}
                data-testid={`recent-booking-${b.booking_id}`}
                onClick={() => setSelected(b)}
                className="text-left rounded-2xl border border-[#E5DFD3] bg-white p-5 hover:border-[#1E3F2D] hover-lift"
              >
                <div className="flex items-center justify-between mb-3">
                  <span className={cn("pill", STATUS_COLOR[b.status])}>{STATUS_LABEL[b.status]}</span>
                  <span className="text-xs text-[#5C7365] font-mono">{b.invoice_no}</span>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-full bg-[#F1EBE1] flex items-center justify-center shrink-0">
                    <PawPrint className="w-4 h-4" strokeWidth={1.75}/>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-medium truncate">{b.user_name}</div>
                    <div className="text-xs text-[#5C7365] truncate">{b.user_email}</div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="font-serif-display text-xl">{formatINR(b.total)}</div>
                    {b.is_priority_slot && (
                      <span className="text-[10px] uppercase tracking-widest text-[#D96C4A] flex items-center justify-end gap-0.5 mt-0.5">
                        <Zap className="w-3 h-3" strokeWidth={1.75}/> Priority
                      </span>
                    )}
                  </div>
                </div>

                <div className="mt-3 space-y-1.5 text-xs text-[#5C7365]">
                  <div className="flex items-center gap-1.5">
                    <PawPrint className="w-3 h-3" strokeWidth={1.75}/>
                    <span className="text-[#1E3F2D]">{b.pet_name}</span>
                    <span>· {b.pet_type}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Phone className="w-3 h-3" strokeWidth={1.75}/> {b.phone}
                  </div>
                  <div className="flex items-start gap-1.5">
                    <MapPin className="w-3 h-3 mt-0.5 shrink-0" strokeWidth={1.75}/>
                    <span className="truncate">{b.address_line1}{b.address_line2 ? `, ${b.address_line2}` : ""}, {b.city_name} – {b.pincode}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <CalendarCheck2 className="w-3 h-3" strokeWidth={1.75}/> {b.slot_date} • {b.slot_time}
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap gap-1.5">
                  {b.items.slice(0, 3).map((it, i) => (
                    <span key={i} className="pill text-xs">{it.service_name}</span>
                  ))}
                  {b.items.length > 3 && <span className="pill text-xs">+{b.items.length - 3} more</span>}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      <Dialog open={!!selected} onOpenChange={(v) => !v && setSelected(null)}>
        <DialogContent className="bg-[#FDFBF7] max-w-2xl max-h-[85vh] overflow-y-auto">
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle className="font-serif-display text-2xl flex items-center gap-3 flex-wrap">
                  Booking {selected.invoice_no}
                  <span className={cn("pill text-xs", STATUS_COLOR[selected.status])}>{STATUS_LABEL[selected.status]}</span>
                  {selected.is_priority_slot && (
                    <span className="pill text-xs border-[#D96C4A]/50 text-[#D96C4A]">
                      <Zap className="w-3 h-3" strokeWidth={1.75}/> Priority
                    </span>
                  )}
                </DialogTitle>
              </DialogHeader>

              <div className="grid sm:grid-cols-2 gap-3 text-sm mt-2">
                <div className="rounded-xl bg-[#F1EBE1] p-4">
                  <div className="text-xs uppercase tracking-widest text-[#5C7365] mb-2">Customer</div>
                  <div className="font-medium">{selected.user_name}</div>
                  <div className="text-xs flex items-center gap-1.5 mt-1"><Mail className="w-3 h-3" strokeWidth={1.75}/> {selected.user_email}</div>
                  <div className="text-xs flex items-center gap-1.5 mt-1"><Phone className="w-3 h-3" strokeWidth={1.75}/> {selected.phone}</div>
                </div>
                <div className="rounded-xl bg-[#F1EBE1] p-4">
                  <div className="text-xs uppercase tracking-widest text-[#5C7365] mb-2">Pet & slot</div>
                  <div>{selected.pet_name} <span className="text-[#5C7365]">({selected.pet_type})</span></div>
                  <div className="text-xs text-[#5C7365] mt-1">
                    <CalendarCheck2 className="w-3 h-3 inline mr-1" strokeWidth={1.75}/>
                    {selected.slot_date} • {selected.slot_time}
                  </div>
                </div>
                <div className="rounded-xl bg-[#F1EBE1] p-4 sm:col-span-2">
                  <div className="text-xs uppercase tracking-widest text-[#5C7365] mb-2">Location</div>
                  <div className="flex items-start gap-1.5">
                    <MapPin className="w-3.5 h-3.5 mt-0.5" strokeWidth={1.75}/>
                    <span>
                      {selected.address_line1}
                      {selected.address_line2 ? `, ${selected.address_line2}` : ""}
                      {selected.locality ? `, ${selected.locality}` : ""}
                      {`, ${selected.city_name} – ${selected.pincode}`}
                      {selected.state ? `, ${selected.state}` : ""}
                    </span>
                  </div>
                  {selected.landmark && (
                    <div className="text-xs text-[#5C7365] mt-2">Landmark: {selected.landmark}</div>
                  )}
                  <div className="grid grid-cols-2 gap-3 mt-3 text-xs">
                    {selected.property_type && (
                      <div>
                        <div className="uppercase tracking-widest text-[#5C7365]">Property</div>
                        <div className="capitalize">{selected.property_type}</div>
                      </div>
                    )}
                    {selected.floor_info && (
                      <div>
                        <div className="uppercase tracking-widest text-[#5C7365]">Floor / lift</div>
                        <div>{selected.floor_info}</div>
                      </div>
                    )}
                    {selected.parking_type && (
                      <div>
                        <div className="uppercase tracking-widest text-[#5C7365]">Parking</div>
                        <div className="capitalize">{selected.parking_type === "none" ? "Not available" : selected.parking_type}</div>
                      </div>
                    )}
                    <div>
                      <div className="uppercase tracking-widest text-[#5C7365]">Utilities</div>
                      <div>{selected.utilities_confirmed ? "Water & power ✓" : "Not confirmed"}</div>
                    </div>
                  </div>
                  {selected.access_instructions && (
                    <div className="mt-3 rounded-lg bg-white/60 p-2 text-xs">
                      <div className="uppercase tracking-widest text-[#5C7365] mb-1">Entry / access</div>
                      {selected.access_instructions}
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-4 rounded-xl border border-[#E5DFD3] p-4 bg-white">
                <div className="text-xs uppercase tracking-widest text-[#5C7365] mb-2">Services</div>
                {selected.items.map((it, i) => (
                  <div key={i} className="flex justify-between text-sm py-1 border-b last:border-b-0 border-[#E5DFD3]">
                    <span>{it.service_name} × {it.qty}</span>
                    <span>{formatINR(it.price * it.qty)}</span>
                  </div>
                ))}
                <div className="mt-3 text-sm space-y-1">
                  <div className="flex justify-between text-[#5C7365]"><span>Subtotal</span><span>{formatINR(selected.subtotal)}</span></div>
                  {selected.referral_discount > 0 && (
                    <div className="flex justify-between text-[#D96C4A]">
                      <span className="flex items-center gap-1"><Gift className="w-3 h-3" strokeWidth={1.75}/> Referral ({selected.referral_code_used})</span>
                      <span>− {formatINR(selected.referral_discount)}</span>
                    </div>
                  )}
                  {selected.priority_fee > 0 && (
                    <div className="flex justify-between text-[#1E3F2D]">
                      <span className="flex items-center gap-1"><Zap className="w-3 h-3" strokeWidth={1.75}/> Priority fee</span>
                      <span>+ {formatINR(selected.priority_fee)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-[#5C7365]"><span>GST ({selected.gst_percent || 18}%)</span><span>{formatINR(selected.gst)}</span></div>
                  <div className="flex justify-between font-medium pt-1 border-t border-[#E5DFD3]"><span>Total</span><span className="font-serif-display text-xl">{formatINR(selected.total)}</span></div>
                </div>
              </div>

              <div className="mt-3 text-xs text-[#5C7365]">
                Payment: <span className="text-[#1E3F2D] font-medium uppercase">{selected.payment_mode}</span> · {selected.payment_status}
                {selected.upi_txn_ref ? ` · ${selected.upi_txn_ref}` : ""}
              </div>
              {selected.notes && (
                <div className="mt-3 rounded-xl bg-[#F1EBE1] p-3 text-sm">
                  <div className="text-xs uppercase tracking-widest text-[#5C7365] mb-1">Notes</div>
                  {selected.notes}
                </div>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
