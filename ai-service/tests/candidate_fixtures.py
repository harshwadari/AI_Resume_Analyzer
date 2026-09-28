"""Offline provider fixture, imported only by tests (never a runtime fallback)."""
import asyncio
import json
from app.services.candidate import extract_profile


def empty_profile():
    return {**dict.fromkeys(['candidateName', 'email', 'phone', 'location', 'totalExperience']),
            **{field: [] for field in ['skills', 'jobTitles', 'experiences', 'education', 'projects', 'certifications', 'domains', 'languages']}}


class FixtureProvider:
    async def extract(self, pages):
        profile = empty_profile()
        profile['skills'] = ['Python'] if any('Python' in p.text for p in pages) else []
        return json.dumps(profile), 'offline-fixture', 'offline-fixture-v1'


def fixture_profile(extraction):
    return asyncio.run(extract_profile(extraction, FixtureProvider()))
