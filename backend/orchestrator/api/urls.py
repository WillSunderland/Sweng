from django.urls import path

try:
    from orchestrator.api.views.runViews import createRun, listRuns, getRun, getSource
except ModuleNotFoundError:
    from api.views.runViews import createRun, listRuns, getRun, getSource

urlpatterns = [
    # Runs
    path("runs", createRun, name="create_run"),  # POST
    path("runs", listRuns, name="list_runs"),  # GET
    path("runs/<str:runId>", getRun, name="get_run"),  # GET
    # Sources
    path("sources/<str:sourceId>", getSource, name="get_source"),  # GET
]
