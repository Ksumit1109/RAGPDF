import 'dotenv/config';
import { Worker } from 'bullmq';
import { OpenAIEmbeddings } from "@langchain/openai";
import { QdrantVectorStore } from "@langchain/qdrant";
import { Document } from "@langchain/core/documents";
import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";
import {
 
} from "@langchain/textsplitters"; // help to chunk the data
import { HuggingFaceInferenceEmbeddings } from "@langchain/community/embeddings/hf";

if (!process.env.HUGGINGFACEHUB_API_KEY) {
    throw new Error("HUGGINGFACEHUB_API_KEY is not set. Define it in your .env file.");
}

const worker = new Worker('file-upload-queue',
    async job => {
        console.log("job", job.data)
        const data = JSON.parse(job.data);
        /*
        Path: data.path
        read the pdf from path,
        chunk the pdf,
        call the openai embedding model for every chunk,
        store the chunk in qdrant db
        */

        //Load the pdf

        const loader = new PDFLoader(data.path); // add the pdf path to load the pdf 
        const docs = await loader.load(); //created the docs of pdf  
        const embeddings = new HuggingFaceInferenceEmbeddings({
            apiKey: process.env.HUGGINGFACEHUB_API_KEY, // or omit to rely on default env pickup
            model: "Qwen/Qwen3-Embedding-8B", // Defaults to `BAAI/bge-base-en-v1.5` if not provided
            provider: "nebius", // Falls back to auto selection mechanism within Hugging Face's inference API if not provided
        });

        const vectorStore = await QdrantVectorStore.fromExistingCollection(embeddings, {
            url: "http://localhost:6333",
            collectionName: "pdf-docs",
        });

        await vectorStore.addDocuments(docs);
        console.log("All docs are added to vector store")
    },
    {
        concurrency: 100,
        connection: {
            host: "localhost",
            port: "6379"
        }
    }

);