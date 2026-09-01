import json, gzip, sys
def load(path):
    op = gzip.open if path.endswith('.gz') else open
    turns = {}; pressure = {}; plants = {}
    with op(path, 'rt') as f:
        for line in f:
            try: e = json.loads(line)
            except: continue
            t = e.get('type')
            if t == 'turn_complete':
                r = e['turnRecord']; turns[r['turn']] = {'turn': r['turn'], 'learner': r.get('learner',''), 'tutor': r.get('tutor','')}
            elif t == 'tutor_manner_switch':
                pressure[e.get('turn')] = e.get('pressure')
            elif t == 'learner_stress_plant':
                plants[e.get('turn')] = e.get('state')
    out = []
    for k in sorted(turns):
        row = turns[k]
        if k in pressure: row['detected'] = pressure[k]
        if k in plants: row['planted'] = plants[k]
        out.append(row)
    return out
src, dst = sys.argv[1], sys.argv[2]
json.dump(load(src), open(dst,'w'), ensure_ascii=False)
print(dst, len(json.load(open(dst))), 'turns')
