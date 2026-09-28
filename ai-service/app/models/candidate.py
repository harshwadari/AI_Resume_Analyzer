"""Extractive candidate schema: absent scalars are null, absent collections empty."""
import re
from typing import Annotated
from pydantic import BaseModel, ConfigDict, Field

Text = Annotated[str, Field(min_length=1, max_length=2000)]
Items = Annotated[list[Text], Field(max_length=150)]


class StrictModel(BaseModel):
    model_config = ConfigDict(extra='forbid', strict=True)


class Evidence(StrictModel):
    pageNumber: int = Field(ge=1, le=50)
    text: str = Field(min_length=1, max_length=20000)


class Experience(StrictModel):
    company: Text | None
    title: Text | None
    startDate: Text | None
    endDate: Text | None
    description: Text | None
    skills: Items
    evidence: list[Evidence] = Field(min_length=1, max_length=50)


class Education(StrictModel):
    institution: Text | None
    qualification: Text | None
    startDate: Text | None
    endDate: Text | None
    evidence: list[Evidence] = Field(min_length=1, max_length=50)


class Project(StrictModel):
    name: Text | None
    description: Text | None
    skills: Items
    evidence: list[Evidence] = Field(min_length=1, max_length=50)


class CandidateProfile(StrictModel):
    candidateName: Text | None
    email: Text | None
    phone: Text | None
    location: Text | None
    skills: Items
    jobTitles: Items
    # Preserve explicit wording/units; do not invent totals from overlapping dates.
    totalExperience: Text | None
    experiences: list[Experience] = Field(max_length=100)
    education: list[Education] = Field(max_length=50)
    projects: list[Project] = Field(max_length=100)
    certifications: Items
    domains: Items
    languages: Items


def normalized(text):
    return re.sub(r'\s+', ' ', text).strip()


def validate_grounding(profile: CandidateProfile, pages):
    """Reject unsupported values rather than silently persisting model inventions."""
    source = normalized('\n'.join(page.text for page in pages))
    def check(value, context):
        if value is not None and (not normalized(value) or normalized(value) not in context):
            raise ValueError('Candidate value is not supported by source text.')
    for name in ('candidateName', 'email', 'phone', 'location', 'totalExperience'):
        check(getattr(profile, name), source)
    for name in ('skills', 'jobTitles', 'certifications', 'domains', 'languages'):
        for value in getattr(profile, name):
            check(value, source)
    for entry in [*profile.experiences, *profile.education, *profile.projects]:
        quotes = []
        for evidence in entry.evidence:
            if evidence.pageNumber > len(pages):
                raise ValueError('Evidence page is outside the resume.')
            check(evidence.text, normalized(pages[evidence.pageNumber - 1].text))
            quotes.append(evidence.text)
        context = normalized('\n'.join(quotes))
        for name, value in entry.model_dump(exclude={'evidence'}).items():
            for item in value if isinstance(value, list) else [value]:
                check(item, context)
    return profile
