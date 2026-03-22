# Use an official Python runtime as a parent image
FROM python:3.11-slim

# Set work directory
WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y gcc

# Install Python dependencies
COPY backend/orchestrator/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy project
COPY . .

# Run the shared FastAPI application used by the orchestrator.
CMD ["uvicorn", "backend.orchestrator.main:app", "--host", "0.0.0.0", "--port", "8000"]