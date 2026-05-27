import "dotenv/config";
import { productionTextbookRetrieve } from "../lib/ragRetrieve";
import { isPineconeTextbookConfigured } from "../lib/ragPinecone";

async function testPinecone() {
  console.log("=== PINECONE CONFIGURATION CHECK ===");
  console.log("PINECONE_API_KEY:", process.env.PINECONE_API_KEY ? "Present" : "Missing");
  console.log("PINECONE_INDEX_NAME:", process.env.PINECONE_INDEX_NAME ?? "Missing");
  console.log("OPENAI_API_KEY:", process.env.OPENAI_API_KEY ? "Present" : "Missing");
  
  const configured = isPineconeTextbookConfigured();
  console.log("Is Pinecone configured in env?:", configured);

  if (!configured) {
    console.error("Error: Pinecone is not properly configured. Check your environment variables.");
    process.exit(1);
  }

  console.log("\n=== RUNNING SEMANTIC SEARCH QUERY ===");
  const query = "treatment options for acne and hyperpigmentation";
  console.log(`Query: "${query}"`);

  try {
    const results = await productionTextbookRetrieve({
      query,
      topK: 3,
    });

    console.log(`\nQuery completed successfully. Retrieved ${results.length} chunks:`);
    results.forEach((item, index) => {
      console.log(`\n[Result #${index + 1}] Source: ${item.chunk.source} (Page Hint: ${item.chunk.pageHint}) (Score: ${item.score.toFixed(4)})`);
      console.log(`Text snippet: "${item.chunk.text.slice(0, 300)}..."`);
    });
  } catch (error) {
    console.error("Error during Pinecone query execution:", error);
  }
}

testPinecone();
