# One-off metabolite migration

This folder is meant as a one-off app to apply data from Tyler's scraping of BIGG/PubChem.
To use, merge the branch `one-off/origin/one-off/EDD-643-merge-scraped-pubchem-data-to-edd`
with a local temporary branch, then add `'metabolite'` to the `INSTALLED_APPS` of your
`local.py` settings file. This will allow for the migration to run, and process existing
metabolite metadata. When done, you may revert to the previous branch, and remove the app
from `INSTALLED_APPS`.
