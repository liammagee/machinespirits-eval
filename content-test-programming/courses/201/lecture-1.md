
## <a id="main-lecture"></a>Variables and Values

---

### What is a Variable?

- A **variable** is a name you give to a piece of data so you can refer to it later.
- In Python, you create a variable by writing its name, an equals sign, and the value:

```python
age = 25
name = "Sam"
temperature = 98.6
```

- After this runs, the name `age` refers to the number 25. You can use `age` anywhere you would have written 25.

```notes
A variable is like a sticky note you put on a piece of data. The data itself is the real thing — a number, a word, a list. The variable is just a name you use to refer to it.

When we write `age = 25`, we are not saying "age equals 25" in the math sense. We are saying: "take the number 25 and stick the label 'age' on it." This is called assignment.

The order matters. The value on the right gets computed first, then the name on the left is attached to it. You can't swap them: `25 = age` is an error.
```

---

### Assignment is Not Equality

This is the single most common confusion in the first week of programming:

- `=` means **assign** (give this name to this value).
- `==` means **is equal to** (ask whether two values are the same).

```python
x = 5         # assignment: x now refers to 5
x == 5        # question: is x equal to 5? Answer: True
x = x + 1     # assignment: compute x + 1, then rename the result "x"
```

The last line looks impossible in math — you cannot have `x = x + 1`. But in Python it is normal: compute `x + 1` (which is 6), then reassign the name `x` to point to 6.

```notes
In algebra, `x = x + 1` is nonsense. There's no number that is one more than itself.

But in programming, the equals sign is not asking a question. It's giving a command: "make this happen." So `x = x + 1` says: "take whatever x currently is, add 1 to it, and call the result x from now on."

If you find yourself saying "but that's not how equals works" — good. Pay attention to that feeling. It means you're noticing a real difference. The equals sign does two different jobs in programming, and you have to learn which job it's doing by looking at the context.
```

---

### What Can a Variable Hold?

Variables can hold different kinds of data, called **types**:

| Type | Example | What it's for |
|------|---------|---------------|
| `int` | `42` | whole numbers |
| `float` | `3.14` | numbers with a decimal point |
| `str` | `"hello"` | text (called a "string") |
| `bool` | `True`, `False` | yes/no values |

```python
count = 3              # int
price = 9.99           # float
greeting = "hi there"  # str
is_open = True         # bool
```

```notes
Notice that strings have quotation marks around them, but numbers don't. This matters.

`"3"` and `3` are different in Python. The first is a string that happens to look like a digit. The second is an actual number. You can add `3 + 3` and get `6`, but `"3" + "3"` gives you `"33"` — it glues the strings together.

This is a place where beginners often get mystifying errors. If you ever get a TypeError that says "cannot add int and str," it is almost always because you put quotation marks somewhere you shouldn't, or forgot them where you should.
```

---

### Renaming and Reassignment

Once a variable exists, you can give it a new value by assigning again:

```python
score = 10
print(score)   # 10

score = 20
print(score)   # 20
```

The old value (10) is simply forgotten. The name `score` now refers to 20. There is only ever one value attached to a name at a time.

You can also copy a value to another variable:

```python
a = 5
b = a
a = 100
print(a)   # 100
print(b)   # 5  — b still has the old copy
```

```notes
This is a subtle point worth slowing down for.

When we write `b = a`, Python takes the value that `a` currently refers to (which is 5) and attaches the name `b` to it. At that moment, both names point to the value 5.

Then when we write `a = 100`, we move the label `a` over to a new value, 100. The label `b` doesn't move. It still points to 5.

Variables are not connected to each other. They are just independent labels. Moving one does not drag the others along.

If this feels unintuitive, try writing each step on paper and drawing where each label is pointing. That's what good programmers actually do in their heads.
```

---

### Let's Practice!

**Question 1** (predict the output — do not run yet):

```python
x = 7
y = x
x = 3
print(y)
```

What does `print(y)` show? Why?

**Question 2**: Write one line of Python that creates a variable `full_name` containing your first and last name as a single string.

**Question 3**: Find the bug:

```python
age = "29"
older = age + 1
print(older)
```

Why does this crash? What is the fix?

```notes
For question 1, the answer is 7, not 3. Remember: when we said `y = x`, Python copied the value, not the name. Changing x later doesn't change y.

If a student gets this wrong, don't just give them the answer. Ask them to draw the labels and values on paper. The visual helps.

For question 2, there are many valid answers: `full_name = "Sam Rivera"`, for example. Check that they used quotation marks.

For question 3, the bug is that `age` is a string (notice the quotation marks around "29"), not a number. You cannot add 1 to a string. The fix is either to remove the quotation marks (if age is really a number) or to convert: `older = int(age) + 1`.

A student who says "it looks fine to me" is not looking carefully at the quotation marks. Point them toward the quotation marks specifically.
```

---

## <a id="activity"></a>Activity: Trace On Paper

Copy the following program onto paper. Next to each line, write down what the values of `a`, `b`, and `c` are AFTER that line runs.

```python
a = 2
b = 3
c = a + b
a = c
b = a - b
c = a + b
```

Before you run the code, write your final values on paper. Then run it and compare.

**Why paper?** When you are stuck later in this course, the single most useful thing you can do is trace your program by hand, one line at a time. It is slow on purpose. Training your brain to slow down is the whole point.

```notes
The correct final values are a = 5, b = 2, c = 7.

This exercise is deliberately boring. That is the point. Students who can trace three variables over six lines on paper can debug their own code. Students who cannot, cannot.

If a student gets it wrong, do not just give them the right answer. Ask them to redo it with an extra column on the paper: "what was on the right-hand side BEFORE the assignment?" That intermediate step is usually where the mistake lives.

A student who says "this is pointless, I'll just run it" is missing the skill the exercise teaches. The skill is not the answer. The skill is being patient enough to compute it yourself.
```
