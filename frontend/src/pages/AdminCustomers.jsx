import React, { useEffect, useState } from "react";
import { adminApi } from "@/lib/api";
import { formatINR, STATUS_LABEL, cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Users, Search, Phone, MapPin, Mail, Gift } from "lucide-react";

export default function AdminCustomers() {
  const [customers, setCustomers] = useState([]);
  const [selected, setSelected] = useState(null);
  const [detail, setDetail] = useState(null);
  const [query, setQuery] = useState("");

  useEffect(() => {
    adminApi.get("/admin/customers").then((r) => setCustomers(r.data));
  }, []);

  useEffect(() => {
    if (selected) {
      adminApi.get(`/admin/customers/${selected}`).then((r) => setDetail(r.data));
    } else {
      setDetail(null);
    }
  }, [selected]);

  const shown = customers.filter((c) => {
    if (!query.trim()) return true;
    const q = query.toLowerCase();
    return (
      (c.name || "").toLowerCase().includes(q) ||
      (c.email || "").toLowerCase().includes(q) ||
      (c.phone || "").includes(q) ||
      (c.referral_code || "").toLowerCase().includes(q)
    );
  });

  return (
    <div data-testid="admin-customers-page">
      <div className="flex items-end justify-between mb-6 flex-wrap gap-3">
        <div>
          <div className="text-xs uppercase tracking-[0.25em] text-[#5C7365] mb-2">Directory</div>
          <h1 className="font-serif-display text-4xl">Customers</h1>
        </div>
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#5C7365]" strokeWidth={1.75}/>
          <Input
            data-testid="customer-search-input"
            className="pl-9 rounded-xl bg-white border-[#E5DFD3] h-11"
            placeholder="Search name, email, phone…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      </div>

      <div className="rounded-2xl border border-[#E5DFD3] bg-white overflow-x-auto">
        <table className="w-full text-sm min-w-[900px]">
          <thead className="bg-[#F1EBE1] text-[#5C7365]">
            <tr>
              <th className="text-left px-4 py-3">Customer</th>
              <th className="text-left px-4 py-3">Contact</th>
              <th className="text-left px-4 py-3">City</th>
              <th className="text-left px-4 py-3">Referral</th>
              <th className="text-right px-4 py-3">Bookings</th>
              <th className="text-right px-4 py-3">Spend</th>
              <th className="text-left px-4 py-3">Joined</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((c) => (
              <tr
                key={c.user_id}
                data-testid={`customer-row-${c.user_id}`}
                onClick={() => setSelected(c.user_id)}
                className="border-t border-[#E5DFD3] hover:bg-[#F1EBE1]/60 cursor-pointer"
              >
                <td className="px-4 py-3">
                  <div className="font-medium">{c.name || "—"}</div>
                  <div className="text-xs text-[#5C7365]">{c.email}</div>
                </td>
                <td className="px-4 py-3 text-xs">
                  <div className="flex items-center gap-1"><Phone className="w-3 h-3" strokeWidth={1.75}/> {c.phone || <span className="text-[#5C7365]">not set</span>}</div>
                </td>
                <td className="px-4 py-3">{c.default_city || <span className="text-[#5C7365] text-xs">—</span>}</td>
                <td className="px-4 py-3 text-xs">
                  <div className="font-mono">{c.referral_code}</div>
                  <div className="text-[#5C7365]">{c.referral_count} referred</div>
                </td>
                <td className="px-4 py-3 text-right">{c.bookings_count}</td>
                <td className="px-4 py-3 text-right">{formatINR(c.total_spend)}</td>
                <td className="px-4 py-3 text-xs text-[#5C7365]">{c.created_at?.slice(0, 10)}</td>
              </tr>
            ))}
            {shown.length === 0 && (
              <tr><td colSpan={7} className="p-6 text-center text-[#5C7365]">
                <Users className="w-6 h-6 mx-auto mb-2" strokeWidth={1.5}/> No customers yet.
              </td></tr>
            )}
          </tbody>
        </table>
      </div>

      <Dialog open={!!selected} onOpenChange={(v) => !v && setSelected(null)}>
        <DialogContent className="bg-[#FDFBF7] max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-serif-display text-2xl">
              {detail?.customer?.name || "Customer details"}
            </DialogTitle>
          </DialogHeader>
          {detail && (
            <>
              <div className="grid sm:grid-cols-2 gap-3 text-sm">
                <div className="rounded-xl bg-[#F1EBE1] p-4">
                  <div className="text-xs uppercase tracking-widest text-[#5C7365] mb-1">Contact</div>
                  <div className="flex items-center gap-1.5"><Mail className="w-3.5 h-3.5" strokeWidth={1.75}/> {detail.customer.email}</div>
                  <div className="flex items-center gap-1.5"><Phone className="w-3.5 h-3.5" strokeWidth={1.75}/> {detail.customer.phone || "Not set"}</div>
                </div>
                <div className="rounded-xl bg-[#F1EBE1] p-4">
                  <div className="text-xs uppercase tracking-widest text-[#5C7365] mb-1">Default address</div>
                  <div className="flex items-start gap-1.5">
                    <MapPin className="w-3.5 h-3.5 mt-0.5" strokeWidth={1.75}/>
                    <span>
                      {detail.customer.default_address_line1 || "Not set"}
                      {detail.customer.default_address_line2 ? `, ${detail.customer.default_address_line2}` : ""}
                      {detail.customer.default_locality ? `, ${detail.customer.default_locality}` : ""}
                      {detail.customer.default_city ? `, ${detail.customer.default_city}` : ""}
                      {detail.customer.default_pincode ? ` – ${detail.customer.default_pincode}` : ""}
                      {detail.customer.default_state ? `, ${detail.customer.default_state}` : ""}
                    </span>
                  </div>
                  {detail.customer.default_landmark && (
                    <div className="text-xs text-[#5C7365] mt-2">Landmark: {detail.customer.default_landmark}</div>
                  )}
                </div>
                <div className="rounded-xl bg-[#F1EBE1] p-4 sm:col-span-2 flex items-center gap-4">
                  <Gift className="w-4 h-4" strokeWidth={1.75}/>
                  <div className="flex-1">
                    <div className="text-xs uppercase tracking-widest text-[#5C7365]">Referral</div>
                    <div>Code: <span className="font-mono">{detail.customer.referral_code}</span></div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-[#5C7365]">Referred</div>
                    <div className="font-serif-display text-2xl">{detail.customer.referral_count || 0}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-[#5C7365]">Credit</div>
                    <div className="font-serif-display text-2xl">{formatINR(detail.customer.referral_credit_inr || 0)}</div>
                  </div>
                </div>
              </div>

              <h3 className="font-serif-display text-xl mt-6 mb-3">Booking history</h3>
              {detail.bookings.length === 0 ? (
                <div className="text-sm text-[#5C7365]">No bookings yet.</div>
              ) : (
                <div className="rounded-xl border border-[#E5DFD3] overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-[#F1EBE1] text-[#5C7365]">
                      <tr>
                        <th className="text-left px-3 py-2">Invoice</th>
                        <th className="text-left px-3 py-2">Pet</th>
                        <th className="text-left px-3 py-2">Slot</th>
                        <th className="text-left px-3 py-2">Status</th>
                        <th className="text-right px-3 py-2">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detail.bookings.map((b) => (
                        <tr key={b.booking_id} className="border-t border-[#E5DFD3]">
                          <td className="px-3 py-2">{b.invoice_no}</td>
                          <td className="px-3 py-2">{b.pet_name} ({b.pet_type})</td>
                          <td className="px-3 py-2">{b.slot_date} • {b.slot_time}</td>
                          <td className="px-3 py-2">{STATUS_LABEL[b.status]}</td>
                          <td className="px-3 py-2 text-right">{formatINR(b.total)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
