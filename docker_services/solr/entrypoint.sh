#!/bin/bash

set -o pipefail -e

# Ensure the signature file at least exists for the following comparison
SIGFILE=/opt/solr/server/solr/signature.txt
touch $SIGFILE

# Check the solr core definitions
if ! tar -cf - -C /tmp/cores . | tee /tmp/cores.tar | sha256sum -c $SIGFILE; then
    # if the SHA-256 hash did not match, write the new hash to the signature file
    sha256sum < /tmp/cores.tar > $SIGFILE
    # copy the new core configs
    tar -xf /tmp/cores.tar -C /opt/solr/server/solr/
    # duplicate the core configs to create the swap versions
    cd /tmp/cores
    BASE="/opt/solr/server/solr"
    # loop over the names in the loaded cores
    for NAME in *; do
        SWAP="${BASE}/${NAME}_swap"
        # if the swap version of core does not exist, make it
        if [ ! -d "${SWAP}" ]; then
            # create swap core directory
            mkdir "${SWAP}"
            # symlink config to the primary core config
            ln -s "../${NAME}/conf" "${SWAP}"
            # write the core.properties file
            echo "name=${NAME}_swap" > "${SWAP}/core.properties"
        fi
    done
fi

# start solr
exec /opt/solr/bin/solr start -f
