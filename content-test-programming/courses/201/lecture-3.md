
## <a id="main-lecture"></a>Loops: Doing Things Many Times

---

### Why Loops?

- Computers are good at repetition. Humans are bad at it.
- A **loop** tells the computer to run the same block of code many times.
- Python's simplest loop is the `for` loop:

```python
for i in range(5):
    print("Hello!")
```

- This prints "Hello!" five times.
- `range(5)` produces the numbers 0, 1, 2, 3, 4.
- `i` takes each of those values in turn.

```notes
The very first reaction some students have is: "but I could just write `print('Hello!')` five times." That is true, and for five times it even makes sense. For 500 times or 5,000,000 times, it does not. Loops are how programs handle size.

Notice two things about `range(5)`. First, it starts at 0, not 1. That is a Python convention that catches beginners off guard. Second, it stops BEFORE 5. So `range(5)` gives you 0, 1, 2, 3, 4 — five values, but none of them is 5. The reason is that programmers think in terms of "how many steps" more than "from what to what."
```

---

### Using the Loop Variable

The variable `i` in the loop above is useful — not wasted.

```python
for i in range(5):
    print("Step", i)
```

Output:
```
Step 0
Step 1
Step 2
Step 3
Step 4
```

You can also loop over a list directly:

```python
names = ["Alex", "Bri", "Chen"]
for name in names:
    print("Hello,", name)
```

Output:
```
Hello, Alex
Hello, Bri
Hello, Chen
```

```notes
The loop variable name is up to you. `i` is a convention for integers, but `name` or `student` or `color` would all work. Choose a name that describes what the variable represents.

Writing `for x in names` works, but a reader has to squint to know that `x` is a name. `for name in names` tells the reader.

If you find yourself writing `for i in range(len(names)):` and then immediately `name = names[i]`, that's a sign you should be doing `for name in names` directly. The indexed form is sometimes necessary — but try the direct form first.
```

---

### Accumulating Values

A common loop pattern: keep a running total.

```python
total = 0
for price in [4, 6, 2, 8]:
    total = total + price
print(total)   # 20
```

The loop body runs four times. Each time, the current `price` is added to `total`. At the end, `total` holds the sum.

A shorthand: `total += price` means exactly the same as `total = total + price`.

```notes
The accumulator pattern is one of the three or four most important patterns in programming. It shows up in almost every program that processes a collection of things.

Walk through it step by step on paper:
- Start: total = 0
- After loop 1 (price = 4): total = 0 + 4 = 4
- After loop 2 (price = 6): total = 4 + 6 = 10
- After loop 3 (price = 2): total = 10 + 2 = 12
- After loop 4 (price = 8): total = 12 + 8 = 20

The key insight: the variable `total` survives across loop iterations. The variable `price` gets a new value each time. That difference is what makes accumulation possible.

A common bug: putting `total = 0` INSIDE the loop. Then total gets reset to 0 every iteration, and only the last price is ever added.
```

---

### The `while` Loop

`for` loops are great when you know how many times to iterate. For "loop until some condition is met," use `while`:

```python
count = 10
while count > 0:
    print(count)
    count -= 1
print("Liftoff!")
```

- Each pass: check the condition. If true, run the body. Then check again.
- If the condition is never made false, the loop runs forever — an **infinite loop**.

```python
count = 10
while count > 0:
    print(count)
    # forgot to decrement count!
```

This prints 10 forever. If your program hangs or spams output without stopping, chances are you have an infinite loop.

```notes
Infinite loops are a rite of passage. Every programmer writes one. Many programmers write one every week.

The cause is almost always the same: the variable the condition depends on is not changing inside the loop. Either you forgot to update it, or you updated a different variable by mistake.

When you run a program and it gets stuck, press Ctrl+C to stop it. (On some systems, close the terminal window.) Then look at your loop: what variable does the condition depend on? Does the body change that variable? If not, there's your bug.

Don't be embarrassed when you write an infinite loop. Be embarrassed only if you don't know how to find it.
```

---

### Breaking Out Early

Sometimes you want to stop a loop in the middle:

```python
for number in [3, 1, 4, 1, 5, 9, 2, 6]:
    if number == 5:
        print("Found 5!")
        break
    print("Not 5:", number)
```

`break` immediately exits the loop. The loop stops dead.

```notes
`break` is useful but slightly dangerous. It jumps out of the loop without finishing. If someone is reading your code from top to bottom, `break` forces them to notice that the loop might end earlier than expected.

Use `break` when you genuinely want to stop as soon as a condition is met. Don't use it to avoid thinking through the loop condition — there's usually a cleaner way using `while` or a boolean flag.
```

---

### Let's Practice!

**Question 1** (predict the output):

```python
for i in range(3):
    for j in range(2):
        print(i, j)
```

How many lines does this print? What are they?

**Question 2**: Write a loop that prints the squares of 1 through 10 (that is: 1, 4, 9, 16, ..., 100).

**Question 3**: Find the bug:

```python
total = 0
for n in [1, 2, 3, 4, 5]:
    total = n
print(total)
```

What does this print, and what did the author probably intend?

```notes
Question 1 prints 6 lines: (0,0), (0,1), (1,0), (1,1), (2,0), (2,1). This is a nested loop. The inner loop runs in full for each value of the outer loop.

Students who are new to nested loops often expect 5 lines (thinking the loops run side-by-side), or 3 lines (thinking `j` ranges over a subset of `i`). Neither is right. Work through the iterations carefully.

Question 2 should be straightforward: `for n in range(1, 11): print(n * n)`. Watch out for `range(1, 10)` which stops at 9 and misses the 100. Also watch for students who use the squares of 0-9 by accident.

Question 3 prints 5. The author probably meant `total += n` (or `total = total + n`), which would print 15. The bug is that `total = n` replaces rather than accumulates. Every iteration overwrites the previous value, so at the end `total` is just the last `n`.

A student who looks at this and says "it's adding them up" is not reading what's actually there. Ask them to trace it on paper: after the loop with n=1, what is total? (Answer: 1. Not 0 plus 1. Just 1.)
```

---

## <a id="activity"></a>Activity: The Grocery Checker

Write a program that:

1. Has a list of prices: `prices = [2.99, 5.49, 1.25, 8.00, 3.50]`
2. Loops through the list and computes the total.
3. Also counts how many items cost more than $3.
4. Prints both the total and the count.

For extra challenge: compute the average price per item.

```notes
This exercise combines accumulation with conditional counting — a very common pattern in real programs.

A clean solution:

```python
prices = [2.99, 5.49, 1.25, 8.00, 3.50]
total = 0
expensive_count = 0
for price in prices:
    total += price
    if price > 3:
        expensive_count += 1
print("Total:", total)
print("Expensive items:", expensive_count)
```

The two accumulators (`total` and `expensive_count`) live in the same loop. Students sometimes write two separate loops doing the same iteration, which works but is wasteful.

The average is `total / len(prices)`. Watch for students who compute total first, then loop AGAIN just to count the items — they should use `len(prices)` instead of a counter loop.

If a student's code prints an obviously wrong total (like 0, or the last price), look for the `total = 0` position. If it's inside the loop, that's the bug.
```
