from __future__ import annotations

from langgraph.graph import END, START, StateGraph
from opensearchpy import OpenSearch

from app.graph.nodes import inputNode, makeSearchNode
from app.graph.nodes_llm import routerNode, nvidiaLlmNode, hfLlmNode
from app.graph.output_formatter import llmOutputNode
from app.graph.state import GraphState


def buildGraph(client: OpenSearch, index: str):
    searchNode = makeSearchNode(client=client, index=index)

    graph = StateGraph(GraphState)

    graph.add_node("inputNode", inputNode)
    graph.add_node("searchNode", searchNode)
    graph.add_node("routerNode", routerNode)
    graph.add_node("nvidiaLlmNode", nvidiaLlmNode)
    graph.add_node("hfLlmNode", hfLlmNode)
    graph.add_node("llmOutputNode", llmOutputNode)

    graph.add_edge(START, "inputNode")
    graph.add_edge("inputNode", "searchNode")
    graph.add_edge("searchNode", "routerNode")

    graph.add_conditional_edges(
        "routerNode",
        lambda state: state.get("route_decision", "nvidia"),
        {
            "nvidia": "nvidiaLlmNode",
            "huggingface": "hfLlmNode",
        },
    )

    graph.add_edge("nvidiaLlmNode", "llmOutputNode")
    graph.add_edge("hfLlmNode", "llmOutputNode")
    graph.add_edge("llmOutputNode", END)

    return graph.compile()
