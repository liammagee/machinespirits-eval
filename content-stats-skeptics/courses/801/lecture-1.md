## The Average Is a Lie

The most seductive number in everyday discourse is the average. "The average American household has X." "The average student scores Y." The word carries an air of finality, as though once you have the average you have captured the thing. In almost every interesting case, you have not. The average is a summary so compressed that it loses the features of the distribution that matter most. Understanding why is the first and most valuable habit of statistical thinking.

Begin with the technical distinction, which is simple. The mean is the arithmetic average: add up the values and divide by the count. The median is the middle value when the data are sorted. The mode is the most common value. For symmetric distributions with no outliers, these three tend to coincide, and which one you report hardly matters. For skewed distributions, they can diverge wildly, and the choice of summary becomes a choice about what story to tell.

The income example is the cleanest case. Suppose a town has a hundred households, ninety-nine earning fifty thousand dollars a year and one earning ten million. The mean income is roughly one hundred fifty thousand dollars. The median income is fifty thousand. A headline that reports the mean tells you the town is prosperous. A headline that reports the median tells you the town is ordinary with one rich person in it. Both numbers are arithmetically correct. Only one of them resembles what you would see if you walked down the street.

### Anscombe's Quartet

In 1973, the statistician Francis Anscombe produced a small dataset now taught in every introductory course, because it makes the point in a way that formulas alone cannot. Anscombe constructed four pairs of variables, each with eleven data points. Each pair has almost identical summary statistics: the same mean of x, the same mean of y, the same variance of x, the same variance of y, the same correlation coefficient, the same linear regression line. If you described these four datasets numerically, you would describe them identically.

Plotted, they are nothing alike. The first is a noisy but genuinely linear relationship. The second is a clean parabola that a straight line fits badly. The third is a tight line with a single outlier dragging the regression toward it. The fourth is a vertical stack of points plus one lone outlier that alone defines the apparent slope. Four pictures, four different worlds, one set of summary statistics. The quartet is the permanent argument for always plotting the data before believing any number computed from it.

### Skew, Variance, and What the Mean Hides

A distribution has more than one coordinate along which it can vary. The mean tells you where its center is. The variance tells you how spread out it is. The skew tells you whether it leans left or right. Higher moments describe its tails — how often extreme values occur. For many real-world variables, especially those touching money, mortality, or attention, the tails are where the interesting action lives. A social network where the average user has a hundred followers and a billionaire influencer has a hundred million has a mean that is meaningless and a tail that is the whole story.

The mean, in short, is a projection from a high-dimensional object — a distribution — onto a single number. Like any projection, it discards information. The discipline of statistical thinking begins with the habit of asking, every time a mean is cited, what was thrown away to produce it. Sometimes the answer is: nothing that matters. Often the answer is: the thing we came to find out.
