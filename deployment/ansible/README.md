# Ansible deployment — nanobot-exeio on a VPS

Automates the manual deploy sequence (clone, config, secrets, `docker compose
build`/`up`) onto a single Linux VPS (built for/tested against Debian and
Ubuntu — OVH's two common VPS images). Re-running is safe and idempotent; the
same playbook against a second VPS reproduces an identical instance.

> **Status: not yet run against a real host.** No VPS has been purchased yet.
> Every template has been rendered and validated locally (valid JSON/YAML,
> correct variable substitution in both the loopback-only and publicly-exposed
> paths — see the "What's been validated" section below), and
> `ansible-playbook site.yml --syntax-check` passes clean. What hasn't
> happened: an actual run against a live host, so treat the first real
> `ansible-playbook site.yml` as a first-run rather than a proven path.
> Watch closely and adjust as needed.

## Why Ansible, and why this shape

- **Ansible over Terraform**: this targets an *existing* dedicated VPS, not
  cloud resources to provision. Terraform would be the wrong layer here.
- **Ansible over a shell script**: the value is idempotency and safe re-runs —
  running `site.yml` again after a secret rotation or a config tweak only
  touches what actually changed.
- **The app repo's own `Dockerfile`/`docker-compose.yml` are never edited.**
  This project only *layers* a `docker-compose.override.yml` on top (Compose
  merges override files natively) — that keeps `git pull` on the app repo
  conflict-free against anything Ansible manages.
- **One host, no groups, no environments.** This deploys one bot to one VPS
  for a solo operator. Don't add multi-environment inventory structure,
  dynamic inventory, or a CI pipeline unless you're actually standing up a
  second instance — that's premature structure for what this is today.

## Structure

```
deployment/ansible/
├── ansible.cfg
├── requirements.yml              # community.docker, community.general
├── site.yml                      # top-level playbook
├── inventory/hosts.yml           # single host — fill in ansible_host once the VPS exists
├── group_vars/all/
│   ├── vars.yml                  # non-secret config, tracked in git
│   └── vault.yml.example         # secrets TEMPLATE — copy, fill, encrypt (see below)
└── roles/
    ├── firewall/                 # ufw baseline
    ├── docker/                   # Docker Engine + Compose plugin
    ├── nanobot/                  # clone repo, template config/secrets, build, up
    └── caddy/                    # reverse proxy + auto-TLS — only runs if you expose publicly
```

## Prerequisites (on your control machine, not the VPS)

```bash
uv tool install ansible-core        # or: pip install --user ansible-core
cd deployment/ansible
ansible-galaxy collection install -r requirements.yml
```

## First-time setup

### 1. Point the inventory at your VPS

Edit `inventory/hosts.yml` — set `ansible_host` to the real IP once you've
bought it, and `ansible_user` to whatever SSH user you'll deploy as (needs
sudo).

### 2. Create the real secrets vault

```bash
cp group_vars/all/vault.yml.example group_vars/all/vault.yml
vim group_vars/all/vault.yml           # fill in real values — see next section
ansible-vault encrypt group_vars/all/vault.yml
```

`vault.yml` and `.vault-pass` are gitignored at the repo root — only the
`.example` template is tracked. **Never commit the real, decrypted file.**

Store the vault password itself in a password manager, or write it to
`.vault-pass` (also gitignored) and uncomment `vault_password_file` in
`ansible.cfg` so you don't have to type `--ask-vault-pass` on every run.

To edit secrets later: `ansible-vault edit group_vars/all/vault.yml`.

### 3. What goes in the vault, and where each value comes from

| Vault var | Source |
|---|---|
| `vault_together_ai_api_key` | Your existing `~/.nanobot/config.json` → `providers.custom.apiKey`, or `.env` on your dev machine |
| `vault_nvidia_api_key` | Same — `providers.nvidia.apiKey` / `.env` |
| `vault_groq_api_key` | Same — `.env`. **Note:** the dev config this project was built from has `transcriptionProvider: "groq"` but `providers.groq.apiKey: null` — transcription is likely not actually working there. This template fixes that by wiring the key through; double check on your end too. |
| `vault_telegram_bot_api_key` | `@BotFather` on Telegram |
| `vault_langfuse_*` | Your Langfuse project settings (optional — skip if you don't use Langfuse) |
| `vault_websocket_token_issue_secret` | Generate fresh: `openssl rand -hex 32`. The dev config this was built from used the literal word `"exeio"` here — don't reuse that, it's guessable. |
| `vault_api_server_key` | Generate fresh: `openssl rand -hex 32`. The dev config's `api.apiKey` is **empty** — the OpenAI-compatible `/v1` server (port 8900) currently has no authentication at all. Set a real value before ever enabling the `nanobot-api` service publicly. |

### 4. Review the non-secret config

`group_vars/all/vars.yml` mirrors `~/.nanobot/config.json`'s current values
(model, timezone, bot name/icon, Telegram `allowFrom`). Adjust as needed —
this file is meant to be readable and diffable in plain git history.

**`nanobot_expose_webui_publicly` defaults to `false`.** Everything stays
bound to `127.0.0.1` on the VPS until you deliberately flip this — reach it
via an SSH tunnel in the meantime:

```bash
ssh -L 8765:127.0.0.1:8765 -L 18790:127.0.0.1:18790 deploy@<vps-ip>
```

Flip it to `true` and set `nanobot_domain` only once DNS actually points at
the VPS — that's what gates the `caddy` role (auto-TLS reverse proxy) and
opens 443 in the firewall role.

### 5. Deploy

```bash
ansible-playbook site.yml --ask-vault-pass
# or, with vault_password_file uncommented in ansible.cfg:
ansible-playbook site.yml
```

Re-run any time — config/secret changes trigger a fast container restart via
Ansible handlers; the image only rebuilds when `roles/nanobot/tasks/main.yml`'s
build task runs (every play, but Docker's own layer cache keeps that cheap).

## What each role does

1. **`firewall`** — ufw: allow SSH, deny incoming by default, allow outgoing.
   Opens 80/443 only when `nanobot_expose_webui_publicly` + `nanobot_domain`
   are both set. Ports `18790`/`8765`/`8900` are **never** opened here —
   they're either loopback-only or fronted by Caddy on 443, matching the
   port-planning guidance in `docs/deployment.md`.
2. **`docker`** — installs Docker Engine + the Compose plugin from Docker's
   official apt repo, adds the deploy user to the `docker` group.
3. **`nanobot`** — the core role:
   - Clones `nanobot-exeio` at `nanobot_repo_ref` into `nanobot_deploy_dir`
     (default `/opt/nanobot`).
   - Chowns `nanobot_data_dir` (default `~/.nanobot` for the deploy user) to
     `1000:1000` — the container's built-in non-root user, per the exact fix
     `docs/deployment.md` documents for bind-mount permission errors.
   - Templates three files from the vaulted + non-secret vars:
     - `config.json` → the data dir (every provider key `${VAR}`-wrapped,
       nothing raw)
     - `.env` → the deploy dir. **Does double duty**: Compose auto-loads it
       for `${NANOBOT_CHANNELS}` build-arg substitution *inside*
       `docker-compose.yml` itself, and `docker-compose.override.yml` also
       points `env_file:` at the same file to inject those vars into the
       *container's* runtime environment — two genuinely different
       consumption points, one file.
     - `docker-compose.override.yml` → adds the `env_file:` directive the
       base compose file is missing, plus external port binds when exposed
       publicly.
   - `docker compose build` (Docker's layer cache makes repeat runs fast —
     no fragile "did anything change" detection needed at this scale) then
     `docker compose up -d` for whichever services are listed in
     `nanobot_services` (default: just `nanobot-gateway`; add
     `nanobot-api` if you want the port-8900 OpenAI-compatible server too).
   - Polls the gateway health endpoint until it responds.
4. **`caddy`** — only runs when exposing publicly with a domain set. Caddy
   over nginx specifically because it does automatic Let's Encrypt TLS with
   near-zero config, and its `reverse_proxy` handles the WebSocket upgrade
   the WebUI needs without the manual header-proxying nginx requires.

## What's been validated (without a live host)

- `ansible-playbook site.yml --syntax-check` — passes clean (two
  `apt_repository`-deprecated-in-2.25 warnings; the module still works on
  the ansible-core version this was built against, but consider migrating to
  `deb822_repository` before that removal lands).
- Every `.yml`/`.yaml` file parses (`yaml.safe_load`).
- All four Jinja2 templates (`config.json.j2`, `env.j2`,
  `docker-compose.override.yml.j2`, `Caddyfile.j2`) were rendered locally
  with representative fake values, in **both** the
  `nanobot_expose_webui_publicly: true` and `: false` branches, and the
  output was parsed back (`json.load` / `yaml.safe_load`) to confirm every
  substitution lands where it should — host bindings flip correctly,
  secrets interpolate, WhatsApp stays safely disabled with an empty
  `allowFrom` regardless of what's in the dev config it was built from.

**Not validated:** an actual `docker compose build`/`up` against a real
Docker daemon, the `community.docker.docker_compose_v2` module's exact
runtime behavior, SSH connectivity/`become` against a real host, or the
Caddy/Let's Encrypt flow end-to-end. These all need the real VPS.

## Known gaps / next steps once the VPS exists

- First real run will surface anything `--syntax-check` can't catch —
  budget time for a first-run debugging pass rather than expecting it to
  work perfectly blind.
- `WhatsApp` is deliberately left `enabled: false` with an empty `allowFrom`
  in `config.json.j2`, regardless of the dev machine's config — see the
  incident notes if you're tempted to re-enable it here without also setting
  a real, non-personal number.
- Consider migrating `apt_repository` → `deb822_repository` in the `docker`
  and `caddy` roles before ansible-core 2.25.
