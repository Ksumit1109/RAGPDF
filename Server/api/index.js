import { handle } from "langcorn";
import express from "express";
import cors from "cors";
import multer from "multer";
import { Queue } from "bullmq";
import { QdrantVectorStore } from "@langchain/qdrant";
import { HuggingFaceInferenceEmbeddings } from "@langchain/community/embeddings/hf";
import { ChatGroq } from "@langchain/groq";
import "dotenv/config";


const redisConnection = process.env.REDIS_URL
  ? {
    url: process.env.REDIS_URL,
    tls: {} // Required for Upstash
  }
  : {
    host: process.env.REDIS_HOST || "localhost",
    port: parseInt(process.env.REDIS_PORT) || 6379
  };

const queue = new Queue("file-upload-queue", {
  connection: redisConnection,
});

const client = new ChatGroq({
  model: "moonshotai/kimi-k2-instruct-0905",
  temperature: 0,
  apiKey: process.env.GROQ_API_KEY,
});

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "/tmp/");
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, `${uniqueSuffix}-${file.originalname}`);
  },
});

const upload = multer({ storage });
const app = express();
app.use(cors());
app.use(express.json());

app.get("/", (req, res) => res.json({ status: "OK" }));

app.post("/upload/pdf", upload.single("pdf"), async (req, res) => {
  try {
    console.log("[API] Upload received:", {
      originalname: req.file?.originalname,
      destination: req.file?.destination,
      path: req.file?.path,
      size: req.file?.size,
    });
    await queue.add("file-ready", {
      filename: req.file.originalname,
      destination: req.file.destination,
      path: req.file.path,
    });
    console.log("[API] Job enqueued for Qdrant ingestion");
    return res.json({ message: "File uploaded" });
  } catch (error) {
    console.error("Upload error:", error);
    return res.status(500).json({ error: "Upload failed" });
  }
});

app.get("/chat", async (req, res) => {
  try {
    const userQuery = req.query.message;

    const embeddings = new HuggingFaceInferenceEmbeddings({
      apiKey: process.env.HUGGINGFACEHUB_API_KEY,
      model: "Qwen/Qwen3-Embedding-8B",
      provider: "nebius",
    });

    console.log("[API] Retrieval start for query:", userQuery)
    const vectorStore = await QdrantVectorStore.fromExistingCollection(
      embeddings,
      {
        url: process.env.QDRANT_URL,
        collectionName: "pdf-docs",
      }
    );

    const retriever = vectorStore.asRetriever({ k: 2 });
    const result = await retriever.invoke(userQuery);
    console.log("[API] Retrieved docs count:", Array.isArray(result) ? result.length : 0);

    const SYSTEM_PROMPT = `
      You are a helpful AI assistant who answers the user query based on context from PDF.
      Context: ${JSON.stringify(result)}
    `;

    const chatResult = await client.invoke([
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: userQuery },
    ]);

    const resultData = { message: chatResult, docs: result };
    return res.json({ resultData });
  } catch (error) {
    console.error("Chat error:", error);
    return res.status(500).json({ error: "Chat failed" });
  }
});

// export handlers for Vercel
export const GET = handle(app);
export const POST = handle(app);
