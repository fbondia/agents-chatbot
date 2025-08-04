import 'dotenv/config';

import { v4 as uuidv4 } from "uuid";

import { z } from "zod";

import { ChatOpenAI } from "@langchain/openai";

import { convertToOpenAITool } from "@langchain/core/utils/function_calling";

import { createReactAgent } from "@langchain/langgraph/prebuilt";

import {
  BaseMessage,
  SystemMessage,
  HumanMessage,
  AIMessage,
  trimMessages,
} from "@langchain/core/messages";

import { DynamicStructuredTool } from "@langchain/core/tools";

import { BufferMemory } from "@langchain/core/memory";
import { tokenTrimmer } from "@langchain/core/memory/utils";

import { ChatPromptTemplate, MessagesPlaceholder } from "@langchain/core/prompts";

import {
  START,
  END,
  MessagesAnnotation,
  StateGraph,
  MemorySaver,
  Annotation
} from "@langchain/langgraph";


// Define o estado do fluxo
const ChatState = Annotation.Root({
  userInput: Annotation(),
  result: Annotation(),
  decision: Annotation(),
});

const routerAgent = async (state) => {
  const input = state.userInput;
  const isToolRequest = input.includes("previsão") || input.includes("converter") || input.includes("buscar");
  return { decision: isToolRequest ? "toolAgent" : "catalogAgent" };
};

const toolAgent = async (state) => {
  const input = state.userInput;
  const result = `🔧 Executando tool para: "${input}"`;
  return { result };
};

const catalogAgent = async (state) => {
  const result = `❓ Você pode pedir por:\n- previsão do tempo\n- converter moeda\n- buscar informações gerais\nDigite um desses para começar!`;
  return { result };
};

const workflow = new StateGraph(ChatState)
  .addNode("routerAgent", routerAgent)
  .addNode("toolAgent", toolAgent)
  .addNode("catalogAgent", catalogAgent)
  .addConditionalEdges("routerAgent", (state) => state.decision)
  .addEdge(START, "routerAgent")
  .addEdge("toolAgent", END)
  .addEdge("catalogAgent", END);

const app = workflow.compile();

// Testando um input do usuário
const input1 = "Quero saber a previsão do tempo para hoje"
console.log(input1)
const response1 = await app.invoke({ userInput: input1 });
console.log(response1.result);

console.log("======")

const input2 = "O que eu posso fazer aqui?"
console.log(input2)
const response2 = await app.invoke({ userInput: input2 });
console.log(response2.result);
