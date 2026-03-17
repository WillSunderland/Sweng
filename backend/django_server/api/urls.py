import sys
import os

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "../../")))

from django.urls import path
from orchestrator.api.views.runViews import createRun, listRuns, getRun, getSource
from orchestrator.api.views.streamViews import streamResponse

urlpatterns = [
    path("runs/", createRun, name="create-run"),
    path("runs/", listRuns, name="list-runs"),  # optional if you want REST-style
    path("runs/<str:runId>/", getRun, name="get-run"),
    path("sources/<str:sourceId>/", getSource, name="get-source"),
    path("stream/", streamResponse, name="stream-response"),
]
