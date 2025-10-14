# PDF Chat Application with RAG

A Node.js application that enables users to upload PDF documents and chat with them using Retrieval-Augmented Generation (RAG). The system processes PDFs asynchronously, stores document embeddings in a vector database, and provides intelligent responses based on the document content.

## Features

- **PDF Upload & Processing**: Upload PDF files via REST API
- **Asynchronous Processing**: Uses BullMQ for queue-based PDF processing
- **Vector Storage**: Stores document embeddings in Qdrant vector database
- **Intelligent Chat**: Query uploaded PDFs using natural language
- **RAG Implementation**: Retrieves relevant context and generates accurate responses
- **Scalable Architecture**: Worker-based processing with configurable concurrency

## Tech Stack

- **Runtime**: Node.js with ES modules
- **Framework**: Express.js
- **Queue System**: BullMQ with Redis
- **Vector Database**: Qdrant
- **Embeddings**: HuggingFace Inference API (Qwen/Qwen3-Embedding-8B)
- **LLM**: Groq (moonshotai/kimi-k2-instruct-0905)
- **Document Processing**: LangChain
- **File Handling**: Multer

## Prerequisites

Before running the application, ensure you have the following installed:

- Node.js (v18 or higher)
- Redis (v6 or higher)
- Qdrant vector database
- npm or yarn

## Installation

1. **Clone the repository**
```bash
git clone <repository-url>
cd <project-directory>
```

2. **Install dependencies**
```bash
npm install
```

3. **Create required directories**
```bash
mkdir uploads
```

4. **Set up environment variables**

Create a `.env` file in the root directory:

```env
GROQ_API_KEY=your_groq_api_key_here
HUGGINGFACEHUB_API_KEY=your_huggingface_api_key_here
```

## Setup Services

### 1. Start Redis

```bash
# Using Docker
docker run -d -p 6379:6379 redis:latest

# Or using local installation
redis-server
```

### 2. Start Qdrant

```bash
# Using Docker
docker run -p 6333:6333 qdrant/qdrant

# Or download from https://qdrant.tech/documentation/quick-start/
```

### 3. Create Qdrant Collection

Before running the application, create a collection in Qdrant:

```bash
curl -X PUT 'http://localhost:6333/collections/pdf-docs' \
  -H 'Content-Type: application/json' \
  -d '{
    "vectors": {
      "size": 1024,
      "distance": "Cosine"
    }
  }'
```

## Running the Application

### Start the Express Server

```bash
node server.js
```

Server will start on `http://localhost:5000`

### Start the Worker Process

In a separate terminal:

```bash
node worker.js
```

## API Endpoints

### 1. Health Check

```http
GET /
```

**Response:**
```json
{
  "status": "All Good "
}
```

### 2. Upload PDF

```http
POST /upload/pdf
Content-Type: multipart/form-data
```

**Parameters:**
- `pdf`: PDF file (form-data)

**Example using cURL:**
```bash
curl -X POST http://localhost:5000/upload/pdf \
  -F "pdf=@/path/to/your/document.pdf"
```

**Response:**
```json
{
  "message": "File uploaded"
}
```

### 3. Chat with PDF

```http
GET /chat?message=<your_question>
```

**Parameters:**
- `message`: Your question about the uploaded PDF (query parameter)

**Example:**
```bash
curl "http://localhost:5000/chat?message=What%20is%20the%20main%20topic%20of%20the%20document?"
```

**Response:**
```json
{
  "resultData": {
    "message": {
      "content": "AI-generated answer based on PDF content"
    },
    "docs": [
      {
        "pageContent": "Relevant excerpt from PDF",
        "metadata": {...}
      }
    ]
  }
}
```

## Architecture

### Server Flow (server.js)

1. Receives PDF upload via `/upload/pdf` endpoint
2. Stores file using Multer with unique filename
3. Adds job to BullMQ queue with file metadata
4. Returns success response immediately

### Worker Flow (worker.js)

1. Polls BullMQ queue for new jobs
2. Loads PDF using PDFLoader
3. Generates embeddings using HuggingFace API
4. Stores embeddings in Qdrant vector database
5. Processes up to 100 jobs concurrently

### Chat Flow

1. Receives user query via `/chat` endpoint
2. Generates query embedding
3. Retrieves top 2 similar document chunks from Qdrant
4. Constructs system prompt with retrieved context
5. Sends prompt to Groq LLM
6. Returns AI-generated response with source documents

## Configuration

### Adjust Worker Concurrency

Modify `concurrency` in `worker.js`:

```javascript
{
  concurrency: 100, // Adjust based on your system resources
  connection: {
    host: "localhost",
    port: "6379"
  }
}
```

### Adjust Retrieval Parameters

Modify retriever settings in `server.js`:

```javascript
const retriever = vectorStore.asRetriever({
  k: 2, // Number of documents to retrieve
});
```

### Change LLM Model

Update model in `server.js`:

```javascript
const client = new ChatGroq({
  model: "moonshotai/kimi-k2-instruct-0905", // Change to your preferred model
  temperature: 0,
  apiKey: process.env.GROQ_API_KEY
});
```

## Project Structure

```
.
├── server.js           # Express API server
├── worker.js           # BullMQ worker for PDF processing
├── uploads/            # Directory for uploaded PDFs
├── .env               # Environment variables
├── package.json       # Dependencies
└── README.md          # Documentation
```

## Dependencies

```json
{
  "dependencies": {
    "@langchain/community": "^x.x.x",
    "@langchain/core": "^x.x.x",
    "@langchain/groq": "^x.x.x",
    "@langchain/qdrant": "^x.x.x",
    "bullmq": "^x.x.x",
    "cors": "^x.x.x",
    "dotenv": "^x.x.x",
    "express": "^x.x.x",
    "multer": "^x.x.x"
  }
}
```

## Troubleshooting

### Redis Connection Error
- Ensure Redis is running on `localhost:6379`
- Check firewall settings

### Qdrant Connection Error
- Verify Qdrant is running on `localhost:6333`
- Ensure collection `pdf-docs` exists with correct vector size (1024)

### API Key Errors
- Verify environment variables are set correctly in `.env` file
- Check API key validity for Groq and HuggingFace

### Upload Errors
- Ensure `uploads/` directory exists and has write permissions
- Check file size limits in Multer configuration

### Worker Not Processing Jobs
- Verify Redis connection is active
- Check worker.js logs for errors
- Ensure HUGGINGFACEHUB_API_KEY is set

## Future Enhancements

- [ ] Add authentication and user management
- [ ] Support multiple file formats (DOCX, TXT, etc.)
- [ ] Implement document deletion
- [ ] Add chat history persistence
- [ ] Create web UI for easier interaction
- [ ] Add document chunking strategies
- [ ] Implement streaming responses
- [ ] Add support for multiple collections per user

## License

MIT License

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request