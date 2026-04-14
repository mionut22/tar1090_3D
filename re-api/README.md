# re-api

This directory contains the re-api service binary and service definition.

## Main Files

- `re-api`: executable service binary
- `systemd/re-api.service`: systemd unit file

## Notes

- Keep runtime secrets and local environment overrides out of version control.
- If the binary is rebuilt locally, make sure deployment and service configuration stay in sync.
