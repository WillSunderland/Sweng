import pytest
from unittest.mock import AsyncMock, MagicMock, patch

from app.graph.builder import buildGraph
from app.graph.nodes_llm import prefetchDecisionNode, queryRewriteNode, readNode


class FakeOpenSearch:
    def __init__(self, responses):
        self._responses = list(responses)

    def search(self, index, body):
        if not self._responses:
            raise AssertionError("Unexpected extra search call")
        return self._responses.pop(0)


@pytest.mark.asyncio
async def test_query_rewrite_uses_chat_history():
    state = {
        "query": "What about the notice period?",
        "chat_history": [
            {"role": "user", "content": "Explain Texas SB 2."},
            {"role": "assistant", "content": "Texas SB 2 adds a 90-day notice period."},
        ],
        "reasoning_steps": [],
    }

    with patch(
        "app.graph.nodes_llm._generate_control_json", new_callable=AsyncMock
    ) as mock_control:
        mock_control.return_value = {
            "rewritten_query": "What notice period does Texas SB 2 require?",
            "reason": "Expanded the follow-up using prior chat context.",
        }

        result = await queryRewriteNode(state)

    assert result["rewrittenQuery"] == "What notice period does Texas SB 2 require?"
    assert "Expanded the follow-up" in result["reasoning_steps"][-1]["detail"]


@pytest.mark.asyncio
async def test_prefetch_decision_can_skip_retrieval():
    state = {
        "query": "summarize that",
        "standaloneQuery": "summarize that",
        "chat_history": [
            {
                "role": "assistant",
                "content": "The bill adds a 90-day notice requirement.",
            },
        ],
        "reasoning_steps": [],
    }

    with patch(
        "app.graph.nodes_llm._generate_control_json", new_callable=AsyncMock
    ) as mock_control:
        mock_control.return_value = {
            "needs_retrieval": False,
            "reason": "The user explicitly asked about the prior answer only.",
        }

        result = await prefetchDecisionNode(state)

    assert result["shouldFetch"] is False
    assert result["prefetchDecision"] == "context_only"


@pytest.mark.asyncio
async def test_read_node_requests_follow_up_search():
    state = {
        "query": "compare the rent caps",
        "standaloneQuery": "compare the rent caps",
        "searchResults": [
            {
                "_source": {
                    "title": "Bill A",
                    "chunk_text": "Bill A caps rent at 5 percent.",
                }
            }
        ],
        "search_iteration": 1,
        "max_reasoning_steps": 2,
        "readNotes": [],
        "reasoning_steps": [],
    }

    with patch(
        "app.graph.nodes_llm._generate_control_json", new_callable=AsyncMock
    ) as mock_control:
        mock_control.return_value = {
            "enough_context": False,
            "summary": "Only one bill was found, so a broader comparison search is needed.",
            "follow_up_query": "compare rent caps across related bills",
        }

        result = await readNode(state)

    assert result["followUpQuery"] == "compare rent caps across related bills"
    assert "Another search will run." in result["reasoning_steps"][-1]["detail"]


@pytest.mark.asyncio
async def test_graph_executes_multi_step_loop_with_context_continuity():
    fake_search = FakeOpenSearch(
        [
            {
                "hits": {
                    "hits": [
                        {
                            "_id": "1",
                            "_score": 0.9,
                            "_source": {
                                "bill_id": "TX-SB-2",
                                "state": "Texas",
                                "session": "2025",
                                "title": "Texas SB 2",
                                "policy_area": "Housing",
                                "bill_type": "SB",
                                "bill_number": "2",
                                "chunk_id": "c1",
                                "chunk_text": "Texas SB 2 sets a 90-day notice period.",
                            },
                        }
                    ]
                }
            },
            {
                "hits": {
                    "hits": [
                        {
                            "_id": "2",
                            "_score": 0.85,
                            "_source": {
                                "bill_id": "TX-HB-8",
                                "state": "Texas",
                                "session": "2025",
                                "title": "Texas HB 8",
                                "policy_area": "Housing",
                                "bill_type": "HB",
                                "bill_number": "8",
                                "chunk_id": "c2",
                                "chunk_text": "Texas HB 8 keeps a 60-day notice period.",
                            },
                        }
                    ]
                }
            },
        ]
    )
    graph = buildGraph(fake_search, "legislation_chunks")
    state = {
        "query": "How does that compare to other bills?",
        "chat_history": [
            {"role": "user", "content": "What does Texas SB 2 do?"},
            {"role": "assistant", "content": "It creates a 90-day notice period."},
        ],
        "processedQuery": "",
        "searchResults": [],
        "accumulatedSources": [],
        "searchQueries": [],
        "readNotes": [],
        "plan": [],
        "reasoning_steps": [],
        "response": {},
        "error": None,
        "max_reasoning_steps": 2,
    }
    mock_answer = MagicMock(
        content="Texas SB 2 uses 90 days, while Texas HB 8 uses 60 days. [Source: Texas SB 2] [Source: Texas HB 8]",
        model="nv-model",
        provider="nvidia",
        total_tokens=44,
    )

    with patch(
        "app.graph.nodes_llm._generate_control_json", new_callable=AsyncMock
    ) as mock_control, patch(
        "app.graph.nodes_llm.nvidia_client.generate", new_callable=AsyncMock
    ) as mock_generate:
        mock_control.side_effect = [
            {
                "rewritten_query": "Compare the Texas SB 2 notice period with similar Texas bills.",
                "reason": "Expanded the follow-up using the prior SB 2 discussion.",
            },
            {
                "plan": [
                    "Rewrite the follow-up into a standalone legislative query.",
                    "Retrieve the main bill and a comparable bill.",
                    "Answer with grounded citations.",
                ],
                "search_query": "Texas SB 2 notice period comparison",
            },
            {
                "needs_retrieval": True,
                "reason": "The question asks for comparison with other bills, so retrieval is required.",
            },
            {
                "enough_context": False,
                "summary": "The first search found SB 2 only; another search is needed for comparison.",
                "follow_up_query": "Texas notice period bills comparison",
            },
            {
                "enough_context": True,
                "summary": "The second search added a comparable bill, so the graph can answer now.",
                "follow_up_query": "",
            },
        ]
        mock_generate.return_value = mock_answer

        result = await graph.ainvoke(state)

    assert (
        result["rewrittenQuery"]
        == "Compare the Texas SB 2 notice period with similar Texas bills."
    )
    assert result["search_iteration"] == 2
    assert result["searchQueries"] == [
        "Texas SB 2 notice period comparison",
        "Texas notice period bills comparison",
    ]
    assert len(result["accumulatedSources"]) == 2
    assert result["response"]["answer"].startswith("Texas SB 2 uses 90 days")
    assert result["response"]["retrieval_skipped"] is False
