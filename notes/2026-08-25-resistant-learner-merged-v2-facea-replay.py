import json, glob, re, os, sys

ROOT = '/Users/lmagee/Dev/machinespirits/machinespirits-eval-private/artifacts/tutor-stub-live/resistant-learner-merged-calibration-v2-2026-08-25'

STOP = set('''a an the and or but if then else of in on at to from by with for as is are was were be been being it its this that these those you your i my we our they their he she his her not no nor so than too very can could may might must shall should will would do does did done have has had having there here what which who whom whose when where why how all any both each few more most other some such only own same s t don now'''.split())

def tokens(text):
    text = text.lower()
    text = re.sub(r'[‘’“”—–]', ' ', text)
    words = re.findall(r'[a-z]+', text)
    return [w for w in words if len(w) >= 3 and w not in STOP]

def planted_corpus(job_dir):
    """Extract rival objective + open nodes + bridges from the first learner model_call prompt."""
    for p in sorted(glob.glob(job_dir + '/traces/*.jsonl')):
        for line in open(p):
            try: e = json.loads(line)
            except: continue
            if e.get('type') == 'model_call' and (e.get('seat') or e.get('role')) == 'tutor_stub_auto_learner':
                def texts(o):
                    if isinstance(o, str): yield o
                    elif isinstance(o, dict):
                        for v in o.values(): yield from texts(v)
                    elif isinstance(o, list):
                        for v in o: yield from texts(v)
                for t in texts(e):
                    if 'Rival objective:' in t:
                        m = re.search(r'Rival objective:(.*?)(?:\n\nBehavior:|\nBehavior:)', t, re.S)
                        block = m.group(1) if m else ''
                        return block
    return ''

def main():
    rep = json.load(open(ROOT + '/report.json'))
    rows = [r for r in rep['rows'] if r['job']['face_id'] == 'faceA']
    split_summary = []
    agreed_summary = []
    for r in sorted(rows, key=lambda x: x['job']['id']):
        jid = r['job']['id']
        jdir = ROOT + '/jobs/' + jid
        tr = json.load(open(jdir + '/transcript.json'))
        tutor_text = ' '.join(u.get('tutor') or '' for u in tr['turns'])
        planted = planted_corpus(jdir)
        planted_tok = set(tokens(planted))
        tutor_tok = set(tokens(tutor_text))
        prim = r['outcome']['primary']
        fld = prim['fields']['final_graded_engagement_rung']
        votes = fld.get('vote_counts')
        status = fld.get('status')
        seats = prim.get('seats', [])
        quote_reports = []
        for s in seats:
            v = s.get('validation', {}).get('fields', {}).get('final_graded_engagement_rung', {})
            rung = v.get('value')
            evid = v.get('evidence', [])
            for q in evid:
                qt = q.get('text', '')
                toks = tokens(qt)
                uniq = set(toks)
                p_only = uniq & planted_tok - tutor_tok
                t_only = uniq & tutor_tok - planted_tok
                both = uniq & tutor_tok & planted_tok
                novel = uniq - tutor_tok - planted_tok
                quote_reports.append({
                    'judge': s['judge_id'], 'rung': rung, 'src': q.get('source_id'),
                    'n_tokens': len(uniq),
                    'planted_only': len(p_only), 'tutor_only': len(t_only),
                    'both': len(both), 'novel': len(novel),
                    'novel_tokens': sorted(novel),
                    'quote': qt[:140],
                })
        entry = {'job': jid, 'status': status, 'votes': votes, 'quotes': quote_reports}
        if status == 'determinate':
            agreed_summary.append(entry)
        else:
            split_summary.append(entry)

    def show(entries, title):
        print('=' * 90)
        print(title)
        for e in entries:
            print(f"\n{e['job']}  votes={e['votes']}")
            for q in e['quotes']:
                print(f"  [{q['judge']} rung={q['rung']} src={q['src']}] tokens={q['n_tokens']} planted_only={q['planted_only']} tutor_only={q['tutor_only']} both={q['both']} novel={q['novel']}")
                print(f"    novel: {q['novel_tokens']}")
                print(f"    quote: {q['quote']}")

    show(split_summary, f'SPLIT ROWS ({len(split_summary)})')
    show(agreed_summary, f'AGREED ROWS ({len(agreed_summary)})')

main()
