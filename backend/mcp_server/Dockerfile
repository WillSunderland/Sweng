FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Run the MCP server (adjust command based on your library)
CMD ["python", "main.py"]
