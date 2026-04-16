
## <a id="main-lecture"></a>Making Decisions: If and Else

---

### Programs That Choose

- Most real programs do different things depending on the data they see.
- Python uses the word **`if`** to run a block of code only when some condition is true.

```python
temperature = 95

if temperature > 90:
    print("It's hot today!")
```

- `temperature > 90` is a **condition** — an expression that is either `True` or `False`.
- The **indented** line runs only when the condition is `True`.

```notes
Today we're learning how to make a program make decisions. This is what makes programs feel intelligent — the ability to say "do this in one situation, do that in another."

The indentation is important. It is not decoration. Python uses the indented lines to know which code belongs inside the "if." Most beginners at some point mess up the indentation and can't figure out why their program behaves strangely. Always look at indentation first when something is wrong.

Read the condition out loud as an English question: "Is temperature greater than 90?" If yes, run the indented block. If no, skip it.
```

---

### Adding `else`

What if we want to do one thing when the condition is true and a different thing when it is false?

```python
temperature = 65

if temperature > 90:
    print("It's hot today!")
else:
    print("Not so hot.")
```

- The `else` block runs **only** when the `if` condition is false.
- Exactly one of the two blocks runs. Never both, never neither.

You can also test multiple conditions with `elif` (short for "else if"):

```python
score = 73

if score >= 90:
    print("A")
elif score >= 80:
    print("B")
elif score >= 70:
    print("C")
else:
    print("Try again")
```

```notes
With `if / elif / else`, Python checks the conditions from top to bottom and stops at the first one that is true. Only ONE block will ever run.

This is important: if a student's score is 95, Python prints "A" and stops. It does not also check whether 95 >= 80, because it already found a match.

A common beginner mistake is to write a bunch of separate `if` statements when they really want `elif`. Separate `if`s will each run independently, which can trigger multiple prints.

Try it: change the example to use `if` for every branch instead of `elif`. Notice what happens when score = 95.
```

---

### Comparison Operators

Conditions are usually built from these comparisons:

| Operator | Meaning | Example |
|----------|---------|---------|
| `==` | is equal to | `age == 18` |
| `!=` | is not equal to | `name != "Alex"` |
| `<` | less than | `temp < 0` |
| `>` | greater than | `score > 70` |
| `<=` | less than or equal | `count <= 10` |
| `>=` | greater than or equal | `age >= 18` |

Remember from Lecture 1: `==` (two equals signs) is the *question* form. A single `=` is **assignment**, not a comparison.

```python
if x = 5:   # SYNTAX ERROR
    ...

if x == 5:  # correct — asks whether x equals 5
    ...
```

```notes
This is the single most common bug new programmers hit. They write `if x = 5:` when they mean `if x == 5:`.

Python will catch this as a syntax error, which is actually a mercy. In some other languages (C, for example), `if (x = 5)` is legal and means "assign 5 to x and then test whether the result is truthy." It silently does the wrong thing.

So when Python yells at you about a syntax error on an `if` line, the first thing to check is: did you use `=` when you meant `==`?
```

---

### Combining Conditions

Sometimes one condition isn't enough. You can combine them with `and`, `or`, and `not`:

```python
age = 20
has_ticket = True

if age >= 18 and has_ticket:
    print("You can enter.")

if age < 13 or age >= 65:
    print("Eligible for discount.")

if not has_ticket:
    print("Please buy a ticket.")
```

- `and` requires **both** sides to be true.
- `or` requires **at least one** side to be true.
- `not` flips true to false and vice versa.

```notes
English is sloppy about "and" and "or." When you say "students or faculty get discounts," you usually mean "students get discounts, and so do faculty." Python's "or" is the same — it means "at least one of these is true."

But watch out for the case where English and Python seem to disagree. If someone says "you can enter if you're 18 and have a ticket," they mean BOTH. Python's `and` means BOTH. So far so good.

Now: "deny entry if they're under 13 or over 65." In Python: `if age < 13 or age >= 65`. Either one of those is enough to deny. This matches English.

If a student writes `if age < 13 and age >= 65`, ask them to find any age that satisfies BOTH. They can't — it's impossible. That's a signal that `and` is wrong here.
```

---

### Let's Practice!

**Question 1** (predict the output):

```python
x = 5
if x > 0:
    print("positive")
elif x > 3:
    print("big")
else:
    print("other")
```

What does this print? Why doesn't it print "big"?

**Question 2**: Write a program that reads a variable `hour` (already set to 14) and prints "Good morning" if `hour` is less than 12, "Good afternoon" if between 12 and 18, and "Good evening" otherwise.

**Question 3**: Find the bug:

```python
password = "letmein"
if password = "letmein":
    print("Access granted")
```

```notes
Question 1 prints "positive." Even though `x > 3` is also true, Python took the first matching branch and stopped. This is the elif behavior we talked about.

A student who answers "big" is thinking about which condition is "more specific" or "better fits." Python doesn't do that — it just checks top to bottom. Walk them through each condition in order.

Question 2 is straightforward if they follow the `if / elif / else` pattern. A common wrong answer is three separate `if`s, which all run independently. If a student does that and it happens to print the right answer, probe whether they know why it worked.

Question 3 has the = vs == bug. This is the #1 bug to have in your muscle memory. If a student can't spot it, guide them to look at the exact character count on that line. Two equals vs one equals is the whole difference.
```

---

## <a id="activity"></a>Activity: Build a Grade Converter

Write a program that:

1. Has a variable `percent` (set it to any number 0-100).
2. Prints the letter grade using the US scale: A (90+), B (80-89), C (70-79), D (60-69), F (below 60).
3. Also prints "Honors" if the grade is A AND the percent is at least 95.

Test your program with `percent = 73`, `percent = 94`, `percent = 97`, and `percent = 45`.

```notes
This activity tests whether students can combine `if`/`elif`/`else` with an additional `if` inside one of the branches. The "Honors" rule is NOT a separate elif — it's an extra check that only runs when the student already has an A.

Students who try to handle Honors with a separate top-level `if` will usually trip over themselves. Watch for a structure like:

```python
if percent >= 90:
    print("A")
if percent >= 95:
    print("Honors")
```

That actually works correctly, but only because neither branch excludes the other. It is fragile. A cleaner version nests the Honors check inside the A branch.

Don't push students to refactor immediately. If they got the right output on all four test cases, they solved the problem. But DO ask them: "what would happen if you added a D+ tier later?" That's where the messy version would break.
```
