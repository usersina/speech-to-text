# Local inference server for Qwen3-ASR-1.7B

> FIXME: Pin version once https://github.com/huggingface/transformers/pull/43838 is merged and released

This folder contains a minimal FastAPI server that hosts a Hugging Face ASR model locally.

Quick start

1. Create and activate a Python virtual environment:

```bash
uv venv
source .venv/bin/activate
```

2. Install the remaining requirements:

```bash
uv sync --all-extras
```

3. Provide a Hugging Face token if the model requires it (recommended). Create a `.env` or export `HF_TOKEN`:

```bash
HF_TOKEN=hf_xxx
HF_MODEL=Qwen/Qwen3-ASR-1.7B
```

5. Run the server from repository root:

```bash
poe start
```

Testing the API

- Quick curl test (multipart file field named `file`):

```bash
curl -v -F "file=@sample/harvard.wav" http://127.0.0.1:8000/transcribe
```

- Example Python client using `requests`:

```python
import requests

files = {"file": open("sample/harvard.wav", "rb")}
resp = requests.post("http://127.0.0.1:8000/transcribe", files=files)
print(resp.json())
```

Expected response format:

```json
{ "text": "...transcribed text..." }
```

Notes

- Supported audio formats depend on your model and `soundfile`; convert if necessary with `ffmpeg`:

```bash
ffmpeg -i input.mp3 -ar 16000 -ac 1 output.wav
```

- If the model is large, the first request may take extra time while the model loads.

API

- POST /transcribe — multipart form file field named `file`. Returns JSON `{ "text": "..." }`.

Notes

- The model is large; loading requires sufficient RAM/VRAM.
- If you have a GPU, install a matching `torch` with CUDA to enable GPU inference.
- If you run into heavy dependency or binary issues, consider using the Hugging Face Inference API instead.
