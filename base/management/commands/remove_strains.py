import os

import numpy as np
from django.core.management.base import BaseCommand, CommandError
from django.db import connection, transaction

import base
from base import strain_removal
from base.models import Dataset, Strain, StrainData


class Command(BaseCommand):
    help = ('Remove strains from a dataset: query/array/correlation-axis membership, their StrainData rows, '
            'the matching score/p-value/correlation columns of all other rows, and the static visualization '
            'files in the git source copy (base/static/visualization/<dataset>); the collected STATIC_ROOT copy '
            'is left to collectstatic. Strain rows themselves are kept. Dry run unless --apply is given.')

    def add_arguments(self, parser):
        parser.add_argument('dataset', help='Dataset name, e.g. Living')
        parser.add_argument('boonelab_ids', nargs='+', help='Boonelab strain ids, e.g. tsq2250')
        parser.add_argument('--apply', action='store_true', help='Actually modify the database and static files')
        parser.add_argument('--static-dir', help='Override the directory to edit (default: base/static/visualization/<dataset> in the source tree)')
        parser.add_argument('--skip-db', action='store_true', help='Only process the static files')
        parser.add_argument('--skip-static', action='store_true', help='Only process the database')

    def handle(self, *args, **options):
        ds = Dataset.objects.get(name__iexact=options['dataset'])
        strains = list(Strain.objects.filter(boonelab_id__in=options['boonelab_ids']))
        missing = set(options['boonelab_ids']) - {s.boonelab_id for s in strains}
        if missing:
            raise CommandError('Unknown strains: %s' % ', '.join(sorted(missing)))
        ids = {s.id for s in strains}
        apply_ = options['apply']
        self.stdout.write('%s run on dataset %s, strains: %s' % (
            'APPLY' if apply_ else 'DRY', ds.name, ', '.join('%s (%s)' % (s.boonelab_id, s.basic_id()) for s in strains)))

        if not options['skip_db']:
            self._db(ds, ids, apply_)
        if not options['skip_static']:
            static_dir = options['static_dir'] or os.path.join(
                os.path.dirname(os.path.abspath(base.__file__)), 'static', 'visualization', ds.name)
            if not os.path.isdir(static_dir):
                raise CommandError('Static directory not found: %s' % static_dir)
            self.stdout.write('Static directory: %s' % static_dir)
            strain_removal.apply(static_dir, ids, dry_run=not apply_, log=self.stdout.write)

    def _db(self, ds, ids, apply_):
        def axis(rel):
            return list(rel.through.objects.filter(dataset=ds).order_by('id').values_list('id', 'strain_id'))

        q_axis, a_axis, c_axis = axis(ds.queries), axis(ds.arrays), axis(ds.correlation_axis)
        q_cols = [i for i, (_, s) in enumerate(q_axis) if s in ids]
        a_cols = [i for i, (_, s) in enumerate(a_axis) if s in ids]
        c_cols = [i for i, (_, s) in enumerate(c_axis) if s in ids]
        self.stdout.write('Axis columns to delete: queries %s of %d, arrays %s of %d, correlation axis %s of %d' % (
            q_cols, len(q_axis), a_cols, len(a_axis), c_cols, len(c_axis)))

        rows = StrainData.objects.filter(dataset=ds)
        own = rows.filter(strain_id__in=ids)
        self.stdout.write('StrainData rows to delete: %d' % own.count())

        # Query rows' scores run over the array axis, array rows' scores over the query axis
        plan = {StrainData.TYPE_QUERY: a_cols, StrainData.TYPE_ARRAY: q_cols}
        expected = {StrainData.TYPE_QUERY: len(a_axis), StrainData.TYPE_ARRAY: len(q_axis)}

        def check(sd):
            if len(sd.scores) != expected[sd.type] or len(sd.pvalues) != expected[sd.type] or \
                    (sd.correlations is not None and len(sd.correlations) != len(c_axis)):
                raise CommandError('Array length mismatch in %s, refusing to touch it' % sd)

        if not apply_:
            # Cheap check in SQL, so a dry run does not download every array
            with connection.cursor() as cur:
                cur.execute('SELECT type, array_length(scores, 1), array_length(pvalues, 1), '
                            'array_length(correlations, 1), count(*) FROM base_straindata '
                            'WHERE dataset_id = %s AND strain_id <> ALL(%s) GROUP BY 1, 2, 3, 4',
                            [ds.pk, list(ids)])
                groups = cur.fetchall()
            for typ, ns, npv, nc, cnt in groups:
                if ns != expected[typ] or npv != expected[typ] or nc not in (None, len(c_axis)):
                    raise CommandError('Array length mismatch in %d %s rows (%s, %s, %s)' % (cnt, typ, ns, npv, nc))
                self.stdout.write('  type %s: %d rows, scores %d -> %d, correlations %s' % (
                    typ, cnt, ns, ns - len(plan[typ]), nc is None and 'none' or '%d -> %d' % (nc, nc - len(c_cols))))
            self.stdout.write('Lengths verified. Nothing changed (use --apply).')
            return

        with transaction.atomic():
            own.delete()
            changed = 0
            for sd in rows.exclude(strain_id__in=ids).iterator():
                check(sd)
                fields = []
                cols = plan[sd.type]
                if cols:
                    sd.scores = np.delete(np.asarray(sd.scores), cols).tolist()
                    sd.pvalues = np.delete(np.asarray(sd.pvalues), cols).tolist()
                    fields += ['scores', 'pvalues']
                if c_cols and sd.correlations is not None:
                    sd.correlations = np.delete(np.asarray(sd.correlations), c_cols).tolist()
                    fields.append('correlations')
                if fields:
                    sd.save(update_fields=fields)
                    changed += 1
            for rel, axis_rows, cols in ((ds.queries, q_axis, q_cols), (ds.arrays, a_axis, a_cols),
                                         (ds.correlation_axis, c_axis, c_cols)):
                rel.through.objects.filter(pk__in=[axis_rows[i][0] for i in cols]).delete()
            self.stdout.write('Rewrote %d StrainData rows, removed axis memberships.' % changed)
