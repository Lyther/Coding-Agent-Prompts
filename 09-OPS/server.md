# COMMAND: SERVER

Rule: run tests on remote dev boxes, not on localhost.

## Remote targets (SSH config)

```sshconfig
Host dev-box-cpu
  HostName 10.37.89.91
  User lizhao.1337

Host dev-box-gpu
  HostName 10.37.89.184
  User lizhao.1337
```

## Proxy (bypass GFW)

Before any networked command (including installs/tests) run:

```sh
export http_proxy=http://sys-proxy-rd-relay.byted.org:8118 https_proxy=http://sys-proxy-rd-relay.byted.org:8118 no_proxy="10.199.47.35,10.199.47.55.byted.org,.volces.com,.bytedance.net"
```

## Agent behavior

- Do not start local servers unless explicitly asked.
- When asked to run tests/benchmarks/builds, prefer remote execution via SSH: `ssh dev-box-cpu '...cmd...'` (or `dev-box-gpu` if GPU is required).
- Include the proxy export in the remote command prefix if you want to access some resources that are slow/unreachable in China: `ssh dev-box-cpu 'export ...; <cmd>'`.
