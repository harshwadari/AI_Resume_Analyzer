from typing import Annotated
from pydantic import BaseModel, ConfigDict, Field, model_validator

Text = Annotated[str, Field(min_length=1, max_length=500, pattern=r'\S')]
Items = Annotated[list[Text], Field(max_length=50)]
Years = Annotated[float, Field(ge=0, le=100, allow_inf_nan=False)]


class Requirements(BaseModel):
    model_config = ConfigDict(extra='forbid', strict=True)
    title: Text | None
    requiredSkills: Items
    preferredSkills: Items
    minimumExperience: Years | None
    maximumExperience: Years | None
    education: Items
    certifications: Items
    responsibilities: Items
    domain: Text | None
    location: Text | None
    employmentType: Text | None

    @model_validator(mode='after')
    def check_range(self):
        if self.minimumExperience is not None and self.maximumExperience is not None:
            if self.minimumExperience > self.maximumExperience:
                raise ValueError('Invalid experience range')
        return self


class ExtractionRequest(BaseModel):
    model_config = ConfigDict(extra='forbid', strict=True)
    rawJDText: Annotated[str, Field(min_length=100, max_length=20000)]

    @model_validator(mode='after')
    def check_content(self):
        if len(self.rawJDText.strip()) < 100:
            raise ValueError('Insufficient JD content')
        return self


class ExtractionResponse(BaseModel):
    structuredJD: Requirements
    parserVersion: str
    modelName: str
    extractedAt: str

