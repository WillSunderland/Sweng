from django.urls import path

try:
    from orchestrator.api.views.runViews import createRun, listRuns, getRun, getSource, patchRun
except ModuleNotFoundError:
    from api.views.runViews import createRun, listRuns, getRun, getSource, patchRun

urlpatterns = [
    # Runs
    path("runs", createRun, name="create_run"),         # POST
    path("runs", listRuns, name="list_runs"),            # GET
    path("runs/<str:runId>", getRun, name="get_run"),    # GET
    path("runs/<str:runId>", patchRun, name="patch_run"), # PATCH
    # Sources
    path("sources/<str:sourceId>", getSource, name="get_source"),  # GET
]