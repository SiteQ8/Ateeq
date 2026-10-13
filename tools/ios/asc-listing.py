#!/usr/bin/env python3
"""يملأ صفحة عتيق في App Store من مجلد appstore/listings، ويُعدّ إصدارًا جديدًا ويرسله للمراجعة.

    ASC_KEY_ID=... ASC_ISSUER_ID=... ASC_KEY_P8='<contents>' python3 tools/ios/asc-listing.py \\
        [--version 1.1.0] [--build 7] [--submit]

لكل لغة في appstore/listings يضع العنوان الفرعي، ثم إن أُعطي --version وجد ذلك الإصدار أو
أنشأه، ووضع فيه الوصف والكلمات المفتاحية والنص الترويجي وما الجديد لكل لغة، ثم إن أُعطي
--build ربط الحزمة التي رقمها ذاك بالإصدار متى انتهت App Store Connect من معالجتها، وإن
أُعطي --submit أرسل الإصدار للمراجعة. وبلا --version لا يتغيّر إلا العنوان الفرعي.

Env: ASC_KEY_ID, ASC_ISSUER_ID, ASC_KEY_P8 (or ASC_KEY_FILE), APP_ID (defaults to Ateeq's)
Needs: pip install pyjwt cryptography requests
"""
import argparse
import os
import sys
import time
from pathlib import Path

import jwt
import requests

API = 'https://api.appstoreconnect.apple.com/v1'
ROOT = Path(__file__).resolve().parent.parent.parent
LISTINGS = ROOT / 'appstore/listings'
APP = os.environ.get('APP_ID', '6816854571')
KEY_ID = os.environ.get('ASC_KEY_ID', '')
ISSUER = os.environ.get('ASC_ISSUER_ID', '')
KEY = os.environ.get('ASC_KEY_P8') or (Path(os.environ['ASC_KEY_FILE']).read_text() if os.environ.get('ASC_KEY_FILE') else '')
LIMITS = {'subtitle': 30, 'keywords': 100, 'promotional_text': 170, 'description': 4000, 'whats_new': 4000}
FIELDS = {'description': 'description', 'keywords': 'keywords', 'promotional_text': 'promotionalText', 'whats_new': 'whatsNew'}


def token():
    now = int(time.time())
    return jwt.encode({'iss': ISSUER, 'iat': now, 'exp': now + 900, 'aud': 'appstoreconnect-v1'}, KEY,
                      algorithm='ES256', headers={'kid': KEY_ID, 'typ': 'JWT'})


def call(method, path, body=None, params=None):
    r = requests.request(method, API + path, params=params, json=body, timeout=60,
                         headers={'Authorization': f'Bearer {token()}', 'Content-Type': 'application/json'})
    if r.status_code >= 400:
        sys.exit(f'{method} {path} -> {r.status_code}: {r.text[:900]}')
    return r.json() if r.text else {}


def texts(loc):
    out = {}
    for f in sorted((LISTINGS / loc).glob('*.txt')):
        s = f.read_text(encoding='utf-8').strip()
        if len(s) > LIMITS[f.stem]:
            sys.exit(f'{loc} {f.stem} أطول من {LIMITS[f.stem]} حرفًا')
        out[f.stem] = s
    return out


def subtitles(locales):
    """العنوان الفرعي يعيش في appInfo، وإن كان للتطبيق نسخة قيد الإعداد فهي التي تُحرَّر."""
    infos = call('GET', f'/apps/{APP}/appInfos', params={'fields[appInfos]': 'state'})['data']
    editable = [i for i in infos if i['attributes']['state'] not in ('READY_FOR_DISTRIBUTION', 'READY_FOR_SALE')] or infos
    info = editable[0]['id']
    have = {l['attributes']['locale']: l for l in call('GET', f'/appInfos/{info}/appInfoLocalizations')['data']}
    for loc in locales:
        sub = texts(loc).get('subtitle')
        if not sub:
            continue
        if loc in have:
            if have[loc]['attributes'].get('subtitle') != sub:
                call('PATCH', f"/appInfoLocalizations/{have[loc]['id']}",
                     {'data': {'type': 'appInfoLocalizations', 'id': have[loc]['id'], 'attributes': {'subtitle': sub}}})
        else:
            call('POST', '/appInfoLocalizations', {'data': {'type': 'appInfoLocalizations', 'attributes': {'locale': loc, 'subtitle': sub},
                                                            'relationships': {'appInfo': {'data': {'type': 'appInfos', 'id': info}}}}})
        print(loc, 'العنوان الفرعي:', sub)


def version(number):
    found = call('GET', f'/apps/{APP}/appStoreVersions', params={'filter[versionString]': number, 'filter[platform]': 'IOS',
                                                                 'fields[appStoreVersions]': 'versionString,appStoreState'})['data']
    if found:
        v = found[0]
        print('الإصدار', number, 'موجود:', v['attributes']['appStoreState'])
        return v['id']
    v = call('POST', '/appStoreVersions', {'data': {'type': 'appStoreVersions',
                                                    'attributes': {'platform': 'IOS', 'versionString': number, 'releaseType': 'AFTER_APPROVAL'},
                                                    'relationships': {'app': {'data': {'type': 'apps', 'id': APP}}}}})['data']
    print('أُنشئ الإصدار', number)
    return v['id']


def version_texts(vid, locales):
    have = {l['attributes']['locale']: l for l in call('GET', f'/appStoreVersions/{vid}/appStoreVersionLocalizations')['data']}
    for loc in locales:
        attrs = {FIELDS[k]: v for k, v in texts(loc).items() if k in FIELDS}
        if loc in have:
            call('PATCH', f"/appStoreVersionLocalizations/{have[loc]['id']}",
                 {'data': {'type': 'appStoreVersionLocalizations', 'id': have[loc]['id'], 'attributes': attrs}})
        else:
            attrs['locale'] = loc
            call('POST', '/appStoreVersionLocalizations', {'data': {'type': 'appStoreVersionLocalizations', 'attributes': attrs,
                                                                   'relationships': {'appStoreVersion': {'data': {'type': 'appStoreVersions', 'id': vid}}}}})
        print(loc, 'نصوص الإصدار:', ', '.join(sorted(attrs)))


def attach_build(vid, number, wait):
    """تنتظر الحزمة حتى تنتهي معالجتها ثم تربطها بالإصدار."""
    deadline = time.time() + wait * 60
    while True:
        builds = call('GET', '/builds', params={'filter[app]': APP, 'filter[version]': number, 'fields[builds]': 'version,processingState,expired'})['data']
        ready = [b for b in builds if b['attributes']['processingState'] == 'VALID' and not b['attributes']['expired']]
        if ready:
            call('PATCH', f'/appStoreVersions/{vid}/relationships/build', {'data': {'type': 'builds', 'id': ready[0]['id']}})
            print('رُبطت الحزمة', number, 'بالإصدار')
            return
        state = builds[0]['attributes']['processingState'] if builds else 'لم تصل بعد'
        if time.time() > deadline:
            sys.exit(f'الحزمة {number} غير جاهزة: {state}')
        print('الحزمة', number, state, '| انتظار')
        time.sleep(60)


def submit(vid):
    open_ones = call('GET', '/reviewSubmissions', params={'filter[app]': APP, 'filter[state]': 'READY_FOR_REVIEW,WAITING_FOR_REVIEW,IN_REVIEW,UNRESOLVED_ISSUES'})['data']
    if open_ones:
        sys.exit('هناك إرسال مفتوح للمراجعة بالفعل: ' + open_ones[0]['attributes']['state'])
    sub = call('POST', '/reviewSubmissions', {'data': {'type': 'reviewSubmissions', 'attributes': {'platform': 'IOS'},
                                                      'relationships': {'app': {'data': {'type': 'apps', 'id': APP}}}}})['data']['id']
    call('POST', '/reviewSubmissionItems', {'data': {'type': 'reviewSubmissionItems',
                                                     'relationships': {'reviewSubmission': {'data': {'type': 'reviewSubmissions', 'id': sub}},
                                                                       'appStoreVersion': {'data': {'type': 'appStoreVersions', 'id': vid}}}}})
    call('PATCH', f'/reviewSubmissions/{sub}', {'data': {'type': 'reviewSubmissions', 'id': sub, 'attributes': {'submitted': True}}})
    print('أُرسل الإصدار للمراجعة')


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--version')
    ap.add_argument('--build', help='رقم الحزمة كما تعدّه App Store Connect')
    ap.add_argument('--wait', type=int, default=40, help='دقائق انتظار معالجة الحزمة')
    ap.add_argument('--submit', action='store_true')
    a = ap.parse_args()
    if not (KEY_ID and ISSUER and KEY):
        sys.exit('ASC_KEY_ID و ASC_ISSUER_ID و ASC_KEY_P8 مطلوبة في البيئة')
    locales = sorted(p.name for p in LISTINGS.iterdir() if p.is_dir())
    vid = version(a.version) if a.version else None
    subtitles(locales)
    if vid:
        version_texts(vid, locales)
        if a.build:
            attach_build(vid, a.build, a.wait)
        if a.submit:
            submit(vid)


if __name__ == '__main__':
    main()
