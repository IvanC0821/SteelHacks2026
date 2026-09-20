"""Original fictional 21-127 exercises, references, and upload samples.

Topic-level inspiration only: sets/quantifiers, rationality, divisibility and proof writing.
No real homework wording, scans, student work or course policies are reproduced.
"""

COURSE_NAME = "21-127 Concepts of Mathematics (fictional)"
NOTES = (
    "Grade only the listed mathematical requirements. Accept every valid alternative proof. "
    "Do not deduct for verbosity, harmless detours, nonstandard but defined notation, or a "
    "clearly withdrawn error when the final argument is complete and readable. Integer "
    "arithmetic and elementary order properties may be used without proof. Do not invent "
    "method restrictions beyond those explicitly stated in the individual exercise. "
    "Do not charge the same missing step under multiple criteria. If evidence is insufficient "
    "to judge, mark uncertain instead of assuming an error. References are staff-only and "
    "must not appear in student hints. These are fictional practice assignments."
)


def question(title, prompt, reference, clean, mixed, criteria):
    return dict(
        title=title,
        prompt=prompt,
        reference=reference,
        clean=clean,
        mixed=mixed,
        criteria=[dict(description=d, points=p, category=c) for d, p, c in criteria],
    )


HOMEWORKS = [
    dict(
        slug="hw1-foundations",
        title="Homework 1 - Foundations of proof",
        questions=[
            question(
                "Sets in three forms",
                [
                    r"Let $\mathbb{N}=\{0,1,2,\ldots\}$. Give short answers; no justification is required.",
                    r"(a) List $A=\{n\in\mathbb{N}:12<n<90\text{ and }n\text{ is a square or a cube}\}$ in roster notation.",
                    r"(b) Write $B=\{1,6,11,16,\ldots\}$ in set-builder notation.",
                    r"(c) Write $C=\{\ldots,1/27,1/9,1/3,1,3,9,27,\ldots\}$ in set-builder notation.",
                ],
                [
                    r"(a) $A=\{16,25,27,36,49,64,81\}$.",
                    r"(b) $B=\{5k+1:k\in\mathbb{N}\}$. The definition of $\mathbb{N}$ includes zero.",
                    r"(c) $C=\{3^k:k\in\mathbb{Z}\}$. Negative exponents give the reciprocals.",
                ],
                [
                    r"(a) $A=\{16,25,27,36,49,64,81\}$.",
                    r"(b) $B=\{5k+1:k\in\mathbb{Z},\ k\geq0\}$.",
                    r"(c) $C=\{3^k:k\in\mathbb{Z}\}$.",
                ],
                [
                    r"(a) $A=\{16,25,36,49,64,81\}$.",
                    r"(b) $B=\{5k+1:k\in\mathbb{Z},\ k\geq0\}$.",
                    r"(c) $C=\{3^k:k\in\mathbb{Z}\}$.",
                ],
                [
                    (
                        "Part (a) lists exactly 16,25,27,36,49,64,81, with no missing or extra elements.",
                        4,
                        "arithmetic",
                    ),
                    (
                        "Part (b) gives exactly {5k+1 : k is an integer and k >= 0}, or an equivalent set.",
                        3,
                        "notation",
                    ),
                    (
                        "Part (c) gives all integer powers of 3, including negative exponents and zero.",
                        3,
                        "notation",
                    ),
                ],
            ),
            question(
                "A divisibility claim",
                [
                    r"Determine whether the proposition is true or false. Prove it if true; otherwise give and verify a counterexample.",
                    r"For all integers $a,b$, if $10\mid ab$, then $10\mid a$ or $10\mid b$.",
                ],
                [
                    r"The proposition is false. Set $a=2$ and $b=5$. Then $ab=10$, so $10\mid ab$, but $10$ divides neither $2$ nor $5$. Thus the hypothesis holds and the conclusion fails.",
                ],
                [
                    r"False: take $a=2$ and $b=5$. Their product is $10=10\cdot1$. Neither $2/10$ nor $5/10$ is an integer, so neither factor is divisible by $10$. This disproves the universal implication.",
                ],
                [
                    r"The statement is true. If a number divides a product, it must divide at least one factor. Applying that fact to $10$ gives the result.",
                ],
                [
                    (
                        "Supplies integer values satisfying 10 | ab but neither 10 | a nor 10 | b (a valid counterexample).",
                        6,
                        "logic",
                    ),
                    (
                        "Explicitly verifies the hypothesis and failure of both alternatives in the conclusion, then states false.",
                        4,
                        "justification",
                    ),
                ],
            ),
            question(
                "A rational point inside an interval",
                [
                    r"Let $x,y\in\mathbb{Q}$ with $x<y$, and let $u=(3x+y)/4$. Prove that $u\in\mathbb{Q}$ and $x<u<y$.",
                    r"For rationality, use the definition of a rational number; merely citing closure of $\mathbb{Q}$ is not sufficient for this exercise.",
                ],
                [
                    r"Write $x=a/b$ and $y=c/d$ for integers $a,b,c,d$ with $b,d\neq0$. Then $u=(3ad+bc)/(4bd)$. Its numerator and denominator are integers and $4bd\neq0$, so $u$ is rational by definition.",
                    r"Since $y-x>0$, $u-x=(y-x)/4>0$ and $y-u=3(y-x)/4>0$. Therefore $x<u<y$.",
                ],
                [
                    r"My first thought was to call this a weighted average, but I will check the required definition directly. Choose integers $a,b,c,d$ with $b,d\neq0$ such that $x=a/b$ and $y=c/d$.",
                    r"Then $u=(3ad+bc)/(4bd)$. Both parts are integers, and $4bd$ is nonzero. Hence $u\in\mathbb{Q}$.",
                    r"Finally, $u-x=(y-x)/4>0$ and $y-u=3(y-x)/4>0$, since $x<y$. This proves the strict inequalities.",
                ],
                [
                    r"The rational numbers are closed under addition, multiplication, and division by a nonzero rational. Therefore $u$ is rational.",
                    r"Also $u-x=(y-x)/4>0$ and $y-u=3(y-x)/4>0$. Hence $x<u<y$.",
                ],
                [
                    (
                        "Gives a definition-based integer-over-nonzero-integer representation of u from rational representations of x and y; verifies integer numerator/denominator and nonzero denominator. Closure alone does not meet this explicitly requested component.",
                        5,
                        "justification",
                    ),
                    ("Proves x < u using y-x > 0, or a valid equivalent argument.", 2.5, "logic"),
                    ("Proves u < y using y-x > 0, or a valid equivalent argument.", 2.5, "logic"),
                ],
            ),
            question(
                "An odd expression",
                [
                    r"Prove that $n^2+3n+1$ is odd for every integer $n$. Your argument must cover negative integers as well as nonnegative integers.",
                ],
                [
                    r"Write the expression as $n(n+3)+1$. If $n=2k$ is even, its product term is $2k(n+3)$. If $n=2k+1$ is odd, then $n+3=2(k+2)$ and the product term is $2n(k+2)$. In both cases the product is twice an integer. Adding one gives an odd integer. Every integer has one of these two parity forms, including negative integers.",
                ],
                [
                    r"For any integer $n$, first factor $n^2+3n=n(n+3)$. If $n$ is even, this product is even. If $n$ is odd, write $n=2k+1$ with $k\in\mathbb{Z}$; then $n+3=2(k+2)$, so the product is again even.",
                    r"Thus $n(n+3)=2m$ for some integer $m$, and $n^2+3n+1=2m+1$. This is odd by definition. No positivity assumption was made.",
                ],
                [
                    r"For $n=0,1,2$, the expression is $1,5,11$. All three values are odd, and the outputs are increasing, so they continue to be odd for all integers $n$.",
                ],
                [
                    (
                        "Proves n(n+3) is even for arbitrary integers, covering both parity cases or using another valid universal argument. Numerical tests or growth alone do not prove parity.",
                        7,
                        "logic",
                    ),
                    (
                        "Explains that adding 1 to the established even product yields an odd integer, completing the stated universal claim.",
                        3,
                        "justification",
                    ),
                ],
            ),
            question(
                "Removing either set",
                [
                    r"For arbitrary sets $A,B,C$, prove by double containment that $A\setminus(B\cup C)=(A\setminus B)\cap(A\setminus C)$.",
                ],
                [
                    r"If $t\in A\setminus(B\cup C)$, then $t\in A$, $t\notin B$, and $t\notin C$. Thus $t$ belongs to both $A\setminus B$ and $A\setminus C$, proving the first containment.",
                    r"Conversely, if $t\in(A\setminus B)\cap(A\setminus C)$, then $t\in A$ and $t$ belongs to neither $B$ nor $C$. Hence $t\notin B\cup C$, so $t\in A\setminus(B\cup C)$. The two containments establish equality.",
                ],
                [
                    r"Let $t\in A\setminus(B\cup C)$. It lies in $A$ but in neither $B$ nor $C$, so it lies in both differences on the right. This proves left-to-right containment.",
                    r"Now let $t$ belong to the intersection on the right. Membership in its two factors says $t\in A$, $t\notin B$, and $t\notin C$. Thus it lies in $A$ but outside $B\cup C$, which is the left-hand side. Both containments hold, so the sets are equal.",
                ],
                [
                    r"Take $t\in A\setminus(B\cup C)$. Then $t\in A$ and $t$ is in neither $B$ nor $C$. Hence $t\in A\setminus B$ and $t\in A\setminus C$. Therefore the two sets are equal.",
                ],
                [
                    (
                        "Proves containment from A minus (B union C) into the intersection by valid element reasoning.",
                        5,
                        "logic",
                    ),
                    (
                        "Proves the reverse containment as requested; a genuinely reversible chain explicitly establishing both directions also qualifies.",
                        5,
                        "justification",
                    ),
                ],
            ),
        ],
    ),
    dict(
        slug="hw2-creative",
        title="Homework 2 - Creative mathematical worlds",
        questions=[
            question(
                "The two-button robot",
                [
                    r"A robot's integer display starts at $0$. Button P adds $8$ and button Q subtracts $6$. You may press either button any nonnegative finite number of times, in any order, or press no buttons.",
                    r"Characterize exactly which integers can appear. Prove that every claimed value is reachable and that no other value is reachable.",
                ],
                [
                    r"Exactly the even integers are reachable. After $p$ presses of P and $q$ presses of Q, the display is $8p-6q=2(4p-3q)$, which is even.",
                    r"For a target $2t$ with integer $t\geq0$, repeat P,Q exactly $t$ times. Each block adds $2$. For $t<0$, repeat P,P,Q,Q,Q exactly $-t$ times; each block changes the display by $16-18=-2$. Zero needs no presses. All button counts are nonnegative, so every even target is attainable.",
                ],
                [
                    r"The answer is all even integers. With nonnegative counts $p,q$, the final value is $8p-6q=2(4p-3q)$, so no odd integer can occur.",
                    r"Let the desired value be $2t$. When $t\geq0$, repeat P,Q $t$ times, adding $2t$. When $t<0$, repeat P,P,Q,Q,Q $-t$ times: each block subtracts $2$, giving $2t$. The case $t=0$ uses the empty sequence. Thus the characterization includes both directions and both signs.",
                ],
                [
                    r"Exactly all even integers can occur. Each button changes the display by an even integer, so the display is always even. Pressing P and then Q adds $2$. Repeating that pair reaches every even integer, which finishes the proof.",
                ],
                [
                    (
                        "Shows every reachable value is even, and identifies the candidate set as all even integers.",
                        3,
                        "logic",
                    ),
                    (
                        "Constructs legal finite nonnegative button counts for every positive even target and for zero.",
                        3,
                        "justification",
                    ),
                    (
                        "Constructs legal finite nonnegative button counts for every negative even target; repeating a +2 block alone is not sufficient.",
                        4,
                        "justification",
                    ),
                ],
            ),
            question(
                "One key for every visitor?",
                [
                    r"There are three visitors $V=\{\mathrm{Ada},\mathrm{Bo},\mathrm{Cy}\}$ and three keys $K=\{\mathrm{red},\mathrm{green},\mathrm{blue}\}$. The predicate $R(v,k)$ means that key $k$ opens visitor $v$'s locker.",
                    r"Write quantified statements for (a) every visitor has at least one working key and (b) there is a single key that works for every visitor. Does (a) imply (b)? Give a fully specified counterexample or a proof.",
                ],
                [
                    r"(a) $\forall v\in V,\ \exists k\in K,\ R(v,k)$. (b) $\exists k\in K,\ \forall v\in V,\ R(v,k)$.",
                    r"The implication is false. Define $R$ to be true exactly for (Ada,red), (Bo,green), and (Cy,blue), and false for all six other visitor-key pairs. Each visitor has a working key. Red fails for Bo, green fails for Cy, and blue fails for Ada; therefore no single key works for all visitors.",
                ],
                [
                    r"The first statement is $\forall v\in V\ \exists k\in K\ R(v,k)$; the second is $\exists k\in K\ \forall v\in V\ R(v,k)$.",
                    r"I briefly wondered whether having equally many visitors and keys forces a universal key, but that count says nothing about which lockers they open. Make only (Ada,red), (Bo,green), and (Cy,blue) true; make every other pair false.",
                    r"Every visitor now has a witness for the first statement. Each key fails for two visitors, so none witnesses the second. Thus (a) does not imply (b).",
                ],
                [
                    r"(a) is $\forall v\in V\ \exists k\in K\ R(v,k)$ and (b) is $\exists k\in K\ \forall v\in V\ R(v,k)$.",
                    r"For a counterexample, let red work only for Ada, green only for Bo, and blue only for Cy. No other openings are allowed. Each visitor has a key, but every key fails for the other two visitors. Thus the implication is false.",
                ],
                [
                    (
                        "Translates statement (a) with a possibly visitor-dependent existential key after the universal visitor quantifier.",
                        2,
                        "notation",
                    ),
                    (
                        "Translates statement (b) with one existential key before the universal visitor quantifier.",
                        2,
                        "notation",
                    ),
                    (
                        "Fully specifies a relation satisfying (a) but not (b), and verifies both properties. Correct detours receive no deduction.",
                        6,
                        "logic",
                    ),
                ],
            ),
            question(
                "Three self-referential cards",
                [
                    r"Three cards carry the following statements. Card A: 'Card B is false.' Card B: 'Card C is false.' Card C: 'Card A and Card B are both false.'",
                    r"Assign true or false to each card so that each assigned value agrees with what the card says. Prove that your assignment is the only consistent one.",
                ],
                [
                    r"Suppose B were false. Its statement would make C true. C being true would require A and B both false, but A being false means B is true, a contradiction. Therefore B must be true.",
                    r"Then C is false because B says C is false, and A is false because B is true. This triple is consistent: A's claim is false, B's claim is true, and C's conjunction is false. B=false was impossible, so (A,B,C)=(false,true,false) is unique.",
                ],
                [
                    r"Assume B is false. Then its statement 'C is false' is false, so C is true. C would force A to be false, but A being false says B is not false. That contradicts our assumption. Hence B is true.",
                    r"Consequently C is false and A is false. Checking the resulting triple: B really is true, so A's claim is false; C really is false, so B's claim is true; A and B are not both false, so C's claim is false. The alternative value for B was impossible, proving uniqueness.",
                ],
                [
                    r"A is true, B is false, and C is true. A correctly says that B is false, and B incorrectly says that C is false. Since those two cards agree with the assignment, this is a consistent solution. The cards force one another, so it is unique.",
                ],
                [
                    (
                        "Gives the consistent assignment A=false, B=true, C=false and verifies the contents of all three cards, including C's conjunction.",
                        6,
                        "logic",
                    ),
                    (
                        "Rules out all other assignments with an exhaustive truth table or a valid argument forcing the values; assertion of uniqueness alone is insufficient.",
                        4,
                        "justification",
                    ),
                ],
            ),
            question(
                "The archive's invert-selection button",
                [
                    r"An archive has a finite set $U$ of files. Clicking 'Invert' changes a selected subset $A\subseteq U$ to $T(A)=U\setminus A$.",
                    r"Prove that $T(T(A))=A$ for every subset $A$. If $U\neq\varnothing$, can any selection satisfy $T(A)=A$? Prove your answer, and explain separately what happens when $U=\varnothing$.",
                ],
                [
                    r"For every $x\in U$, membership in $T(T(A))$ means nonmembership in $T(A)$, which means membership in $A$. Neither set contains anything outside $U$. Thus $T(T(A))=A$.",
                    r"If $U$ is nonempty, take $x\in U$. If $x\in A$, then $x\notin T(A)$; otherwise $x\in T(A)$ but $x\notin A$. In either case the sets differ, so there is no fixed selection. If $U$ is empty, its only subset is empty and $T(\varnothing)=\varnothing$.",
                ],
                [
                    r"For a file $x\in U$, two inversions change selected to unselected to selected, or unselected to selected to unselected. Formally, $x\in T(T(A))$ if and only if $x\in A$. Neither set has an element outside $U$, so they are equal.",
                    r"Suppose $U$ has an element $x$. Whichever membership status $x$ has in $A$, its status in $T(A)$ is opposite. Therefore $T(A)\neq A$ for every $A$. If $U=\varnothing$, the only possible $A$ is empty, and inversion leaves it empty.",
                ],
                [
                    r"For each $x\in U$, $x\in T(T(A))$ means $x\notin U\setminus A$, hence $x\in A$. The equivalence goes both ways, and both sets are subsets of $U$. Thus $T(T(A))=A$.",
                    r"I also considered whether half the files being selected could make a fixed point. Equal size does not imply equal sets. With any file $x\in U$, inversion changes whether that very file belongs, so when $U$ is nonempty the two selections cannot be equal.",
                    r"For the empty archive there is just one selection, $A=\varnothing$, and it is fixed. This separate case is not a counterexample to the nonempty-archive claim.",
                ],
                [
                    (
                        "Proves double inversion equals A for arbitrary subsets, using an equivalence or both containments.",
                        4,
                        "logic",
                    ),
                    (
                        "Proves no fixed subset exists for nonempty U by tracking membership of an element, or another valid argument.",
                        4,
                        "logic",
                    ),
                    (
                        "Handles U empty: its unique subset is empty and is fixed. Harmless side discussions are not penalized.",
                        2,
                        "justification",
                    ),
                ],
            ),
            question(
                "The paired shelf labels",
                [
                    r"A librarian chooses $13$ distinct shelf labels from $\{1,2,\ldots,24\}$. Prove that two chosen labels differ by exactly $12$.",
                    r"If you use a counting or pigeonhole argument, specify the groups and explain why the counts force the conclusion.",
                ],
                [
                    r"Partition the labels into the 12 disjoint pairs $\{1,13\},\{2,14\},\ldots,\{12,24\}$. Every available label belongs to exactly one pair. If each pair contained at most one chosen label, at most 12 labels would have been chosen. Since 13 distinct labels were chosen, one pair contains both its members, whose difference is exactly 12.",
                ],
                [
                    r"Use the pairs $\{i,i+12\}$ for $i=1,\ldots,12$. The first entries are exactly 1 through 12 and the second entries exactly 13 through 24, so these pairs partition the available labels.",
                    r"If no pair had both entries selected, each of the 12 pairs could contribute at most one chosen label. That would allow at most 12 chosen labels, contrary to 13. Therefore some whole pair is selected, and its two labels differ by 12.",
                ],
                [
                    r"Put the 13 chosen labels in increasing order. There are 12 gaps between consecutive chosen labels and 24 possible shelf positions. By the pigeonhole principle, one consecutive gap must be 12, so two chosen labels differ by exactly 12.",
                ],
                [
                    (
                        "Defines 12 disjoint pairs {i,i+12}, i=1,...,12, covering all labels, or an equivalent valid grouping.",
                        5,
                        "logic",
                    ),
                    (
                        "Correctly uses 13 distinct choices in 12 groups to force a full pair and concludes difference exactly 12. A bare gap-count assertion is not a valid counting argument.",
                        5,
                        "justification",
                    ),
                ],
            ),
        ],
    ),
]


def assignment_payload(hw):
    return {
        "title": hw["title"],
        "questions": [
            {
                "id": f"q{i}",
                "title": q["title"],
                "prompt": "\n\n".join(q["prompt"]),
                "max_points": 10,
            }
            for i, q in enumerate(hw["questions"], 1)
        ],
    }


def rubric_payload(hw):
    return {
        "instructor_notes": NOTES,
        "criteria": [
            {**c, "id": f"q{i}-c{j}", "question_id": f"q{i}"}
            for i, q in enumerate(hw["questions"], 1)
            for j, c in enumerate(q["criteria"], 1)
        ],
    }
