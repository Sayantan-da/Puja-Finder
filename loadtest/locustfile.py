"""
Load test for PujaFinder — measure capacity BEFORE launch day.

Setup:   pip install locust
Smoke:   locust -f loadtest/locustfile.py --headless -u 20 -r 5 -t 30s --host http://localhost:8000
Launch:  locust -f loadtest/locustfile.py --headless -u 200 -r 20 -t 5m --host https://your-app.onrender.com

Watch for: failures > 0%, p95 latency, requests/sec ceiling.
Reads only — safe to run against production (no writes, no auth).
"""
from locust import HttpUser, between, task


class PujaVisitor(HttpUser):
    """Simulates the real Puja-night traffic mix: ~90% reads, everyone
    hitting the pandal list most often."""

    wait_time = between(1, 4)

    def on_start(self):
        self.client.get("/health")

    @task(6)
    def pandal_list(self):
        """The hot path: home page list with rating + crowd aggregates."""
        self.client.get("/api/pandals", name="/api/pandals [hot]")

    @task(3)
    def home_page(self):
        self.client.get("/", name="/ [spa]")

    @task(2)
    def moments(self):
        self.client.get("/api/moments", name="/api/moments")

    @task(2)
    def nearby(self):
        self.client.get(
            "/api/pandals/nearby?lat=22.5726&lng=88.3639&radius_km=5",
            name="/api/pandals/nearby",
        )

    @task(1)
    def about_content(self):
        self.client.get("/api/content", name="/api/content [cached]")

    @task(1)
    def deep_link(self):
        self.client.get("/pandals/1", name="/pandals/1 [spa]")
