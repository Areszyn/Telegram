import { Hono } from "hono";
import type { Env } from "../types.ts";
import { requireAdmin } from "../lib/auth.ts";

const notices = new Hono<{ Bindings: Env }>();

notices.get("/app-notice", async (c) => {
  const row = await c.env.DB.prepare(
    "SELECT id, title, message, type FROM app_notices WHERE active = 1 ORDER BY id DESC LIMIT 1"
  ).first<{ id: number; title: string; message: string; type: string }>();
  if (!row) return c.json({ notice: null });
  return c.json({ notice: row });
});

notices.get("/admin/notices", requireAdmin(), async (c) => {
  const { results } = await c.env.DB.prepare(
    "SELECT id, title, message, type, active, created_at FROM app_notices ORDER BY id DESC LIMIT 50"
  ).all();
  return c.json({ notices: results ?? [] });
});

notices.post("/admin/notices", requireAdmin(), async (c) => {
  const { title, message, type } = await c.req.json<{ title: string; message: string; type?: string }>();
  if (!title?.trim() || !message?.trim()) return c.json({ error: "Title and message are required" }, 400);
  await c.env.DB.prepare("UPDATE app_notices SET active = 0 WHERE active = 1").run();
  const res = await c.env.DB.prepare(
    "INSERT INTO app_notices (title, message, type, active) VALUES (?, ?, ?, 1)"
  ).bind(title.trim(), message.trim(), type?.trim() || "warning").run();
  return c.json({ ok: true, id: res.meta.last_row_id });
});

notices.put("/admin/notices/:id", requireAdmin(), async (c) => {
  const id = c.req.param("id");
  const { title, message, type, active } = await c.req.json<{ title?: string; message?: string; type?: string; active?: boolean }>();
  const sets: string[] = [];
  const vals: unknown[] = [];
  if (title !== undefined) { sets.push("title = ?"); vals.push(title.trim()); }
  if (message !== undefined) { sets.push("message = ?"); vals.push(message.trim()); }
  if (type !== undefined) { sets.push("type = ?"); vals.push(type.trim()); }
  if (active !== undefined) {
    if (active) {
      await c.env.DB.prepare("UPDATE app_notices SET active = 0 WHERE active = 1 AND id != ?").bind(id).run();
    }
    sets.push("active = ?");
    vals.push(active ? 1 : 0);
  }
  if (sets.length === 0) return c.json({ error: "Nothing to update" }, 400);
  vals.push(id);
  await c.env.DB.prepare(`UPDATE app_notices SET ${sets.join(", ")} WHERE id = ?`).bind(...vals).run();
  return c.json({ ok: true });
});

notices.delete("/admin/notices/:id", requireAdmin(), async (c) => {
  const id = c.req.param("id");
  await c.env.DB.prepare("DELETE FROM app_notices WHERE id = ?").bind(id).run();
  return c.json({ ok: true });
});

export default notices;
