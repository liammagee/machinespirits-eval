## Bias, Fairness, and Statistical Parity

It is tempting to imagine that fairness in machine learning is a matter of getting the math right. Build a model that treats everyone the same, audit it carefully, and the problem dissolves. The central result of the last decade of fairness research is that this hope is false in a specific and instructive way. There is no single mathematical definition of fairness. There are several, they are all reasonable, and they are, under realistic conditions, provably incompatible. You can have at most one at a time, and choosing which one you want is an ethical decision that cannot be deferred to a metric.

Consider three widely cited definitions. Demographic parity says that the model's positive predictions should occur at the same rate across protected groups: if fifty percent of men are flagged for a loan, fifty percent of women should be too. Equal opportunity, due to Hardt, Price, and Srebro, says that among people who actually repay, men and women should be flagged at the same rate — that is, the true positive rate should be equal across groups. Calibration says that when the model outputs a risk score of 0.7, the empirical frequency of the outcome should be 0.7 regardless of which group the person is in.

### The Impossibility Result

Alexandra Chouldechova (2017) and, independently, Kleinberg, Mullainathan, and Raghavan (2016) proved a sharp theorem. If the base rates of the outcome differ across groups — which in the real world they almost always do — then no model can satisfy calibration and equal false-positive and false-negative rates simultaneously, except in the trivial case of a perfect classifier. Said differently: if Black and white defendants have different base rates of rearrest within two years, a well-calibrated risk score will necessarily produce unequal error rates, and a system engineered to equalize error rates will necessarily fail to be well calibrated.

This is not a bug waiting for a patch. It is a feature of the structure of the problem. The world has inequalities, those inequalities show up in the data, and the formal machinery of prediction cannot smooth them into a single notion of equality. The incompatibility forces the modeler to articulate which kind of equality she is after, and to take responsibility for what the others will look like once that choice is made.

### Two Cases

The COMPAS controversy, reported by ProPublica in 2016, illustrated the stakes. Northpointe, the vendor, argued its recidivism risk tool was fair because it was approximately calibrated across race: a score of 7 meant roughly the same rearrest probability for Black and white defendants. ProPublica argued it was unfair because, among defendants who did not reoffend, Black defendants were far more likely to have been labeled high risk. Both sides were mathematically correct. They were measuring different things, each defensible, and the data made reconciliation impossible. The impossibility theorem was the ground truth that neither headline captured.

Amazon's résumé screener, abandoned internally in 2015, offers the other end. The system had learned from a decade of hiring decisions in which men were disproportionately successful. It duly penalized résumés that mentioned "women's" — as in "women's chess club" — and downgraded graduates of two all-women's colleges. There was no explicit bias in the code. The unfairness was encoded in the training data and faithfully reproduced. This case required no impossibility theorem to diagnose: the tool was learning a discriminatory pattern that could not be justified by any fairness definition.

### The Lesson

The right response to the impossibility result is not despair. It is explicitness. A team deploying a risk model must decide in advance which notion of fairness it is optimizing, document the tradeoffs, and be prepared to defend the choice in the terms the choice actually involves. Moral seriousness here looks like arithmetic, and then like argument. It never looks like a silent default.
