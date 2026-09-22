import json
import os
import re
import subprocess
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path
from uuid import uuid4
from bson import ObjectId
from pymongo import ReturnDocument
from pymongo.errors import PyMongoError
from app.core.celery_app import celery
from app.core.database import database

PARSER_VERSION = 'resume-text-v1'
MAX_ATTEMPTS = 3
PARSER_TIMEOUT_SECONDS = 35


def now():
    return datetime.now(timezone.utc)


def parse_resume(record):
    root = os.getenv('RESUME_STORAGE_DIR')
    if not root:
        raise OSError('Worker storage is not configured')
    key = record['storageReference']
    if not re.fullmatch(r'[a-f0-9-]{36}\.pdf', key):
        raise ValueError('Invalid storage reference')
    target = (Path(root).resolve() / key).resolve()
    if target.parent != Path(root).resolve():
        raise ValueError('Unsafe storage reference')
    if not target.is_file():
        raise OSError('Stored PDF is unavailable')
    process = subprocess.Popen([sys.executable, '-m', 'app.parsers.resume_pdf', str(target)],
                               stdin=subprocess.DEVNULL, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL,
                               text=True, encoding='utf-8', creationflags=getattr(subprocess, 'CREATE_NO_WINDOW', 0))
    try:
        output, _ = process.communicate(timeout=PARSER_TIMEOUT_SECONDS)
    except subprocess.TimeoutExpired:
        # Windows virtualenv launchers have a child interpreter. Killing only
        # the launcher leaves the parser and its pipe alive past the timeout.
        if sys.platform == 'win32':
            subprocess.run(['taskkill', '/PID', str(process.pid), '/T', '/F'], stdin=subprocess.DEVNULL,
                           stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=5,
                           creationflags=subprocess.CREATE_NO_WINDOW)
        else:
            process.kill()
        process.communicate(timeout=5)
        raise
    finally:
        process.stdout.close()
    if process.returncode:
        raise ValueError('PDF is unreadable, encrypted, empty, or exceeds processing limits.')
    payload = json.loads(output)
    text = payload.get('text')
    if not isinstance(text, str) or not text.strip() or len(text) > 100050:
        raise ValueError('Invalid extracted text')
    return text


def finish_job(db, job):
    query = {'jobId': job['_id'], '_id': {'$in': job['resumeIds']}}
    if db.resumes.count_documents({**query, 'processingStatus': {'$in': ['UPLOADED', 'PROCESSING']}}) == 0:
        failed = db.resumes.count_documents({**query, 'processingStatus': 'FAILED'})
        db.processingjobs.update_one({'_id': job['_id']}, {'$set': {'status': 'COMPLETED_WITH_ERRORS' if failed else 'COMPLETED', 'updatedAt': now()}, '$unset': {'dispatchError': ''}})


def process_one(job_id, resume_id, parser=None):
    db = database()
    job = db.processingjobs.find_one({'_id': ObjectId(job_id)})
    if not job or ObjectId(resume_id) not in job['resumeIds']:
        return 'SKIPPED'
    if not db.users.find_one({'_id': job['recruiter']}) or not db.analyses.find_one({'_id': job['analysis'], 'recruiter': job['recruiter']}):
        db.resumes.update_many({'jobId': job['_id'], 'processingStatus': {'$in': ['UPLOADED', 'PROCESSING']}}, {'$set': {'processingStatus': 'FAILED', 'processingError': 'Owner or analysis is no longer available.'}})
        finish_job(db, job)
        return 'FAILED'
    token = uuid4().hex
    record = db.resumes.find_one_and_update({
        '_id': ObjectId(resume_id), 'jobId': job['_id'], 'recruiter': job['recruiter'], 'analysis': job['analysis'],
        '$or': [{'processingStatus': 'UPLOADED', '$or': [{'nextAttemptAt': {'$exists': False}}, {'nextAttemptAt': {'$lte': now()}}]},
                {'processingStatus': 'PROCESSING', 'leaseUntil': {'$lte': now()}}],
    }, {'$set': {'processingStatus': 'PROCESSING', 'leaseUntil': now() + timedelta(seconds=120), 'claimToken': token, 'updatedAt': now()},
        '$inc': {'attempts': 1}}, return_document=ReturnDocument.AFTER)
    if not record:
        finish_job(db, job)
        return 'SKIPPED'
    db.processingjobs.update_one({'_id': job['_id']}, {'$set': {'status': 'RUNNING', 'updatedAt': now()}, '$unset': {'dispatchError': ''}})
    query = {'_id': record['_id'], 'jobId': job['_id'], 'claimToken': token}
    try:
        if record['attempts'] > MAX_ATTEMPTS:
            raise ValueError('Processing retry limit reached.')
        text = (parser or parse_resume)(record)
        db.resumes.update_one(query, {'$set': {'processingStatus': 'PROCESSED', 'rawText': text, 'processedAt': now(), 'parserVersion': PARSER_VERSION, 'updatedAt': now()},
                                     '$unset': {'processingError': '', 'leaseUntil': '', 'claimToken': '', 'nextAttemptAt': ''}})
    except (OSError, subprocess.TimeoutExpired):
        terminal = record['attempts'] >= MAX_ATTEMPTS
        db.resumes.update_one(query, {'$set': {'processingStatus': 'FAILED' if terminal else 'UPLOADED',
                                             'processingError': 'File could not be read or processing timed out.' if terminal else 'Temporary processing failure; retry scheduled.',
                                             'nextAttemptAt': now() + timedelta(seconds=5 * 2 ** (record['attempts'] - 1)), 'updatedAt': now()},
                                     '$unset': {'leaseUntil': '', 'claimToken': '', 'publishedAt': ''}})
        if not terminal:
            return 'RETRY'
    except (ValueError, KeyError):
        db.resumes.update_one(query, {'$set': {'processingStatus': 'FAILED', 'processingError': 'PDF is unreadable, encrypted, empty, or exceeds processing limits.', 'updatedAt': now()},
                                     '$unset': {'leaseUntil': '', 'claimToken': ''}})
    finish_job(db, job)
    return 'DONE'


@celery.task(bind=True, name='processing.resume', max_retries=20)
def process_resume(self, job_id, resume_id):
    try:
        outcome = process_one(job_id, resume_id)
        if outcome == 'RETRY':
            raise self.retry(countdown=min(60, 5 * 2 ** self.request.retries))
    except PyMongoError:
        raise self.retry(exc=RuntimeError('Worker database temporarily unavailable'), countdown=30) from None


@celery.task(name='processing.dispatch', autoretry_for=(PyMongoError,), retry_backoff=True, max_retries=5)
def dispatch_job(job_id):
    db = database()
    job = db.processingjobs.find_one({'_id': ObjectId(job_id)})
    if not job or job['status'] not in ['PENDING', 'RUNNING']:
        return
    query = {'jobId': job['_id'], '$or': [
        {'processingStatus': 'UPLOADED', '$and': [
            {'$or': [{'publishedAt': {'$exists': False}}, {'publishedAt': {'$lte': now() - timedelta(minutes=5)}}]},
            {'$or': [{'nextAttemptAt': {'$exists': False}}, {'nextAttemptAt': {'$lte': now()}}]},
        ]},
        {'processingStatus': 'PROCESSING', 'leaseUntil': {'$lte': now()}},
    ]}
    for record in db.resumes.find(query, {'_id': 1}):
        # Reserve publication before sending: a fast worker must not have its retry
        # marker overwritten by the publisher. Stale reservations are recovered.
        published = now()
        reserved = db.resumes.update_one({**query, '_id': record['_id']}, {'$set': {'publishedAt': published}})
        if not reserved.modified_count:
            continue
        try:
            process_resume.apply_async(args=[job_id, str(record['_id'])], task_id=f'{job_id}:{record["_id"]}:{PARSER_VERSION}')
        except Exception:
            db.resumes.update_one({'_id': record['_id'], 'jobId': job['_id'], 'publishedAt': published}, {'$unset': {'publishedAt': ''}})
            raise
    finish_job(db, job)


@celery.task(name='processing.reconcile')
def reconcile():
    for job in database().processingjobs.find({'status': {'$in': ['PENDING', 'RUNNING']}}, {'_id': 1}):
        dispatch_job(str(job['_id']))
