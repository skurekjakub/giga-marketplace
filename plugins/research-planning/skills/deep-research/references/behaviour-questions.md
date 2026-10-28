# Behaviour questions: measure the subject, the comparators, the consumer

For questions about how a system behaves. These are step 3 of the main order.

## 1. Measure the subject

Write the measurement as a script in `evidence/` and save its raw output there. The script
declares its inputs at the top so it can be re-run against any target. Cover at least:

- a case that has the feature;
- a case that exists without it;
- a case that does not exist at all;
- any edge class the implementation lets through.

## 2. Measure the comparators with the same script

The vendors or implementations the user named (in the order they named them), then the ones the
domain makes obvious, then any upstream. Each gets the same case classes. A vendor claim from a
blog post, a search summary or a design doc is not a measurement until the script has run
against that vendor. Run long batches in the background, one target at a time. The raw output is
the evidence file, not your paraphrase.

## 3. Measure the consumer

Record what the real client sends and what it does with the answer. A client that silently
drops part of the response can decide the question on its own, and that fact is rarely
documented.

## 4. Primary sources

- **Standards and specs:** capture the text and quote the deciding paragraphs with section
  numbers.
- **Packages:** download the package (for npm, `npm view <pkg> dist.tarball`). Keep the README
  and the source file that decides the behaviour, and note the version and date.

## The comparator table

This goes in the README's Reasoning section: target × what it decides by × each case class,
with the date measured.

## HTTP example

A probe whose rows are URLs and whose columns are status, content type, `vary`,
`cache-control`, `x-robots-tag`, `link`, and length or redirect target:

```bash
#!/usr/bin/env bash
# Inputs: one target per run. Rows: the case classes.
BASE="${1:?base url}"
PATHS=(/has-feature /exists-without-feature /does-not-exist /edge.txt)
ACCEPT="${ACCEPT:-text/markdown}"
printf 'path\tstatus\ttype\tvary\tcache-control\tlength\n'
for p in "${PATHS[@]}"; do
  curl -s -o /dev/null -H "Accept: $ACCEPT" -D - "$BASE$p" | tr -d '\r' | awk -v p="$p" '
    /^HTTP\//{s=$2} tolower($1)=="content-type:"{t=$2} tolower($1)=="vary:"{v=$2}
    tolower($1)=="cache-control:"{c=$2} tolower($1)=="content-length:"{l=$2}
    END{printf "%s\t%s\t%s\t%s\t%s\t%s\n",p,s,t,v,c,l}'
done
```

**The consumer test for HTTP:**

1. Point the actual client (a fetch tool, `curl` with the tool's headers, a crawler's documented
   user agent) at an echo endpoint such as `https://httpbin.org/headers`.
2. Point the same client at the live URL under question.
3. Record what reaches the model.

A tool that drops the body of every non-2xx response changes the verdict.
