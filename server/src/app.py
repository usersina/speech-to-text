import os
import tempfile

import uvicorn
from fastapi import FastAPI, File, HTTPException, UploadFile
from pydantic_settings import BaseSettings
from transformers import AutomaticSpeechRecognitionPipeline, pipeline

app = FastAPI()


class Config(BaseSettings):
    HF_MODEL: str = "Qwen/Qwen3-ASR-1.7B"
    HF_TOKEN: str | None = None


settings = Config()
_asr = None


def get_asr() -> AutomaticSpeechRecognitionPipeline:
    global _asr
    if _asr is None:
        kwargs = {}
        if settings.HF_TOKEN:
            kwargs["token"] = settings.HF_TOKEN
        _asr = pipeline("automatic-speech-recognition", model=settings.HF_MODEL, **kwargs)
    return _asr


@app.post("/transcribe")
async def transcribe(file: UploadFile = File(...)) -> dict[str, str | None]:
    filename = file.filename or ""
    suffix = os.path.splitext(filename)[1] or ".wav"
    with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
        tmp.write(await file.read())
        tmp_path = tmp.name
    try:
        asr = get_asr()
        result = asr(tmp_path, generate_kwargs={"do_sample": False})
        text: str | None
        if isinstance(result, dict):
            text_raw = result.get("text")
            if isinstance(text_raw, str):
                text = text_raw
            elif text_raw is None:
                text = None
            else:
                text = str(text_raw)
        else:
            if isinstance(result, str):
                text = result
            else:
                text = str(result)
        return {"text": text}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e
    finally:
        try:
            os.unlink(tmp_path)
        except Exception:
            pass


if __name__ == "__main__":
    uvicorn.run("server.app:app", host="0.0.0.0", port=8000)
