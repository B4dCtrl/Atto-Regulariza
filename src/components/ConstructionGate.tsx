import { useEffect, useState, type ReactNode } from "react";
import { Construction } from "@/components/landing/Construction";
import { CONSTRUCTION_MODE, DEV_ACCESS_KEY, DEV_STORAGE_KEY as STORAGE_KEY } from "@/lib/site-config";

/**
 * Porteiro de pré-lançamento.
 *
 * - CONSTRUCTION_MODE off → site normal para todos.
 * - CONSTRUCTION_MODE on  → público vê <Construction />; devs com a chave
 *   (?dev=DEV_ACCESS_KEY) veem o site integral. A liberação fica salva no
 *   localStorage. Sair do modo dev: ?dev=off
 *
 * SSR renderiza <Construction /> por padrão (sem flash para o público e bom
 * para crawlers); o efeito client-side libera para os devs.
 */
export function ConstructionGate({ children }: { children: ReactNode }) {
  const [unlocked, setUnlocked] = useState(false);

  useEffect(() => {
    if (!CONSTRUCTION_MODE) {
      setUnlocked(true);
      return;
    }
    try {
      const params = new URLSearchParams(window.location.search);
      const key = params.get("dev");

      if (key === DEV_ACCESS_KEY) {
        localStorage.setItem(STORAGE_KEY, "1");
        // remove o ?dev da URL por estética/segurança
        params.delete("dev");
        const qs = params.toString();
        window.history.replaceState(
          {},
          "",
          window.location.pathname + (qs ? `?${qs}` : "")
        );
      } else if (key === "off") {
        localStorage.removeItem(STORAGE_KEY);
      }

      setUnlocked(localStorage.getItem(STORAGE_KEY) === "1");
    } catch {
      setUnlocked(false);
    }
  }, []);

  if (CONSTRUCTION_MODE && !unlocked) return <Construction />;
  return <>{children}</>;
}
