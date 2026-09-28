"""Lossless semantic partitions. Offsets address the unchanged extracted rawText."""
import hashlib
import re
from bisect import bisect_right
from typing import Literal
from pydantic import Field
from app.models.candidate import StrictModel, normalized

CHUNKER_VERSION = 'resume-sections-v1'
HEADINGS = {
    'summary': ('summary', 'professional summary', 'profile', 'objective', 'career objective', 'about me'),
    'skills': ('skills', 'technical skills', 'core skills', 'core competencies', 'technologies'),
    'experience': ('experience', 'work experience', 'professional experience', 'employment', 'employment history', 'internships'),
    'projects': ('projects', 'personal projects', 'academic projects', 'selected projects'),
    'education': ('education', 'academic qualifications', 'academic background'),
    'certifications': ('certifications', 'certificates', 'licenses', 'certifications and training'),
    'languages': ('languages',),
    'other': ('domains', 'domain', 'additional note', 'additional information', 'interests', 'references', 'awards'),
}


class ResumeChunk(StrictModel):
    analysisId: str = Field(pattern=r'^[a-f0-9]{24}$')
    resumeId: str = Field(pattern=r'^[a-f0-9]{24}$')
    candidateId: str = Field(pattern=r'^[a-f0-9]{24}$')
    section: Literal['summary', 'skills', 'experience', 'job_experience', 'projects', 'education', 'certifications', 'languages', 'other']
    pageStart: int = Field(ge=1, le=50)
    pageEnd: int = Field(ge=1, le=50)
    chunkIndex: int = Field(ge=0)
    text: str = Field(min_length=1, max_length=100049)
    sourceStart: int = Field(ge=0)
    sourceEnd: int = Field(gt=0)


def build_chunks(extraction, profile, analysis_id, resume_id):
    source = extraction.rawText
    boundaries = {0: 'other'}
    offset = 0
    for line in source.splitlines(keepends=True):
        heading = re.sub(r'^[\s•#*\-]+|[\s:•#*\-]+$', '', line).casefold()
        heading = re.sub(r'\s+', ' ', heading)
        # Common compact resumes keep a heading and its content on one line.
        heading = heading.split(':', 1)[0].strip()
        for section, aliases in HEADINGS.items():
            if heading in aliases:
                boundaries[offset] = section
                break
        offset += len(line)
    # Entry evidence identifies actual jobs/projects even in headingless layouts.
    # Find a whitespace-tolerant literal quote and cut at its original line boundary.
    page_offsets = []
    offset = 0
    for page in extraction.pages:
        page_offsets.append(offset)
        offset += len(page.text) + 1
    for field, section in [('experiences', 'job_experience'), ('projects', 'projects'), ('education', 'education')]:
        for entry in profile[field]:
            positions = []
            for evidence in entry['evidence']:
                page = extraction.pages[evidence['pageNumber'] - 1]
                pattern = r'\s+'.join(re.escape(token) for token in normalized(evidence['text']).split(' '))
                match = re.search(pattern, page.text)
                if match:
                    start = page.text.rfind('\n', 0, match.start()) + 1
                    positions.append(page_offsets[page.pageNumber - 1] + start)
            if positions:
                boundaries[min(positions)] = section
    points = sorted(boundaries)
    # Keep a section heading with its first entry, rather than emitting an
    # unhelpful one-word chunk such as "Experience" or "Education".
    index = 0
    aliases = {name for values in HEADINGS.values() for name in values}
    while index + 1 < len(points):
        start, following = points[index:index + 2]
        header = normalized(source[start:following]).casefold().strip(' :•#*-')
        same_family = boundaries[start] == boundaries[following] or (
            boundaries[start] == 'experience' and boundaries[following] == 'job_experience')
        if header in aliases and same_family:
            boundaries[start] = boundaries[following]
            del boundaries[following]
            points.pop(index + 1)
        else:
            index += 1
    chunks = []
    for index, start in enumerate(points):
        end = points[index + 1] if index + 1 < len(points) else len(source)
        if start == end:
            continue
        chunks.append(ResumeChunk(analysisId=analysis_id, resumeId=resume_id, candidateId=resume_id,
            section=boundaries[start], pageStart=bisect_right(page_offsets, start),
            pageEnd=bisect_right(page_offsets, end - 1), chunkIndex=len(chunks),
            text=source[start:end], sourceStart=start, sourceEnd=end).model_dump())
    if ''.join(chunk['text'] for chunk in chunks) != source:
        raise ValueError('Chunk reconstruction failed.')
    return {'resumeChunks': chunks, 'chunkerVersion': CHUNKER_VERSION,
            'sourceTextHash': hashlib.sha256(source.encode('utf-8')).hexdigest()}
