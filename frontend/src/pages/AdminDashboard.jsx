import React, { useEffect, useState } from "react";
import { adminApi } from "@/lib/api";
import { formatINR } from "@/lib/utils";
import { CalendarCheck2, Users, IndianRupee, Hourglass } from "lucide-react";

export default function AdminDashboard() {
  const [stats, setStats] = useState(null);
  const [recent, setRecent] = useState([]);

  useEffect(() => {
    adminApi.get("/admin/stats").then((r) => setStats(r.data));
    adminApi.get("/admin/bookings").then((r) => setRecent(r.data.slice(0, 6)));
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
        <h2 className="font-serif-display text-2xl mb-4">Recent bookings</h2>
        <div className="rounded-2xl border border-[#E5DFD3] overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-[#F1EBE1] text-[#5C7365]">
              <tr>
                <th className="text-left px-4 py-3">Invoice</th>
                <th className="text-left px-4 py-3">Customer</th>
                <th className="text-left px-4 py-3">Pet</th>
                <th className="text-left px-4 py-3">City</th>
                <th className="text-left px-4 py-3">Slot</th>
                <th className="text-right px-4 py-3">Total</th>
                <th className="text-left px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {recent.map((b) => (
                <tr key={b.booking_id} className="border-t border-[#E5DFD3]">
                  <td className="px-4 py-3">{b.invoice_no}</td>
                  <td className="px-4 py-3">{b.user_name}</td>
                  <td className="px-4 py-3">{b.pet_name} ({b.pet_type})</td>
                  <td className="px-4 py-3">{b.city_name}</td>
                  <td className="px-4 py-3">{b.slot_date} {b.slot_time}</td>
                  <td className="px-4 py-3 text-right">{formatINR(b.total)}</td>
                  <td className="px-4 py-3 capitalize">{b.status.replace("_", " ")}</td>
                </tr>
              ))}
              {recent.length === 0 && (
                <tr><td colSpan={7} className="p-6 text-center text-[#5C7365]">No bookings yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
