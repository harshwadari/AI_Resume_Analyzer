import asyncio
import copy
import json
import unittest
from pathlib import Path
import httpx
from unittest.mock import patch
from app.models.candidate import CandidateProfile, validate_grounding
from app.models.resume_extraction import ResumeExtraction
from app.services.candidate import extract_profile, ProfileUnavailable, GeminiCandidateProvider
from app.services.resume_chunks import build_chunks
from tests.candidate_fixtures import empty_profile
from tests import test_processing


def document():
    texts = ['Ada Example\nSummary\nSoftware engineer\nSkills\nPython\nExperience\nAlpha Ltd\nEngineer\n2020 - 2022\nBuilt Python APIs.\n',
             'Beta Ltd\nLead Engineer\n2022 - Present\nLed Python migration.\nEducation\nExample University\nBSc\nProjects\nTracker\nPython dashboard\nCertifications\nPython Certificate\n']
    return ResumeExtraction(rawText='\f'.join(texts), pages=[{'pageNumber': i+1, 'text': text} for i, text in enumerate(texts)],
        documentMetadata={'pageCount': 2}, extractionStatus='PROCESSED', extractionMethod='text')


def profile():
    data = empty_profile()
    data.update(candidateName='Ada Example', skills=['Python'], jobTitles=['Engineer', 'Lead Engineer'], experiences=[
        {'company': company, 'title': title, 'startDate': start, 'endDate': end, 'description': description,
         'skills': ['Python'], 'evidence': [{'pageNumber': page, 'text': quote}]}
        for company, title, start, end, description, page, quote in [
            ('Alpha Ltd', 'Engineer', '2020', '2022', 'Built Python APIs.', 1, 'Alpha Ltd\nEngineer\n2020 - 2022\nBuilt Python APIs.'),
            ('Beta Ltd', 'Lead Engineer', '2022', 'Present', 'Led Python migration.', 2, 'Beta Ltd\nLead Engineer\n2022 - Present\nLed Python migration.')]])
    return data


class CandidateTests(unittest.TestCase):
    def test_profile_preserves_unknowns_and_rejects_invented_values_and_evidence(self):
        result = validate_grounding(CandidateProfile.model_validate(profile()), document().pages)
        self.assertIsNone(result.email)
        self.assertIsNone(result.totalExperience)
        for mutate in [lambda p: p.update(skills=['Kubernetes']),
                       lambda p: p['experiences'][0].update(company='Beta Ltd'),
                       lambda p: p['experiences'][0]['evidence'][0].update(pageNumber=2),
                       lambda p: p.update(totalExperience='6 years'),
                       lambda p: p.update(extra='unexpected')]:
            invalid = copy.deepcopy(profile()); mutate(invalid)
            with self.assertRaises(ValueError):
                validate_grounding(CandidateProfile.model_validate(invalid), document().pages)

    def test_semantic_chunks_reconstruct_every_character_and_have_provenance(self):
        source = document()
        result = build_chunks(source, profile(), 'a'*24, 'b'*24)
        chunks = result['resumeChunks']
        self.assertEqual(''.join(c['text'] for c in chunks), source.rawText)
        jobs = [c for c in chunks if c['section'] == 'job_experience']
        self.assertEqual(len(jobs), 2)
        self.assertIn('Alpha Ltd', jobs[0]['text']); self.assertIn('Beta Ltd', jobs[1]['text'])
        self.assertEqual(jobs[1]['pageStart'], 2)
        for index, c in enumerate(chunks):
            self.assertEqual(c['text'], source.rawText[c['sourceStart']:c['sourceEnd']])
            self.assertEqual(c['chunkIndex'], index)
            self.assertEqual(c['candidateId'], 'b'*24)
            self.assertLessEqual(c['pageStart'], c['pageEnd'])
        self.assertEqual(result, build_chunks(source, profile(), 'a'*24, 'b'*24))
        self.assertFalse(any(c['text'].strip() in ['Experience', 'Education', 'Projects'] for c in chunks))

    def test_headingless_text_and_blank_pages_are_not_dropped_or_sliced_by_length(self):
        text = 'Unusual layout. ' * 2000
        source = ResumeExtraction(rawText=text+'\f\fTail', pages=[{'pageNumber': 1, 'text': text}, {'pageNumber': 2, 'text': ''}, {'pageNumber': 3, 'text': 'Tail'}],
            documentMetadata={'pageCount': 3}, extractionStatus='PROCESSED', extractionMethod='text')
        chunks = build_chunks(source, empty_profile(), 'a'*24, 'b'*24)['resumeChunks']
        self.assertEqual(len(chunks), 1)
        self.assertEqual(chunks[0]['text'], source.rawText)
        self.assertEqual(chunks[0]['pageEnd'], 3)

    def test_provider_validation_and_versions(self):
        class Provider:
            async def extract(self, pages):
                return json.dumps(profile()), 'fixture', 'fixture-v1'
        result = asyncio.run(extract_profile(document(), Provider()))
        self.assertEqual(result['candidateProfile']['rawText'], document().rawText)
        self.assertEqual(result['profileModelVersion'], 'fixture-v1')
        class Invalid:
            async def extract(self, pages):
                return '{}', 'fixture', 'fixture-v1'
        with self.assertRaises(ProfileUnavailable):
            asyncio.run(extract_profile(document(), Invalid()))

    def test_multi_page_experience_and_inline_sections_keep_exact_offsets(self):
        texts = ['Skills: Python\nExperience\nAlpha Ltd\nEngineer\n2020\n', 'Built Python APIs.\nEducation: Example University\n']
        source = ResumeExtraction(rawText='\f'.join(texts), pages=[{'pageNumber': n+1, 'text': text} for n, text in enumerate(texts)],
            documentMetadata={'pageCount': 2}, extractionStatus='PROCESSED', extractionMethod='text')
        data = empty_profile()
        data['experiences'] = [{'company': 'Alpha Ltd', 'title': 'Engineer', 'startDate': '2020', 'endDate': None,
            'description': 'Built Python APIs.', 'skills': ['Python'], 'evidence': [
                {'pageNumber': 1, 'text': 'Alpha Ltd\nEngineer\n2020'}, {'pageNumber': 2, 'text': 'Built Python APIs.'}]}]
        validate_grounding(CandidateProfile.model_validate(data), source.pages)
        chunks = build_chunks(source, data, 'a'*24, 'b'*24)['resumeChunks']
        job = next(c for c in chunks if c['section'] == 'job_experience')
        self.assertEqual((job['pageStart'], job['pageEnd']), (1, 2))
        self.assertEqual(chunks[0]['section'], 'skills')
        self.assertEqual(chunks[-1]['section'], 'education')
        self.assertEqual(''.join(c['text'] for c in chunks), source.rawText)

    def test_worker_retains_raw_text_on_model_failure_and_retries_without_partial_profile(self):
        case = test_processing.ProcessingTests(); case.setUp(); self.addCleanup(case.doCleanups)
        from app.services import processing as work
        def fail(_): raise ProfileUnavailable('private provider error')
        result = work.process_one(str(case.job), str(case.resume), lambda _: document(), fail)
        self.assertEqual(result, 'RETRY')
        row = case.db.resumes.find_one()
        self.assertEqual(row['rawText'], document().rawText)
        self.assertNotIn('candidateProfile', row)
        self.assertNotIn('private provider', row['processingError'])

    def test_gemini_uses_structured_schema_untrusted_document_and_actual_model_version(self):
        observed = []
        def respond(request):
            observed.append(json.loads(request.content))
            return httpx.Response(200, json={'modelVersion': 'gemini-fixture-001', 'candidates': [
                {'finishReason': 'STOP', 'content': {'parts': [{'text': json.dumps(profile())}]}}]})
        original = httpx.AsyncClient
        with patch.dict('os.environ', {'GOOGLE_GEN_API_KEY': 'synthetic', 'RESUME_MODEL': 'gemini-fixture'}), \
             patch('app.services.candidate.httpx.AsyncClient', side_effect=lambda **kwargs: original(transport=httpx.MockTransport(respond), **kwargs)):
            result = asyncio.run(extract_profile(document()))
        self.assertEqual(result['profileModelVersion'], 'gemini-fixture-001')
        self.assertIn('untrusted', observed[0]['systemInstruction']['parts'][0]['text'])
        self.assertNotIn('Ada Example', observed[0]['systemInstruction']['parts'][0]['text'])
        self.assertIn('Ada Example', observed[0]['contents'][0]['parts'][0]['text'])
        self.assertIn('experiences', observed[0]['generationConfig']['responseJsonSchema']['properties'])
        self.assertIn('title', observed[0]['generationConfig']['responseJsonSchema']['$defs']['Experience']['properties'])
        def limited(_): return httpx.Response(429, headers={'retry-after': '90'}, json={'error': 'synthetic quota error'})
        with patch.dict('os.environ', {'GOOGLE_GEN_API_KEY': 'synthetic'}), \
             patch('app.services.candidate.httpx.AsyncClient', side_effect=lambda **kwargs: original(transport=httpx.MockTransport(limited), **kwargs)):
            with self.assertRaises(ProfileUnavailable) as failure:
                asyncio.run(extract_profile(document(), GeminiCandidateProvider()))
            self.assertEqual(failure.exception.retry_after, 90)

    def test_rate_limit_sets_a_durable_later_retry(self):
        case = test_processing.ProcessingTests(); case.setUp(); self.addCleanup(case.doCleanups)
        from app.services import processing as work
        def limited(_): raise ProfileUnavailable('quota', retry_after=90)
        started = work.now()
        self.assertEqual(work.process_one(str(case.job), str(case.resume), lambda _: document(), limited), 'RETRY')
        self.assertGreaterEqual((case.db.resumes.find_one()['nextAttemptAt'] - started).total_seconds(), 89)
        with patch.object(work, 'process_one', return_value='RETRY'), patch.object(work.process_resume, 'retry', side_effect=RuntimeError('retry')) as retry:
            with self.assertRaisesRegex(RuntimeError, 'retry'):
                work.process_resume.run(str(case.job), str(case.resume))
            self.assertGreater(retry.call_args.kwargs['countdown'], 85)

    def test_ten_manually_reviewed_live_model_profiles_remain_grounded_and_lossless(self):
        rows = json.loads((Path(__file__).parent / 'fixtures' / 'candidate_review.json').read_text(encoding='utf-8'))
        self.assertEqual(len(rows), 10)
        for index, row in enumerate(rows):
            with self.subTest(resume=index+1):
                data = dict(row['candidateProfile'])
                raw = data.pop('rawText')
                source = ResumeExtraction(rawText=raw, pages=row['pages'], documentMetadata={'pageCount': len(row['pages'])},
                    extractionStatus='PROCESSED', extractionMethod='text')
                validate_grounding(CandidateProfile.model_validate(data), source.pages)
                chunks = build_chunks(source, data, 'a'*24, f'{index+1:024x}')['resumeChunks']
                self.assertEqual(''.join(c['text'] for c in chunks), raw)
                self.assertTrue(all(c['pageEnd'] <= len(row['pages']) for c in chunks))
                self.assertIsNone(data['phone'])
                if index != 0:
                    self.assertIsNone(data['totalExperience'])
        self.assertNotIn('Kubernetes', rows[9]['candidateProfile']['skills'])
        self.assertIsNone(rows[8]['candidateProfile']['experiences'][0]['startDate'])

    def test_worker_persists_profile_and_chunks_together_and_skips_ocr_required(self):
        case = test_processing.ProcessingTests(); case.setUp(); self.addCleanup(case.doCleanups)
        case.run_one(lambda _: document())
        row = case.db.resumes.find_one()
        self.assertEqual(row['candidateProfile']['rawText'], row['rawText'])
        self.assertEqual(''.join(c['text'] for c in row['resumeChunks']), row['rawText'])
        case.db.resumes.update_one({}, {'$set': {'processingStatus': 'UPLOADED'}})
        with patch('app.services.processing.build_profile') as provider:
            case.run_one(lambda _: test_processing.extracted(''))
            provider.assert_not_called()
