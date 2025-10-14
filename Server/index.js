import 'dotenv/config';
import express from 'express'
import cors from 'cors'
import multer from 'multer'
import { Queue } from "bullmq";
import { QdrantVectorStore } from "@langchain/qdrant";
import { HuggingFaceInferenceEmbeddings } from "@langchain/community/embeddings/hf";
import { ChatGroq } from "@langchain/groq";

const queue = new Queue("file-upload-queue", {
    connection: {
        host: "localhost",
        port: "6379"
    }
});

const client = new ChatGroq({
    model: "moonshotai/kimi-k2-instruct-0905",
    temperature: 0,
    apiKey: process.env.GROQ_API_KEY
});

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'uploads/')
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9)
        cb(null, `${uniqueSuffix}-${file.originalname}`)
    }
})
const upload = multer({ storage: storage })

const app = express()
app.use(cors())

app.get('/', (req, res) => {
    return res.json({ status: "All Good " })
})

const PORT = 5000
app.listen(PORT, () => {
    console.log(`Server started on PORT: ${PORT}`)
})

app.post('/upload/pdf', upload.single('pdf'), async (req, res) => {
    await queue.add("file-ready", JSON.stringify({
        filename: req.file.originalname,
        destination: req.file.destination,
        path: req.file.path
    }))
    return res.json({ message: 'File uploaded' })
})

app.get(`/chat`, async (req, res) => {
    const userQuery = req.query.message;
    const embeddings = new HuggingFaceInferenceEmbeddings({
        apiKey: process.env.HUGGINGFACEHUB_API_KEY, // or omit to rely on default env pickup
        model: "Qwen/Qwen3-Embedding-8B", // Defaults to `BAAI/bge-base-en-v1.5` if not provided
        provider: "nebius", // Falls back to auto selection mechanism within Hugging Face's inference API if not provided
    });
    const vectorStore = await QdrantVectorStore.fromExistingCollection(embeddings, {
        url: "http://localhost:6333",
        collectionName: "pdf-docs",
    });
    const retriever = vectorStore.asRetriever({
        // Optional filter
        // filter: filter,
        k: 2,
    });
    const result = await retriever.invoke(userQuery);
    const SYSTEM_PROMPT = `
        You are a helpfull AI Assistant who answeres the user query based on the available context from PDF file.
        Context : ${JSON.stringify(result)}
      `
    const chatResult = await client.invoke(
        [
            {
                role: "system",
                content:
                    `${SYSTEM_PROMPT}`
            },
            { role: "user", content: `${userQuery}` },
        ]
    )
    const resultData = { message: chatResult, docs: result }
    return res.json({ resultData })
})

