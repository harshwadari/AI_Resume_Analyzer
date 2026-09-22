import os
import secrets
import socket
import subprocess
import sys
import time
import unittest
from pathlib import Path
from unittest.mock import patch

import httpx
from fastapi.testclient import TestClient
from app.main import app


class HealthTests(unittest.TestCase):
    def test_all_routes_require_service_auth(self):
        token = 'synthetic-' + 'x' * 32
        with patch.dict(os.environ, {'AI_SERVICE_TOKEN': token, 'GOOGLE_GEN_API_KEY': ''}), TestClient(app) as client:
            for headers in [{}, {'X-AI-Service-Token': 'wrong'}]:
                self.assertEqual(client.get('/health', headers=headers).status_code, 401)
                self.assertEqual(client.post('/v1/jd/extract', headers=headers, json={'rawJDText': 'x' * 100}).status_code, 401)
                self.assertEqual(client.post('/v1/jobs', headers=headers, json={'jobId': 'a' * 24}).status_code, 401)
            response = client.get('/health', headers={'X-AI-Service-Token': token})
            self.assertEqual(response.status_code, 200)
            self.assertEqual(response.json(), {'status': 'ok', 'service': 'prepwise-ai'})
            for path in ['/docs', '/redoc', '/openapi.json']:
                self.assertEqual(client.get(path).status_code, 404)

    def test_missing_service_configuration_fails_closed(self):
        with patch.dict(os.environ, {'AI_SERVICE_TOKEN': ''}), TestClient(app) as client:
            self.assertEqual(client.get('/health').status_code, 503)

    def test_node_calls_independent_uvicorn_health(self):
        root = Path(__file__).resolve().parents[1]
        env = os.environ.copy()
        env['AI_SERVICE_TOKEN'] = secrets.token_hex(32)
        env.pop('GOOGLE_GEN_API_KEY', None)
        with socket.socket() as listener:
            listener.bind(('127.0.0.1', 0))
            port = listener.getsockname()[1]
        env['AI_SERVICE_URL'] = f'http://127.0.0.1:{port}'
        process = subprocess.Popen(
            [sys.executable, '-m', 'uvicorn', 'app.main:app', '--host', '127.0.0.1', '--port', str(port), '--no-access-log'],
            cwd=root, env=env, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE, text=True,
            creationflags=getattr(subprocess, 'CREATE_NO_WINDOW', 0),
        )
        try:
            deadline = time.monotonic() + 15
            with httpx.Client(timeout=1, trust_env=False) as client:
                while True:
                    if process.poll() is not None:
                        self.fail('Uvicorn failed to start: ' + process.stderr.read())
                    try:
                        # Reachable but protected, without Gemini or MongoDB.
                        response = client.get(env['AI_SERVICE_URL'] + '/health')
                        self.assertEqual(response.status_code, 401)
                        break
                    except httpx.TransportError:
                        if time.monotonic() >= deadline:
                            self.fail('Uvicorn startup timed out')
                        time.sleep(0.1)
            result = subprocess.run(['node', 'scripts/check-ai-health.js'], cwd=root.parent / 'Backend',
                                    env=env, capture_output=True, text=True, timeout=10)
            self.assertEqual(result.returncode, 0, result.stderr)
            self.assertIn('"status":"ok"', result.stdout)
            self.assertIn('"service":"prepwise-ai"', result.stdout)
            env['AI_SERVICE_TOKEN'] = 'wrong-' + 'x' * 40
            denied = subprocess.run(['node', 'scripts/check-ai-health.js'], cwd=root.parent / 'Backend',
                                    env=env, capture_output=True, text=True, timeout=10)
            self.assertNotEqual(denied.returncode, 0)
            self.assertNotIn(env['AI_SERVICE_TOKEN'], denied.stderr)
        finally:
            process.terminate()
            try:
                process.wait(timeout=5)
            except subprocess.TimeoutExpired:
                process.kill()
                process.wait(timeout=5)
            process.stderr.close()
