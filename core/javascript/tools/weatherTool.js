import { z } from "zod";
import { DynamicStructuredTool } from "@langchain/core/tools";

export const weatherTool = new DynamicStructuredTool({
  name: "weather_forecast",
  description: "Fornece a previsão do tempo para uma cidade. Entrada esperada: nome da cidade.",
  schema: z.object({
    data: z
      .object({
        cidade: z.string(),
      })
      .array(),
  }),
  func: async ({ data }) => {
    const [params] = data
    console.log(params)
    return `A previsão para ${params.cidade} é: Sol com nuvens e 25°C.`;
  },
});
