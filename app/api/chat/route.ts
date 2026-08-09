import { NextRequest } from "next/server";
import { Pinecone } from "@pinecone-database/pinecone";
import { PineconeStore } from "@langchain/pinecone";
import { OpenAIEmbeddings, ChatOpenAI } from "@langchain/openai";
import { ConversationalRetrievalQAChain } from "langchain/chains";
import { BufferMemory } from "langchain/memory";

export async function POST(request: NextRequest) {
  const body = await request.json();

  const pinecone = new Pinecone();
  const pineconeIndex = pinecone.Index(
    process.env.PINECONE_INDEX_NAME as string
  );

  const vectorStore = await PineconeStore.fromExistingIndex(
    new OpenAIEmbeddings({ openAIApiKey: process.env.OPENAI_KEY }),
    { pineconeIndex }
  );

  const model = new ChatOpenAI({
    modelName: "gpt-3.5-turbo",
    streaming: true,
    openAIApiKey: process.env.OPENAI_KEY,
  });

  const chain = ConversationalRetrievalQAChain.fromLLM(
    model,
    vectorStore.asRetriever(),
    {
      returnSourceDocuments: true,
      memory: new BufferMemory({
        memoryKey: "chat_history",
        inputKey: "question",
        outputKey: "text",
      }),
    }
  );

  // Use chain.call() instead of chain.stream() for compatibility
  const result = await chain.call({ question: body.prompt });
  const answer = result.text ?? "Sorry, I couldn't generate an answer.";

  // Wrap the answer in a single-chunk ReadableStream so the frontend receives it as a streaming text response
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(answer));
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
    },
  });
}