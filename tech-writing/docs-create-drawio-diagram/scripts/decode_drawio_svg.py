#!/usr/bin/env python3
"""Extract the editable mxGraphModel XML out of a .drawio.svg (or .drawio) file.

The rendered SVG body is a throwaway export artifact — the real diagram
source lives in the root <svg content="..."> attribute as an <mxfile>
whose <diagram> payload is URL-encoded, raw-deflate-compressed, base64
text (plain child XML for uncompressed saves). Edit the XML this script
prints, then rebuild the asset with export_drawio_svg.py.
"""

import argparse
import base64
import html
import re
import sys
import urllib.parse
import zlib


def extract_mxfile(text: str) -> str:
    if text.lstrip().startswith('<mxfile'):
        return text
    m = re.search(r'content="([^"]*)"', text)
    if not m:
        sys.exit('error: no <mxfile> found — file has no drawio content attribute')
    return html.unescape(m.group(1))


def extract_model(mxfile: str) -> str:
    compressed = re.search(r'<diagram[^>]*>([^<]+)</diagram>', mxfile)
    if compressed:
        payload = compressed.group(1).strip()
        raw = zlib.decompress(base64.b64decode(payload), -15)
        return urllib.parse.unquote(raw.decode('utf-8'))
    plain = re.search(r'<diagram[^>]*>(.*)</diagram>', mxfile, re.S)
    if plain:
        return plain.group(1).strip()
    sys.exit('error: no <diagram> payload inside the mxfile')


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('source', help='.drawio.svg or .drawio file')
    parser.add_argument('-o', '--out', help='write XML here instead of stdout')
    args = parser.parse_args()

    with open(args.source, encoding='utf-8') as f:
        model = extract_model(extract_mxfile(f.read()))

    if args.out:
        with open(args.out, 'w', encoding='utf-8') as f:
            f.write(model)
        cells = len(re.findall(r'<mxCell', model))
        print(f'{args.out}: {cells} cells')
    else:
        print(model)


if __name__ == '__main__':
    main()
