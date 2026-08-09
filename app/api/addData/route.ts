import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import { NextRequest, NextResponse } from "next/server";
import { Pinecone } from "@pinecone-database/pinecone";
import { OpenAIEmbeddings } from "@langchain/openai";
import { PineconeStore } from "@langchain/pinecone";

export async function POST(request: NextRequest) {
  const data = await request.formData();
  const file: File | null = data.get("file") as unknown as File;

  if (!file) {
    return NextResponse.json({ success: false, error: "No file found" });
  }

  if (file.type !== "application/pdf") {
    return NextResponse.json({ success: false, error: "Invalid file type" });
  }

  // Load the PDF
  const loader = new PDFLoader(file);
  const rawDocs = await loader.load();

  // Split into chunks
  const textSplitter = new RecursiveCharacterTextSplitter({
    chunkSize: 1000,
    chunkOverlap: 200,
  });
  const splitDocuments = await textSplitter.splitDocuments(rawDocs);

  // Store in Pinecone
  const pinecone = new Pinecone();
  const pineconeIndex = pinecone.Index(
    process.env.PINECONE_INDEX_NAME as string
  );

  await PineconeStore.fromDocuments(
    splitDocuments,
    new OpenAIEmbeddings({ openAIApiKey: process.env.OPENAI_KEY }),
    { pineconeIndex }
  );

  return NextResponse.json({ success: true });
}