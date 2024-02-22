FROM alpine

ARG TOWER_CLI_VERSION="0.9.2"

# Install Tower CLI
RUN apk add --no-cache curl ca-certificates jq uuidgen \
    && curl -L https://github.com/seqeralabs/tower-cli/releases/download/v${TOWER_CLI_VERSION}/tw-linux-x86_64 > tw \
    && chmod +x ./tw \
    && mv tw /usr/local/bin/ \
    && tw --version

# Make action script available
ADD *.sh /
RUN chmod +x /entrypoint.sh

ENTRYPOINT ["/entrypoint.sh"]
