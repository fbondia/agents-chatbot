import 'dotenv/config';

import { v4 as uuidv4 } from "uuid";

import { ChatOpenAI } from "@langchain/openai";

import { createReactAgent } from "@langchain/langgraph/prebuilt";

import {
    BaseMessage,
    SystemMessage,
    HumanMessage,
    AIMessage,
    trimMessages,
} from "@langchain/core/messages";

import { ChatPromptTemplate, MessagesPlaceholder } from "@langchain/core/prompts";

import { catalogTool } from "./tools/catalogTool.js";
import { weatherTool } from "./tools/weatherTool.js";
import { currencyTool } from "./tools/currencyTool.js";



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
    prompt: promptTemplate,
    chatHistoryTransformer: trimmer
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