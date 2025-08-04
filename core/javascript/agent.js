import 'dotenv/config';

import { v4 as uuidv4 } from "uuid";

import { z } from "zod";

import { ChatOpenAI } from "@langchain/openai";

import { createReactAgent } from "@langchain/langgraph/prebuilt";

import {
  BaseMessage,
  SystemMessage,
  HumanMessage,
  AIMessage,
  trimMessages,
} from "@langchain/core/messages";

import { DynamicStructuredTool } from "@langchain/core/tools";

import { ChatPromptTemplate, MessagesPlaceholder } from "@langchain/core/prompts";


import {
  START,
  END,
  MessagesAnnotation,
  StateGraph,
  MemorySaver,
  Annotation
} from "@langchain/langgraph";

const llm = new ChatOpenAI({ 
    model: "gpt-4.1-nano",
    temperature: 0 
});


const chatId = () => ({ 
    configurable: { 
        thread_id: uuidv4() 
    } 
});

const niceTool = new DynamicStructuredTool({
  name: "consultar_temperatura",
  description: "Consulta a temperatura",
  schema: z.object({
    data: z
      .object({
        cidade: z.string()
      })
      .array(),
  }),
  func: async ({ data }) => {
    return "8 graus";
  },
});


const agentModel = new ChatOpenAI({ temperature: 0 });
const agentTools = [niceTool]

const agentCheckpointer = new MemorySaver();
const agent = createReactAgent({
  llm: agentModel,
  tools: agentTools,
  checkpointSaver: agentCheckpointer,
});



const config = chatId()

const agentFinalState = await agent.invoke(
  { messages: [new HumanMessage("qual temperatura em barueri?")] },
  config,
);

console.log(agentFinalState.messages[agentFinalState.messages.length - 1].content);

const agentNextState = await agent.invoke(
  { messages: [new HumanMessage("e em São Roque?")] },
  config,
);

console.log(agentNextState.messages.map(x=>x.content));