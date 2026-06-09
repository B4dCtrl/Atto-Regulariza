import { useState } from "react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

interface PropertyFormData {
  name: string;
  address: string;
  city: string;
  state: string;
}

interface PropertyFormProps {
  onSuccess?: (propertyId: string) => void;
  onSkip?: () => void;
}

export function PropertyForm({ onSuccess, onSkip }: PropertyFormProps) {
  const [formData, setFormData] = useState<PropertyFormData>({
    name: "",
    address: "",
    city: "",
    state: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!formData.name || !formData.address || !formData.city || !formData.state) {
      setError("Preencha todos os campos");
      return;
    }

    setLoading(true);

    try {
      const { data, error: insertError } = await supabase
        .from("properties")
        .insert([
          {
            name: formData.name,
            address: formData.address,
            city: formData.city,
            state: formData.state,
            status: "entrada",
            progress: 10,
            current_stage: 1,
          },
        ])
        .select()
        .single();

      if (insertError) throw insertError;

      // Criar estágios iniciais
      const stages = [
        { stage_number: 1, label: "Cadastro", state: "active" },
        { stage_number: 2, label: "Análise", state: "pending" },
        { stage_number: 3, label: "Profissional", state: "pending" },
        { stage_number: 4, label: "Tramitação", state: "pending" },
        { stage_number: 5, label: "Entrega", state: "pending" },
      ];

      await supabase.from("process_stages").insert(
        stages.map((s) => ({
          property_id: data.id,
          ...s,
        }))
      );

      onSuccess?.(data.id);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Erro ao criar propriedade"
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto">
      <div className="rounded-3xl bg-background ring-1 ring-border p-8">
        <h2 className="font-serif text-2xl tracking-tight mb-2">
          Dados do Imóvel
        </h2>
        <p className="text-sm text-ink-soft mb-6">
          Preencha os dados básicos do imóvel para começar a regularização.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-sm font-medium">
              Nome/Identificação do Imóvel *
            </label>
            <input
              type="text"
              name="name"
              placeholder="Ex: Apto 142 - Vila Madalena"
              value={formData.name}
              onChange={handleChange}
              className="mt-2 w-full rounded-lg border border-border bg-surface px-4 py-2 text-sm outline-none focus:border-foreground"
              disabled={loading}
            />
          </div>

          <div>
            <label className="text-sm font-medium">Endereço *</label>
            <input
              type="text"
              name="address"
              placeholder="Ex: Rua Harmonia, 142"
              value={formData.address}
              onChange={handleChange}
              className="mt-2 w-full rounded-lg border border-border bg-surface px-4 py-2 text-sm outline-none focus:border-foreground"
              disabled={loading}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium">Cidade *</label>
              <input
                type="text"
                name="city"
                placeholder="Ex: São Paulo"
                value={formData.city}
                onChange={handleChange}
                className="mt-2 w-full rounded-lg border border-border bg-surface px-4 py-2 text-sm outline-none focus:border-foreground"
                disabled={loading}
              />
            </div>

            <div>
              <label className="text-sm font-medium">Estado *</label>
              <select
                name="state"
                value={formData.state}
                onChange={handleChange}
                className="mt-2 w-full rounded-lg border border-border bg-surface px-4 py-2 text-sm outline-none focus:border-foreground"
                disabled={loading}
              >
                <option value="">Selecione</option>
                <option value="SP">São Paulo</option>
                <option value="RJ">Rio de Janeiro</option>
                <option value="MG">Minas Gerais</option>
                <option value="BA">Bahia</option>
                <option value="SC">Santa Catarina</option>
                <option value="RS">Rio Grande do Sul</option>
                <option value="PR">Paraná</option>
                <option value="DF">Distrito Federal</option>
                <option value="MS">Mato Grosso do Sul</option>
                <option value="GO">Goiás</option>
              </select>
            </div>
          </div>

          {error && <div className="text-sm text-red-500">{error}</div>}

          <div className="flex gap-3 pt-4">
            <Button
              type="submit"
              disabled={loading}
              className="flex-1"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Criando...
                </>
              ) : (
                "Começar"
              )}
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={onSkip}
              disabled={loading}
              className="flex-1"
            >
              Depois
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
