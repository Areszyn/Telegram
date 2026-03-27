import { Hono } from "hono";
import type { Env } from "../types.ts";

const privacy = new Hono<{ Bindings: Env }>();

privacy.get("/privacy", (c) => {
  return c.redirect("https://areszyn.org/privacy.html", 301);
});

export default privacy;
