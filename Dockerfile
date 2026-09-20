# ---- Stage 1: build the React frontend ----
FROM node:20-alpine AS frontend
WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# ---- Stage 2: FastAPI backend serving the built frontend ----
FROM python:3.12-slim
WORKDIR /app/backend
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY backend/ .
COPY --from=frontend /app/frontend/dist ../frontend/dist

# uploads dir (user photos) — kept inside the container; mount a volume for persistence
RUN mkdir -p uploads/pandal_images
ENV CROWD_SIMULATOR=off

EXPOSE 8000
# Apply schema migrations, then boot (single worker: in-memory WS manager)
CMD ["sh", "-c", "alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
