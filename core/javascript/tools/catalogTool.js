import { z } from "zod";
import { DynamicStructuredTool } from "@langchain/core/tools";

export const catalogTool = new DynamicStructuredTool({
  name: "show_catalog",
  description: "Mostra ao usuário o que ele pode pedir (ex: previsão do tempo, conversão de moeda, busca).",
  schema: z.object({
    data: z
      .object({
        categoria: z.string(),
      })
      .array(),
  }),
  func: async ({ data }) => {
    const [params] = data
    console.log(params)
    return `Você pode pedir por:\n- previsão do tempo\n- conversão de moeda\n- buscar informações gerais.`;
  },
});
