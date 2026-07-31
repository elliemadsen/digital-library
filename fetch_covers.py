"""
Offline script to download book cover images from the Open Library Covers API
and save them into covers/ so the site can serve them from GitHub instead of
hitting the Open Library API on every page load.

Usage:
    python3 fetch_covers.py

Re-run any time the Google Sheet gets new books; existing covers are skipped.
"""
import json
import time
import urllib.error
import urllib.request
from pathlib import Path

SHEET_ID = "1moYiL52ZN9F20QZ-uYoO91Bh3AtkJYEoNcyv6MuRI2Y"
SHEET_RANGE = "Sheet1"
API_KEY = "AIzaSyAGQtw4Jdd-BCe6-8PIRfUeQp8lwKJurfE"

COVERS_DIR = Path(__file__).parent / "covers"
USER_AGENT = "digital-library-cover-fetcher (https://github.com/elliemadsen/digital-library)"

# Open Library returns a small grey placeholder image (rather than a 404)
# when it has no cover for an ISBN. Treat anything this small as "no cover".
MIN_VALID_COVER_BYTES = 1000


def fetch_isbns():
    url = (
        f"https://sheets.googleapis.com/v4/spreadsheets/{SHEET_ID}"
        f"/values/{SHEET_RANGE}?key={API_KEY}"
    )
    with urllib.request.urlopen(url) as response:
        rows = json.load(response)["values"]

    headers = [h.strip() for h in rows[0]]
    isbn_index = headers.index("isbn")

    isbns = {row[isbn_index].strip() for row in rows[1:] if len(row) > isbn_index and row[isbn_index].strip()}
    return sorted(isbns)


def download_cover(isbn):
    dest = COVERS_DIR / f"{isbn}.jpg"
    if dest.exists():
        return "skipped"

    url = f"https://covers.openlibrary.org/b/isbn/{isbn}-L.jpg"
    request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    try:
        with urllib.request.urlopen(request) as response:
            data = response.read()
    except urllib.error.HTTPError as e:
        print(f"  {isbn}: HTTP {e.code}, skipping")
        return "missing"

    if len(data) < MIN_VALID_COVER_BYTES:
        print(f"  {isbn}: no cover available (placeholder image), skipping")
        return "missing"

    dest.write_bytes(data)
    return "downloaded"


def main():
    COVERS_DIR.mkdir(exist_ok=True)
    isbns = fetch_isbns()
    print(f"Found {len(isbns)} unique ISBNs in sheet")

    counts = {"downloaded": 0, "skipped": 0, "missing": 0}
    for isbn in isbns:
        result = download_cover(isbn)
        counts[result] += 1
        if result == "downloaded":
            print(f"  {isbn}: downloaded")
            time.sleep(0.2)  # be polite to Open Library

    print(f"\nDone. downloaded={counts['downloaded']} skipped={counts['skipped']} missing={counts['missing']}")


if __name__ == "__main__":
    main()
