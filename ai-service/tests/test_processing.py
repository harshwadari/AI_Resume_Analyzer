import unittest
import tempfile
import subprocess
import time
from uuid import uuid4
from pathlib import Path
from datetime import timedelta
from unittest.mock import patch
import mongomock
from bson import ObjectId
from app.services import processing as work


class ProcessingTests(unittest.TestCase):
    def setUp(self):
        self.db = mongomock.MongoClient(tz_aware=True).test
        self.owner, self.analysis, self.job, self.resume = [ObjectId() for _ in range(4)]
        self.db.users.insert_one({'_id': self.owner})
        self.db.analyses.insert_one({'_id': self.analysis, 'recruiter': self.owner})
        self.db.processingjobs.insert_one({'_id': self.job, 'analysis': self.analysis, 'recruiter': self.owner, 'resumeIds': [self.resume], 'status': 'PENDING'})
        self.db.resumes.insert_one({'_id': self.resume, 'jobId': self.job, 'analysis': self.analysis, 'recruiter': self.owner, 'processingStatus': 'UPLOADED', 'attempts': 0})
        self.mock_db = patch.object(work, 'database', return_value=self.db)
        self.mock_db.start()
        self.addCleanup(self.mock_db.stop)

    def run_one(self, parser=lambda _: 'Candidate skills'):
        return work.process_one(str(self.job), str(self.resume), parser)

    def test_duplicate_and_active_lease_skip_parser(self):
        self.assertEqual(self.run_one(), 'DONE')
        with patch.object(work, 'parse_resume') as parser:
            self.assertEqual(self.run_one(parser), 'SKIPPED')
            parser.assert_not_called()
        self.assertEqual(self.db.resumes.find_one()['attempts'], 1)
        self.db.resumes.update_one({}, {'$set': {'processingStatus': 'PROCESSING', 'leaseUntil': work.now() + timedelta(seconds=60)}})
        self.assertEqual(self.run_one(), 'SKIPPED')

    def test_retries_have_backoff_and_terminal_per_file_error(self):
        def failure(_):
            raise OSError('private filesystem details')
        for attempt in range(1, 4):
            result = self.run_one(failure)
            row = self.db.resumes.find_one()
            self.assertEqual(row['attempts'], attempt)
            self.assertNotIn('private filesystem', row['processingError'])
            if attempt < 3:
                self.assertEqual(result, 'RETRY')
                self.assertEqual(self.run_one(failure), 'SKIPPED')
                self.db.resumes.update_one({}, {'$set': {'nextAttemptAt': work.now() - timedelta(seconds=1)}})
        self.assertEqual(row['processingStatus'], 'FAILED')
        self.assertEqual(self.db.processingjobs.find_one()['status'], 'COMPLETED_WITH_ERRORS')

    def test_expired_lease_recovers_and_stale_worker_cannot_overwrite(self):
        def parser(_):
            self.db.resumes.update_one({}, {'$set': {'leaseUntil': work.now() - timedelta(seconds=1)}})
            self.run_one(lambda _: 'new worker result')
            return 'stale worker result'
        self.run_one(parser)
        self.assertEqual(self.db.resumes.find_one()['rawText'], 'new worker result')

    def test_publish_failure_and_retry_publication_recover(self):
        with patch.object(work.process_resume, 'apply_async', side_effect=ConnectionError('broker offline')):
            with self.assertRaises(ConnectionError):
                work.dispatch_job(str(self.job))
        self.assertNotIn('publishedAt', self.db.resumes.find_one())
        with patch.object(work.process_resume, 'apply_async') as publish:
            work.dispatch_job(str(self.job))
            work.dispatch_job(str(self.job))
            self.assertEqual(publish.call_count, 1)
            self.assertIn(str(self.resume), publish.call_args.kwargs['task_id'])
            self.db.resumes.update_one({}, {'$set': {'publishedAt': work.now() - timedelta(minutes=6)}})
            work.reconcile()
            self.assertEqual(publish.call_count, 2)

    def test_deleted_owner_and_invalid_pdf_fail_individually(self):
        with patch.object(work, 'parse_resume', side_effect=ValueError('bad PDF')):
            self.run_one(None)
        self.assertEqual(self.db.resumes.find_one()['processingStatus'], 'FAILED')
        self.db.resumes.update_one({}, {'$set': {'processingStatus': 'UPLOADED'}})
        self.db.users.delete_many({})
        self.assertEqual(self.run_one(), 'FAILED')

    def test_parser_rejects_malformed_oversized_and_unsafe_files(self):
        from app.parsers.resume_pdf import extract
        with tempfile.TemporaryDirectory() as folder:
            target = Path(folder) / 'bad.pdf'
            target.write_bytes(b'not a PDF')
            with self.assertRaises(Exception):
                extract(target)
            target.write_bytes(b'x' * (5 * 1024 * 1024 + 1))
            with self.assertRaisesRegex(ValueError, 'size limit'):
                extract(target)
            with patch.dict('os.environ', {'RESUME_STORAGE_DIR': folder}):
                with self.assertRaisesRegex(ValueError, 'storage reference'):
                    work.parse_resume({'storageReference': '../../outside.pdf'})

    def test_real_pdf_subprocess_extracts_text(self):
        root = Path(__file__).resolve().parents[2]
        pdf = subprocess.run(['node', '-e', "process.stdout.write(require('./Backend/test/pdf-fixture')())"],
                             cwd=root, capture_output=True, check=True, timeout=10).stdout
        with tempfile.TemporaryDirectory() as folder:
            key = f'{uuid4()}.pdf'
            (Path(folder) / key).write_bytes(pdf)
            with patch.dict('os.environ', {'RESUME_STORAGE_DIR': folder}):
                self.assertIn('Senior Engineer', work.parse_resume({'storageReference': key}))

    def test_parser_timeout_terminates_the_subprocess(self):
        with tempfile.TemporaryDirectory() as folder:
            key = f'{uuid4()}.pdf'
            (Path(folder) / key).write_bytes(b'%PDF-1.4')
            started = time.monotonic()
            with patch.dict('os.environ', {'RESUME_STORAGE_DIR': folder}), patch.object(work, 'PARSER_TIMEOUT_SECONDS', 0.001):
                with self.assertRaises(subprocess.TimeoutExpired):
                    work.parse_resume({'storageReference': key})
            self.assertLess(time.monotonic() - started, 10)
