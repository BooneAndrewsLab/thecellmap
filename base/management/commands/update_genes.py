from django.db.transaction import atomic
from intermine.webservice import Service

from base.models import Gene
from base.utils import CellMapCommand, orf_sorting_value


def fetch_from_sgd() -> dict:
    """Query SGD's intermine service and return an up-to-date dict of S. Cerevisiae features (genes).
    Returned is a dictionary of "SGD_ID" -> dict of feature data. Keys in feature data are:
    sgd_id, feature_qualifier, feature_type, orf, name, aliases, chromosome, chromosomal_location, start_coordinate,
    stop_coordinate, description

    :rtype: dict
    """
    service = Service("https://yeastmine.yeastgenome.org:443/yeastmine/service")
    query = service.new_query("Gene")
    query.add_view(
        "primaryIdentifier", "qualifier", "secondaryIdentifier",
        "symbol", "chromosomeLocation.start", "chromosomeLocation.end",
        "description", "synonyms.value"
    )
    query.add_constraint("Gene", "IN", "ALL_Verified_Uncharacterized_Dubious_ORFs", code="A")

    genes = {}

    for row in query.rows():
        sgd_id = row["primaryIdentifier"]
        orf = row["secondaryIdentifier"]

        if orf.startswith('Q'):
            chrom = 0
        else:
            chrom = ord(orf[1]) - 64

        if sgd_id not in genes:
            genes[sgd_id] = {
                'primary_sgdid': row["primaryIdentifier"],
                'feature_qualifier': row["qualifier"],
                'orf': orf,
                'name': row["symbol"] or None,
                'aliases': [],
                'chromosome': chrom,
                'start': row["chromosomeLocation.start"],
                'stop': row["chromosomeLocation.end"],
                'sorting_value': orf_sorting_value(orf),
                'description': row["description"],
            }

        if row["synonyms.value"] not in (orf, row["symbol"]):
            genes[sgd_id]['aliases'].append(row["synonyms.value"])

    return genes


class Command(CellMapCommand):
    help = 'Updates the Gene table SGD\'s intermine portal'

    @atomic
    def handle(self, *args, **options):
        genes = {g.primary_sgdid: g for g in Gene.objects.all()}

        sgd = fetch_from_sgd()

        for sgd_id, gene_data in sgd.items():
            if sgd_id in genes:
                gene = genes[sgd_id]
                updated_data = {}

                for key, val in gene_data.items():
                    old_val = getattr(gene, key)

                    if key is 'aliases':
                        if sorted(old_val) != sorted(val):
                            setattr(gene, key, val)
                            updated_data[key] = val
                    elif old_val != val:
                        setattr(gene, key, val)
                        updated_data[key] = val

                if updated_data:
                    gene.save()
                    print('Updated', gene)
            else:
                #  SGD_ID not found in our database, create a new Gene
                genes[sgd_id] = Gene.objects.create(**gene_data)
                print('Created', genes[sgd_id])
