import React, { useEffect, useState } from "react";
import { adminApi } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { formatINR } from "@/lib/utils";
import { Plus, Pencil } from "lucide-react";

const empty = { name: "", pet_type: "dog", description: "", duration_minutes: 60, base_price: 999, image_url: "" };

export default function AdminServices() {
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(empty);

  const load = () => adminApi.get("/services").then((r) => setItems(r.data));
  useEffect(() => { load(); }, []);

  const openNew = () => { setEditing(null); setForm(empty); setOpen(true); };
  const openEdit = (svc) => {
    setEditing(svc.service_id);
    setForm({
      name: svc.name, pet_type: svc.pet_type, description: svc.description,
      duration_minutes: svc.duration_minutes, base_price: svc.base_price,
      image_url: svc.image_url || "",
    });
    setOpen(true);
  };

  const save = async () => {
    try {
      if (editing) {
        await adminApi.patch(`/admin/services/${editing}`, form);
        toast.success("Service updated");
      } else {
        await adminApi.post("/admin/services", form);
        toast.success("Service created");
      }
      setOpen(false);
      load();
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Save failed");
    }
  };

  const toggleActive = async (svc, next) => {
    await adminApi.patch(`/admin/services/${svc.service_id}`, { active: next });
    load();
  };

  return (
    <div data-testid="admin-services-page">
      <div className="flex items-end justify-between mb-6 flex-wrap gap-3">
        <div>
          <div className="text-xs uppercase tracking-[0.25em] text-[#5C7365] mb-2">Catalog</div>
          <h1 className="font-serif-display text-4xl">Services</h1>
        </div>
        <Button
          data-testid="admin-add-service-btn"
          onClick={openNew}
          className="rounded-full bg-[#1E3F2D] hover:bg-[#25523a] text-white h-11 px-5"
        >
          <Plus className="w-4 h-4 mr-2" strokeWidth={1.75}/> Add service
        </Button>
      </div>

      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
        {items.map((s) => (
          <div key={s.service_id} className="rounded-2xl border border-[#E5DFD3] bg-white p-5">
            <div className="flex items-start justify-between">
              <div>
                <div className="text-xs uppercase tracking-widest text-[#5C7365]">{s.pet_type}</div>
                <div className="font-serif-display text-2xl mt-1">{s.name}</div>
              </div>
              <div className="font-serif-display text-xl">{formatINR(s.base_price)}</div>
            </div>
            <p className="text-sm text-[#5C7365] mt-2 min-h-[48px]">{s.description}</p>
            <div className="mt-4 flex items-center justify-between">
              <div className="text-xs text-[#5C7365]">{s.duration_minutes} min</div>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 text-xs text-[#5C7365]">
                  Active
                  <Switch
                    data-testid={`toggle-active-${s.service_id}`}
                    checked={!!s.active}
                    onCheckedChange={(v) => toggleActive(s, v)}
                  />
                </div>
                <button
                  data-testid={`edit-service-${s.service_id}`}
                  onClick={() => openEdit(s)}
                  className="p-2 rounded-full border border-[#E5DFD3] hover:bg-[#F1EBE1]"
                >
                  <Pencil className="w-3.5 h-3.5" strokeWidth={1.75}/>
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="bg-[#FDFBF7]">
          <DialogHeader>
            <DialogTitle className="font-serif-display text-2xl">
              {editing ? "Edit service" : "Add service"}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-4">
            <div>
              <Label>Name</Label>
              <Input
                data-testid="svc-form-name"
                className="mt-1 rounded-xl h-11"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Pet type</Label>
                <Select value={form.pet_type} onValueChange={(v) => setForm((f) => ({ ...f, pet_type: v }))}>
                  <SelectTrigger data-testid="svc-form-pet-type" className="mt-1 rounded-xl h-11"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="dog">Dog</SelectItem>
                    <SelectItem value="cat">Cat</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Duration (min)</Label>
                <Input
                  type="number"
                  data-testid="svc-form-duration"
                  className="mt-1 rounded-xl h-11"
                  value={form.duration_minutes}
                  onChange={(e) => setForm((f) => ({ ...f, duration_minutes: Number(e.target.value) }))}
                />
              </div>
            </div>
            <div>
              <Label>Base price (INR)</Label>
              <Input
                type="number"
                data-testid="svc-form-price"
                className="mt-1 rounded-xl h-11"
                value={form.base_price}
                onChange={(e) => setForm((f) => ({ ...f, base_price: Number(e.target.value) }))}
              />
            </div>
            <div>
              <Label>Description</Label>
              <Textarea
                data-testid="svc-form-desc"
                className="mt-1 rounded-xl"
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              />
            </div>
            <div>
              <Label>Image URL (optional)</Label>
              <Input
                data-testid="svc-form-image"
                className="mt-1 rounded-xl h-11"
                value={form.image_url}
                onChange={(e) => setForm((f) => ({ ...f, image_url: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setOpen(false)}
              className="rounded-full border-[#E5DFD3]"
            >
              Cancel
            </Button>
            <Button
              data-testid="svc-form-save"
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
