# ELK Reasoner

This directory is the local install point for the optional Java-based ELK
reasoner. The jar is intentionally git-ignored.

The ontology pilot has two reasoning paths:

- Runtime policy guidance uses `eyereasoner` plus `n3` from Node. This path does
  not need Java and is exercised by `npm run ontology:test` and
  `npm run ontology:pilot`.
- OWL class-taxonomy classification uses ELK. This path needs Java and is
  exercised by `npm run ontology:elk`.

## Java Setup

On macOS with Homebrew:

```bash
brew install openjdk
```

Homebrew installs OpenJDK as a keg-only package. The wrapper script looks for
Java in these places, in order:

1. `--java <path>` passed to `npm run ontology:elk`
2. `JAVA_BIN`
3. `java` on `PATH`
4. Homebrew OpenJDK paths such as `/opt/homebrew/opt/openjdk/bin/java`

That means the following usually works without modifying the shell profile:

```bash
npm run ontology:elk -- --input config/ontology/reasoning-core.ttl
```

If a different Java install should be used:

```bash
JAVA_BIN=/path/to/java npm run ontology:elk -- --input config/ontology/reasoning-core.ofn
```

If you want system Java wrappers to find Homebrew OpenJDK outside this repo,
Homebrew may suggest a symlink such as:

```bash
sudo ln -sfn /opt/homebrew/opt/openjdk/libexec/openjdk.jdk /Library/Java/JavaVirtualMachines/openjdk.jdk
```

That symlink is not required for this repo's wrapper if the Homebrew path exists.

## Download ELK

Download the standalone jar:

```bash
npm run ontology:download-elk
```

This writes:

```text
vendor/reasoners/elk/elk-standalone-0.4.3.jar
```

Use `--force` to refresh the jar:

```bash
npm run ontology:download-elk -- --force
```

## Run ELK Classification

Classify the ontology and write the taxonomy artifact:

```bash
npm run ontology:elk -- --input config/ontology/reasoning-core.ttl --output exports/ontology/elk-classification.owl
```

`elk-standalone` expects OWL functional syntax. If a `.ttl` input is supplied,
the wrapper automatically uses the adjacent `.ofn` mirror when present:

```text
config/ontology/reasoning-core.ttl -> config/ontology/reasoning-core.ofn
```

The output path is under `exports/`, which is ignored by git.

## Troubleshooting

If Java is missing:

```text
Java runtime is not available. Install Java before running ELK.
On macOS/Homebrew: brew install openjdk
```

Install OpenJDK or pass an explicit Java binary:

```bash
npm run ontology:elk -- --java /path/to/java --input config/ontology/reasoning-core.ofn
```

If the jar is missing:

```bash
npm run ontology:download-elk
```

If ELK reports a parse error for Turtle input, run through the wrapper rather
than invoking the jar directly. The wrapper handles the `.ttl` to `.ofn` mirror.
