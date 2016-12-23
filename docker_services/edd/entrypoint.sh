#!/bin/bash

set -o pipefail -e

QUIET=0
function output() {
    if [ ! $QUIET -eq 1 ]; then
        echo "$@"
    fi
}

function service_wait() {
    # $1 = service name
    # $2 = service port
    until nc -z "$1" "$2"; do
        output "Waiting for $1 service …"
        sleep 1
    done
}

function print_help() {
    echo "Usage: entrypoint.sh [options] [--] command [arguments]"
    echo "Options:"
    echo "    -h, --help"
    echo "        Print this help message."
    echo "    -q, --quiet"
    echo "        Silence output from this entrypoint script."
    echo "    -a, --init, --init-all"
    echo "        Perform all initialization tasks prior to command start (default)."
    echo "    -A, --no-init, --no-init-all"
    echo "        Skip all initialization tasks; may override with another --init* flag."
    echo "    -s, --init-static"
    echo "        Copy static files to the static volume. Only used to override -A."
    echo "    -S, --no-init-static"
    echo "        Skip initialization of static files."
    echo "    -d, --init-database"
    echo "        Initialize the database using POSTGRES_DUMP_URL or POSTGRES_DUMP_FILE environment."
    echo "        Only used to override -A."
    echo "    -D, --no-init-database"
    echo "        Skip initialization of the database."
    echo "    -m, --init-migration"
    echo "        Run any pending database migrations. Only used to override -A."
    echo "    -M, --no-init-migration"
    echo "        Skip database migrations."
    echo "    -i, --init-index"
    echo "        Re-index search prior to command. Only used to override -A."
    echo "    -I, --no-init-index"
    echo "        Skip search re-indexing."
    echo "    --local file"
    echo "        Copy the file specified to the local.py settings prior to launching the command."
    echo "        This option will be ignored if code is mounted to the container at /code."
    echo "    --force-index"
    echo "        Force re-indexing; this option does not apply if -I is set."
    echo "    -w host, --wait-host host"
    echo "        Wait for a host to begin responding before running commands."
    echo "        This option may be specified multiple times."
    echo "    -p port, --wait-port port"
    echo "        Only applies if -w is used. Specifies port to listen on. Defaults to 24051."
    echo "        This option may be specified multiple times. The Nth port defined applies to the Nth host."
    echo
    echo "Commands:"
    echo "    worker"
    echo "        Start a Celery worker node."
    echo "    application"
    echo "        Start a Django webserver (gunicorn)."
    echo "    devmode"
    echo "        Start a Django webserver (manage.py runserver)."
    echo "    shell"
    echo "        Start a Django shell session (default)."
    echo "    init-only [port]"
    echo "        Container will only perform selected init tasks."
    echo "        The service will begin listening on the specified port after init, default to 24051."
}

short="adhimp:qsw:ADIMS"
long="help,quiet,init,init-all,no-init,no-init-all"
long="$long,init-static,no-init-static,init-database,no-init-database"
long="$long,init-migration,no-init-migration,init-index,no-init-index"
long="$long,local:,force-index,wait-host:,wait-port:"
params=`getopt -o "$short" -l "$long" --name "$0" -- "$@"`
eval set -- "$params"

COMMAND=shell
INIT_STATIC=1
INIT_DB=1
INIT_MIGRATE=1
INIT_INDEX=1
REINDEX_EDD=false
WAIT_HOST=()
WAIT_PORT=()

while [ ! $# -eq 0 ]; do
    case "$1" in
        --help | -h)
            print_help
            exit 0
            ;;
        --quiet | -q)
            shift
            QUIET=1
            ;;
        --init-all | --init | -a)
            shift
            INIT_STATIC=1
            INIT_DB=1
            INIT_MIGRATE=1
            INIT_INDEX=1
            ;;
        --no-init-all | --no-init | -A)
            shift
            INIT_STATIC=0
            INIT_DB=0
            INIT_MIGRATE=0
            INIT_INDEX=0
            ;;
        --init-static | -s)
            shift
            INIT_STATIC=1
            ;;
        --no-init-static | -S)
            shift
            INIT_STATIC=0
            ;;
        --init-database | -d)
            shift
            INIT_DB=1
            ;;
        --no-init-database | -D)
            shift
            INIT_DB=0
            ;;
        --init-migration | -m)
            shift
            INIT_MIGRATE=1
            ;;
        --no-init-migration | -M)
            shift
            INIT_MIGRATE=0
            ;;
        --init-index | -i)
            shift
            INIT_INDEX=1
            ;;
        --no-init-index | -I)
            shift
            INIT_INDEX=0
            ;;
        --local)
            LOCAL_PY="$2"
            shift 2
            ;;
        --force-index)
            shift
            REINDEX_EDD=true
            ;;
        --wait-host | -w)
            WAIT_HOST+=("$2")
            shift 2
            ;;
        --wait-port | -p)
            WAIT_PORT+=("$2")
            shift 2
            ;;
        --)
            shift
            if [ ! $# -eq 0 ]; then
                COMMAND="$1"
                shift
            else
                echo "No command specified" >&2
                exit 1
            fi
            break
            ;;
        -*)
            echo "Unknown flag $1" >&2
            exit 1
            ;;
        *)
            COMMAND="$1"
            shift
            break
            ;;
    esac
done

# Look for code mounted at /code and symlink to /usr/local/edd if none found
if [ ! -x /code/manage.py ]; then
    output "Running with container copy of code …"
    ln -s /usr/local/edd /code
    if [ ! -z "$LOCAL_PY" ]; then
        cp "$LOCAL_PY" /code/edd/settings/local.py
    fi
else
    output "Running with mounted copy of code …"
fi
cd /code

SEPARATOR='****************************************************************************************'
output "EDD_DEPLOYMENT_ENVIRONMENT: " \
    "${EDD_DEPLOYMENT_ENVIRONMENT:-'Not specified. Assuming PRODUCTION.'}"

# Wait for redis to become available
service_wait redis 6379

if [ $INIT_STATIC -eq 1 ]; then
    output
    output "$SEPARATOR"
    output "Collecting static resources …"
    output "$SEPARATOR"
    # Collect static first, worker will complain if favicons are missing
    python /code/manage.py collectstatic --noinput
fi

# Wait for postgres to become available
service_wait postgres 5432

if [ $INIT_DB -eq 1 ]; then
    output
    output "$SEPARATOR"
    output "Configuring database initial state …"
    output "$SEPARATOR"

    export PGPASSWORD=$POSTGRES_PASSWORD
    # Test if our database exists; run init script if missing
    if ! psql -lqt -h postgres -U postgres | cut -d \| -f 1 | grep -qw edd; then
        output "Initializing the database for first-time use …"
        psql -h postgres -U postgres template1 < /code/docker_services/postgres/init.sql
        # Flag for re-indexing
        REINDEX_EDD=true
    fi
    if [ ! -z $POSTGRES_DUMP_URL ] || \
            ([ ! -z $POSTGRES_DUMP_FILE ] && [ -r $POSTGRES_DUMP_FILE ]); then
        # Don't bother dropping and recreating if database just initialized
        if [ "$REINDEX_EDD" != "true" ]; then
            echo 'DROP DATABASE IF EXISTS edd; CREATE DATABASE edd;' | \
                psql -h postgres -U postgres
        fi
        # Flag for re-indexing
        REINDEX_EDD=true
    fi

    # If database dump URL is provided, dump the reference database and restore the local one from
    # the dump
    if [ ! -z $POSTGRES_DUMP_URL ]; then
        output $(echo "Copying database from remote $POSTGRES_DUMP_URL …" | \
                sed -E -e 's/(\w+):\/\/([^:]+):[^@]*@/\1:\/\/\2:****@/')
        REINDEX_EDD=true
        pg_dump "$POSTGRES_DUMP_URL" | psql -h postgres -U postgres edd
    elif [ ! -z $POSTGRES_DUMP_FILE ] && [ -r $POSTGRES_DUMP_FILE ]; then
        output "Copying database from local file $POSTGRES_DUMP_FILE …"
        REINDEX_EDD=true
        psql -h postgres -U postgres edd < "$POSTGRES_DUMP_FILE"
    else
        output "Skipping database restore. No dump source specified."
    fi

    # Ensure the uuid-ossp extension is enabled on existing EDD databases
    echo 'CREATE EXTENSION IF NOT EXISTS "uuid-ossp";' | \
        psql -h postgres -U postgres edd
fi

unset PGPASSWORD
unset POSTGRES_DUMP_FILE
unset POSTGRES_DUMP_URL

# Wait for solr to become available
service_wait solr 8983

if [ $INIT_MIGRATE -eq 1 ]; then
    output
    output "$SEPARATOR"
    output "Managing database migrations …"
    output "$SEPARATOR"

    # Temporarily turn off strict error checking, as the migration check will sometimes
    # have a non-zero exit
    set +e

    # List any pending migrations
    MIGRATIONS=$(python /code/manage.py showmigrations --plan 2> /dev/null | grep -v '[X]')

    # Re-enable strict error checking
    set -e

    # Run migrations; if any detected, flag for re-indexing
    if [ ! -z "$MIGRATIONS" ]; then
        output "Detected pending migrations …"
        if [ ! -z $SKIP_AUTO_MIGRATION ]; then
            output "Skipped pending migrations due to the SKIP_AUTO_MIGRATION variable"
        else
            python /code/manage.py migrate
            REINDEX_EDD=true
        fi
    fi
fi

if [ $INIT_INDEX -eq 1 ]; then
    output
    output "$SEPARATOR"
    output "Re-building Solr indexes …"
    output "$SEPARATOR"

    if [ "$REINDEX_EDD" = "true" ]; then
        output
        python /code/manage.py edd_index
        output "End of Solr index rebuild"
    else
        output "Skipping Solr index rebuild since there were" \
            "no applied database migrations or restores from dump"
    fi
fi

# Wait for rabbitmq to become available
service_wait rabbitmq 5672

# If specified, wait on other service(s)
for ((i=0; i<${#WAIT_HOST[@]}; i++)); do
    port=${WAIT_PORT[$i]:-24051}
    service_wait "${WAIT_HOST[$i]}" $port
done

# Start up the command
output
output "$SEPARATOR"
case "$COMMAND" in
    worker)
        output "Starting Celery worker"
        output "$SEPARATOR"
        exec celery -A edd worker -l info
        ;;
    devmode)
        output "Starting development apppserver"
        output "$SEPARATOR"
        exec python manage.py runserver 0.0.0.0:8000
        ;;
    application)
        output "Starting production apppserver"
        output "$SEPARATOR"
        exec gunicorn -w 4 -b 0.0.0.0:8000 edd.wsgi:application
        ;;
    shell)
        output "Starting shell session"
        output "$SEPARATOR"
        exec python manage.py shell
        ;;
    init-only)
        output "Init finished"
        mkdir -p /tmp/edd-wait
        cd /tmp/edd-wait
        exec python -m SimpleHTTPServer ${1:-24051}
        ;;
    *)
        output "Unrecognized command: $COMMAND"
        exit 1
        ;;
esac
