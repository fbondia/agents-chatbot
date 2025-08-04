import 'dotenv/config';

import { v4 as uuidv4 } from "uuid";

import { z } from "zod";

import { ChatOpenAI } from "@langchain/openai";

import { catalogTool } from "./tools/catalogTool.js";
import { weatherTool } from "./tools/weatherTool.js";
import { currencyTool } from "./tools/currencyTool.js";
//import { ChatMessageHistory } from "@langchain/core/memory";

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


const trimmer = trimMessages({
    maxTokens: 4,
    strategy: "last",
    tokenCounter: (msgs) => msgs.length,
    includeSystem: true,
    allowPartial: false,
    startOn: "human",
});

const promptTemplate = ChatPromptTemplate.fromMessages([
    ["system", "Você fala em português e é uma secretária de um consultório terapeutico respondendo ao terapeuta em tarefas administrativas."],
    ["placeholder", "{messages}"],
]);


const chatAgent = createReactAgent({
    llm,
    tools: [catalogTool, weatherTool, currencyTool],
    //chatHistory: memory,
    //chatHistoryTransformer,
});

const GraphAnnotation = Annotation.Root({
    ...MessagesAnnotation.spec,
    language: Annotation(),
});

const workflow = new StateGraph(GraphAnnotation)
    .addNode("chatAgent", chatAgent)
    .addEdge(START, "chatAgent")
    .addEdge("chatAgent", END);

const memory = new MemorySaver();

const app = workflow.compile({ checkpointer: memory });



// Simulando interações

const run = async () => {

    const config = chatId()

    const response1 = await app.invoke({ messages: [new HumanMessage("Oi, o que posso fazer aqui?")] }, config)
    console.log(response1.messages.map(x => x.content));

    const response2 = await app.invoke({ messages: [new HumanMessage("Qual a previsão para São Paulo?")] }, config)
    console.log(response2.messages.map(x => x.content));

    const response3 = await app.invoke({ messages: [new HumanMessage("Converta 200 USD para BRL")] }, config)
    console.log(response3.messages.map(x => x.content));
};

run();