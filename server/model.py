from langchain_groq.chat_models import ChatGroq
from typing import TypedDict,Annotated
from langgraph.graph import END,StateGraph,add_messages
from langgraph.checkpoint.memory import MemorySaver
from langchain_community.tools import TavilySearchResults
from langchain_core.messages import ToolMessage
from dotenv import load_dotenv
from uuid import uuid4

load_dotenv()

llm = ChatGroq(model="llama-3.3-70b-versatile")

config = {
    "configurable":{
        "thread_id":1
    }
}

memory = MemorySaver()

MODEL = "model_node"
TOOL_NODE = 'tool_node'

class State(TypedDict):
    messages : Annotated[list,add_messages]

search_tool = TavilySearchResults(search_depth="basic")

tools = [search_tool]

llm_with_tools = llm.bind_tools(tools=tools)

async def model_node(state:State):
    messages = state["messages"]
    response = await llm_with_tools.ainvoke(messages)
    return {
        "messages": response
    }

async def tool_node(state:State):
    tool_calls = state["messages"][-1].tool_calls
    tool_messages = []

    for tool_call in tool_calls:
        tool_id = tool_call["id"]
        tool_args = tool_call["args"]
        tool_name = tool_call["name"]

        if tool_name == "tavily_search_results_json":
            search_results = await search_tool.ainvoke(tool_args)
            tool_message = ToolMessage(
                content = str(search_results),
                tool_call_id = tool_id,
                name = tool_name
            )
            tool_messages.append(tool_message)
    return {
        "messages":tool_messages
    }

def tool_route(state:State):
    last_message = state['messages'][-1]

    if (hasattr(last_message,"tool_calls") and len(last_message.tool_calls)>0):
        return TOOL_NODE
    return END

graph = StateGraph(State)

graph.add_node(MODEL,model_node)
graph.add_node(TOOL_NODE,tool_node)

graph.set_entry_point(MODEL)
graph.add_conditional_edges(MODEL,tool_route,path_map={
    "tool_node":TOOL_NODE,
    "__end__":END
})
graph.add_edge(TOOL_NODE,MODEL)

graph_model = graph.compile(checkpointer=memory)

initial_msg = {"messages":"What is the weather in ap?"}


