"""Cross-service test harness: real Celery + Mongo, Redis-compatible fake TCP broker.

Never used by the application. Node supplies an isolated Mongo replica set.
"""
import os
import sys
import select
import threading
import time
from fakeredis import TcpFakeServer
from fakeredis import _tcp_server
from redis.exceptions import ResponseError

# fakeredis 2.38 defaults its TCP writer to RESP3 even for RESP2 clients.
# Kombu uses RESP2; use the test server's existing RESP2 serializer.
_tcp_server.Resp3Writer = _tcp_server.Resp2Writer


class PortableHandler(_tcp_server.TCPFakeRequestHandler):
    def handle(self):
        # The upstream handler relies on POSIX nonblocking file descriptors.
        # On Windows a blocking readline prevents BRPOP push replies. Poll the
        # socket while keeping all Redis commands in fakeredis unchanged.
        while not self.server._shutdown_event.is_set() and not self.shutdown_request:
            if self.current_client.can_read():
                try:
                    response = self.current_client.read_response()
                except ResponseError as error:
                    response = error
                self.writer.dump(response)
                continue
            ready, _, _ = select.select([self.connection], [], [], 0.01)
            if ready:
                data = self.connection.recv(65536)
                if not data:
                    break
                self.current_client.get_socket().sendall(data)

real_redis = bool(os.getenv('TEST_REDIS_SERVER'))
if real_redis:
    from tests.redis_fixture import RedisFixture
    broker = RedisFixture(os.environ['TEST_REDIS_SERVER'])
    os.environ['REDIS_URL'] = broker.url
    print(f'REDIS_VERSION={broker.version}', flush=True)
else:
    broker = TcpFakeServer(('127.0.0.1', 0))
    broker.RequestHandlerClass = PortableHandler
    threading.Thread(target=broker.serve_forever, daemon=True).start()
    os.environ['REDIS_URL'] = f'redis://127.0.0.1:{broker.server_address[1]}/0'

import uvicorn
from celery.contrib.testing.worker import start_worker
from app.core.celery_app import celery
from app.main import app

server = uvicorn.Server(uvicorn.Config(app, host='127.0.0.1', port=int(os.environ['TEST_AI_PORT']), log_level='error'))
threading.Thread(target=server.run, daemon=True).start()
while not server.started:
    time.sleep(0.02)
print('HARNESS_READY', flush=True)
try:
    command = sys.stdin.readline().strip()
    if command == 'restart-broker' and real_redis:
        broker.restart()
        print('REDIS_RESTARTED', flush=True)
        command = sys.stdin.readline().strip()
    while command in ['start', 'restart-worker']:
        with start_worker(celery, pool='threads', concurrency=2, perform_ping_check=False, shutdown_timeout=20):
            print('WORKER_READY', flush=True)
            command = sys.stdin.readline().strip()
finally:
    server.should_exit = True
    if real_redis:
        broker.close()
    else:
        broker.shutdown()
        broker.server_close()
