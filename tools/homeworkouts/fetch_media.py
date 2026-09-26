#!/usr/bin/env python3
"""Fetch the Home Workouts app's exercise clips that the app itself has not cached yet.

The app downloads a clip from Leap's CDN the first time an exercise is started:

    https://resource.leap.app/indexdata/v1/action/<actionId>/<style>/men_white/<version>/data.zip

where <style> and <version> come from the bundle's Resource/Mapping/action_mapping.json
(per action: gym, live, bed, 3d_bed, adriana, pilates, each with a men_white version or -1).
The zip holds videos/video: the MP4 whose first 256 bytes are replaced by 704 bytes of
scrambled text; from byte 256 on it is the plain file. Every clip the app has cached shares
the same 256-byte header apart from the mdat size (bytes 40..43) and two bytes inside the
x264 SEI note that decoders ignore, and the layout is always ftyp(32) free(8) mdat moov,
with moov last. So the header is rebuilt from a template plus mdat = total - 40 - moov.

Stdlib only, Python 3.9. Used by sync.py; can also run by hand:

    python3 fetch_media.py --ids 726 655 --out /tmp/clips
"""
import argparse
import io
import json
import os
import struct
import sys
import tempfile
import time
import urllib.error
import urllib.request
import zipfile

CDN = 'https://resource.leap.app/indexdata/v1/action/%s/%s/men_white/%s/data.zip'
STYLE_ORDER = ('gym', 'live', 'bed', '3d_bed', 'adriana', 'pilates')
SCRAMBLED_LEN = 704     # bytes of scrambled text at the start of videos/video
HEAD_LEN = 256          # bytes of the real MP4 they stand in for
MDAT_SIZE_AT = 40       # ftyp(32) + free(8), then the mdat box size
# The 256-byte header of a cached clip (action 10). Bytes 40..43 are patched per file.
HEAD_TEMPLATE = bytes.fromhex('000000206674797069736f6d0000020069736f6d69736f32617663316d70343100000008667265650024af9c6d6461740000027f0605ffff7bdc45e9bde6d948b7962cd820d923eeef78323634202d20636f7265203135352072323930312037643066663232202d20482e3236342f4d5045472d342041564320636f646563202d20436f70796c65667420323030332d32303138202d20687474703a2f2f7777772e766964656f6c616e2e6f72672f783236342e68746d6c202d206f7074696f6e733a2063616261633d31207265663d33206465626c6f636b3d313a303a3020616e616c7973653d3078333a3078313133206d653d686578207375626d653d37')
DEFAULT_MAPPING = '/Applications/Home Workouts.app/Wrapper/homeworkout.app/Resource/Mapping/action_mapping.json'


class FetchError(Exception):
    pass


def load_mapping(path=DEFAULT_MAPPING):
    with open(path, 'rb') as f:
        items = json.load(f)
    return {str(x.get('action_id')): x for x in items if isinstance(x, dict) and x.get('action_id') is not None}


def pick_source(mapping, action_id):
    """(style, version) of the first style that has a men_white clip, or None."""
    entry = mapping.get(str(action_id))
    if not entry:
        return None
    for style in STYLE_ORDER:
        v = (entry.get(style) or {}).get('men_white')
        if isinstance(v, int) and v >= 0:
            return style, v
    return None


def walk_boxes(data):
    """Top-level MP4 boxes as [(type, size)]; raises FetchError when they do not tile the file."""
    boxes = []
    off = 0
    while off + 8 <= len(data):
        size, typ = struct.unpack('>I4s', data[off:off + 8])
        if size < 8:
            raise FetchError('box %r at %d has size %d' % (typ, off, size))
        boxes.append((typ.decode('latin1'), size))
        off += size
    if off != len(data):
        raise FetchError('boxes end at %d, file is %d bytes' % (off, len(data)))
    return boxes


def rebuild(blob):
    """videos/video from the CDN zip -> a playable MP4."""
    if len(blob) <= SCRAMBLED_LEN:
        raise FetchError('clip is only %d bytes' % len(blob))
    body = blob[SCRAMBLED_LEN:]
    total = HEAD_LEN + len(body)
    i = body.rfind(b'moov')
    if i < 4:
        raise FetchError('no moov box in the tail')
    moov_size = struct.unpack('>I', body[i - 4:i])[0]
    moov_off = HEAD_LEN + i - 4
    if moov_off + moov_size != total:
        raise FetchError('moov at %d size %d does not end the %d-byte file' % (moov_off, moov_size, total))
    mdat_size = moov_off - MDAT_SIZE_AT
    if mdat_size <= 8:
        raise FetchError('mdat size %d' % mdat_size)
    head = bytearray(HEAD_TEMPLATE)
    head[MDAT_SIZE_AT:MDAT_SIZE_AT + 4] = struct.pack('>I', mdat_size)
    out = bytes(head) + body
    boxes = walk_boxes(out)
    if [b[0] for b in boxes] != ['ftyp', 'free', 'mdat', 'moov']:
        raise FetchError('unexpected box layout %r' % boxes)
    return out


def download(url, timeout=30):
    req = urllib.request.Request(url, headers={'User-Agent': 'PlannerHomeWorkouts/1.0'})
    last = None
    for _attempt in range(2):
        try:
            with urllib.request.urlopen(req, timeout=timeout) as r:
                return r.read()
        except (urllib.error.URLError, urllib.error.HTTPError, OSError) as e:
            last = e
            time.sleep(1.0)
    raise FetchError('%s: %s' % (url, last))


def fetch_one(action_id, mapping, out_dir):
    src = pick_source(mapping, action_id)
    if not src:
        raise FetchError('action %s has no men_white clip in action_mapping.json' % action_id)
    style, version = src
    data = download(CDN % (action_id, style, version))
    try:
        with zipfile.ZipFile(io.BytesIO(data)) as z:
            blob = z.read('videos/video')
    except (zipfile.BadZipFile, KeyError) as e:
        raise FetchError('action %s: bad zip (%s)' % (action_id, e))
    clip = rebuild(blob)
    os.makedirs(out_dir, exist_ok=True)
    fd, tmp = tempfile.mkstemp(prefix='.clip-', suffix='.mp4', dir=out_dir)
    with os.fdopen(fd, 'wb') as f:
        f.write(clip)
    os.replace(tmp, os.path.join(out_dir, '%s.mp4' % action_id))
    return style, version, len(clip)


def fetch_missing(action_ids, out_dir, mapping=None, limit=80, pause=0.4, log=None):
    """Download every listed action's clip that is not in out_dir yet. Returns
    (fetched, skipped_existing, failed); failures are logged, never raised."""
    log = log or (lambda s: None)
    mapping = mapping if mapping is not None else load_mapping()
    fetched = skipped = failed = 0
    for action_id in sorted({str(a) for a in action_ids if str(a).isdigit()}, key=int):
        if os.path.exists(os.path.join(out_dir, '%s.mp4' % action_id)):
            skipped += 1
            continue
        if fetched + failed >= limit:
            log('fetch cap of %d reached; the rest wait for the next run' % limit)
            break
        try:
            style, version, size = fetch_one(action_id, mapping, out_dir)
            fetched += 1
            log('fetched %s (%s v%s, %d bytes)' % (action_id, style, version, size))
        except FetchError as e:
            failed += 1
            log('failed %s: %s' % (action_id, e))
        time.sleep(pause)
    return fetched, skipped, failed


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__.split('\n')[0])
    ap.add_argument('--ids', nargs='+', required=True, help='action ids')
    ap.add_argument('--out', required=True, help='directory for <id>.mp4')
    ap.add_argument('--mapping', default=DEFAULT_MAPPING)
    args = ap.parse_args(argv)
    fetched, skipped, failed = fetch_missing(args.ids, args.out, load_mapping(args.mapping), limit=10000, log=print)
    print('fetched %d, already had %d, failed %d' % (fetched, skipped, failed))
    return 1 if failed and not fetched else 0


if __name__ == '__main__':
    sys.exit(main())
