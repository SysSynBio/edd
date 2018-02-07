FROM buildpack-deps:buster

LABEL maintainer="Mark Forrer <mark.forrer@lbl.gov>"

ENV LANG C.UTF-8
ARG GIT_BRANCH=master
ARG GIT_URL=https://github.com/JBEI/edd.git

RUN apt-get clean && apt-get update \
    && DEBIAN_FRONTEND=noninteractive apt-get install -y -q \
       build-essential \
       python3-all-dev \
       python3-pip\
       python3-setuptools \
       python3-wheel \
       git \
    && apt-get autoremove -y \
    && ln -s /usr/bin/python3 /usr/local/bin/python \
    && ln -s /usr/bin/pip3 /usr/local/bin/pip \
    && pip install --no-cache-dir virtualenv \
    && rm -rf /var/lib/apt/lists/* \
    # configure sparse checkout of the code from EDD repo (we'll pull it in a separate layer)
    && git init /code/ \
    && git remote add origin ${GIT_URL} -C /code/ \
    && git config core.sparsecheckout true -C /code/ \
    && echo jbei/* >> /code/.git/info/sparse-checkout \


# pull the code & install python requirements in a separate layer so all the previous Debian &
# static repo URL config  gets cached and doesn't have to be rebuilt each time the code changes.
# Few required libraries at this point, so that part should be fast.
RUN git pull origin ${GIT_BRANCH} -C /code/ \
    && pip install -r /code/jbei/requirements.txt

ENTRYPOINT ["/bin/bash"]