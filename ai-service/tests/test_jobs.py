import os
import unittest
from unittest.mock import patch
from fastapi.testclient import TestClient
from app.main import app


class JobApiTests(unittest.TestCase):
    def test_validated_private_enqueue_and_sanitized_broker_failure(self):
        token = 'x' * 40
        with patch.dict(os.environ, {'AI_SERVICE_TOKEN': token, 'REDIS_URL': 'redis://test', 'MONGO_URI': 'mongodb://test'}), TestClient(app) as client:
            headers = {'X-AI-Service-Token': token}
            with patch('app.api.jobs.dispatch_job.apply_async') as send:
                for payload in [{'jobId': 'invalid'}, {'jobId': 'a' * 24, 'anything': 1}]:
                    self.assertEqual(client.post('/v1/jobs', headers=headers, json=payload).status_code, 422)
                send.assert_not_called()
                self.assertEqual(client.post('/v1/jobs', headers=headers, json={'jobId': 'a' * 24}).status_code, 202)
                send.assert_called_once()
                send.side_effect = ConnectionError('private broker URL')
                response = client.post('/v1/jobs', headers=headers, json={'jobId': 'b' * 24})
                self.assertEqual(response.status_code, 503)
                self.assertNotIn('private broker URL', response.text)
