import urllib.error
import unittest
from typing import Any
from unittest.mock import call, patch

import app as ghostshell


class GhostShellAppTests(unittest.TestCase):
    def setUp(self):
        ghostshell.app.config.update(TESTING=True)
        self.client = ghostshell.app.test_client()

    def test_home_serves_workbench_and_configured_model(self):
        response = self.client.get("/")
        self.assertEqual(response.status_code, 200)
        self.assertIn(b"GHOSTSHELL", response.data)
        self.assertIn(b'id="prompt-panel"', response.data)
        self.assertIn(b"Code insight", response.data)
        self.assertIn(b"Safety lens", response.data)
        self.assertIn(b"qwen2.5:1.5b", response.data)

    def test_route_manifest_is_served_as_json(self):
        response = self.client.get("/manus-routes.json")
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.is_json)
        self.assertEqual(response.get_json()["routes"][0]["path"], "/")
        response.close()

    def test_empty_and_invalid_requests_are_rejected(self):
        empty = self.client.post("/api/chat", json={"mode": "command", "message": "  "})
        self.assertEqual(empty.status_code, 400)
        self.assertEqual(empty.get_json()["error"]["code"], "message_required")

        invalid_mode = self.client.post("/api/chat", json={"mode": "unknown", "message": "ls"})
        self.assertEqual(invalid_mode.status_code, 400)
        self.assertEqual(invalid_mode.get_json()["error"]["code"], "invalid_mode")

        malformed_mode = self.client.post("/api/chat", json={"mode": [], "message": "ls"})
        self.assertEqual(malformed_mode.status_code, 400)
        self.assertEqual(malformed_mode.get_json()["error"]["code"], "invalid_mode")

    def test_non_json_request_is_rejected(self):
        response = self.client.post("/api/chat", data="message=ls", content_type="text/plain")
        self.assertEqual(response.status_code, 415)
        self.assertEqual(response.get_json()["error"]["code"], "json_required")

    def test_long_message_is_rejected(self):
        response = self.client.post("/api/chat", json={"mode": "error", "message": "x" * 10_001})
        self.assertEqual(response.status_code, 413)
        self.assertEqual(response.get_json()["error"]["code"], "message_too_long")

    def test_command_mode_sends_untrusted_input_to_selected_local_model(self):
        tags = {"models": [{"name": "qwen2.5:1.5b"}, {"name": "qwen2.5:0.5b"}]}
        result = {"message": {"content": "The command lists files. Review it before you run it."}}
        with patch.object(ghostshell, "ollama_request", side_effect=[tags, result]) as ollama:
            response = self.client.post("/api/chat", json={"mode": "command", "message": "ls -la", "model": "qwen2.5:0.5b"})

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.get_json()["model"], "qwen2.5:0.5b")
        self.assertIn("lists files", response.get_json()["response"])
        self.assertEqual(ollama.call_args_list, [call("/api/tags"), call("/api/chat", ollama.call_args_list[1].args[1])])
        payload = ollama.call_args_list[1].args[1]
        self.assertEqual(payload["model"], "qwen2.5:0.5b")
        self.assertFalse(payload["stream"])
        self.assertIn("UNTRUSTED DATA", payload["messages"][0]["content"])
        self.assertIn("ls -la", payload["messages"][1]["content"])

    def test_code_and_safety_modes_have_distinct_task_prompts(self):
        tags = {"models": [{"name": "qwen2.5:1.5b"}]}
        with patch.object(ghostshell, "ollama_request", side_effect=[tags, {"message": {"content": "Code explanation."}}]) as ollama:
            code_response = self.client.post("/api/chat", json={"mode": "code", "message": "print(1 + 1)"})
        self.assertEqual(code_response.status_code, 200)
        self.assertIn("Explain this code", ollama.call_args_list[1].args[1]["messages"][1]["content"])

        with patch.object(ghostshell, "ollama_request", side_effect=[tags, {"message": {"content": "Review only."}}]) as ollama:
            safety_response = self.client.post("/api/chat", json={"mode": "safety", "message": "rm -rf ./build"})
        self.assertEqual(safety_response.status_code, 200)
        self.assertIn("safety and security risks", ollama.call_args_list[1].args[1]["messages"][1]["content"])

    def test_common_secret_is_redacted_before_model_call(self):
        captured: dict[str, Any] = {}

        def fake_request(path, payload=None):
            if path == "/api/tags":
                return {"models": [{"name": "qwen2.5:1.5b"}]}
            if payload is None:
                raise AssertionError("The chat request payload should be present")
            captured["prompt"] = payload["messages"][1]["content"]
            return {"message": {"content": "That token [REDACTED] should be revoked."}}

        with patch.object(ghostshell, "ollama_request", side_effect=fake_request):
            response = self.client.post("/api/chat", json={"mode": "error", "message": "api_key=ghp_example_privatevalue12345"})

        self.assertEqual(response.status_code, 200)
        self.assertNotIn("ghp_example_privatevalue12345", captured["prompt"])
        self.assertIn("[REDACTED]", captured["prompt"])

    def test_uninstalled_or_invalid_model_is_rejected(self):
        tags = {"models": [{"name": "qwen2.5:1.5b"}]}
        with patch.object(ghostshell, "ollama_request", return_value=tags) as ollama:
            response = self.client.post("/api/chat", json={"mode": "command", "message": "ls", "model": "qwen2.5:99b"})
        self.assertEqual(response.status_code, 503)
        self.assertEqual(response.get_json()["error"]["code"], "model_unavailable")
        self.assertEqual(ollama.call_count, 1)

        invalid = self.client.post("/api/chat", json={"mode": "command", "message": "ls", "model": "bad;tag"})
        self.assertEqual(invalid.status_code, 400)
        self.assertEqual(invalid.get_json()["error"]["code"], "invalid_model")

    def test_ollama_unavailable_returns_structured_error(self):
        with patch.object(ghostshell, "ollama_request", side_effect=urllib.error.URLError("connection refused")):
            response = self.client.post("/api/chat", json={"mode": "error", "message": "ModuleNotFoundError"})
        self.assertEqual(response.status_code, 503)
        self.assertEqual(response.get_json()["error"]["code"], "ollama_unavailable")

    def test_health_endpoint_reports_local_model_inventory(self):
        tags = {"models": [{"name": "qwen2.5:1.5b"}, {"name": "mistral:latest"}]}
        with patch.object(ghostshell, "ollama_request", return_value=tags):
            response = self.client.get("/api/health")
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.get_json()["model_installed"])
        self.assertTrue(response.get_json()["local_only"])
        self.assertEqual(response.get_json()["models"], ["mistral:latest", "qwen2.5:1.5b"])

    def test_health_endpoint_marks_custom_ollama_host(self):
        tags = {"models": [{"name": "qwen2.5:1.5b"}]}
        with patch.object(ghostshell, "OLLAMA_BASE_URL", "https://ollama.example.invalid"):
            with patch.object(ghostshell, "ollama_request", return_value=tags):
                response = self.client.get("/api/health")
        self.assertEqual(response.status_code, 200)
        self.assertFalse(response.get_json()["local_only"])

    def test_health_endpoint_reports_unavailable(self):
        with patch.object(ghostshell, "ollama_request", side_effect=urllib.error.URLError("connection refused")):
            response = self.client.get("/api/health")
        self.assertEqual(response.status_code, 503)
        self.assertEqual(response.get_json()["ollama"], "unavailable")


if __name__ == "__main__":
    unittest.main()
