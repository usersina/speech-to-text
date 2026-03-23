import logging
import os
import tempfile
from contextlib import asynccontextmanager
from typing import Any

import torch
import uvicorn
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic_settings import BaseSettings, SettingsConfigDict
from qwen_asr import Qwen3ASRModel

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

_SUPPORTED_EXTENSIONS = {".wav", ".mp3", ".flac", ".ogg", ".m4a", ".webm"}

# Full list of languages supported by Qwen3-ASR
# https://huggingface.co/Qwen/Qwen3-ASR-1.7B
_SUPPORTED_LANGUAGES = {
    "Chinese",
    "English",
    "Cantonese",
    "Arabic",
    "German",
    "French",
    "Spanish",
    "Portuguese",
    "Indonesian",
    "Italian",
    "Korean",
    "Russian",
    "Thai",
    "Vietnamese",
    "Japanese",
    "Turkish",
    "Hindi",
    "Malay",
    "Dutch",
    "Swedish",
    "Danish",
    "Finnish",
    "Polish",
    "Czech",
    "Filipino",
    "Persian",
    "Greek",
    "Hungarian",
    "Macedonian",
    "Romanian",
}


class Config(BaseSettings):
    HF_MODEL: str = "Qwen/Qwen3-ASR-1.7B"
    HF_TOKEN: str | None = None
    model_config = SettingsConfigDict(env_file="../.env", env_file_encoding="utf-8")


settings = Config()
_model: Qwen3ASRModel | None = None


def _load_model() -> Qwen3ASRModel:
    kwargs: dict[str, Any] = {
        "dtype": torch.bfloat16,
        "device_map": "cuda:0" if torch.cuda.is_available() else "cpu",
        "max_new_tokens": 256,
    }
    logger.info("Loading ASR model: %s", settings.HF_MODEL)
    model = Qwen3ASRModel.from_pretrained(settings.HF_MODEL, **kwargs)
    logger.info("ASR model loaded successfully.")
    return model


def get_model() -> Qwen3ASRModel:
    if _model is None:
        raise RuntimeError("ASR model is not initialized. Server may still be starting up.")
    return _model


@asynccontextmanager
async def lifespan(app: FastAPI):  # noqa: ANN201
    global _model
    _model = _load_model()
    yield
    _model = None
    logger.info("ASR model unloaded.")


app = FastAPI(title="Speech-to-Text API", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok", "model": settings.HF_MODEL}


@app.get("/languages")
async def languages() -> dict[str, list[str]]:
    return {"languages": sorted(_SUPPORTED_LANGUAGES)}


@app.post("/transcribe")
async def transcribe(
    file: UploadFile = File(...),
    language: str | None = Form(default=None),
) -> dict[str, str | None]:
    filename = file.filename or ""
    suffix = os.path.splitext(filename)[1].lower() or ".wav"

    if suffix not in _SUPPORTED_EXTENSIONS:
        raise HTTPException(
            status_code=415,
            detail=f"Unsupported file type '{suffix}'. Supported: {sorted(_SUPPORTED_EXTENSIONS)}",
        )

    if language is not None and language not in _SUPPORTED_LANGUAGES:
        raise HTTPException(
            status_code=422,
            detail=f"Unsupported language '{language}'. Supported: {sorted(_SUPPORTED_LANGUAGES)}",
        )

    tmp_path: str | None = None
    try:
        with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
            tmp.write(await file.read())
            tmp_path = tmp.name

        logger.info("Transcribing file: %s (%s) language=%s", filename, suffix, language or "auto")
        results = get_model().transcribe(audio=tmp_path, language=language)
        text = results[0].text if results else None
        detected_language = results[0].language if results else None
        logger.info(
            "Transcription complete. language=%s characters=%d",
            detected_language,
            len(text) if text else 0,
        )
        return {"text": text, "language": detected_language}

    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Transcription failed for file: %s", filename)
        raise HTTPException(status_code=500, detail=str(e)) from e

    finally:
        if tmp_path:
            try:
                os.unlink(tmp_path)
            except OSError:
                logger.warning("Could not delete temp file: %s", tmp_path)


if __name__ == "__main__":
    uvicorn.run("app:app", host="0.0.0.0", port=8000)
