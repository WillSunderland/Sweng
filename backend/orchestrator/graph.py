from typing import TypedDict, Annotated, Sequence
from langgraph.graph import StateGraph, END

class AgentState(TypedDict):
    messages: Sequence[str]
    query: str
    documents: List[str]

# Define Nodes
def query_rewriter(state: AgentState):
    # TODO: Use Nvidia gpt-120b to rewrite query
    return {"query": f"Rewritten: {state['query']}"}

def retrieve_docs(state: AgentState):
    # TODO: Call MCP Tool here
    return {"documents": ["Doc 1", "Doc 2"]}

def generate_answer(state: AgentState):
    # TODO: Generate RAG response with citations
    return {"messages": ["Final answer based on context"]}

# Build Graph
workflow = StateGraph(AgentState)
workflow.add_node("rewrite", query_rewriter)
workflow.add_node("retrieve", retrieve_docs)
workflow.add_node("generate", generate_answer)

workflow.set_entry_point("rewrite")
workflow.add_edge("rewrite", "retrieve")
workflow.add_edge("retrieve", "generate")
workflow.add_edge("generate", END)

app = workflow.compile()
