import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PawPrint, Phone, MapPin, User as UserIcon } from "lucide-react";
import { toast } from "sonner";

export default function Profile() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [cities, setCities] = useState([]);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    phone: "",
    default_address_line1: "",
    default_address_line2: "",
    default_pincode: "",
    default_city: "",
  });

  useEffect(() => {
    if (loading) return;
    if (!user) { navigate("/login", { replace: true }); return; }
    api.get("/cities").then((r) => setCities(r.data));
    api.get("/profile").then((r) => setForm((f) => ({
      ...f,
      phone: r.data.phone || "",
      default_address_line1: r.data.default_address_line1 || "",
      default_address_line2: r.data.default_address_line2 || "",
      default_pincode: r.data.default_pincode || "",
      default_city: r.data.default_city || "",
    })));
  }, [user, loading, navigate]);

  const save = async () => {
    if (!/^\d{10}$/.test(form.phone)) {
      toast.error("Enter a valid 10-digit mobile number");
      return;
    }
    setSaving(true);
    try {
      await api.patch("/profile", form);
      toast.success("Profile updated");
      navigate("/dashboard");
    } catch {
      toast.error("Save failed");
    } finally {
      setSaving(false);
    }
  };

  if (loading || !user) return null;

  return (
    <main data-testid="profile-page" className="max-w-3xl mx-auto px-6 lg:px-10 py-12">
      <div className="mb-8">
        <div className="text-xs uppercase tracking-[0.25em] text-[#5C7365] mb-2">My profile</div>
        <h1 className="font-serif-display text-4xl">Your details</h1>
        <p className="text-[#5C7365] mt-2">Save these once — we&rsquo;ll auto-fill them in future bookings.</p>
      </div>

      <div className="rounded-3xl border border-[#E5DFD3] bg-[#FDFBF7] p-6 sm:p-8 space-y-6">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-full bg-[#F1EBE1] flex items-center justify-center">
            <UserIcon className="w-5 h-5" strokeWidth={1.75}/>
          </div>
          <div>
            <div className="font-medium">{user.name}</div>
            <div className="text-xs text-[#5C7365]">{user.email}</div>
          </div>
        </div>

        <div className="grid sm:grid-cols-2 gap-5">
          <div className="sm:col-span-2">
            <Label htmlFor="phone" className="flex items-center gap-1.5"><Phone className="w-3.5 h-3.5" strokeWidth={1.75}/> Mobile number</Label>
            <Input
              id="phone"
              data-testid="profile-phone-input"
              inputMode="numeric"
              maxLength={10}
              placeholder="10-digit mobile"
              className="mt-2 rounded-xl bg-[#FDFBF7] border-[#E5DFD3] h-11"
              value={form.phone}
              onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value.replace(/\D/g, "") }))}
            />
          </div>

          <div className="sm:col-span-2">
            <Label className="flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5" strokeWidth={1.75}/> Address line 1</Label>
            <Input
              data-testid="profile-addr1-input"
              placeholder="Flat, building, street"
              className="mt-2 rounded-xl bg-[#FDFBF7] border-[#E5DFD3] h-11"
              value={form.default_address_line1}
              onChange={(e) => setForm((f) => ({ ...f, default_address_line1: e.target.value }))}
            />
          </div>
          <div className="sm:col-span-2">
            <Label>Address line 2 (optional)</Label>
            <Input
              data-testid="profile-addr2-input"
              placeholder="Landmark, area"
              className="mt-2 rounded-xl bg-[#FDFBF7] border-[#E5DFD3] h-11"
              value={form.default_address_line2}
              onChange={(e) => setForm((f) => ({ ...f, default_address_line2: e.target.value }))}
            />
          </div>
          <div>
            <Label>City</Label>
            <Select value={form.default_city} onValueChange={(v) => setForm((f) => ({ ...f, default_city: v }))}>
              <SelectTrigger data-testid="profile-city-select" className="mt-2 rounded-xl bg-[#FDFBF7] border-[#E5DFD3] h-11">
                <SelectValue placeholder="Choose city" />
              </SelectTrigger>
              <SelectContent>
                {cities.map((c) => <SelectItem key={c.slug} value={c.slug}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>PIN code</Label>
            <Input
              data-testid="profile-pin-input"
              inputMode="numeric"
              maxLength={6}
              placeholder="6 digits"
              className="mt-2 rounded-xl bg-[#FDFBF7] border-[#E5DFD3] h-11"
              value={form.default_pincode}
              onChange={(e) => setForm((f) => ({ ...f, default_pincode: e.target.value.replace(/\D/g, "") }))}
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 pt-2">
          <Button
            variant="outline"
            className="rounded-full border-[#E5DFD3]"
            onClick={() => navigate("/dashboard")}
          >Cancel</Button>
          <Button
            data-testid="profile-save-btn"
            onClick={save}
            disabled={saving}
            className="rounded-full bg-[#1E3F2D] hover:bg-[#25523a] text-white h-11 px-6"
          >
            {saving ? "Saving…" : "Save details"}
          </Button>
        </div>
      </div>
    </main>
  );
}
