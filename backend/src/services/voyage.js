const API_URL = "https://api.voyageai.com/v1/embeddings";

// Voyage AI embeddings, called directly over fetch. Used to build the pgvector
// index over raw entries (JOURNAL.md section 6), separate from the living profile.
export async function embedText(text, { inputType = "document" } = {}) {
  if (!process.env.VOYAGE_API_KEY) {
    throw new Error("VOYAGE_API_KEY is not set");
  }

  const response = await fetch(API_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${process.env.VOYAGE_API_KEY}`,
    },
    body: JSON.stringify({
      model: process.env.VOYAGE_MODEL || "voyage-3",
      input: [text],
      input_type: inputType,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Voyage API error ${response.status}: ${body}`);
  }

  const data = await response.json();
  return data.data[0].embedding;
}
