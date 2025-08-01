import json
import openai
import os

from dotenv import load_dotenv, find_dotenv

from langchain_ollama import ChatOllama
from langchain_openai import ChatOpenAI

from langchain_core.tools import tool

from langgraph.graph import StateGraph, END
from typing import TypedDict, Annotated
import operator
from langchain_core.messages import AnyMessage, SystemMessage, HumanMessage, ToolMessage

from langchain_core.messages import BaseMessage

def pretty_print(messages: list[BaseMessage]):
    print("\n===== CONVERSA =====\n")
    for msg in messages:
        if msg.__class__.__name__ == "SystemMessage":
            print("🟦 [System]")
        elif msg.__class__.__name__ == "HumanMessage":
            print("🧑 [Usuário]")
        elif msg.__class__.__name__ == "AIMessage":
            print("🤖 [Assistente]")
        elif msg.__class__.__name__ == "ToolMessage":
            print(f"🛠️ [Tool: {msg.name}]")
        else:
            print("❓ [Outro Tipo]")

        print(msg.content)
        print("-" * 40)
    print("=====================\n")


_ = load_dotenv(find_dotenv()) 
openai.api_key  = os.environ['OPENAI_API_KEY']

# === Implementações reais das funções ===
@tool("get_weather", description="Retorna a previsão do tempo para uma cidade específica.")
def get_weather(city):
    print("================= WEATHER!!")
    return {'temp': '28°C', 'clima': 'Ensolarado', 'umidade': '60%'}

@tool("calculate_sum", description="Soma dois números e retorna o resultado.")
def calculate_sum(a, b):
    return int(a) + int(b)


# ferramentas decoradas com @tool (usadas na execução real)
tool_functions = [get_weather, calculate_sum]

# ferramentas em formato JSON (usadas no bind_tools com LLM)
tool_specs = [
    {
      'type': 'function',
      'function': {
        'name': 'get_weather',
        'description': "Retorna a previsão do tempo para uma cidade.",
        'parameters': {
          'type': 'object',
          'properties': {
            'city': {
              'type': 'string',
              'description': 'The name of the city',
            },
          },
          'required': ['city'],
        },
      },
    },
    {
      'type': 'function',
      'function': {
        'name': 'calculate_sum',
        'description': "Soma dois números inteiros.",
        'parameters': {
          'type': 'object',
          'properties': {
            'a': {
              'type': 'float',
              'description': 'Primeiro número',
            },
            'b': {
              'type': 'float',
              'description': 'Segundo número',
            },
          },
          'required': ['a', 'b'],
        },
      },
    }
]


class AgentState(TypedDict):
    messages: Annotated[list[AnyMessage], operator.add]

class Agent:

    def __init__(self, model, tools, system=""):
        self.system = system
        graph = StateGraph(AgentState)
        graph.add_node("llm", self.call_llm)
        graph.add_node("action", self.take_action)
        graph.add_conditional_edges(
            "llm",
            self.exists_action,
            {True: "action", False: END}
        )
        graph.add_edge("action", "llm")
        graph.set_entry_point("llm")
        self.graph = graph.compile()
        self.tools = {t.name: t for t in tools}
        self.model = model.bind_tools(tools)

    def exists_action(self, state: AgentState):
        result = state['messages'][-1]
        return len(result.tool_calls) > 0

    def call_llm(self, state: AgentState):

        print("======= CALLING LLM ")

        messages = state['messages']
        if self.system:
            messages = [SystemMessage(content=self.system)] + messages
        message = self.model.invoke(messages)
        pretty_print(messages)
        return {'messages': [message]}

    def take_action(self, state: AgentState):
        tool_calls = state['messages'][-1].tool_calls
        results = []
        for t in tool_calls:
            print(f"Calling: {t}")
            if not t['name'] in self.tools:      # check for bad tool name from LLM
                print("\n ....bad tool name....")
                result = "bad tool name, retry"  # instruct LLM to retry if bad
            else:
                result = self.tools[t['name']].invoke(t['args'])
            results.append(ToolMessage(tool_call_id=t['id'], name=t['name'], content=str(result)))
        print("Back to the model!")
        return {'messages': results}

prompt="""Você é um assistente de pesquisa inteligente. Use o mecanismo de busca para procurar informações.
Você pode fazer várias buscas (tanto de uma vez quanto em sequência).
Só procure informações quando tiver certeza do que está buscando.
Se precisar buscar algo antes de fazer uma pergunta de acompanhamento, está autorizado a fazer isso!"""

#llm = ChatOllama(model="mistral")
llm = ChatOpenAI(model="gpt-3.5-turbo")  #reduce inference cost
abot = Agent(llm, tool_functions, system=prompt)

messages = [HumanMessage(content="Qual é a temperatura em Barueri?")]
result = abot.graph.invoke({"messages": messages})

#print(result)
