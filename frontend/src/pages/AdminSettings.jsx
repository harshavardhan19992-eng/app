import React, { useEffect, useState } from "react";
import { adminApi } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { IndianRupee, Percent, KeyRound, Save } from "lucide-react";

export default function AdminSettings() {
  const [settings, setSettings] = useState({ upi_id: "", upi_payee_name: "", gst_percent: 18 });
  const [loaded, setLoaded] = useState(false);
  const [pw, setPw] = useState({ current_password: "", new_password: "", confirm: "" });
  const [saving, setSaving] = useState(false);
  const [changing, setChanging] = useState(false);

  useEffect(() => {
    adminApi.get("/admin/settings").then((r) => { setSettings(r.data); setLoaded(true); });
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      await adminApi.patch("/admin/settings", settings);
      toast.success("Settings saved");
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const changePassword = async (e) => {
    e.preventDefault();
    if (pw.new_password !== pw.confirm) {
      toast.error("New passwords don't match");
      return;
    }
    setChanging(true);
    try {
      await adminApi.post("/admin/password", {
        current_password: pw.current_password,
        new_password: pw.new_password,
      });
      toast.success("Password updated");
      setPw({ current_password: "", new_password: "", confirm: "" });
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Password change failed");
    } finally {
      setChanging(false);
    }
  };

  if (!loaded) return null;

  return (
    <div data-testid="admin-settings-page" className="max-w-3xl">
      <div className="mb-8">
        <div className="text-xs uppercase tracking-[0.25em] text-[#5C7365] mb-2">Configuration</div>
        <h1 className="font-serif-display text-4xl">Settings</h1>
      </div>

      {/* Payment settings */}
      <section className="rounded-2xl border border-[#E5DFD3] bg-white p-6 mb-6">
        <div className="flex items-center gap-2 mb-4">
          <IndianRupee className="w-4 h-4" strokeWidth={1.75}/>
          <h2 className="font-serif-display text-2xl">Payment</h2>
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <Label>UPI ID</Label>
            <Input
              data-testid="settings-upi-id"
              className="mt-2 rounded-xl h-11"
              placeholder="pawgroom@upi"
              value={settings.upi_id}
              onChange={(e) => setSettings((s) => ({ ...s, upi_id: e.target.value }))}
            />
          </div>
          <div>
            <Label>UPI payee name</Label>
            <Input
              data-testid="settings-upi-name"
              className="mt-2 rounded-xl h-11"
              placeholder="PawGroom India"
              value={settings.upi_payee_name}
              onChange={(e) => setSettings((s) => ({ ...s, upi_payee_name: e.target.value }))}
            />
          </div>
        </div>
      </section>

      {/* Tax */}
      <section className="rounded-2xl border border-[#E5DFD3] bg-white p-6 mb-6">
        <div className="flex items-center gap-2 mb-4">
          <Percent className="w-4 h-4" strokeWidth={1.75}/>
          <h2 className="font-serif-display text-2xl">Tax</h2>
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <Label>GST %</Label>
            <Input
              type="number"
              step="0.5"
              data-testid="settings-gst"
              className="mt-2 rounded-xl h-11"
              value={settings.gst_percent}
              onChange={(e) => setSettings((s) => ({ ...s, gst_percent: Number(e.target.value) }))}
            />
            <div className="text-xs text-[#5C7365] mt-1">Applied to all new bookings.</div>
          </div>
        </div>
      </section>

      <div className="flex justify-end mb-10">
        <Button
          data-testid="settings-save-btn"
          onClick={save}
          disabled={saving}
          className="rounded-full bg-[#1E3F2D] hover:bg-[#25523a] text-white h-11 px-6"
        >
          <Save className="w-4 h-4 mr-2" strokeWidth={1.75}/> {saving ? "Saving…" : "Save changes"}
        </Button>
      </div>

      {/* Password */}
      <section className="rounded-2xl border border-[#E5DFD3] bg-white p-6">
        <div className="flex items-center gap-2 mb-4">
          <KeyRound className="w-4 h-4" strokeWidth={1.75}/>
          <h2 className="font-serif-display text-2xl">Admin password</h2>
        </div>
        <form onSubmit={changePassword} className="grid sm:grid-cols-3 gap-4">
          <div>
            <Label>Current password</Label>
            <Input
              type="password"
              data-testid="settings-current-pw"
              className="mt-2 rounded-xl h-11"
              value={pw.current_password}
              onChange={(e) => setPw((s) => ({ ...s, current_password: e.target.value }))}
              required
            />
          </div>
          <div>
            <Label>New password</Label>
            <Input
              type="password"
              data-testid="settings-new-pw"
              className="mt-2 rounded-xl h-11"
              value={pw.new_password}
              onChange={(e) => setPw((s) => ({ ...s, new_password: e.target.value }))}
              required
            />
          </div>
          <div>
            <Label>Confirm new</Label>
            <Input
              type="password"
              data-testid="settings-confirm-pw"
              className="mt-2 rounded-xl h-11"
              value={pw.confirm}
              onChange={(e) => setPw((s) => ({ ...s, confirm: e.target.value }))}
              required
            />
          </div>
          <div className="sm:col-span-3 flex justify-end">
            <Button
              type="submit"
              data-testid="settings-change-pw-btn"
              disabled={changing}
              className="rounded-full bg-[#D96C4A] hover:bg-[#c65e3e] text-white h-11 px-6"
            >
              {changing ? "Updating…" : "Update password"}
            </Button>
          </div>
        </form>
      </section>
    </div>
  );
}
