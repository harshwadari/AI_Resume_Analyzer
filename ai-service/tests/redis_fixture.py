"""Private real-Redis process for acceptance tests; never installs a service."""
import os
import socket
import subprocess
import tempfile
import time
from pathlib import Path
from redis import Redis
from redis.exceptions import ConnectionError


class RedisFixture:
    def __init__(self, executable):
        self.executable = str(Path(executable).resolve(strict=True))
        self.directory = tempfile.TemporaryDirectory(prefix='prepwise-redis-test-')
        with socket.socket() as listener:
            listener.bind(('127.0.0.1', 0))
            self.port = listener.getsockname()[1]
        self.url = f'redis://127.0.0.1:{self.port}/0'
        self.client = Redis.from_url(self.url, socket_timeout=3, socket_connect_timeout=3)
        self.process = None
        self.start()

    def start(self):
        self.process = subprocess.Popen([
            self.executable, '--bind', '127.0.0.1', '--port', str(self.port),
            '--save', '', '--appendonly', 'yes', '--appendfsync', 'always', '--dir', '.',
        ], cwd=self.directory.name, stdin=subprocess.DEVNULL, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE,
            creationflags=getattr(subprocess, 'CREATE_NO_WINDOW', 0))
        deadline = time.monotonic() + 15
        while time.monotonic() < deadline:
            if self.process.poll() is not None:
                raise RuntimeError('Redis startup failed: ' + self.process.stderr.read().decode(errors='replace'))
            try:
                if self.client.ping():
                    self.version = self.client.info('server')['redis_version']
                    return
            except ConnectionError:
                time.sleep(0.05)
        raise RuntimeError('Redis startup timed out')

    def stop(self):
        if self.process and self.process.poll() is None:
            try:
                self.client.shutdown(nosave=True)
            except ConnectionError:
                pass
            try:
                self.process.wait(timeout=10)
            except subprocess.TimeoutExpired:
                self.process.kill()
                self.process.wait(timeout=5)
        if self.process:
            self.process.stderr.close()

    def restart(self):
        self.stop()
        self.start()

    def close(self):
        self.stop()
        self.client.close()
        self.directory.cleanup()
