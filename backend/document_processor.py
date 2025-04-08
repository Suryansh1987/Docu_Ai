import os
import uuid
import sys
import logging
import traceback
import subprocess
import time
from dotenv import load_dotenv
from langchain_community.document_loaders import PyPDFLoader, TextLoader, Docx2txtLoader
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain_google_genai import GoogleGenerativeAIEmbeddings
from langchain_chroma import Chroma
import requests


logging.basicConfig(level=logging.INFO, 
                   format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


try:
    load_dotenv()
    logger.info("Environment variables loaded from .env file")
except Exception as e:
    logger.warning(f"Error loading .env file: {str(e)}")


api_key = os.getenv("GOOGLE_API_KEY")
if not api_key:
    logger.error("GOOGLE_API_KEY not found. Ensure it is set in the .env file.")
    sys.exit(1)


current_dir = os.path.dirname(os.path.abspath(__file__))
persistent_directory = os.path.join(current_dir, "db", "chroma_db_with_metadata")
os.makedirs(persistent_directory, exist_ok=True)


def initialize_embeddings(max_retries=3, retry_delay=2):
    """Initialize embeddings with retry logic"""
    for attempt in range(max_retries):
        try:
            embeddings = GoogleGenerativeAIEmbeddings(
                google_api_key=api_key,
                model="embedding-001"
            )
          
            _ = embeddings.embed_query("test")
            logger.info("Google embeddings initialized and tested successfully")
            return embeddings
        except (requests.exceptions.ConnectionError, requests.exceptions.Timeout) as e:
            logger.warning(f"Connection error on attempt {attempt+1}/{max_retries}: {str(e)}")
            if attempt < max_retries - 1:
                logger.info(f"Retrying in {retry_delay} seconds...")
                time.sleep(retry_delay)
                retry_delay *= 2  
            else:
                logger.error("Failed to initialize embeddings after multiple attempts")
                raise
        except Exception as e:
            logger.error(f"Error initializing Google embeddings: {str(e)}")
            raise

try:
    embeddings = initialize_embeddings()
except Exception as e:
    logger.error(f"Fatal error initializing embeddings: {str(e)}")
    sys.exit(1)

def install_dependency(package):
    """Installs missing dependencies."""
    subprocess.check_call([sys.executable, "-m", "pip", "install", package])

def validate_pdf(file_path):
    """Validates if the PDF can be read using multiple methods."""
    try:
        # First try with pypdf
        import pypdf
        with open(file_path, 'rb') as f:
            pdf = pypdf.PdfReader(f)
            page_count = len(pdf.pages)
            logger.info(f"PDF validation successful with pypdf. Pages: {page_count}")
            return True
    except Exception as e:
        logger.warning(f"pypdf validation failed: {str(e)}. Trying PyMuPDF...")
        
        # Try with PyMuPDF as fallback
        try:
            import fitz
            doc = fitz.open(file_path)
            page_count = len(doc)
            doc.close()
            logger.info(f"PDF validation successful with PyMuPDF. Pages: {page_count}")
            return True
        except Exception as e2:
            logger.error(f"PDF validation failed with all methods: {str(e2)}")
            return False

def process_document(file_path, original_filename):
    """Processes a document and stores it in the vector database."""
    logger.info(f"Processing document: {original_filename} from path: {file_path}")
    
    if not os.path.exists(file_path):
        logger.error(f"File not found: {file_path}")
        return None
    
    file_extension = os.path.splitext(file_path)[1].lower()
    logger.info(f"File extension: {file_extension}")
    
   
    if file_extension == '.pdf' and not validate_pdf(file_path):
        return None
    
    try:
        if file_extension == '.pdf':
            loader = PyPDFLoader(file_path)
        elif file_extension == '.txt':
            loader = TextLoader(file_path)
        elif file_extension in ['.docx', '.doc']:
            loader = Docx2txtLoader(file_path)
        else:
            raise ValueError(f"Unsupported file type: {file_extension}")
        
        documents = loader.load()
        logger.info(f"Loaded {len(documents)} document segments")
        
        
        text_splitter = RecursiveCharacterTextSplitter(
            chunk_size=10000,  
            chunk_overlap=1000,  
            length_function=len,
        )
        chunks = text_splitter.split_documents(documents)
        logger.info(f"Split into {len(chunks)} chunks")
        
        
        doc_id = str(uuid.uuid4())
        for i, chunk in enumerate(chunks):
            chunk.metadata.update({
                "document_id": doc_id,
                "filename": original_filename,
                "chunk_id": i
            })
        
      
        max_retries = 3
        retry_delay = 2
        for attempt in range(max_retries):
            try:
                logger.info(f"Attempt {attempt+1}/{max_retries} to store documents in vector DB")
                db = Chroma(persist_directory=persistent_directory, embedding_function=embeddings)
                
              
                batch_size = 5
                for i in range(0, len(chunks), batch_size):
                    batch = chunks[i:i+batch_size]
                    logger.info(f"Processing batch {i//batch_size + 1}/{(len(chunks)-1)//batch_size + 1} with {len(batch)} chunks")
                    db.add_documents(batch)
                    time.sleep(1)  
                
                db.persist()
                logger.info(f"Document stored in vector DB with ID: {doc_id}")
                return doc_id
            except (requests.exceptions.ConnectionError, requests.exceptions.Timeout) as e:
                logger.warning(f"Connection error on attempt {attempt+1}/{max_retries}: {str(e)}")
                if attempt < max_retries - 1:
                    logger.info(f"Retrying in {retry_delay} seconds...")
                    time.sleep(retry_delay)
                    retry_delay *= 2  
                else:
                    logger.error("Failed to store documents after multiple attempts")
                    raise
            except Exception as e:
                logger.error(f"Error processing document: {str(e)}")
                logger.error(traceback.format_exc())
                raise
        
        return None
    except Exception as e:
        logger.error(f"Error processing document: {str(e)}")
        logger.error(traceback.format_exc())
        return None

def debug_vector_retrieval(query, k=5):
    """Tests the retrieval system by running a sample query."""
    try:
        db = Chroma(persist_directory=persistent_directory, embedding_function=embeddings)
        results = db.similarity_search(query, k=k)
        logger.info("Retrieved Documents:")
        for res in results:
            logger.info(res.page_content[:500])  
    except Exception as e:
        logger.error(f"Error in retrieval: {str(e)}")
        logger.error(traceback.format_exc())

if __name__ == "__main__":
    test_query = "What is financial time series?"
    debug_vector_retrieval(test_query)
