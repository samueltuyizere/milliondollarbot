"use client";

import { useState, useEffect, useCallback } from "react";
import { usePermissions } from "@/hooks/use-permissions";
import { PERMISSIONS } from "@/lib/permissions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Plus,
  Pencil,
  Trash2,
  Shield,
  Users,
  RefreshCw,
  Lock,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface PermissionItem {
  id: string;
  code: string;
  description?: string;
  category?: string;
}

interface RoleRow {
  id: string;
  name: string;
  description?: string;
  isSystem: boolean;
  permissions: PermissionItem[];
  _count: { users: number };
}

const CATEGORY_LABELS: Record<string, string> = {
  dashboard: "Dashboard",
  trades: "Trades",
  bot: "Bot",
  config: "Configuration",
  risk: "Risk",
  users: "Users",
  roles: "Roles & Permissions",
};

function groupByCategory(perms: PermissionItem[]) {
  const groups: Record<string, PermissionItem[]> = {};
  for (const p of perms) {
    const cat = p.category ?? "other";
    if (!groups[cat]) groups[cat] = [];
    groups[cat].push(p);
  }
  return groups;
}

export default function RolesPage() {
  const { can } = usePermissions();
  const [roles, setRoles] = useState<RoleRow[]>([]);
  const [allPerms, setAllPerms] = useState<PermissionItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editRole, setEditRole] = useState<RoleRow | null>(null);
  const [form, setForm] = useState({ name: "", description: "", permissionIds: new Set<string>() });
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

  // Delete confirm
  const [deleteTarget, setDeleteTarget] = useState<RoleRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Expanded rows
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [rRes, pRes] = await Promise.all([
        fetch("/api/roles"),
        fetch("/api/permissions"),
      ]);
      if (rRes.ok) setRoles(await rRes.json());
      if (pRes.ok) setAllPerms(await pRes.json());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  function openCreate() {
    setEditRole(null);
    setForm({ name: "", description: "", permissionIds: new Set() });
    setFormError("");
    setModalOpen(true);
  }

  function openEdit(r: RoleRow) {
    setEditRole(r);
    setForm({
      name: r.name,
      description: r.description ?? "",
      permissionIds: new Set(r.permissions.map((p) => p.id)),
    });
    setFormError("");
    setModalOpen(true);
  }

  function togglePerm(id: string) {
    setForm((f) => {
      const next = new Set(f.permissionIds);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return { ...f, permissionIds: next };
    });
  }

  function toggleCategory(perms: PermissionItem[]) {
    const allSelected = perms.every((p) => form.permissionIds.has(p.id));
    setForm((f) => {
      const next = new Set(f.permissionIds);
      if (allSelected) perms.forEach((p) => next.delete(p.id));
      else perms.forEach((p) => next.add(p.id));
      return { ...f, permissionIds: next };
    });
  }

  async function handleSave() {
    setFormError("");
    if (!editRole && !form.name.trim()) { setFormError("Role name is required"); return; }
    setSaving(true);
    try {
      const url = editRole ? `/api/roles/${editRole.id}` : "/api/roles";
      const method = editRole ? "PUT" : "POST";
      const body: Record<string, unknown> = {
        description: form.description || null,
        permissionIds: Array.from(form.permissionIds),
      };
      if (!editRole) body.name = form.name.trim();

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) { setFormError(data.error ?? "Failed to save"); return; }
      setModalOpen(false);
      fetchData();
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/roles/${deleteTarget.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) { alert(data.error ?? "Failed to delete"); return; }
      setDeleteTarget(null);
      fetchData();
    } finally {
      setDeleting(false);
    }
  }

  const grouped = groupByCategory(allPerms);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
        <div>
          <h2 className="text-xl font-semibold">Roles &amp; Permissions</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Define roles and assign granular permissions
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={fetchData} disabled={loading}>
            <RefreshCw className={cn("w-4 h-4 mr-2", loading && "animate-spin")} />
            Refresh
          </Button>
          {can(PERMISSIONS.ROLES_MANAGE) && (
            <Button size="sm" onClick={openCreate}>
              <Plus className="w-4 h-4 mr-2" />
              Add Role
            </Button>
          )}
        </div>
      </div>

      {/* Role cards */}
      {loading ? (
        <div className="py-12 text-center text-muted-foreground">Loading…</div>
      ) : (
        <div className="space-y-3">
          {roles.map((role) => {
            const isExpanded = expanded.has(role.id);
            const permGroups = groupByCategory(role.permissions);
            return (
              <div
                key={role.id}
                className="rounded-xl border border-border bg-card overflow-hidden"
              >
                <div
                  className="flex items-center gap-4 px-5 py-4 cursor-pointer hover:bg-muted/20 transition-colors"
                  onClick={() => setExpanded((prev) => {
                    const next = new Set(prev);
                    if (next.has(role.id)) next.delete(role.id);
                    else next.add(role.id);
                    return next;
                  })}
                >
                  <div className="w-9 h-9 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                    <Shield className="w-4 h-4 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">{role.name}</span>
                      {role.isSystem && (
                        <Badge variant="outline" className="text-[9px] h-4 px-1.5 text-muted-foreground border-border">
                          <Lock className="w-2.5 h-2.5 mr-1" />
                          System
                        </Badge>
                      )}
                    </div>
                    {role.description && (
                      <p className="text-xs text-muted-foreground mt-0.5 truncate">{role.description}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Users className="w-3.5 h-3.5" />
                      {role._count.users}
                    </div>
                    <Badge variant="secondary" className="text-xs">
                      {role.permissions.length} perms
                    </Badge>
                    {can(PERMISSIONS.ROLES_MANAGE) && (
                      <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0"
                          onClick={() => openEdit(role)}
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                        {!role.isSystem && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                            onClick={() => setDeleteTarget(role)}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {isExpanded && (
                  <div className="border-t border-border px-5 py-4 bg-muted/10">
                    {Object.entries(permGroups).map(([cat, perms]) => (
                      <div key={cat} className="mb-3 last:mb-0">
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
                          {CATEGORY_LABELS[cat] ?? cat}
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {perms.map((p) => (
                            <span
                              key={p.id}
                              className="text-xs px-2 py-0.5 rounded bg-primary/10 text-primary border border-primary/20"
                            >
                              {p.code}
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                    {role.permissions.length === 0 && (
                      <p className="text-sm text-muted-foreground">No permissions assigned</p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Create / Edit Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editRole ? `Edit Role: ${editRole.name}` : "Add Role"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {!editRole && (
              <div className="space-y-1.5">
                <Label htmlFor="r-name">Role Name *</Label>
                <Input
                  id="r-name"
                  placeholder="e.g. ANALYST"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                />
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="r-desc">Description</Label>
              <Input
                id="r-desc"
                placeholder="Short description of this role"
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              />
            </div>

            <div className="space-y-3">
              <Label>Permissions</Label>
              <div className="rounded-lg border border-border divide-y divide-border overflow-hidden">
                {Object.entries(grouped).map(([cat, perms]) => {
                  const allSelected = perms.every((p) => form.permissionIds.has(p.id));
                  const someSelected = perms.some((p) => form.permissionIds.has(p.id));
                  return (
                    <div key={cat}>
                      <div
                        className="flex items-center gap-3 px-4 py-2.5 bg-muted/30 cursor-pointer hover:bg-muted/50 transition-colors"
                        onClick={() => toggleCategory(perms)}
                      >
                        <Checkbox
                          checked={allSelected}
                          onCheckedChange={() => toggleCategory(perms)}
                          onClick={(e) => e.stopPropagation()}
                          className={someSelected && !allSelected ? "opacity-50" : ""}
                        />
                        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                          {CATEGORY_LABELS[cat] ?? cat}
                        </span>
                        <span className="ml-auto text-xs text-muted-foreground">
                          {perms.filter((p) => form.permissionIds.has(p.id)).length}/{perms.length}
                        </span>
                      </div>
                      <div className="px-4 py-2 grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                        {perms.map((p) => (
                          <div
                            key={p.id}
                            className="flex items-center gap-2.5 cursor-pointer"
                            onClick={() => togglePerm(p.id)}
                          >
                            <Checkbox
                              checked={form.permissionIds.has(p.id)}
                              onCheckedChange={() => togglePerm(p.id)}
                              onClick={(e) => e.stopPropagation()}
                            />
                            <div className="min-w-0">
                              <p className="text-xs font-mono font-medium text-foreground leading-tight">
                                {p.code}
                              </p>
                              {p.description && (
                                <p className="text-[10px] text-muted-foreground leading-tight mt-0.5">
                                  {p.description}
                                </p>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {formError && (
              <p className="text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2">
                {formError}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Saving…" : editRole ? "Save Changes" : "Create Role"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <Dialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Role</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground py-2">
            Are you sure you want to delete the role{" "}
            <span className="font-semibold text-foreground">{deleteTarget?.name}</span>? This cannot
            be undone.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting ? "Deleting…" : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
