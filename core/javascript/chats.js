import 'dotenv/config';

import { v4 as uuidv4 } from "uuid";

import { ChatOpenAI } from "@langchain/openai";

import {
  SystemMessage,
  HumanMessage,
  AIMessage,
  trimMessages,
} from "@langchain/core/messages";

import { ChatPromptTemplate } from "@langchain/core/prompts";

import {
  START,
  END,
  MessagesAnnotation,
  StateGraph,
  MemorySaver,
  Annotation
} from "@langchain/langgraph";

const chatId = () => ({ 
    configurable: { 
        thread_id: uuidv4() 
    } 
});

const model = new ChatOpenAI({ 
    model: "gpt-4.1-nano",
    temperature: 0 
});

const trimmer = trimMessages({
  maxTokens: 4,
  strategy: "last",
  tokenCounter: (msgs) => msgs.length,
  includeSystem: true,
  allowPartial: false,
  startOn: "human",
});

const simpleCall = async () => {

    const messages = [
        new SystemMessage("Translate the following from english into brazilian portuguese"),
        new HumanMessage("hi!"),
    ];

    const response = await model.invoke(messages);
    console.log(`${response.content}`);

}

const simpleCallWithPromptTemplate = async () => {
    const systemTemplate = "Translate the following from English into {language}";

    const promptTemplate = ChatPromptTemplate.fromMessages([
        ["system", systemTemplate],
        ["user", "{text}"],
    ]);

    const promptValue = await promptTemplate.invoke({
        language: "portuguese",
        text: "hi!",
    });

    const response = await model.invoke(promptValue);
    console.log(`${response.content}`);
}

const niceToMeetYouWithGraph = async() => {

    const callModel = async (state) => {
        const response = await model.invoke(state.messages);
        return { messages: response };
    };

    const workflow = new StateGraph(MessagesAnnotation)
    .addNode("model", callModel)
    .addEdge(START, "model")
    .addEdge("model", END);

    const memory = new MemorySaver();

    const app = workflow.compile({ checkpointer: memory });

    const niceToMeetYou = async (name) => {
        const config = chatId()
        const first = await app.invoke( {messages: [new HumanMessage(`Olá, eu sou ${name}!`)]}, config);
        const second = await app.invoke( {messages: [new HumanMessage("Você lembra meu nome?")]}, config);
        console.log(second.messages.map(x=>x.content));
    }


    await niceToMeetYou("Bob")
    await niceToMeetYou("Lucy")

}

const niceToMeetYouWithGraphAndTemplates = async() => {

    const promptTemplate = ChatPromptTemplate.fromMessages([
        ["system", "You talk like a pirate. Answer all questions to the best of your ability, but do it in {language}" ],
        ["placeholder", "{messages}"],
    ]);

    const callModel = async (state) => {
        const prompt = await promptTemplate.invoke(state);
        const response = await model.invoke(prompt);
        return { messages: response };
    };

    const GraphAnnotation = Annotation.Root({
        ...MessagesAnnotation.spec,
        language: Annotation(),
    });

    const workflow = new StateGraph(GraphAnnotation)
    .addNode("model", callModel)
    .addEdge(START, "model")
    .addEdge("model", END);

    const memory = new MemorySaver();

    const app = workflow.compile({ checkpointer: memory });

    const niceToMeetYou = async (name) => {
        const config = chatId()
        const first = await app.invoke( {messages: [new HumanMessage(`Olá, eu sou ${name}!`)], language: "Português"}, config);
        const second = await app.invoke( {messages: [new HumanMessage("Você lembra meu nome?")], language: "Português"}, config);
        console.log(second.messages.map(x=>x.content));
    }


    await niceToMeetYou("Jim")

}

const withTrimmer = async() => {

    const promptTemplate = ChatPromptTemplate.fromMessages([
        ["system", "Você fala em português e é um bom ouvinte, sempre curioso a respeito de seu interlocutor." ],
        ["placeholder", "{messages}"],
    ]);

    const callModel = async (state) => {

        const trimmedMessage = await trimmer.invoke(state.messages);
        const prompt = await promptTemplate.invoke({
            messages: trimmedMessage,
            language: state.language,
        });
        const response = await model.invoke(prompt);
        return { messages: response };
    };

    const GraphAnnotation = Annotation.Root({
        ...MessagesAnnotation.spec,
        language: Annotation(),
    });

    const workflow = new StateGraph(GraphAnnotation)
    .addNode("model", callModel)
    .addEdge(START, "model")
    .addEdge("model", END);

    const memory = new MemorySaver();

    const app = workflow.compile({ checkpointer: memory });

    const messages = [
        new HumanMessage("Olá, eu sou Bob"),
        new AIMessage("Olá Bob, como está?"),
        new HumanMessage("Estou com fome."),
        new AIMessage("O que gosta de comer?"),
        new HumanMessage("Pizza"),
        new AIMessage("De que tipo?"),
        new HumanMessage("Todas"),
        new AIMessage("Além de pizza, do que você gosta?"),
        new HumanMessage("De dançar"),
        new AIMessage("Que tipo de música?"),
        new HumanMessage("Deixa pra lá. Qual é o meu nome?"),
    ];

    const config = chatId()
    const response = await app.invoke( {messages}, config);
    console.log(response.messages.map(x=>x.content));

}

withTrimmer()