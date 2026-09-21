# Aurora Cloud FixIt — Engine Edition

FixIt is a custom troubleshooting wrapper around a Gemini-compatible LLM connection.

## Product flow
1. User provides a description and/or evidence.
2. FixIt Engine inspects the evidence.
3. The engine separates observed facts from hypotheses.
4. It proposes the safest useful check first.
5. It gives concrete steps, expected results and failure branches.
6. It ends with a verification step.
7. The user can report what happened and continue the same FixIt session.
8. Astra remains the companion for explanations and follow-up questions.

## Gemini connection
- `🔑 My Gemini Key` stores a key in browser `sessionStorage` for the current session.
- Vercel can use `GEMINI_API_KEY` as a fallback.
- The browser sends the personal key through `x-fixit-api-key` to the server route.
- If an API route is unavailable while a personal key is active, the browser can fall back to Gemini directly.

## Important output behavior
FixIt does not parse the model answer into custom JSON cards. The model's returned text is assigned to a `<pre>` using `textContent`, preserving the model's emojis, markdown characters, bullets and line breaks exactly as returned.

The wrapper changes the *instruction/context sent to the model*, not the model's returned answer.
