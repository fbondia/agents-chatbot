import { z } from "zod";
import { DynamicStructuredTool } from "@langchain/core/tools";

export const currencyTool = new DynamicStructuredTool({
  name: "currency_converter",
  description: "Converte valores entre moedas. Entrada esperada: exemplo '100 USD para BRL'.",
  schema: z.object({
    data: z
      .object({
        valor: z.number(),
        moeda_origem: z.string(),
        moeda_destino: z.string(),
      })
      .array(),
  }),
  func: async ({ data }) => {
    const [params] = data
    console.log(params)
    return `Conversão simulada de: ${params.valor}. Resultado: R$ 520,00.`; // Simulado
  },
});
