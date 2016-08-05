This folder contains the templates used for Haystack search configuration. Haystack *does not*
follow typical Django or Solr naming conventions. The Django convention for templates is to place
files in `{TEMPLATE_SEARCH}/{APP_NAME}/some_file.txt`. Solr names its schema files `schema.xml`.
Instead of the expected layout of `{TEMPLATE_SEARCH}/haystack/configuration/schema.xml` for a base
template of a Solr schema definition, Haystack uses
`{TEMPLATE_SEARCH}/search_configuration/solr.xml`. At least the authors still use the stock
template loader, instead of hard-coding the location to look for templates.
