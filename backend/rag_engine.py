import os
from langchain_google_genai import ChatGoogleGenerativeAI, GoogleGenerativeAIEmbeddings
from langchain_chroma import Chroma
from langchain_core.messages import HumanMessage, SystemMessage
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

class RAGEngine:
    def __init__(self):
       
        current_dir = os.path.dirname(os.path.abspath(__file__))
        self.persistent_directory = os.path.join(
            current_dir, "db", "chroma_db_with_metadata")
        
        
        self.embeddings = GoogleGenerativeAIEmbeddings(
            google_api_key=os.getenv("GOOGLE_API_KEY"),
            model="embedding-001"
        )
        
        
        self.model = ChatGoogleGenerativeAI(
            model="gemini-1.5-flash",
            google_api_key=os.getenv("GOOGLE_API_KEY"),
            temperature=0.3,
            convert_system_message_to_human=True  
        )
        
       
        self.db = Chroma(
            persist_directory=self.persistent_directory,
            embedding_function=self.embeddings
        )
        
       
        self.retriever = self.db.as_retriever(
            search_type="similarity",
            search_kwargs={"k": 3},
        )
    
    def answer_question(self, question):
        """Answer a question using RAG."""
      
        relevant_docs = self.retriever.invoke(question)
        
       
        combined_input = (
            "Here are some documents that might help answer the question: "
            + question
            + "\n\nRelevant Documents:\n"
            + "\n\n".join([doc.page_content for doc in relevant_docs])
            + "\n\nPlease provide a comprehensive answer based only on the provided documents. "
            + "If the answer is not found in the documents, respond with 'I don't have enough information to answer this question.'"
        )
        
        
        messages = [
            SystemMessage(content="You are a helpful assistant that answers questions based on provided documents."),
            HumanMessage(content=combined_input),
        ]
        
        
        result = self.model.invoke(messages)
        
        return result.content