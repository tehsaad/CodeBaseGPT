# AI usage disclosure

- **Gemma** (Google's open model family), through the endpoint you configure, generates answers in *Ask* and explanations in *Stuck Mode*. Each answer shows the model label. The model receives only the retrieved snippets, optional web search excerpts, recent conversation turns, and the policy text.
- **Embeddings** (optional, `gemini-embedding-001`) convert code chunks and questions into vectors for semantic retrieval.
- **No AI** is used for parsing, import resolution, the Atlas, insights metrics, or search query generation. Those are deterministic.
- AI output can be wrong. Statements about the repository must carry `[C#]` citations you can open; anything else is labelled as inference. CodeBaseGPT never claims to have executed or tested code.
- This project was built with assistance from an AI coding agent (Claude). The code is reviewed by and owned by the repository author.
