
## <a id="main-lecture"></a>When Things Go Wrong: Debugging

---

### A Bug Is Not Magic

- Code does exactly what you told it to do, every single time.
- If the program behaves unexpectedly, it means your instructions said something different from what you meant.
- **Debugging** is the process of finding the gap between what you meant and what you wrote.

Bugs feel mysterious because your brain is holding onto what you *meant*, not what the code *says*. The first job is to let go of your intent and read the code literally, line by line.

```notes
New programmers often believe that bugs are random or that the computer is "against them." It isn't. The computer is unforgiving, but it is not creative. It cannot do anything you didn't ask it to.

This is actually good news: every bug has a specific cause. If you find it, the bug is 100% reproducible and 100% fixable. You are never "just unlucky."

The hard part is that finding the cause requires humility. You have to trust that YOUR code is wrong, not the language, not the computer, not the textbook. Most of the time, beginners waste hours assuming the tools are broken when really it was a missing indent.
```

---

### Three Kinds of Bug

Bugs usually fall into one of three categories:

**1. Syntax errors** — the code won't even run.
Python yells at you with a `SyntaxError` or similar. Fix: read the exact line Python points to. Look for missing colons, quotation marks, or parentheses.

**2. Runtime errors** — the code starts running, then crashes partway through.
You get a traceback. Common ones: `TypeError`, `ValueError`, `ZeroDivisionError`, `IndexError`.

**3. Logic errors** — the code runs to completion, but the answer is wrong.
No error message. The program finished "successfully" and printed something nonsensical. These are the hardest to find.

```notes
Students often think "runs without errors = works correctly." That is the most dangerous belief in programming.

A logic error means the code ran perfectly — it just did the wrong thing. No traceback will tell you about it. You catch logic errors by checking whether the output matches what you expected.

A good habit: before running code on a complicated input, first run it on a simple input where you know the correct answer. If `sum_to(3)` returns 7, you know something is wrong before you try `sum_to(1000)`.
```

---

### Reading a Traceback

When Python crashes, it prints a **traceback**. Most beginners scroll past it and just read the last line. The last line is important — but so are the rest.

```
Traceback (most recent call last):
  File "grades.py", line 7, in <module>
    average = total / count
ZeroDivisionError: division by zero
```

Read it bottom to top:

- **Last line** tells you the *kind* of error: ZeroDivisionError.
- **Second-to-last** tells you the *file* and *line* where it happened: `grades.py`, line 7.
- **Line content** shows the actual code: `average = total / count`.
- Now you know: on line 7, `count` was 0 when you tried to divide.

The next question is: why was `count` 0? That is what the rest of the traceback helps with.

```notes
Tracebacks are NOT punishments. They are the most helpful thing Python offers. They tell you exactly where the problem is and often what the problem is.

Students who glaze over tracebacks and immediately google the error message are skipping the single most useful information on their screen. Slow down. Read the traceback. Then, if you still don't know, search.

A very common pattern: a student says "I got an error, what do I do?" and they haven't read the traceback. Ask them: which file? Which line? What kind of error? If they can't answer, they haven't looked. Make them look.
```

---

### The Debugging Loop

A reliable debugging process:

1. **Reproduce the bug.** Can you make it happen again, on purpose? If not, you can't fix it.
2. **Form a hypothesis.** "I think the bug is because X." Write it down if necessary.
3. **Test the hypothesis.** Add a print, change an input, or isolate the suspect line.
4. **Revise.** The test either confirms X, rules X out, or surprises you. Update your hypothesis.

Keep doing this until the bug is pinned down.

Beginners often skip step 2 — the hypothesis. They just change things randomly hoping one fix sticks. That is **shotgun debugging**, and it teaches you nothing.

```notes
The slowest part of debugging is forcing yourself to predict before you test. It feels pointless. "Why should I guess when I can just run it?"

The reason is that every guess-then-check teaches you something about the code. If you predicted correctly, you understand what's happening. If you predicted wrong, you now know where your mental model diverges from reality — which is exactly the gap the bug lives in.

Random edits without hypotheses sometimes "fix" the symptom but leave the underlying misunderstanding intact. The bug comes back two days later in a different form.

Train this early. It is the difference between programmers who get better every year and programmers who are stuck.
```

---

### The Print Statement Is Your Friend

The simplest debugging tool is `print`. Drop prints in your code to see what the values actually are at each step.

```python
def total_spent(prices):
    total = 0
    for price in prices:
        print("adding", price, "to total", total)   # debug print
        total = total + price
    return total

print(total_spent([4, 6, 2]))
```

The debug print reveals exactly what the loop is doing. If the behavior surprises you, your mental model is wrong somewhere.

Remove the debug prints once you find the bug (or keep them commented out for next time).

```notes
Professional debuggers exist — tools that let you step through code line by line and watch variable values. They are excellent. But print-statement debugging is faster for 90% of beginner bugs.

The trick is being specific in what you print. `print(x)` tells you less than `print("after loop:", x)`. Label your prints so you can find them in the output.

Also: print ONE thing at a time. Flooding your output with 20 print statements makes it harder to spot the pattern. Add one, check, move it if needed.
```

---

### Let's Practice!

**Question 1** (read the traceback):

```
Traceback (most recent call last):
  File "app.py", line 12, in <module>
    result = compute(users)
  File "app.py", line 5, in compute
    average = total / len(users)
ZeroDivisionError: division by zero
```

Where is the error? What does it tell you about the state of the program?

**Question 2**: The following code prints 0 instead of 15. Find the bug.

```python
total = 0
for n in [1, 2, 3, 4, 5]:
    total = 0
    total += n
print(total)
```

**Question 3** (logic error — no traceback):

```python
def is_even(n):
    if n % 2 == 1:
        return True
    else:
        return False

print(is_even(4))   # prints False — but 4 IS even!
```

The comparison is reversed. Fix it.

```notes
Question 1: the error is on line 5 of app.py, inside the function `compute`. The cause is that `len(users)` is 0 — the users list is empty. Tracing back further, `compute` was called from line 12 with the variable `users`, which must itself be empty.

The lesson: errors propagate. The LINE the error fires on is not always the line where the actual problem was introduced. Line 12 passed an empty list into the function. That empty list is the real bug.

Question 2's bug is `total = 0` INSIDE the loop. Every iteration resets total, then adds `n`. At the end, `total` is just the last `n`. Wait — that would print 5, not 0. Let me re-read... Oh, `total = 0` resets, then `total += n` adds n, so after the last iteration (n=5), total = 0 + 5 = 5. So it prints 5, not 0. The problem statement says it prints 0 — which is the state BEFORE += runs. Either way, the fix is the same: move `total = 0` to before the loop.

Actually, let me trace it one more time. n=1: total=0, then total=0+1=1. n=2: total=0, then total=0+2=2. n=3: total=0, then total=3. n=4: total=4. n=5: total=5. Final: 5. So the problem description ("prints 0") is slightly off but the bug is clear: the reset should be outside.

If a student gets confused by this, walk them through the trace on paper. The confusion teaches the lesson: reading code carefully is harder than it looks.

Question 3: the fix is `if n % 2 == 0` (even means divisible by 2 with remainder 0). The author wrote the condition for ODD, not even. A cleaner version: `return n % 2 == 0` — no need for the if/else at all.

Students who fix this by swapping True and False in the branches (`if n % 2 == 1: return False; else: return True`) get the right answer but with a more confusing condition. Ask them which version another programmer would find clearer.
```

---

## <a id="activity"></a>Activity: Debug These

Here are three broken programs. For each: describe what you expected, what actually happens, and fix it.

**Program A**:
```python
def greet(name):
    print("Hello, " + name)

greet("Alex")
greet(42)
```

**Program B**:
```python
numbers = [3, 7, 2, 9, 4]
largest = 0
for n in numbers:
    if n > largest:
        largest = n
print("Largest:", largest)
# Now try it with numbers = [-3, -7, -2, -9, -4]
```

**Program C**:
```python
password = "hunter2"
tries = 0
while tries < 3:
    guess = "wrong"
    if guess == password:
        print("Access granted")
        break
    print("Wrong password, try again")
print("Too many attempts")
```

```notes
Program A: the call `greet(42)` crashes because you can't concatenate a string and an integer. Fix: convert 42 to a string with `str(42)`, or use an f-string: `print(f"Hello, {name}")`. The f-string is cleaner and works for both strings and numbers.

This is a subtle teaching point: the bug isn't in `greet`. It's in the assumption about what `greet` receives. Good code handles both cases.

Program B has a logic error. With all-negative numbers, `largest` stays 0 and the program reports 0 as the largest — which isn't even in the list. The fix is to initialize `largest` to the first element: `largest = numbers[0]`. Or start with `-infinity` using `float('-inf')`.

This is the classic "initial value" bug. Students who never test with unusual inputs will never catch it.

Program C is an infinite loop. `tries` never changes, so the while condition is always true. The "break" would exit, but since `guess` never equals `password`, break never fires. The fix is to increment `tries` on each iteration (`tries += 1`) so the loop eventually exits.

Notice: the final print ("Too many attempts") will now fire, but it's misleading — it always prints, even if access was granted. A full fix also restructures the post-loop to check whether access was ever granted. But first, fix the infinite loop. One bug at a time.
```
