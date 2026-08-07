"""Where the evaluation data lives, for the Python analysis scripts.

This mirrors ``services/evaluationDataPaths.js``. A mirror is a copy, and a copy
is what caused the incident this module exists to prevent, so
``tests/evaluationLogsPathAgreement.test.js`` runs both implementations over
the same cases and fails if they disagree. Change one, change the other, or the test
tells you.

The order, best first:

1. an explicit ``EVAL_LOGS_DIR`` (resolved against ``root`` when relative),
2. ``<root>/logs`` when ``root`` is a handed-over run folder rather than a
   checkout — such a folder carries its own logs and belongs to no archive,
3. the archive under ``MS_DATA_HOME`` (default ``~/.machinespirits-data``),
4. ``<root>/logs``.

Step 3 is the one every hand-written copy left out. In the main checkout
``logs`` is a symlink to the archive, so a copy that stops at step 4 works by
accident; from a worktree the same copy reads an empty directory and reports no
data, with nothing to say what happened.
"""

import os

__all__ = [
    "resolve_data_home",
    "resolve_db_path",
    "resolve_logs_root_candidates",
    "resolve_logs_root",
    "resolve_tutor_dialogues_dir_candidates",
    "resolve_tutor_dialogues_dir",
]


def _from_root(root, value):
    return value if os.path.isabs(value) else os.path.join(root, value)


def _is_repo_root(root):
    return os.path.exists(os.path.join(root, "package.json")) and os.path.exists(os.path.join(root, "services"))


def resolve_data_home(env=None):
    env = os.environ if env is None else env
    return env.get("MS_DATA_HOME") or os.path.join(os.path.expanduser("~"), ".machinespirits-data")


def resolve_db_path(root, explicit=None, env=None):
    env = os.environ if env is None else env
    chosen = explicit or env.get("EVAL_DB_PATH")
    if chosen:
        return _from_root(root, chosen)
    archive_db = os.path.join(resolve_data_home(env), "evaluations.db")
    if os.path.exists(archive_db):
        return archive_db
    return os.path.join(root, "data", "evaluations.db")


def resolve_logs_root_candidates(root, explicit=None, env=None):
    if not root:
        raise ValueError("root is required")
    env = os.environ if env is None else env
    candidates = []

    chosen = explicit or env.get("EVAL_LOGS_DIR")
    if chosen:
        candidates.append(_from_root(root, chosen))

    root_logs = os.path.join(root, "logs")
    if not _is_repo_root(root) and os.path.exists(root_logs):
        candidates.append(root_logs)

    data_home = resolve_data_home(env)
    if os.path.exists(data_home):
        candidates.append(os.path.join(data_home, "logs"))

    candidates.append(root_logs)

    seen = set()
    ordered = []
    for c in candidates:
        if c not in seen:
            seen.add(c)
            ordered.append(c)
    return ordered


def resolve_logs_root(root, explicit=None, env=None):
    return resolve_logs_root_candidates(root, explicit, env)[0]


def _as_dialogues_dir(logs_root):
    # EVAL_LOGS_DIR is allowed to point straight at the trace dir.
    if os.path.basename(logs_root.rstrip(os.sep)) == "tutor-dialogues":
        return logs_root
    return os.path.join(logs_root, "tutor-dialogues")


def resolve_tutor_dialogues_dir_candidates(root, explicit=None, env=None):
    return [_as_dialogues_dir(r) for r in resolve_logs_root_candidates(root, explicit, env)]


def resolve_tutor_dialogues_dir(root, explicit=None, env=None):
    """First candidate that exists on disk, else the preferred one."""
    candidates = resolve_tutor_dialogues_dir_candidates(root, explicit, env)
    for c in candidates:
        if os.path.isdir(c):
            return c
    return candidates[0]
