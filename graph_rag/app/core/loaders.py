# app/core/loaders.py
import requests
from bs4 import BeautifulSoup
from io import BytesIO
import fitz

def extract_text_from_url(url: str) -> str:
    res = requests.get(url, timeout=15)
    res.raise_for_status()

    soup = BeautifulSoup(res.text, "html.parser")
    for tag in soup(["script", "style", "noscript"]):
        tag.decompose()

    return soup.get_text(separator=" ", strip=True)


def extract_text_from_pdf(pdf_url: str) -> str:
    res = requests.get(pdf_url, timeout=20)
    res.raise_for_status()

    doc = fitz.open(stream=res.content, filetype="pdf")
    pages = [page.get_text() for page in doc]

    return "\n".join(pages)
