import os
from functools import lru_cache
from pymongo import MongoClient


@lru_cache
def database():
    uri = os.getenv('MONGO_URI')
    if not uri:
        raise RuntimeError('Worker database is not configured')
    client = MongoClient(uri, serverSelectionTimeoutMS=5000, connectTimeoutMS=5000)
    return client.get_database(os.environ['MONGO_DB_NAME']) if os.getenv('MONGO_DB_NAME') else client.get_default_database('test')
