import json
import os
import unittest
from pathlib import Path
from unittest.mock import AsyncMock, patch

import httpx
from fastapi.testclient import TestClient
from app.main import app
from app.models.jd import Requirements
from app.services.gemini import generate_requirements

VALID = json.loads((Path(__file__).parent / 'requirements.json').read_text())
TEXT = 'Backend engineer. Requires Node.js and MongoDB with 3+ years experience. Python preferred. Build reliable APIs. Remote, full-time.'


class ExtractionTests(unittest.TestCase):
    def setUp(self):
        self.env = patch.dict(os.environ, {'AI_SERVICE_TOKEN': 's' * 40, 'GOOGLE_GEN_API_KEY': 'synthetic-key', 'JD_MODEL': 'gemini-2.5-flash'})
        self.env.start()
        self.client = TestClient(app)
        self.headers = {'X-AI-Service-Token': 's' * 40}

    def tearDown(self):
        self.client.close()
        self.env.stop()

    def post(self, body=None):
        return self.client.post('/v1/jd/extract', headers=self.headers, json=body or {'rawJDText': TEXT})

    def test_service_auth_and_input_validation(self):
        self.assertEqual(self.client.post('/v1/jd/extract', json={'rawJDText': TEXT}).status_code, 401)
        for body in [{'rawJDText': ' ' * 101}, {'rawJDText': 'x' * 20001}, {'rawJDText': TEXT, 'recruiter': 'injected'}]:
            response = self.post(body)
            self.assertEqual(response.status_code, 422)
            self.assertNotIn(TEXT, response.text)

    def test_valid_output_and_metadata(self):
        with patch('app.api.jd.generate_requirements', AsyncMock(return_value=json.dumps(VALID))) as provider:
            response = self.post()
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data['structuredJD'], VALID)
        self.assertEqual(data['parserVersion'], 'jd-v1')
        self.assertEqual(data['modelName'], 'gemini-2.5-flash')
        self.assertTrue(data['extractedAt'].endswith('Z'))
        self.assertEqual(provider.call_args.args[0], TEXT)

    def test_rejects_unvalidated_llm_responses(self):
        invalid = ['not json', '```json\n{}\n```', '{}', json.dumps({**VALID, 'extra': 'injected'}),
                   json.dumps({**VALID, 'minimumExperience': '3'}), json.dumps({**VALID, 'minimumExperience': True}),
                   json.dumps({**VALID, 'maximumExperience': 1}), json.dumps({**VALID, 'title': ' '}),
                   json.dumps({**VALID, 'requiredSkills': ['Node.js'] * 51})]
        for raw in invalid:
            with self.subTest(raw=raw), patch('app.api.jd.generate_requirements', AsyncMock(return_value=raw)):
                response = self.post()
                self.assertEqual(response.status_code, 502)
                self.assertNotIn(raw, response.text)

    def test_timeout_and_missing_configuration(self):
        with patch('app.api.jd.generate_requirements', AsyncMock(side_effect=httpx.ReadTimeout('private provider detail'))):
            self.assertEqual(self.post().status_code, 504)
        with patch.dict(os.environ, {'GOOGLE_GEN_API_KEY': ''}):
            self.assertEqual(self.post().status_code, 503)


class ProviderTests(unittest.IsolatedAsyncioTestCase):
    async def test_gemini_request_uses_schema_and_keeps_document_out_of_system_prompt(self):
        def handler(request):
            payload = json.loads(request.content)
            self.assertEqual(payload['generationConfig']['responseJsonSchema'], Requirements.model_json_schema())
            self.assertEqual(payload['contents'][0]['parts'][0]['text'], TEXT)
            self.assertNotIn(TEXT, payload['systemInstruction']['parts'][0]['text'])
            self.assertEqual(request.headers['x-goog-api-key'], 'synthetic')
            return httpx.Response(200, json={'candidates': [{'finishReason': 'STOP', 'content': {'parts': [{'text': json.dumps(VALID)}]}}]})
        client = httpx.AsyncClient(transport=httpx.MockTransport(handler))
        with patch('app.services.gemini.httpx.AsyncClient', return_value=client):
            result = await generate_requirements(TEXT, 'gemini-2.5-flash', 'synthetic')
        self.assertEqual(json.loads(result), VALID)


if __name__ == '__main__':
    unittest.main()
