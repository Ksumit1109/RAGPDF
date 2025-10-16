import 'dotenv/config';
import { Worker } from 'bullmq';
import { QdrantVectorStore } from "@langchain/qdrant";
import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";
import { HuggingFaceInferenceEmbeddings } from "@langchain/community/embeddings/hf";

if (!process.env.HUGGINGFACEHUB_API_KEY) {
    throw new Error("HUGGINGFACEHUB_API_KEY is not set");
}


const redisConnection = process.env.REDIS_URL 
    ? { 
        url: process.env.REDIS_URL,
        tls: {} // Required for Upstash
      }
    : {
        host: process.env.REDIS_HOST || "localhost",
        port: parseInt(process.env.REDIS_PORT) || 6379
      };

const worker = new Worker('file-upload-queue',
    async job => {
        console.log("Processing job:", job.id)
        const data = JSON.parse(job.data);

        const loader = new PDFLoader(data.path);
        const docs = await loader.load();
        
        const embeddings = new HuggingFaceInferenceEmbeddings({
            apiKey: process.env.HUGGINGFACEHUB_API_KEY,
            model: "Qwen/Qwen3-Embedding-8B",
            provider: "nebius",
        });

        const vectorStore = await QdrantVectorStore.fromExistingCollection(embeddings, {
            url: process.env.QDRANT_URL || "http://localhost:6333",
            collectionName: "pdf-docs",
        });

        await vectorStore.addDocuments(docs);
        console.log("Documents added to vector store for job:", job.id)
    },
    {
        concurrency: 100,
        connection: redisConnection
    }
);

worker.on('completed', job => {
    console.log(`Job ${job.id} completed`);
});

worker.on('failed', (job, err) => {
    console.error(`Job ${job.id} failed:`, err);
});