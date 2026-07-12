FROM python:3.13-slim-bookworm
RUN apt-get update && apt-get install -y --no-install-recommends qpdf poppler-utils mupdf-tools tesseract-ocr tesseract-ocr-eng ca-certificates && rm -rf /var/lib/apt/lists/*
RUN useradd --create-home --uid 10001 processor
WORKDIR /app
COPY pipeline.py server.py ./
USER processor
ENV PORT=8788 MAX_INPUT_BYTES=104857600 MAX_PAGES=2000 OCR_CHARACTER_THRESHOLD=40
EXPOSE 8788
CMD ["python", "server.py"]
