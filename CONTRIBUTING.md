# Contributing: One world, every age

Team rules for the Build for Everyone hackathon (Gaming track). Short on purpose: read once, then build.

## First-time setup (2 minutes)

```bash
git clone https://github.com/jbisaccia-9/one-world-every-age.git
cd one-world-every-age
git config core.hooksPath .githooks   # turns on the pre-push secret guard
cp .env.example .env                  # then fill in the keys you were sent
```

Git doesn't turn on hooks from a cloned repo by itself. The `core.hooksPath` line tells your copy to use the repo's `.githooks/` folder, so the guard runs before every push.

**Optional but recommended:** create your own banned-terms list. The guard blocks any commit that contains one of these terms:

```bash
mkdir -p .guard
printf '%s\n' "Your Full Name" "your.personal@email.com" "YourEmployer" > .guard/banned_patterns.txt
```

`.guard/` is gitignored on purpose. The list is personal and never leaves your machine.

## Branches, PRs, merging

- **Never push straight to `main`.** Branch, push, open a PR.
- **Branch names:** `feat/<thing>`, `fix/<thing>`, `chore/<thing>`, for example `feat/age-gated-chat` or `fix/persona-switch`.
- **1 approval per PR** from a teammate, plus a green `guard` check. GitHub enforces both on `main`. Only the repo owner can override and self-merge, and only when the clock demands it (say so in the PR).
- **Squash and merge only.** One PR becomes one commit on `main`, and the branch is deleted automatically.
- Keep PRs small. Several small, working PRs beat one big one at 4:15 PM.

## Secrets, keys and sensitive data

The pre-push guard (`.githooks/pre-push`) and the `secret-scan` CI check enforce these rules. They scan every commit you push, including ones where you added something and later deleted it.

1. **Keys live in `.env` only.** Never put them in code, commits, screenshots or Discord channels. Add new variable *names* (no values) to `.env.example`.
2. **Partner keys stay server-side.** The one exception is k-ID's publishable key (`kgp_…`), which k-ID designs for the browser; it still lives only in `.env` as `VITE_KID_PUBLISHABLE_KEY`, never in code. Other k-ID, Inworld, Modulate and FastSpring keys are called from our backend. Anything with a browser-exposed prefix (the `NEXT_PUBLIC`, `VITE`, `REACT_APP` and `EXPO_PUBLIC` family) is shipped to every player's browser. The guard blocks secret-looking names with those prefixes.
3. **Synthetic people only.** Use k-ID's test personas and made-up data. This is a product for kids, so no real players' names, birthdays, ages, locations, photos or voices.
4. **No raw recordings in the repo, storage or logs.** Voice and video captures are personal data. `recordings/` is ignored and the guard blocks raw audio and video files. Demo clips made with TTS go in `assets/synthetic/`. The live voice turn in the spec (8.1.5) is allowed only for a consenting **adult** presenter: the audio is processed in memory, sent to Modulate for redaction, and never committed, saved or logged. Never record a child's or a real player's voice.
5. **Test mode only.** FastSpring sandbox and test cards. No real payment details anywhere.
6. **No personal machine paths** (`/Users/<you>/…`) or personal emails in code or config.

### If the guard blocks your push

It tells you which commit and which rule matched. Remove the content, then rewrite the commit: `git commit --amend` for the latest commit, or `git rebase -i` for older ones. Push again. Don't bypass it with `--no-verify`: CI runs the same scan and the PR can't merge until it passes.

### If a real key ever gets pushed

1. **Rotate or revoke the key first** in that provider's dashboard. Deleting it from git is **not** enough, because it may already have been copied.
2. Tell the team in the group chat.
3. Then clean it out of the code and update `.env` with the new key.

## Hackathon rules to remember

- No project code before **10:20 AM PT** build start.
- Submit by **4:30 PM PT** (the form opens at 3:00 PM). Submit early, resubmit if needed.
- The judges want to see the game **changing for different test personas**, live. Protect that demo flow.
