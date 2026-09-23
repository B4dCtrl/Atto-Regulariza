import { describe, it, expect, vi, beforeEach } from "vitest";

const roles = vi.fn();
vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: {
    from: () => ({ select: () => ({ eq: () => roles() }) }),
  },
}));

import { exigirAdmin } from "./exigir-admin.server";

describe("exigirAdmin", () => {
  beforeEach(() => roles.mockReset());

  it("deixa passar admin", async () => {
    roles.mockResolvedValue({ data: [{ role: "admin" }], error: null });
    await expect(exigirAdmin("u1")).resolves.toBeUndefined();
  });

  it("barra cliente", async () => {
    roles.mockResolvedValue({ data: [{ role: "cliente" }], error: null });
    await expect(exigirAdmin("u1")).rejects.toThrow("Acesso negado.");
  });

  it("barra quando o banco falha", async () => {
    roles.mockResolvedValue({ data: null, error: { message: "x" } });
    await expect(exigirAdmin("u1")).rejects.toThrow("Acesso negado.");
  });
});
