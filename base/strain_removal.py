"""Remove strains from a dataset's static visualization files.

Pure python (no Django imports) so it can be tested on a copy of the static directory.
"""
import csv
import json
import os
import pickle
import tempfile


def _write_atomic(path, writer, mode='w'):
    fd, tmp = tempfile.mkstemp(dir=os.path.dirname(path), prefix='.tmp_')
    try:
        with os.fdopen(fd, mode) as fp:
            writer(fp)
        os.replace(tmp, path)
    except BaseException:
        if os.path.exists(tmp):
            os.unlink(tmp)
        raise


def _dump_json(path, obj):
    _write_atomic(path, lambda fp: json.dump(obj, fp, separators=(',', ':')))


def _load_pickle(path):
    with open(path, 'rb') as fp:
        return pickle.load(fp, encoding='latin1')


def _dump_pickle(path, obj):
    # protocol 0 matches the existing files (text pickles)
    _write_atomic(path, lambda fp: pickle.dump(obj, fp, protocol=0), mode='wb')


def plan(static_dir, strain_ids):
    """Returns (nodes_to_remove, nodes_inv_new). A node is removed when all its strains are removed."""
    strain_ids = set(strain_ids)
    nodes_inv = _load_pickle(os.path.join(static_dir, 'nodes_inv.pickle'))
    remove, new_inv = set(), {}
    for node, sids in nodes_inv.items():
        left = [s for s in sids if s not in strain_ids]
        if not left:
            remove.add(node)
        else:
            new_inv[node] = left
    return remove, new_inv


def _filter_csv(path, columns, remove):
    """Drop rows whose value in any of `columns` is a removed node. Returns number of dropped rows."""
    dropped = [0]

    def writer(fp):
        with open(path, newline='') as src:
            reader = csv.reader(src)
            out = csv.writer(fp, lineterminator='\n')
            header = next(reader)
            out.writerow(header)
            idx = [header.index(c) for c in columns]
            for row in reader:
                if any(int(row[i]) in remove for i in idx):
                    dropped[0] += 1
                else:
                    out.writerow(row)

    _write_atomic(path, writer)
    return dropped[0]


def apply(static_dir, strain_ids, dry_run=True, log=print):
    remove, new_inv = plan(static_dir, strain_ids)
    log('Nodes to remove: %s' % sorted(remove))
    j = lambda f: os.path.join(static_dir, f)

    nodes_json = json.load(open(j('nodes.json')))
    nodes_pickle = _load_pickle(j('nodes.pickle'))
    layouts = {f: json.load(open(j(f))) for f in ('layout.json', 'layout_uncharacterized.json') if os.path.exists(j(f))}
    corr = json.load(open(j('correlations.json')))
    suppressors = json.load(open(j('suppressors.json'))) if os.path.exists(j('suppressors.json')) else {}

    nodes_json['nodes'] = [n for n in nodes_json['nodes'] if n['id'] not in remove]
    nodes_pickle = [n for n in nodes_pickle if n['id'] not in remove]
    log('nodes.json/nodes.pickle: %d nodes remain' % len(nodes_json['nodes']))
    assert len(nodes_json['nodes']) == len(nodes_pickle) == len(new_inv)

    for f, lay in layouts.items():
        before = len(lay['nodes'])
        lay['nodes'] = [n for n in lay['nodes'] if n['id'] not in remove]
        log('%s: %d -> %d nodes' % (f, before, len(lay['nodes'])))

    before = len(corr['edges'])
    corr['edges'] = [e for e in corr['edges'] if e['s'] not in remove and e['t'] not in remove]
    log('correlations.json: %d -> %d edges' % (before, len(corr['edges'])))

    sid_str = {str(s) for s in strain_ids}
    sup_hits = [k for k in suppressors if k in sid_str]
    for k in sup_hits:
        del suppressors[k]
    log('suppressors.json: %d entries removed' % len(sup_hits))

    if dry_run:
        for f, cols in (('layout.csv', ('source', 'target')), ('safe_layout.csv', ('node',)),
                        ('safe_neighbors.csv', ('node1', 'neighborhood'))):
            if os.path.exists(j(f)):
                with open(j(f), newline='') as src:
                    reader = csv.reader(src)
                    header = next(reader)
                    idx = [header.index(c) for c in cols]
                    n = sum(1 for r in reader if any(int(r[i]) in remove for i in idx))
                log('%s: %d rows would be dropped' % (f, n))
        return remove

    _dump_json(j('nodes.json'), nodes_json)
    _dump_pickle(j('nodes.pickle'), nodes_pickle)
    _dump_pickle(j('nodes_inv.pickle'), new_inv)
    for f, lay in layouts.items():
        _dump_json(j(f), lay)
    _dump_json(j('correlations.json'), corr)
    if suppressors or sup_hits:
        _dump_json(j('suppressors.json'), suppressors)
    for f, cols in (('layout.csv', ('source', 'target')), ('safe_layout.csv', ('node',)),
                    ('safe_neighbors.csv', ('node1', 'neighborhood'))):
        if os.path.exists(j(f)):
            log('%s: %d rows dropped' % (f, _filter_csv(j(f), cols, remove)))
    return remove
