import os
import logging
import sys
import time
from werkzeug.utils import secure_filename
print(f"Python executable: {sys.executable}")
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain_google_genai import GoogleGenerativeAIEmbeddings, ChatGoogleGenerativeAI
from langchain_community.vectorstores import FAISS
from langchain.chains.combine_documents import create_stuff_documents_chain
from langchain.chains import create_retrieval_chain
from langchain.prompts import PromptTemplate
from dotenv import load_dotenv
from langchain_core.documents import Document

import fitz  

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

load_dotenv()
logger.info("Environment variables loaded")

app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": ["http://localhost:3000", "http://127.0.0.1:3000"]}})


google_api_key = os.getenv('GOOGLE_API_KEY')
if not google_api_key:
    logger.error("No Google API key found. Please set the GOOGLE_API_KEY environment variable.")
    google_api_key = "" 

logger.info(f"API key available: {bool(google_api_key)}")
vectorstore_path = "vectorstore/faiss_index"


def load_pdf_with_pymupdf(file_path):
    """Load PDF with PyMuPDF and convert to Document objects."""
    try:
        logger.info(f"Loading PDF with PyMuPDF: {file_path}")
        doc = fitz.open(file_path)
        docs = []
        
        for i, page in enumerate(doc):
            text = page.get_text()
            if text.strip():  
                metadata = {"source": file_path, "page": i}
                docs.append(Document(page_content=text, metadata=metadata))
        
        logger.info(f"Successfully loaded {len(docs)} pages with PyMuPDF")
        return docs
    except Exception as e:
        logger.error(f"Error loading PDF with PyMuPDF: {str(e)}")
        raise

def process_pdf(file_path, append_to_existing=False):
    try:
        logger.info(f"Processing PDF file: {file_path}")
        
        # Check for API key before processing
        if not google_api_key:
            raise RuntimeError("Google API key is missing. Please set the GOOGLE_API_KEY environment variable.")
        
        # Try with PyMuPDF first
        try:
            docs = load_pdf_with_pymupdf(file_path)
        except Exception as mupdf_error:
            logger.warning(f"PyMuPDF failed: {str(mupdf_error)}. Trying alternative methods...")
            
            # Try with other loaders as fallback
            try:
                from langchain_community.document_loaders import PDFMinerLoader
                loader = PDFMinerLoader(file_path)
                docs = loader.load()
                logger.info(f"Loaded {len(docs)} pages from PDF using PDFMinerLoader")
            except Exception as miner_error:
                logger.warning(f"PDFMinerLoader failed: {str(miner_error)}. Trying final method...")
                
                try:
                    from langchain_community.document_loaders import UnstructuredPDFLoader
                    loader = UnstructuredPDFLoader(file_path)
                    docs = loader.load()
                    logger.info(f"Loaded {len(docs)} pages from PDF using UnstructuredPDFLoader")
                except Exception as unstruct_error:
                    logger.error(f"All PDF loading methods failed. Last error: {str(unstruct_error)}")
                    raise RuntimeError("Could not process this PDF with any available method. The file may be corrupted or password-protected.")
        
        if not docs:
            raise RuntimeError("Failed to load document content - no pages extracted. The PDF may contain only images without text or be password-protected.")

        # Improved chunking strategy for better handling of large documents
        text_splitter = RecursiveCharacterTextSplitter(
            chunk_size=1000,  # Smaller chunks
            chunk_overlap=1000,  # Less overlap
            separators=["\n\n", "\n", " ", ""]  # Better splitting on natural breaks
        )
        
        split_docs = text_splitter.split_documents(docs)
        logger.info(f"Split into {len(split_docs)} chunks")

        # Change to Google embeddings with updated model name
        embeddings = GoogleGenerativeAIEmbeddings(
            google_api_key=google_api_key,
            model="models/embedding-001"  # Update model name format here
        )
        logger.info("Created embeddings")
        
        # Check if we should append to existing vectorstore
        if append_to_existing and os.path.exists(vectorstore_path):
            try:
                # Load existing vectorstore
                existing_vectorstore = FAISS.load_local(vectorstore_path, embeddings)
                logger.info(f"Loaded existing vector store from {vectorstore_path}")
                
                # Add new documents to existing vectorstore
                existing_vectorstore.add_documents(split_docs)
                vectorstore = existing_vectorstore
                logger.info(f"Added {len(split_docs)} new chunks to existing vectorstore")
            except Exception as e:
                logger.error(f"Error appending to existing vectorstore: {str(e)}")
                # If there's an error, create a new vectorstore
                vectorstore = FAISS.from_documents(split_docs, embeddings)
                logger.info("Created new FAISS vector store due to error with existing one")
        else:
            # Create new vectorstore
            vectorstore = FAISS.from_documents(split_docs, embeddings)
            logger.info("Created new FAISS vector store")
        
        # Save the vectorstore
        vectorstore.save_local(vectorstore_path)
        logger.info(f"Saved vector store to {vectorstore_path}")
        
        return vectorstore
    except Exception as e:
        logger.error(f"Error processing PDF: {str(e)}")
        raise RuntimeError(f"Error processing PDF: {str(e)}")

def load_vectorstore():
    try:
        if os.path.exists(vectorstore_path):
            logger.info(f"Loading vector store from {vectorstore_path}")

            embeddings = GoogleGenerativeAIEmbeddings(
                google_api_key=google_api_key,
                model="models/embedding-001"  # Update model name format here
            )
            vectorstore = FAISS.load_local(vectorstore_path, embeddings, allow_dangerous_deserialization=True)
            logger.info("Vector store loaded successfully")
            return vectorstore
        logger.warning("No vector store found")
        return None
    except Exception as e:
        logger.error(f"Error loading vector store: {str(e)}")
        return None

@app.route('/upload', methods=['POST'])
def upload_file():
    logger.info("Upload endpoint called")
    
    if not google_api_key:
        return jsonify({"error": "Google API key is missing. Please set the GOOGLE_API_KEY environment variable."}), 401
    
    if 'file' not in request.files:
        logger.warning("No file provided in request")
        return jsonify({"error": "No file provided"}), 400
    
    file = request.files['file']
    if file.filename == '':
        logger.warning("Empty filename provided")
        return jsonify({"error": "No file selected"}), 400
    
    if request.content_length and request.content_length > 1024 * 1024 * 1024:  # 50MB
        logger.warning(f"File too large: {request.content_length / (1024 * 1024):.2f} MB")
        return jsonify({"error": "File too large. Please upload a file smaller than 50MB."}), 413
    
    file_extension = os.path.splitext(file.filename)[1].lower()
    if file_extension != '.pdf':
        logger.warning(f"Unsupported file type: {file_extension}")
        return jsonify({"error": "Only PDF files are currently supported."}), 400
    
    # Create a unique filename to prevent overwriting
    # Extract the base name without extension and add our own extension
    original_filename = secure_filename(file.filename)
    base_name = os.path.splitext(original_filename)[0]
    unique_filename = f"{int(time.time())}_{base_name}.pdf"
    file_path = os.path.join("uploads", unique_filename)
    os.makedirs("uploads", exist_ok=True)
    file.save(file_path)
    logger.info(f"File saved to {file_path}")
    
    try:
        # Process the PDF and add to the existing vectorstore if it exists
        vectorstore = process_pdf(file_path, append_to_existing=True)
        return jsonify({"message": "File processed successfully", "filename": unique_filename})
    except Exception as e:
        error_msg = str(e)
        logger.error(f"Error processing file: {error_msg}")
        
        # Provide more user-friendly error messages
        if "PdfReadError" in error_msg or "Invalid Elementary Object" in error_msg:
            return jsonify({
                "error": "The PDF file appears to be corrupted or in an unsupported format. Please try a different file or convert it to a standard PDF format."
            }), 400
        elif "Could not process" in error_msg:
            return jsonify({
                "error": "Could not process this PDF. The file may be corrupted, password-protected, or in an unsupported format."
            }), 400
        else:
            return jsonify({"error": f"Error processing file: {error_msg}"}), 500

@app.route('/files', methods=['GET'])
def list_files():
    """List all uploaded files in the uploads directory"""
    try:
        uploads_dir = "uploads"
        if not os.path.exists(uploads_dir):
            return jsonify({"files": []})
            
        files = []
        for filename in os.listdir(uploads_dir):
            if filename.endswith('.pdf'):
                file_path = os.path.join(uploads_dir, filename)
                file_stats = os.stat(file_path)
                size_kb = file_stats.st_size / 1024
                size_str = f"{size_kb:.1f} KB" if size_kb < 1024 else f"{size_kb/1024:.1f} MB"
                
                files.append({
                    "name": filename,
                    "size": size_str,
                    "path": f"/uploads/{filename}"
                })
                
        return jsonify({"files": files})
    except Exception as e:
        logger.error(f"Error listing files: {str(e)}")
        return jsonify({"error": "Could not retrieve file list"}), 500

# Remove the second /files route completely
# @app.route('/files', methods=['GET'])
# def get_files():
#     """Return a list of uploaded files."""
#     try:
#         upload_dir = "uploads"
#         if not os.path.exists(upload_dir):
#             return jsonify({"files": []})
#         
#         files = []
#         for filename in os.listdir(upload_dir):
#             file_path = os.path.join(upload_dir, filename)
#             if os.path.isfile(file_path):
#                 file_size = os.path.getsize(file_path)
#                 # Format file size
#                 if file_size < 1024:
#                     size_str = f"{file_size} B"
#                 elif file_size < 1048576:
#                     size_str = f"{file_size/1024:.1f} KB"
#                 else:
#                     size_str = f"{file_size/1048576:.1f} MB"
#                 
#                 files.append({
#                     "name": filename,
#                     "size": size_str,
#                     "path": file_path
#                 })
#         
#         return jsonify({"files": files})
#     except Exception as e:
#         logger.error(f"Error getting files: {str(e)}")
#         return jsonify({"error": "Failed to retrieve files"}), 500
@app.route('/uploads/<filename>', methods=['GET'])
def serve_file(filename):
    """Serve an uploaded file"""
    try:
        from flask import send_from_directory
        return send_from_directory('uploads', filename)
    except Exception as e:
        logger.error(f"Error serving file {filename}: {str(e)}")
        return jsonify({"error": f"Could not retrieve file: {str(e)}"}), 404

@app.route('/ask', methods=['POST'])
def ask_question():
    logger.info("Ask endpoint called")
    
    if not google_api_key:
        return jsonify({"error": "Google API key is missing. Please set the GOOGLE_API_KEY environment variable."}), 401
    
    data = request.get_json()
    question = data.get("question")
    
    if not question:
        logger.warning("No question provided")
        return jsonify({"error": "No question provided"}), 400
    
    vectorstore = load_vectorstore()
    if not vectorstore:
        return jsonify({"error": "No document data available. Please upload a file first."}), 400
    
   
    retriever = vectorstore.as_retriever(
        search_kwargs={
            "k": 5,  
            "fetch_k": 5, 
            "lambda_mult": 0.5,  
        }
    )
    
   
    prompt_template = """
    Answer the following question based only on the provided document excerpts:
    {context}
    
    Question: {input}
    
    If the answer is not contained in the document excerpts, say "I don't see information about that in the document."
    Keep your answer concise and focused on the document content.
    """
    prompt = PromptTemplate.from_template(prompt_template)
    
    
    llm = ChatGoogleGenerativeAI(
        google_api_key=google_api_key,
        model="gemini-1.5-flash",
        temperature=0.3,
        max_output_tokens=300
    )
    
    document_chain = create_stuff_documents_chain(llm, prompt)
    retrieval_chain = create_retrieval_chain(retriever, document_chain)
    
    try:
        response = retrieval_chain.invoke({"input": question})
        answer = response.get("answer", "I couldn't find an answer based on the document.")
      
        answer = answer.encode('ascii', 'ignore').decode('ascii')
        return {"answer": answer}
    except Exception as e:
        error_str = str(e).lower()
        logger.error(f"Error generating answer: {error_str}")
        
       
        if "maximum context length" in error_str or "token limit" in error_str:
            return jsonify({
                "error": "The document is too large to process this question. Please try a more specific question."
            }), 413  
        elif "rate limit" in error_str:
            return jsonify({
                "error": "The service is currently busy. Please try again in a moment."
            }), 429  
        else:
            return jsonify({
                "error": "An error occurred while processing your question. Please try again."
            }), 500

@app.route('/test', methods=['GET'])
def test_endpoint():
    logger.info("Test endpoint called")
    return jsonify({"message": "API is working!"})

# Add this new route to your app.py file

@app.route('/files', methods=['GET'])
def get_files():
    """Return a list of uploaded files."""
    try:
        upload_dir = "uploads"
        if not os.path.exists(upload_dir):
            return jsonify({"files": []})
        
        files = []
        for filename in os.listdir(upload_dir):
            file_path = os.path.join(upload_dir, filename)
            if os.path.isfile(file_path):
                file_size = os.path.getsize(file_path)
                # Format file size
                if file_size < 1024:
                    size_str = f"{file_size} B"
                elif file_size < 1048576:
                    size_str = f"{file_size/1024:.1f} KB"
                else:
                    size_str = f"{file_size/1048576:.1f} MB"
                
                files.append({
                    "name": filename,
                    "size": size_str,
                    "path": file_path
                })
        
        return jsonify({"files": files})
    except Exception as e:
        logger.error(f"Error getting files: {str(e)}")
        return jsonify({"error": "Failed to retrieve files"}), 500

if __name__ == '__main__':
    os.makedirs("uploads", exist_ok=True)
    os.makedirs("vectorstore", exist_ok=True)
    logger.info("Starting Flask server on port 5000")
    app.run(host='0.0.0.0', port=5000, debug=True)
