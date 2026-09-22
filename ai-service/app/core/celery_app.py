import os
from celery import Celery

celery = Celery('prepwise', broker=os.getenv('REDIS_URL', 'redis://127.0.0.1:6379/0'), include=['app.services.processing'])
celery.conf.update(
    task_default_queue='resume-processing', task_serializer='json', accept_content=['json'],
    task_ignore_result=True, worker_concurrency=2, worker_prefetch_multiplier=1,
    task_acks_late=True, task_reject_on_worker_lost=True,
    broker_connection_retry_on_startup=True,
    broker_transport_options={'visibility_timeout': 180, 'socket_connect_timeout': 3, 'socket_timeout': 3},
    task_publish_retry=False,
    beat_schedule={'recover-publication-and-leases': {'task': 'processing.reconcile', 'schedule': 30.0}},
)
