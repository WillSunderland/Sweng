how to create an api end point:
1) add endpoint to urls.py in api folder.
2) work with your end point in views.py inside api folder

dont forget this:
The URL pattern inside this app.
Since we included the app under path("api/", include("api.urls")), the full URL becomes:
ex: /api/ + health/ → /api/health/

!!! you dont have to change urls.py in config folder.


------------------------------------------------------------------------------------------------


how to run to test:

From backend/django_server/:

python manage.py runserver


Then open:

example:
http://127.0.0.1:8000/api/health/

If that returns {"status":"ok"}, you’re done. (it returns so its fine)




can put this into docker-compose.yml:

version: "3.8"

services:
  orchestrator:
    build: ./backend/orchestrator
    ports:
      - "8000:8000"
    environment:
      - NVIDIA_API_KEY=${NVIDIA_API_KEY}
      - MCP_SERVER_URL=http://mcp-server:8001
    depends_on:
      - mcp-server

  mcp-server:
    build: ./backend/mcp_server
    ports:
      - "8001:8001"
    environment:
      - ELASTICSEARCH_URL=${ELASTICSEARCH_URL}

  django-server:
    build: ./backend/django_server
    ports:
      - "8002:8000"
    environment:
      - DJANGO_SETTINGS_MODULE=config.settings

  frontend:
    build: ./frontend
    ports:
      - "3000:80"
    depends_on:
      - orchestrator



