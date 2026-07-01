import React, { useEffect, useState } from "react";
import { adminApi } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Pencil, Phone, MapPin, Scissors } from "lucide-react";
import { toast } from "sonner";

const empty = { name: "", phone: "", city: "", notes: "" };

export default function AdminGroomers() {
  const [groomers, setGroomers] = useState([]);
  const [cities, setCities] = useState([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(empty);

  const load = () => adminApi.get("/admin/groomers").then((r) => setGroomers(r.data));
  useEffect(() => {
    load();
    adminApi.get("/cities").then((r) => setCities(r.data));
  }, []);

  const openNew = () => { setEditing(null); setForm(empty); setOpen(true); };
  const openEdit = (g) => {
    setEditing(g.groomer_id);
    setForm({ name: g.name, phone: g.phone || "", city: g.city || "", notes: g.notes || "" });
    setOpen(true);
  };

  const save = async () => {
    if (!form.name.trim()) { toast.error("Name is required"); return; }
    try {
      if (editing) {
        await adminApi.patch(`/admin/groomers/${editing}`, form);
        toast.success("Groomer updated");
      } else {
        await adminApi.post("/admin/groomers", form);
        toast.success("Groomer added");
      }
      setOpen(false);
      load();
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Save failed");
    }
  };

  const toggleActive = async (g, next) => {
    await adminApi.patch(`/admin/groomers/${g.groomer_id}`, { active: next });
    load();
  };

  return (
    <div data-testid="admin-groomers-page">
      <div className="flex items-end justify-between mb-6 flex-wrap gap-3">
        <div>
          <div className="text-xs uppercase tracking-[0.25em] text-[#5C7365] mb-2">Team</div>
          <h1 className="font-serif-display text-4xl">Groomers</h1>
          <p className="text-[#5C7365] mt-2 text-sm">Add your groomers here to assign them to bookings.</p>
        </div>
        <Button
          data-testid="admin-add-groomer-btn"
          onClick={openNew}
          className="rounded-full bg-[#1E3F2D] hover:bg-[#25523a] text-white h-11 px-5"
        >
          <Plus className="w-4 h-4 mr-2" strokeWidth={1.75}/> Add groomer
        </Button>
      </div>

      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
        {groomers.map((g) => (
          <div
            key={g.groomer_id}
            data-testid={`groomer-card-${g.groomer_id}`}
            className="rounded-2xl border border-[#E5DFD3] bg-white p-5"
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-[#F1EBE1] flex items-center justify-center">
                  <Scissors className="w-4 h-4" strokeWidth={1.75}/>
                </div>
                <div>
                  <div className="font-serif-display text-xl">{g.name}</div>
                  {g.city && (
                    <div className="text-xs text-[#5C7365] flex items-center gap-1 mt-0.5">
                      <MapPin className="w-3 h-3" strokeWidth={1.75}/>
                      {cities.find(c => c.slug === g.city)?.name || g.city}
                    </div>
                  )}
                </div>
              </div>
              <button
                data-testid={`edit-groomer-${g.groomer_id}`}
                onClick={() => openEdit(g)}
                className="p-2 rounded-full border border-[#E5DFD3] hover:bg-[#F1EBE1]"
              >
                <Pencil className="w-3.5 h-3.5" strokeWidth={1.75}/>
              </button>
            </div>
            {g.phone && (
              <div className="mt-3 text-sm text-[#5C7365] flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5" strokeWidth={1.75}/> {g.phone}
              </div>
            )}
            {g.notes && (
              <div className="mt-2 text-xs text-[#5C7365]">{g.notes}</div>
            )}
            <div className="mt-4 flex items-center justify-between text-xs text-[#5C7365]">
              <span>Active</span>
              <Switch
                data-testid={`toggle-groomer-${g.groomer_id}`}
                checked={!!g.active}
                onCheckedChange={(v) => toggleActive(g, v)}
              />
            </div>
          </div>
        ))}
        {groomers.length === 0 && (
          <div className="col-span-full rounded-2xl border border-dashed border-[#E5DFD3] p-10 text-center bg-white text-[#5C7365]">
            <Scissors className="w-6 h-6 mx-auto mb-2" strokeWidth={1.5}/>
            No groomers yet. Add your first team member to start assigning bookings.
          </div>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="bg-[#FDFBF7]">
          <DialogHeader>
            <DialogTitle className="font-serif-display text-2xl">
              {editing ? "Edit groomer" : "Add groomer"}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-4">
            <div>
              <Label>Name</Label>
              <Input
                data-testid="groomer-form-name"
                className="mt-1 rounded-xl h-11"
                placeholder="e.g. Priya Menon"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Phone</Label>
                <Input
                  data-testid="groomer-form-phone"
                  className="mt-1 rounded-xl h-11"
                  placeholder="10 digits"
                  inputMode="numeric"
                  maxLength={10}
                  value={form.phone}
                  onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value.replace(/\D/g, "") }))}
                />
              </div>
              <div>
                <Label>City</Label>
                <Select value={form.city} onValueChange={(v) => setForm((f) => ({ ...f, city: v }))}>
                  <SelectTrigger data-testid="groomer-form-city" className="mt-1 rounded-xl h-11">
                    <SelectValue placeholder="Choose" />
                  </SelectTrigger>
                  <SelectContent>
                    {cities.map((c) => <SelectItem key={c.slug} value={c.slug}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Notes (optional)</Label>
              <Textarea
                data-testid="groomer-form-notes"
                className="mt-1 rounded-xl"
                placeholder="Specialisation, experience…"
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} className="rounded-full border-[#E5DFD3]">
              Cancel
            </Button>
            <Button
              data-testid="groomer-form-save"
              onClick={save}
              className="rounded-full bg-[#1E3F2D] hover:bg-[#25523a] text-white"
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
