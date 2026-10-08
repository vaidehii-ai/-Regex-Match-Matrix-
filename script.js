// ======================================================
// REGEX MATCH MATRIX
// Lightweight Regex Engine From Scratch
// No native RegExp() used
// ======================================================


// ======================================================
// CHECK MATCH
// ======================================================

function checkRegex() {

    const pattern =
        document.getElementById("pattern").value;

    const input =
        document.getElementById("inputString").value;

    const result =
        document.getElementById("result");

    result.className = "";


    if (pattern === "") {

        result.innerHTML =
            "Please enter a pattern.";

        return;
    }


    try {

        const ast = parsePattern(pattern);

        let steps = [];

        let matched = false;


        // Try every OR alternative
        for (let i = 0; i < ast.length; i++) {

            let tempSteps = [];

            let positions = matchSequence(
                ast[i],
                0,
                input,
                0,
                tempSteps
            );


            if (positions.includes(input.length)) {

                steps = tempSteps;
                matched = true;

                break;
            }
        }


        if (!matched && steps.length === 0) {

            steps = [
                {
                    pattern: pattern,
                    input: input,
                    operation: "Pattern comparison",
                    result: "NO MATCH"
                }
            ];
        }


        showMatrix(steps);


        if (matched) {

            result.innerHTML = "✓ MATCH";
            result.className = "match";

        } else {

            result.innerHTML = "✗ NO MATCH";
            result.className = "no-match";
        }


    } catch (error) {

        result.innerHTML =
            "Invalid Pattern";

        result.className =
            "no-match";


        document.getElementById("matrix").innerHTML = `
            <p class="empty">
                ${escapeHTML(error.message)}
            </p>
        `;
    }
}


// ======================================================
// PARSE COMPLETE PATTERN
// ======================================================

function parsePattern(pattern) {

    let alternatives = [];

    let current = [];

    let i = 0;


    while (i < pattern.length) {

        // OR
        if (pattern[i] === "|") {

            if (current.length === 0) {
                throw new Error(
                    "Empty alternative before |"
                );
            }

            alternatives.push(current);

            current = [];

            i++;

            if (i === pattern.length) {
                throw new Error(
                    "Pattern cannot end with |"
                );
            }

            continue;
        }


        let atom;


        // Character class
        if (pattern[i] === "[") {

            let classResult =
                parseCharacterClass(
                    pattern,
                    i
                );

            atom = classResult.token;
            i = classResult.position;

        }


        // Dot
        else if (pattern[i] === ".") {

            atom = {
                type: "dot"
            };

            i++;

        }


        // Start anchor
        else if (pattern[i] === "^") {

            atom = {
                type: "start"
            };

            i++;

        }


        // End anchor
        else if (pattern[i] === "$") {

            atom = {
                type: "end"
            };

            i++;

        }


        // Escape
        else if (pattern[i] === "\\") {

            i++;

            if (i >= pattern.length) {

                throw new Error(
                    "Incomplete escape sequence"
                );
            }

            atom = {
                type: "literal",
                value: pattern[i]
            };

            i++;

        }


        // Quantifier without previous character
        else if (
            pattern[i] === "*" ||
            pattern[i] === "+" ||
            pattern[i] === "?"
        ) {

            throw new Error(
                "Quantifier needs a character before it"
            );

        }


        // Normal character
        else {

            atom = {
                type: "literal",
                value: pattern[i]
            };

            i++;
        }


        // Check quantifier

        if (
            i < pattern.length &&
            (
                pattern[i] === "*" ||
                pattern[i] === "+" ||
                pattern[i] === "?"
            )
        ) {

            if (
                atom.type === "start" ||
                atom.type === "end"
            ) {

                throw new Error(
                    "Anchor cannot have a quantifier"
                );
            }


            atom = {
                type: "quantifier",
                atom: atom,
                symbol: pattern[i]
            };


            i++;


            // Prevent things like a**
            if (
                i < pattern.length &&
                (
                    pattern[i] === "*" ||
                    pattern[i] === "+" ||
                    pattern[i] === "?"
                )
            ) {

                throw new Error(
                    "Multiple quantifiers are not allowed"
                );
            }
        }


        current.push(atom);
    }


    if (current.length === 0) {

        throw new Error(
            "Empty pattern"
        );
    }


    alternatives.push(current);

    return alternatives;
}


// ======================================================
// CHARACTER CLASS
// ======================================================

function parseCharacterClass(pattern, start) {

    let i = start + 1;

    let items = [];


    if (
        i < pattern.length &&
        pattern[i] === "^"
    ) {

        throw new Error(
            "Negated character classes are not supported"
        );
    }


    while (i < pattern.length) {

        if (pattern[i] === "]") {

            if (items.length === 0) {

                throw new Error(
                    "Empty character class"
                );
            }


            return {
                token: {
                    type: "class",
                    items: items
                },

                position: i + 1
            };
        }


        let first = pattern[i];

        i++;


        // Range such as a-z or 0-9

        if (
            i + 1 < pattern.length &&
            pattern[i] === "-" &&
            pattern[i + 1] !== "]"
        ) {

            i++;

            let last = pattern[i];

            i++;


            if (
                first.charCodeAt(0) >
                last.charCodeAt(0)
            ) {

                throw new Error(
                    "Invalid character range"
                );
            }


            items.push({
                type: "range",
                start: first,
                end: last
            });

        } else {

            items.push({
                type: "character",
                value: first
            });
        }
    }


    throw new Error(
        "Unclosed character class"
    );
}


// ======================================================
// MATCH SEQUENCE
// ======================================================

function matchSequence(
    tokens,
    index,
    input,
    position,
    steps
) {

    // All pattern tokens matched
    if (index === tokens.length) {

        return [position];
    }


    let token = tokens[index];


    // Normal token
    if (token.type !== "quantifier") {

        let results =
            matchAtom(
                token,
                input,
                position,
                steps
            );


        let finalPositions = [];


        for (let newPosition of results) {

            let nextResults =
                matchSequence(
                    tokens,
                    index + 1,
                    input,
                    newPosition,
                    steps
                );


            finalPositions.push(
                ...nextResults
            );
        }


        return finalPositions;
    }


    // Quantifier
    return matchQuantifier(
        token,
        tokens,
        index,
        input,
        position,
        steps
    );
}


// ======================================================
// QUANTIFIER MATCHING
// ======================================================

function matchQuantifier(
    token,
    tokens,
    index,
    input,
    position,
    steps
) {

    let symbol = token.symbol;

    let positions = [position];

    let current = position;


    // ----------------------------------------------
    // Find all possible repetitions
    // ----------------------------------------------

    while (true) {

        let before = current;

        let tempSteps = [];


        let result =
            matchAtom(
                token.atom,
                input,
                current,
                tempSteps
            );


        if (result.length === 0) {
            break;
        }


        let next = result[0];


        // Prevent infinite loop
        if (next === before) {
            break;
        }


        current = next;

        positions.push(current);


        steps.push(...tempSteps);


        if (current >= input.length) {
            break;
        }
    }


    // ----------------------------------------------
    // Minimum repetitions
    // ----------------------------------------------

    let minimum = 0;

    if (symbol === "+") {
        minimum = 1;
    }


    // ----------------------------------------------
    // Try longest match first
    // ----------------------------------------------

    for (
        let i = positions.length - 1;
        i >= minimum;
        i--
    ) {

        let tempSteps = [];


        let result =
            matchSequence(
                tokens,
                index + 1,
                input,
                positions[i],
                tempSteps
            );


        if (result.length > 0) {

            steps.push({

                pattern:
                    tokenToString(token),

                input:
                    input.substring(
                        position,
                        positions[i]
                    ),

                operation:
                    "Quantifier " +
                    symbol +
                    " matched",

                result:
                    "MATCH"
            });


            steps.push(...tempSteps);


            return result;
        }
    }


    return [];
}


// ======================================================
// MATCH ONE ATOM
// ======================================================

function matchAtom(
    atom,
    input,
    position,
    steps
) {


    // ----------------------------------------------
    // Start ^
    // ----------------------------------------------

    if (atom.type === "start") {

        if (position === 0) {

            steps.push({

                pattern: "^",

                input: "",

                operation:
                    "Start position check",

                result:
                    "MATCH"
            });


            return [position];
        }


        return [];
    }


    // ----------------------------------------------
    // End $
    // ----------------------------------------------

    if (atom.type === "end") {

        if (position === input.length) {

            steps.push({

                pattern: "$",

                input: "",

                operation:
                    "End position check",

                result:
                    "MATCH"
            });


            return [position];
        }


        return [];
    }


    // ----------------------------------------------
    // No input left
    // ----------------------------------------------

    if (position >= input.length) {

        steps.push({

            pattern:
                tokenToString(atom),

            input: "",

            operation:
                "No input character available",

            result:
                "NO MATCH"
        });


        return [];
    }


    let character =
        input[position];


    // ----------------------------------------------
    // Normal character
    // ----------------------------------------------

    if (atom.type === "literal") {

        if (character === atom.value) {

            steps.push({

                pattern:
                    atom.value,

                input:
                    character,

                operation:
                    "Character Match",

                result:
                    "MATCH"
            });


            return [
                position + 1
            ];
        }


        steps.push({

            pattern:
                atom.value,

            input:
                character,

            operation:
                "Character Compare",

            result:
                "NO MATCH"
        });


        return [];
    }


    // ----------------------------------------------
    // Dot .
    // ----------------------------------------------

    if (atom.type === "dot") {

        steps.push({

            pattern: ".",

            input:
                character,

            operation:
                "Any Character Match",

            result:
                "MATCH"
        });


        return [
            position + 1
        ];
    }


    // ----------------------------------------------
    // Character class
    // ----------------------------------------------

    if (atom.type === "class") {

        if (
            classMatches(
                atom,
                character
            )
        ) {

            steps.push({

                pattern:
                    tokenToString(atom),

                input:
                    character,

                operation:
                    "Character Class Match",

                result:
                    "MATCH"
            });


            return [
                position + 1
            ];
        }


        steps.push({

            pattern:
                tokenToString(atom),

            input:
                character,

            operation:
                "Character Class Compare",

            result:
                "NO MATCH"
        });


        return [];
    }


    return [];
}


// ======================================================
// CHARACTER CLASS CHECK
// ======================================================

function classMatches(
    atom,
    character
) {

    for (let item of atom.items) {


        if (item.type === "character") {

            if (
                character ===
                item.value
            ) {

                return true;
            }
        }


        if (item.type === "range") {

            let code =
                character.charCodeAt(0);


            let start =
                item.start.charCodeAt(0);


            let end =
                item.end.charCodeAt(0);


            if (
                code >= start &&
                code <= end
            ) {

                return true;
            }
        }
    }


    return false;
}


// ======================================================
// TOKEN TO STRING
// ======================================================

function tokenToString(token) {

    if (token.type === "literal") {

        return token.value;
    }


    if (token.type === "dot") {

        return ".";
    }


    if (token.type === "start") {

        return "^";
    }


    if (token.type === "end") {

        return "$";
    }


    if (token.type === "class") {

        let text = "[";


        for (let item of token.items) {

            if (
                item.type === "character"
            ) {

                text += item.value;
            }


            if (
                item.type === "range"
            ) {

                text +=
                    item.start +
                    "-" +
                    item.end;
            }
        }


        text += "]";

        return text;
    }


    if (
        token.type === "quantifier"
    ) {

        return (
            tokenToString(
                token.atom
            ) +
            token.symbol
        );
    }


    return "";
}


// ======================================================
// SHOW VERIFICATION MATRIX
// ======================================================

function showMatrix(steps) {

    let html = `

    <div class="matrix-table">

    <table>

        <tr>

            <th>Step</th>

            <th>Pattern</th>

            <th>Input</th>

            <th>Operation</th>

            <th>Result</th>

        </tr>
    `;


    if (steps.length === 0) {

        html += `

        <tr>

            <td colspan="5">
                No matching steps.
            </td>

        </tr>
        `;
    }


    steps.forEach(
        function(step, index) {

            let resultClass =
                step.result === "MATCH"
                    ? "valid"
                    : "invalid";


            html += `

            <tr>

                <td>
                    ${index + 1}
                </td>

                <td>
                    ${escapeHTML(
                        step.pattern
                    )}
                </td>

                <td>
                    ${escapeHTML(
                        step.input
                    )}
                </td>

                <td>
                    ${escapeHTML(
                        step.operation
                    )}
                </td>

                <td class="${resultClass}">
                    ${step.result}
                </td>

            </tr>
            `;
        }
    );


    html += `

    </table>

    </div>
    `;


    document.getElementById(
        "matrix"
    ).innerHTML = html;
}


// ======================================================
// HTML SAFETY
// ======================================================

function escapeHTML(value) {

    return String(value)

        .replace(
            /&/g,
            "&amp;"
        )

        .replace(
            /</g,
            "&lt;"
        )

        .replace(
            />/g,
            "&gt;"
        )

        .replace(
            /"/g,
            "&quot;"
        )

        .replace(
            /'/g,
            "&#039;"
        );
}


// ======================================================
// CLEAR
// ======================================================

function clearApp() {

    document.getElementById(
        "pattern"
    ).value = "";


    document.getElementById(
        "inputString"
    ).value = "";


    document.getElementById(
        "result"
    ).innerHTML = "";


    document.getElementById(
        "result"
    ).className = "";


    document.getElementById(
        "matrix"
    ).innerHTML = `

        <p class="empty">

            Enter a pattern and string
            to see step-by-step verification.

        </p>
    `;
}