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



from langchain.chains import ConversationChain
from langchain.prompts import PromptTemplate
from langchain.memory import ConversationBufferMemory




_ = load_dotenv(find_dotenv()) 
openai.api_key  = os.environ['OPENAI_API_KEY']

def pretty_print(messages: list[BaseMessage]):
    print("\n===== CONVERSA =====\n")
    for msg in messages:
        if msg.__class__.__name__ == "SystemMessage":
            print("[System]")
        elif msg.__class__.__name__ == "HumanMessage":
            print("[Usuário]")
        elif msg.__class__.__name__ == "AIMessage":
            print("[Assistente]")
        elif msg.__class__.__name__ == "ToolMessage":
            print(f"[Tool: {msg.name}]")
        else:
            print("[Outro Tipo]")

        print(msg.content)
        print("-" * 40)
    print("=====================\n")

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

ollama = ChatOllama(model="mistral")
llm = ChatOpenAI(model="gpt-3.5-turbo")
abot = Agent(llm, tool_functions, system=prompt)

#messages = [HumanMessage(content="Qual é a temperatura em Barueri?")]
#result = abot.graph.invoke({"messages": messages})

#print(result)



# ======== Catálogo de Funções =========
tools = {
    "agendar_sessao": {
        "description": "Realiza um agendamento de sessão ou consulta",
        "parameters": {
            "nome": {
                "type": "string"
            },
            "data": {
                "type": "date"
            }
        }
      },
    "cancelar_sessao": {
        "description": "Cancela um agendamento de sessão ou consulta",
        "parameters": {
            "nome": {
                "type": "string"
            },
            "data": {
                "type": "date"
            },
        }
    },
    "registrar_pagamento": {
        "description": "Registra o pagamento de uma consulta ou sessão",
        "parameters": {
            "nome": {
                "type": "string"
            },
            "data": {
                "type": "date",
            },
            "valor": {
                "type": "currency"
            }
        }
    },
}

# ======== Prompt de Roteamento =========
prompt_fn = """
Você é um roteador de chamadas de função. Escolha qual função atende à solicitação do usuário.

Funções disponíveis:
{catalog}

Mensagem do usuário:
{input}

Retorne apenas o nome exato da função sem nenhuma outra informação. 
Se não houver nenhuma função que atende à solicitação responda apenas "UNKNOWN".

Sua resposta:
"""

prompt_p = """
Você é um roteador de chamadas de função. Preencha os parâmetros da função {function} a partir da solicitação do usuário.

Parâmetros disponíveis:
{parameters}

Mensagem do usuário:
{input}

Retorne um JSON com duas chaves:
- "function": nome da função
- "parameters": dicionário com os parâmetros para a função (ou vazio se não for necessário)

Omita parâmetros com valores incompletos ou inválidos.
Não inclua qualquer tipo de comentário na resposta.
Retorne apenas os parâmetros com os valores válidos preenchidos sem nenhuma outra informação.

Exemplo:
{{
  "function": "agendar_sessao",
  "parameters": {{
     "nome": "João",
     "data": "2025-01-01"
  }}
}}

Sua resposta:
"""

# ======== LLM + Cadeia de Roteamento =========
llm = ChatOllama(model="mistral")

# ======== Teste com mensagens =========
entradas = [
    "Gostaria de agendar uma sessão para o Fabiano no dia 10/04/2025",
    "Olá, meu nome é Fabiano, me cumprimente!",
    "Qual a média de 10, 20 e 30?",
    "Quero cancelar a sessão da Roberta no dia 13.",
    "Registre o pagamento do Paulo no valor de R$ 200",
    "Geraldo pagou o que devia"
]

for entrada in entradas:
    print("🟢 Entrada:", entrada)
    output = llm.invoke(prompt_fn.format(input=entrada, catalog='\n'.join(f"- {chave}" for chave in tools.keys())))
    choice = output.content.strip()
    print(choice)
    if tools.get(choice):
      output = llm.invoke(prompt_p.format(input=entrada, function=choice, parameters=json.dumps(tools[choice]["parameters"], indent=2)))
      print(output.content)
    
    print("----")