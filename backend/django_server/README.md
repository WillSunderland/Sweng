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



