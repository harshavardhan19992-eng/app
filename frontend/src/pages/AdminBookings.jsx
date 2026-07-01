import React, { useEffect, useState } from "react";
import { adminApi } from "@/lib/api";
import { formatINR, STATUS_LABEL } from "@/lib/utils";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

const STATUSES = ["pending", "confirmed", "in_service", "completed", "cancelled"];

export default function AdminBookings() {
  const [bookings, setBookings] = useState([]);
  const [groomers, setGroomers] = useState([]);
  const [filter, setFilter] = useState("all");

  const load = () => adminApi.get("/admin/bookings").then((r) => setBookings(r.data));
  useEffect(() => {
    load();
    adminApi.get("/admin/groomers").then((r) => setGroomers(r.data.filter((g) => g.active)));
  }, []);

  const updateStatus = async (id, status) => {
    try {
      await adminApi.patch(`/admin/bookings/${id}/status`, { status });
      toast.success("Booking updated");
      load();
    } catch {
      toast.error("Failed to update");
    }
  };

  const assignGroomer = async (id, groomer_id) => {
    try {
      const r = await adminApi.patch(`/admin/bookings/${id}/assign`, {
        groomer_id: groomer_id === "__none__" ? null : groomer_id,
      });
      toast.success(r.data.assigned_groomer_name ? `Assigned to ${r.data.assigned_groomer_name}` : "Unassigned");
      load();
    } catch {
      toast.error("Assignment failed");
    }
  };

  const shown = filter === "all" ? bookings : bookings.filter((b) => b.status === filter);

  return (
    <div data-testid="admin-bookings-page">
      <div className="flex items-end justify-between mb-6 flex-wrap gap-3">
        <div>
          <div className="text-xs uppercase tracking-[0.25em] text-[#5C7365] mb-2">All bookings</div>
          <h1 className="font-serif-display text-4xl">Bookings</h1>
        </div>
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger data-testid="admin-status-filter" className="w-56 rounded-xl bg-white border-[#E5DFD3] h-11">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {STATUSES.map((s) => (
              <SelectItem key={s} value={s}>{STATUS_LABEL[s]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-2xl border border-[#E5DFD3] overflow-x-auto bg-white">
        <table className="w-full text-sm min-w-[860px]">
          <thead className="bg-[#F1EBE1] text-[#5C7365]">
            <tr>
              <th className="text-left px-4 py-3">Invoice</th>
              <th className="text-left px-4 py-3">Customer</th>
              <th className="text-left px-4 py-3">Pet</th>
              <th className="text-left px-4 py-3">City & slot</th>
              <th className="text-left px-4 py-3">Address</th>
              <th className="text-right px-4 py-3">Total</th>
              <th className="text-left px-4 py-3">Payment</th>
              <th className="text-left px-4 py-3">Groomer</th>
              <th className="text-left px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((b) => (
              <tr key={b.booking_id} className="border-t border-[#E5DFD3] align-top">
                <td className="px-4 py-3">
                  <div className="font-medium">{b.invoice_no}</div>
                  <div className="text-xs text-[#5C7365]">{b.booking_id}</div>
                </td>
                <td className="px-4 py-3">
                  <div>{b.user_name}</div>
                  <div className="text-xs text-[#5C7365]">{b.user_email}</div>
                  <div className="text-xs text-[#5C7365]">{b.phone}</div>
                </td>
                <td className="px-4 py-3">{b.pet_name} <span className="text-[#5C7365]">({b.pet_type})</span></td>
                <td className="px-4 py-3">
                  <div>{b.city_name}</div>
                  <div className="text-xs text-[#5C7365]">{b.slot_date} • {b.slot_time}</div>
                </td>
                <td className="px-4 py-3 text-xs text-[#5C7365] max-w-[240px]">
                  <div>{b.address_line1}{b.address_line2 ? `, ${b.address_line2}` : ""}</div>
                  {b.locality && <div>{b.locality}</div>}
                  <div>{b.pincode}{b.state ? `, ${b.state}` : ""}</div>
                  {b.landmark && <div className="italic">Near {b.landmark}</div>}
                </td>
                <td className="px-4 py-3 text-right">{formatINR(b.total)}</td>
                <td className="px-4 py-3 text-xs">
                  <div className="uppercase">{b.payment_mode}</div>
                  <div className="text-[#5C7365]">{b.payment_status}{b.upi_txn_ref ? ` · ${b.upi_txn_ref}` : ""}</div>
                </td>
                <td className="px-4 py-3">
                  <Select
                    value={b.assigned_groomer_id || "__none__"}
                    onValueChange={(v) => assignGroomer(b.booking_id, v)}
                  >
                    <SelectTrigger data-testid={`assign-groomer-row-${b.booking_id}`} className="h-9 rounded-lg border-[#E5DFD3] bg-white w-40">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">— Unassigned —</SelectItem>
                      {groomers.map((g) => (
                        <SelectItem key={g.groomer_id} value={g.groomer_id}>{g.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {b.preferred_groomer_name && !b.assigned_groomer_id && (
                    <div className="text-[10px] text-[#5C7365] mt-1">Prefers {b.preferred_groomer_name}</div>
                  )}
                </td>
                <td className="px-4 py-3">
                  <Select value={b.status} onValueChange={(v) => updateStatus(b.booking_id, v)}>
                    <SelectTrigger data-testid={`admin-status-${b.booking_id}`} className="h-9 rounded-lg border-[#E5DFD3] bg-white w-40">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {STATUSES.map((s) => (
                        <SelectItem key={s} value={s}>{STATUS_LABEL[s]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </td>
              </tr>
            ))}
            {shown.length === 0 && (
              <tr><td colSpan={9} className="p-6 text-center text-[#5C7365]">No bookings.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
