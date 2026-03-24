import sys
import os

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "../../")))

from django.urls import path

try:
    from orchestrator.api.views.runViews import createRun, listRuns, getRun, getSource

    urlpatterns = [
        path("runs/", createRun, name="create-run"),
        path("runs/", listRuns, name="list-runs"),  # optional if you want REST-style
        path("runs/<str:runId>/", getRun, name="get-run"),
        path("sources/<str:sourceId>/", getSource, name="get-source"),
    ]
except ImportError:
    # When running standalone (e.g. in Docker without orchestrator),
    # API run routes are handled by the FastAPI orchestrator via reverse proxy.
    urlpatterns = []
